'use strict';

const {spawn} = require('child_process');

function runCapture(command, args, spawnProcess, timeoutMs) {
    return new Promise((resolve) => {
        let output = '';
        let child;
        try {
            child = spawnProcess(command, args, {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
        } catch (e) {
            resolve({code: -1, output: e.message});
            return;
        }
        const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
        child.stdout.on('data', (chunk) => (output += chunk));
        child.stderr.on('data', (chunk) => (output += chunk));
        child.on('error', (error) => {
            clearTimeout(timer);
            resolve({code: -1, output: error.message});
        });
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({code, output});
        });
    });
}

/**
 * Updates the user's copy of yt-dlp with yt-dlp's own updater. YouTube changes often, and a newer
 * yt-dlp is the usual fix when downloads suddenly stop working.
 */
function createUpdater({binaries, spawnProcess = spawn}) {
    async function readVersion(command) {
        const {code, output} = await runCapture(command, ['--version'], spawnProcess, 30000);
        return code === 0 ? output.trim() : null;
    }

    return {
        async update() {
            const command = binaries.getYtDlpPath();
            const before = await readVersion(command);
            const result = await runCapture(command, ['--ignore-config', '-U'], spawnProcess, 180000);
            const after = await readVersion(command);
            if (after) binaries.recordYtDlpVersion(after);

            if (result.code !== 0 && after === before) {
                return {ok: false, updated: false, version: after, message: 'Could not check for a newer yt-dlp.'};
            }
            const updated = Boolean(before && after && before !== after);
            return {
                ok: true,
                updated,
                version: after,
                message: updated ? `yt-dlp was updated to ${after}.` : `yt-dlp is up to date (${after}).`
            };
        }
    };
}

module.exports = {createUpdater};
