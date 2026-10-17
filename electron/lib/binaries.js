'use strict';

const fs = require('fs');
const path = require('path');

function targetKey(platform = process.platform, arch = process.arch) {
    const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : 'linux';
    return `${os}-${arch}`;
}

function executableName(base, platform = process.platform) {
    return platform === 'win32' ? `${base}.exe` : base;
}

/**
 * Folder holding the yt-dlp and ffmpeg that ship with the app.
 * Packaged builds find them in the app's resources; a source checkout uses resources/bin/<target>.
 */
function bundledBinDir({isPackaged, resourcesPath, projectRoot, platform, arch}) {
    return isPackaged ? path.join(resourcesPath, 'bin') : path.join(projectRoot, 'resources', 'bin', targetKey(platform, arch));
}

/**
 * Compares dotted numeric versions such as 2026.08.19 or 2026.08.19.1. Returns -1, 0 or 1.
 */
function compareVersions(a, b) {
    const left = String(a).split('.').map((part) => parseInt(part, 10) || 0);
    const right = String(b).split('.').map((part) => parseInt(part, 10) || 0);
    for (let i = 0; i < Math.max(left.length, right.length); i++) {
        const difference = (left[i] || 0) - (right[i] || 0);
        if (difference !== 0) return difference < 0 ? -1 : 1;
    }
    return 0;
}

function readTextFile(file) {
    try {
        return fs.readFileSync(file, 'utf8').trim();
    } catch (e) {
        return null;
    }
}

/**
 * Locates the tools. yt-dlp is copied into a folder the user can write to, because it updates itself and
 * an installed app's own folder is usually read-only.
 */
function createBinaries({bundledDir, userDir, platform = process.platform}) {
    const ytDlpName = executableName('yt-dlp', platform);
    const bundledYtDlp = path.join(bundledDir, ytDlpName);
    const userYtDlp = path.join(userDir, ytDlpName);
    const versionFile = path.join(userDir, 'yt-dlp.version');

    function bundledVersions() {
        try {
            return JSON.parse(fs.readFileSync(path.join(bundledDir, 'versions.json'), 'utf8'));
        } catch (e) {
            return {};
        }
    }

    function copyBundledYtDlp(version) {
        fs.mkdirSync(userDir, {recursive: true});
        const staging = `${userYtDlp}.copy`;
        fs.copyFileSync(bundledYtDlp, staging);
        fs.chmodSync(staging, 0o755);
        fs.renameSync(staging, userYtDlp);
        fs.writeFileSync(versionFile, version || '0');
    }

    return {
        ffmpegPath: path.join(bundledDir, executableName('ffmpeg', platform)),

        /**
         * Path of the yt-dlp to run: the user's copy, refreshed from the bundled one when the app
         * brings a newer yt-dlp than the copy has.
         */
        getYtDlpPath() {
            const bundledVersion = bundledVersions().ytDlp || '0';
            const installedVersion = readTextFile(versionFile);
            const missing = !fs.existsSync(userYtDlp) || installedVersion === null;
            if (missing || compareVersions(installedVersion, bundledVersion) < 0) {
                try {
                    copyBundledYtDlp(bundledVersion);
                } catch (e) {
                    return bundledYtDlp;
                }
            }
            return userYtDlp;
        },

        recordYtDlpVersion(version) {
            try {
                fs.writeFileSync(versionFile, version);
            } catch (e) {
                // The version note is only a hint for the next launch.
            }
        },

        bundledYtDlp,
        userYtDlp
    };
}

module.exports = {targetKey, executableName, bundledBinDir, compareVersions, createBinaries};
