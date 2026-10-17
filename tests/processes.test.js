import {createRequire} from 'node:module';
import {describe, expect, it, vi} from 'vitest';

const {killProcessTree} = createRequire(import.meta.url)('../electron/lib/processes.js');

const child = (overrides = {}) => ({pid: 4321, killed: false, exitCode: null, kill: vi.fn(), ...overrides});

describe('killProcessTree', () => {
    it('on Windows ends the whole tree with taskkill, because the single-file yt-dlp runs a second process', () => {
        const spawnProcess = vi.fn();
        const target = child();
        killProcessTree(target, spawnProcess, 'win32');
        expect(spawnProcess).toHaveBeenCalledWith('taskkill', ['/pid', '4321', '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
        expect(target.kill).not.toHaveBeenCalled();
    });

    it('elsewhere sends SIGTERM, then SIGKILL if the process is still running after a few seconds', () => {
        vi.useFakeTimers();
        const spawnProcess = vi.fn();
        const target = child();
        killProcessTree(target, spawnProcess, 'linux');
        expect(target.kill).toHaveBeenCalledWith('SIGTERM');
        expect(spawnProcess).not.toHaveBeenCalled();
        vi.advanceTimersByTime(3100);
        expect(target.kill).toHaveBeenCalledWith('SIGKILL');
        vi.useRealTimers();
    });

    it('does not send SIGKILL when the process already exited', () => {
        vi.useFakeTimers();
        const target = child();
        killProcessTree(target, vi.fn(), 'darwin');
        target.exitCode = 0;
        vi.advanceTimersByTime(3100);
        expect(target.kill).toHaveBeenCalledTimes(1);
        vi.useRealTimers();
    });

    it('falls back to a plain kill when taskkill cannot be started', () => {
        const target = child();
        killProcessTree(target, () => {
            throw new Error('ENOENT');
        }, 'win32');
        expect(target.kill).toHaveBeenCalledWith('SIGTERM');
    });

    it('ignores a missing, finished or already killed process', () => {
        const spawnProcess = vi.fn();
        expect(() => killProcessTree(null, spawnProcess, 'win32')).not.toThrow();
        const done = child({exitCode: 0});
        killProcessTree(done, spawnProcess, 'linux');
        const dead = child({killed: true});
        killProcessTree(dead, spawnProcess, 'linux');
        expect(done.kill).not.toHaveBeenCalled();
        expect(dead.kill).not.toHaveBeenCalled();
        expect(spawnProcess).not.toHaveBeenCalled();
    });
});
