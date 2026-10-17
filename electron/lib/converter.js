'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const {spawn} = require('child_process');

const {normalizeYouTubeUrl} = require('./urls');
const {BITRATES} = require('./settings');
const {buildArgs} = require('./args');
const {parseLine, createLineSplitter} = require('./output');
const {classifyError, summarizeDetail} = require('./errors');
const {killProcessTree} = require('./processes');

const MIN_MS_BETWEEN_AUTOMATIC_UPDATES = 30 * 60 * 1000;

function failure(code, message, detail) {
    return {ok: false, error: {code, message, detail: detail || ''}};
}

/**
 * Runs yt-dlp once and reports what it printed. Resolves with the outcome; it never rejects.
 */
function runYtDlp({command, args, env, spawnProcess, onEvent, onChild}) {
    return new Promise((resolve) => {
        let child;
        try {
            child = spawnProcess(command, args, {env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
        } catch (error) {
            resolve({exitCode: -1, stderr: error.message, filePath: null, title: null});
            return;
        }
        onChild(child);

        let filePath = null;
        let title = null;
        const otherLines = [];
        const handleLine = (line) => {
            const event = parseLine(line);
            if (event === null) {
                if (line.trim()) otherLines.push(line);
                return;
            }
            if (event.type === 'file') filePath = event.filePath;
            if (event.type === 'title') title = event.title;
            onEvent(event);
        };
        const out = createLineSplitter(handleLine);
        const err = createLineSplitter(handleLine);

        child.stdout.on('data', (chunk) => out.push(chunk.toString('utf8')));
        child.stderr.on('data', (chunk) => err.push(chunk.toString('utf8')));
        child.on('error', (error) => {
            resolve({exitCode: -1, stderr: error.message, filePath, title});
        });
        child.on('close', (exitCode) => {
            out.end();
            err.end();
            resolve({exitCode, stderr: otherLines.join('\n'), filePath, title});
        });
    });
}

/**
 * Turns a YouTube link into an MP3 in the download folder. One conversion runs at a time.
 */
function createConverter({binaries, updater, emit, spawnProcess = spawn, tempRoot = os.tmpdir(), now = Date.now}) {
    let activeChild = null;
    let cancelled = false;
    let running = false;
    let lastAutomaticUpdate = -Infinity;

    function jsRuntimeEnvironment() {
        // Electron's own binary can act as the Node runtime yt-dlp uses to solve YouTube's challenges.
        return {
            args: ['--js-runtimes', `node:${process.execPath}`],
            env: {...process.env, ELECTRON_RUN_AS_NODE: '1'}
        };
    }

    async function attempt({url, bitrate, downloadFolder, tempFolder, useJsRuntime}) {
        const runtime = useJsRuntime ? jsRuntimeEnvironment() : {args: [], env: process.env};
        const args = buildArgs({
            url,
            bitrate,
            downloadFolder,
            tempFolder,
            ffmpegPath: binaries.ffmpegPath
        });
        // Options must come before "--", so the runtime flags are placed ahead of it.
        args.splice(args.indexOf('--'), 0, ...runtime.args);

        return runYtDlp({
            command: binaries.getYtDlpPath(),
            args,
            env: runtime.env,
            spawnProcess,
            onChild: (child) => (activeChild = child),
            onEvent: (event) => {
                if (event.type === 'title') emit({stage: 'downloading', title: event.title, percent: 0});
                if (event.type === 'download' && event.percent !== null) {
                    emit({stage: 'downloading', percent: event.percent});
                }
                if (event.type === 'postprocess' && event.status === 'started' && event.processor === 'ExtractAudio') {
                    emit({stage: 'converting', percent: null});
                }
            }
        });
    }

    async function convert({url: rawUrl, bitrate, downloadFolder}) {
        if (running) return failure('busy', 'A conversion is already running.');

        const parsed = normalizeYouTubeUrl(rawUrl);
        if (!parsed.ok) return failure('invalid-url', parsed.message);
        if (!BITRATES.includes(bitrate)) return failure('invalid-bitrate', 'That bitrate is not supported.');

        try {
            fs.mkdirSync(downloadFolder, {recursive: true});
            fs.accessSync(downloadFolder, fs.constants.W_OK);
        } catch (e) {
            return failure('disk', 'The download folder cannot be written to. Choose another one from the Preferences menu.');
        }

        running = true;
        cancelled = false;
        let tempFolder;

        try {
            tempFolder = fs.mkdtempSync(path.join(tempRoot, 'youtube-to-mp3-'));
            emit({stage: 'starting', percent: null});

            const job = {url: parsed.url, bitrate, downloadFolder, tempFolder, useJsRuntime: false};
            let result = await attempt(job);

            if (!cancelled && result.exitCode !== 0) {
                const verdict = classifyError(result.stderr);
                const canUpdate = verdict.retryAfterUpdate && now() - lastAutomaticUpdate > MIN_MS_BETWEEN_AUTOMATIC_UPDATES;
                if (canUpdate) {
                    lastAutomaticUpdate = now();
                    emit({stage: 'updating', percent: null});
                    await updater.update();
                    if (!cancelled) {
                        emit({stage: 'starting', percent: null});
                        result = await attempt({...job, useJsRuntime: true});
                    }
                }
            }

            if (cancelled) return failure('cancelled', 'Cancelled.');
            if (result.exitCode !== 0) {
                const verdict = classifyError(result.stderr);
                return failure(verdict.code, verdict.message, summarizeDetail(result.stderr));
            }

            emit({stage: 'done', percent: 100});
            return {ok: true, filePath: result.filePath, title: result.title};
        } finally {
            running = false;
            activeChild = null;
            if (tempFolder) fs.rmSync(tempFolder, {recursive: true, force: true});
        }
    }

    function cancel() {
        if (!running) return;
        cancelled = true;
        killProcessTree(activeChild);
    }

    return {convert, cancel, isRunning: () => running};
}

module.exports = {createConverter, runYtDlp};
