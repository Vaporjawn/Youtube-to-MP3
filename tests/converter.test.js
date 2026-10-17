import {EventEmitter} from 'node:events';
import {existsSync, mkdtempSync, readdirSync, rmSync, utimesSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {PassThrough} from 'node:stream';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

const {createConverter} = createRequire(import.meta.url)('../electron/lib/converter.js');

const URL_OK = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';

let root;
let downloads;
let tempRoot;
let produced;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'conv-test-'));
    downloads = join(root, 'downloads');
    tempRoot = join(root, 'tmp');
    require_mkdirs();
    produced = join(root, 'Big Buck Bunny.mp3');
    writeFileSync(produced, 'mp3');
});
afterEach(() => rmSync(root, {recursive: true, force: true}));

function require_mkdirs() {
    const {mkdirSync} = createRequire(import.meta.url)('node:fs');
    mkdirSync(downloads);
    mkdirSync(tempRoot);
}

/**
 * A stand-in for a yt-dlp process. `script` decides what it prints and when it ends.
 */
function fakeSpawn(scripts) {
    const calls = [];
    const spawnProcess = (command, args, options) => {
        const index = calls.length;
        const child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        child.exitCode = null;
        child.killed = false;
        child.pid = 1000 + index;
        child.kill = vi.fn(() => {
            child.killed = true;
            setImmediate(() => finish(null));
        });
        const finish = (code) => {
            child.exitCode = code === null ? 1 : code;
            child.stdout.end();
            child.stderr.end();
            setImmediate(() => child.emit('close', code));
        };
        calls.push({command, args, options, child});
        const script = scripts[Math.min(index, scripts.length - 1)];
        setImmediate(() => script({child, finish, out: (t) => child.stdout.write(t), err: (t) => child.stderr.write(t)}));
        return child;
    };
    return {spawnProcess, calls};
}

const success = ({out, err, finish}) => {
    out('TITLE|Big Buck Bunny\n');
    out('PROGRESS|50|100|NA\nPROGRESS|100|100|NA\n');
    err('PP|started|ExtractAudio\nPP|finished|ExtractAudio\n');
    out(`FILE|${produced}\n`);
    finish(0);
};

const failWith = (text) => ({err, finish}) => {
    err(`WARNING: [youtube] No supported JavaScript runtime could be found.\n${text}\n`);
    finish(1);
};

function setup(scripts, extra = {}) {
    const {spawnProcess, calls} = fakeSpawn(scripts);
    const events = [];
    const binaries = {ffmpegPath: '/app/ffmpeg', getYtDlpPath: () => '/user/yt-dlp'};
    const updater = {update: vi.fn(async () => ({ok: true, updated: true, version: '2026.09.01'}))};
    const converter = createConverter({
        binaries,
        updater,
        emit: (event) => events.push(event),
        spawnProcess,
        tempRoot,
        ...extra
    });
    return {converter, calls, events, updater};
}

const job = (overrides = {}) => ({url: URL_OK, bitrate: 192, downloadFolder: downloads, ...overrides});

describe('createConverter.convert', () => {
    it('runs yt-dlp and reports title, progress, conversion and the finished file', async () => {
        const {converter, calls, events} = setup([success]);
        const result = await converter.convert(job());

        expect(result).toEqual({ok: true, filePath: produced, title: 'Big Buck Bunny'});
        expect(calls).toHaveLength(1);
        expect(calls[0].command).toBe('/user/yt-dlp');
        expect(calls[0].options.windowsHide).toBe(true);
        expect(events.map((event) => event.stage)).toEqual(['starting', 'downloading', 'downloading', 'downloading', 'converting', 'done']);
        expect(events.filter((event) => event.stage === 'downloading').map((event) => event.percent)).toEqual([0, 50, 100]);
    });

    it('makes yt-dlp talk in UTF-8 so non-English titles survive on Windows', async () => {
        const {converter, calls} = setup([success]);
        await converter.convert(job());
        expect(calls[0].options.env.PYTHONUTF8).toBe('1');
        expect(calls[0].options.env.PYTHONIOENCODING).toBe('utf-8');
    });

    it('finds the new MP3 when the path yt-dlp printed does not exist', async () => {
        const written = join(downloads, 'Caf\u00e9 \u97f3\u697d.mp3');
        const garbled = ({out, finish}) => {
            out('TITLE|Caf\u00e9\n');
            writeFileSync(written, 'mp3');
            out('FILE|C:\\Music\\Caf? ??.mp3\n');
            finish(0);
        };
        const {converter} = setup([garbled]);
        expect(await converter.convert(job())).toMatchObject({ok: true, filePath: written});
    });

    it('does not mistake an old MP3 in the folder for the new one', async () => {
        const old = join(downloads, 'Old.mp3');
        writeFileSync(old, 'mp3');
        utimesSync(old, new Date('2020-01-01'), new Date('2020-01-01'));
        const noFile = ({finish}) => finish(0);
        const {converter} = setup([noFile]);
        expect(await converter.convert(job())).toMatchObject({ok: true, filePath: null});
    });

    it('cleans the address before it reaches yt-dlp', async () => {
        const {converter, calls} = setup([success]);
        await converter.convert(job({url: `${URL_OK}&list=PL1&index=3`}));
        expect(calls[0].args.at(-1)).toBe(URL_OK);
    });

    it('removes its temporary folder afterwards, on success and on failure', async () => {
        const first = setup([success]);
        await first.converter.convert(job());
        expect(readdirSync(tempRoot)).toEqual([]);

        const second = setup([failWith('ERROR: [youtube] abc: Private video')]);
        await second.converter.convert(job());
        expect(readdirSync(tempRoot)).toEqual([]);
    });

    it('refuses a bad address without starting anything', async () => {
        const {converter, calls} = setup([success]);
        const result = await converter.convert(job({url: '--exec rm -rf /'}));
        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('invalid-url');
        expect(calls).toHaveLength(0);
    });

    it('refuses an unsupported bitrate', async () => {
        const {converter, calls} = setup([success]);
        const result = await converter.convert(job({bitrate: 1}));
        expect(result.error.code).toBe('invalid-bitrate');
        expect(calls).toHaveLength(0);
    });

    it('creates a missing download folder and refuses one it cannot use', async () => {
        const {converter} = setup([success]);
        const fresh = join(downloads, 'new', 'deeper');
        expect((await converter.convert(job({downloadFolder: fresh}))).ok).toBe(true);
        expect(existsSync(fresh)).toBe(true);

        const blocked = await converter.convert(job({downloadFolder: join(root, 'tmp', '\0bad')}));
        expect(blocked.error.code).toBe('disk');
    });

    it('explains a private video and does not waste time updating', async () => {
        const {converter, updater, calls} = setup([failWith('ERROR: [youtube] abc: Private video. Sign in if you\'ve been granted access')]);
        const result = await converter.convert(job());
        expect(result.error.code).toBe('private');
        expect(result.error.message).toMatch(/private/i);
        expect(updater.update).not.toHaveBeenCalled();
        expect(calls).toHaveLength(1);
    });

    it('updates yt-dlp and retries once, with a JavaScript runtime, when the failure is unrecognised', async () => {
        const {converter, updater, calls, events} = setup([failWith('ERROR: [youtube] abc: Unable to extract player response'), success]);
        const result = await converter.convert(job());

        expect(result.ok).toBe(true);
        expect(updater.update).toHaveBeenCalledTimes(1);
        expect(calls).toHaveLength(2);
        expect(calls[0].args).not.toContain('--js-runtimes');
        const retry = calls[1].args;
        expect(retry[retry.indexOf('--js-runtimes') + 1]).toMatch(/^node:/);
        expect(retry.indexOf('--js-runtimes')).toBeLessThan(retry.indexOf('--'));
        expect(retry.at(-1)).toBe(URL_OK);
        expect(calls[1].options.env.ELECTRON_RUN_AS_NODE).toBe('1');
        expect(events.map((event) => event.stage)).toContain('updating');
    });

    it('reports the error with details when the retry fails too', async () => {
        const {converter, calls} = setup([failWith('ERROR: [youtube] abc: Unable to extract player response')]);
        const result = await converter.convert(job());
        expect(calls).toHaveLength(2);
        expect(result.ok).toBe(false);
        expect(result.error.code).toBe('unknown');
        expect(result.error.detail).toMatch(/Unable to extract/);
        expect(result.error.detail).not.toMatch(/JavaScript runtime/);
    });

    it('does not try to update again within half an hour', async () => {
        let clock = 1_000_000;
        const {converter, updater} = setup([failWith('ERROR: weird failure')], {now: () => clock});
        await converter.convert(job());
        clock += 5 * 60 * 1000;
        await converter.convert(job());
        expect(updater.update).toHaveBeenCalledTimes(1);
        clock += 40 * 60 * 1000;
        await converter.convert(job());
        expect(updater.update).toHaveBeenCalledTimes(2);
    });

    it('reports a process that cannot start', async () => {
        const converter = createConverter({
            binaries: {ffmpegPath: '/x', getYtDlpPath: () => '/missing'},
            updater: {update: async () => ({ok: false})},
            emit: () => {},
            spawnProcess: () => {
                throw new Error('spawn ENOENT');
            },
            tempRoot
        });
        const result = await converter.convert(job());
        expect(result.ok).toBe(false);
        expect(result.error.detail).toMatch(/ENOENT/);
    });

    it('allows only one conversion at a time', async () => {
        const {converter} = setup([({finish}) => setTimeout(() => finish(0), 30)]);
        const first = converter.convert(job());
        const second = await converter.convert(job());
        expect(second.error.code).toBe('busy');
        await first;
        expect(converter.isRunning()).toBe(false);
    });
});

describe('createConverter.cancel', () => {
    it('stops the process, reports it as cancelled and cleans up', async () => {
        const {converter, calls, updater} = setup([({out}) => out('TITLE|Slow\nPROGRESS|1|100|NA\n')]);
        const running = converter.convert(job());
        await vi.waitFor(() => expect(calls).toHaveLength(1));
        await vi.waitFor(() => expect(readdirSync(tempRoot)).toHaveLength(1));

        converter.cancel();
        const result = await running;

        expect(result).toEqual({ok: false, error: {code: 'cancelled', message: 'Cancelled.', detail: ''}});
        expect(calls[0].child.kill).toHaveBeenCalledWith('SIGTERM');
        expect(updater.update).not.toHaveBeenCalled();
        expect(calls).toHaveLength(1);
        expect(readdirSync(tempRoot)).toEqual([]);
        expect(converter.isRunning()).toBe(false);
    });

    it('does nothing when idle', () => {
        const {converter} = setup([success]);
        expect(() => converter.cancel()).not.toThrow();
    });

    it('lets a new conversion start after a cancel', async () => {
        const {converter, calls} = setup([({out}) => out('TITLE|Slow\n'), success]);
        const first = converter.convert(job());
        await vi.waitFor(() => expect(calls).toHaveLength(1));
        converter.cancel();
        await first;
        expect((await converter.convert(job())).ok).toBe(true);
    });
});
