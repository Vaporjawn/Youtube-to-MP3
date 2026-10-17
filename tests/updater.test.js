import {EventEmitter} from 'node:events';
import {createRequire} from 'node:module';
import {PassThrough} from 'node:stream';
import {describe, expect, it, vi} from 'vitest';

const {createUpdater} = createRequire(import.meta.url)('../electron/lib/updater.js');

/**
 * Fake yt-dlp whose --version answers come from `versions` in order and whose -U exits with `updateCode`.
 */
function fakeYtDlp({versions, updateCode = 0, updateText = ''}) {
    const calls = [];
    const spawnProcess = (command, args) => {
        calls.push(args);
        const child = new EventEmitter();
        child.stdout = new PassThrough();
        child.stderr = new PassThrough();
        child.kill = vi.fn();
        setImmediate(() => {
            if (args.includes('--version')) {
                child.stdout.write(`${versions.shift()}\n`);
                child.emit('close', 0);
            } else {
                child.stderr.write(updateText);
                child.emit('close', updateCode);
            }
        });
        return child;
    };
    return {spawnProcess, calls};
}

function setup(options) {
    const {spawnProcess, calls} = fakeYtDlp(options);
    const binaries = {getYtDlpPath: () => '/user/yt-dlp', recordYtDlpVersion: vi.fn()};
    return {updater: createUpdater({binaries, spawnProcess}), binaries, calls};
}

describe('createUpdater.update', () => {
    it('reports an update and records the new version', async () => {
        const {updater, binaries, calls} = setup({versions: ['2026.02.04', '2026.08.19']});
        expect(await updater.update()).toEqual({
            ok: true,
            updated: true,
            version: '2026.08.19',
            message: 'yt-dlp was updated to 2026.08.19.'
        });
        expect(binaries.recordYtDlpVersion).toHaveBeenCalledWith('2026.08.19');
        expect(calls.find((args) => args.includes('-U'))).toEqual(['--ignore-config', '-U']);
    });

    it('reports when already current', async () => {
        const {updater} = setup({versions: ['2026.08.19', '2026.08.19']});
        const result = await updater.update();
        expect(result).toMatchObject({ok: true, updated: false, version: '2026.08.19'});
        expect(result.message).toMatch(/up to date/);
    });

    it('reports a failed check when the updater errors and nothing changed', async () => {
        const {updater} = setup({versions: ['2026.08.19', '2026.08.19'], updateCode: 1, updateText: 'ERROR: Unable to connect'});
        expect(await updater.update()).toEqual({
            ok: false,
            updated: false,
            version: '2026.08.19',
            message: 'Could not check for a newer yt-dlp.'
        });
    });

    it('still counts an update when the updater exits non-zero but the binary did change', async () => {
        const {updater} = setup({versions: ['2026.02.04', '2026.08.19'], updateCode: 1});
        expect(await updater.update()).toMatchObject({ok: true, updated: true});
    });

    it('survives yt-dlp not starting at all', async () => {
        const updater = createUpdater({
            binaries: {getYtDlpPath: () => '/missing', recordYtDlpVersion: vi.fn()},
            spawnProcess: () => {
                throw new Error('spawn ENOENT');
            }
        });
        expect(await updater.update()).toMatchObject({ok: false, updated: false});
    });
});
