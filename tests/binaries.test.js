import {chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const {targetKey, executableName, bundledBinDir, compareVersions, createBinaries} = createRequire(import.meta.url)(
    '../electron/lib/binaries.js'
);

let root;
let bundled;
let user;
beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'bin-test-'));
    bundled = join(root, 'bundled');
    user = join(root, 'user');
    mkdirSync(bundled);
});
afterEach(() => rmSync(root, {recursive: true, force: true}));

function bundle(version, content = 'bundled-binary') {
    writeFileSync(join(bundled, 'yt-dlp'), content);
    writeFileSync(join(bundled, 'versions.json'), JSON.stringify({ytDlp: version}));
}

describe('helpers', () => {
    it('names targets the way the resources folders are named', () => {
        expect(targetKey('darwin', 'arm64')).toBe('mac-arm64');
        expect(targetKey('darwin', 'x64')).toBe('mac-x64');
        expect(targetKey('win32', 'x64')).toBe('win-x64');
        expect(targetKey('linux', 'arm64')).toBe('linux-arm64');
    });

    it('adds .exe only on Windows', () => {
        expect(executableName('ffmpeg', 'win32')).toBe('ffmpeg.exe');
        expect(executableName('ffmpeg', 'darwin')).toBe('ffmpeg');
    });

    it('finds the tools in resources when packaged and in resources/bin/<target> from source', () => {
        expect(bundledBinDir({isPackaged: true, resourcesPath: '/r', projectRoot: '/p', platform: 'linux', arch: 'x64'})).toBe(join('/r', 'bin'));
        expect(bundledBinDir({isPackaged: false, resourcesPath: '/r', projectRoot: '/p', platform: 'win32', arch: 'x64'})).toBe(
            join('/p', 'resources', 'bin', 'win-x64')
        );
    });

    it('compares dotted versions numerically', () => {
        expect(compareVersions('2026.08.19', '2026.08.19')).toBe(0);
        expect(compareVersions('2026.08.19', '2026.09.01')).toBe(-1);
        expect(compareVersions('2026.10.01', '2026.9.30')).toBe(1);
        expect(compareVersions('2026.08.19.1', '2026.08.19')).toBe(1);
        expect(compareVersions('2026.08.19', '2026.08.19.1')).toBe(-1);
    });
});

describe('createBinaries.getYtDlpPath', () => {
    it('copies the bundled yt-dlp to the user folder on first use and makes it runnable', () => {
        bundle('2026.08.19');
        const binaries = createBinaries({bundledDir: bundled, userDir: user, platform: 'linux'});
        const path = binaries.getYtDlpPath();
        expect(path).toBe(join(user, 'yt-dlp'));
        expect(readFileSync(path, 'utf8')).toBe('bundled-binary');
        expect(statSync(path).mode & 0o111).not.toBe(0);
        expect(existsSync(`${path}.copy`)).toBe(false);
    });

    it('replaces an older user copy when the app ships a newer yt-dlp', () => {
        bundle('2026.08.19');
        const binaries = createBinaries({bundledDir: bundled, userDir: user, platform: 'linux'});
        binaries.getYtDlpPath();
        writeFileSync(join(user, 'yt-dlp'), 'old');
        writeFileSync(join(user, 'yt-dlp.version'), '2026.01.01');
        binaries.getYtDlpPath();
        expect(readFileSync(join(user, 'yt-dlp'), 'utf8')).toBe('bundled-binary');
    });

    it('keeps a user copy that updated itself past the bundled one', () => {
        bundle('2026.08.19');
        const binaries = createBinaries({bundledDir: bundled, userDir: user, platform: 'linux'});
        binaries.getYtDlpPath();
        writeFileSync(join(user, 'yt-dlp'), 'self-updated');
        binaries.recordYtDlpVersion('2026.09.30');
        binaries.getYtDlpPath();
        expect(readFileSync(join(user, 'yt-dlp'), 'utf8')).toBe('self-updated');
    });

    it('falls back to the bundled copy if the user folder cannot be written', () => {
        bundle('2026.08.19');
        writeFileSync(user, 'a file where the folder should be');
        const binaries = createBinaries({bundledDir: bundled, userDir: user, platform: 'linux'});
        expect(binaries.getYtDlpPath()).toBe(join(bundled, 'yt-dlp'));
    });

    it('points ffmpeg at the bundled binary', () => {
        expect(createBinaries({bundledDir: bundled, userDir: user, platform: 'win32'}).ffmpegPath).toBe(join(bundled, 'ffmpeg.exe'));
    });
});
