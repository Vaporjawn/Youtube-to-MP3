'use strict';

const {spawn} = require('child_process');

/**
 * Stops a child process together with anything it started. yt-dlp's single-file builds run a second
 * process, and on Windows ending only the first one leaves the second running.
 */
function killProcessTree(child, spawnProcess = spawn, platform = process.platform) {
    if (!child || child.killed || child.exitCode !== null) return;
    if (platform === 'win32' && child.pid) {
        try {
            spawnProcess('taskkill', ['/pid', String(child.pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
            return;
        } catch (e) {
            // Fall through to the plain kill.
        }
    }
    child.kill('SIGTERM');
    const forced = setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
    }, 3000);
    forced.unref();
}

module.exports = {killProcessTree};
