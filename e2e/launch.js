import {execFileSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {_electron as electron} from '@playwright/test';

/**
 * Starts the app with its own empty profile and download folder. Set APP_EXECUTABLE to run a packaged build
 * instead of the source checkout. The window stays hidden.
 */
export async function launchApp({bitrate = 192} = {}) {
    const root = mkdtempSync(join(tmpdir(), 'ytmp3-e2e-'));
    const userData = join(root, 'profile');
    const downloads = join(root, 'Music');
    mkdirSync(userData);
    mkdirSync(downloads);
    writeFileSync(join(userData, 'settings.json'), JSON.stringify({bitrate, downloadFolder: downloads}));

    const env = {...process.env, YOUTUBE_TO_MP3_HIDDEN: '1'};
    delete env.ELECTRON_RUN_AS_NODE;

    const executable = process.env.APP_EXECUTABLE;
    const app = await electron.launch(
        executable
            ? {executablePath: executable, args: [`--user-data-dir=${userData}`], env}
            : {args: ['.', `--user-data-dir=${userData}`], env}
    );
    const window = await app.firstWindow();
    const problems = [];
    window.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
    window.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
    });

    return {
        app,
        window,
        downloads,
        userData,
        problems,
        async close() {
            await app.close();
            rmSync(root, {recursive: true, force: true});
        }
    };
}

/** Reads duration and tags of an mp3 with the app's own ffmpeg. */
export function inspectMp3(ffmpegPath, file) {
    try {
        execFileSync(ffmpegPath, ['-hide_banner', '-i', file], {stdio: 'pipe'});
    } catch (error) {
        return String(error.stderr);
    }
    return '';
}
