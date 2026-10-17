'use strict';

const fs = require('fs');
const path = require('path');

const BITRATES = [320, 192, 160, 130, 65];
const DEFAULT_BITRATE = 160;

function isDirectory(folder) {
    try {
        return fs.statSync(folder).isDirectory();
    } catch (e) {
        return false;
    }
}

/**
 * Cleans a settings object read from disk or from the renderer. Anything unknown or invalid is dropped
 * so a damaged settings file can never break the app.
 */
function sanitizeSettings(raw, defaultFolder) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const bitrate = BITRATES.includes(source.bitrate) ? source.bitrate : DEFAULT_BITRATE;
    const folder =
        typeof source.downloadFolder === 'string' && path.isAbsolute(source.downloadFolder)
            ? source.downloadFolder
            : defaultFolder;
    return {bitrate, downloadFolder: isDirectory(folder) ? folder : defaultFolder};
}

function createSettingsStore(filePath, defaultFolder) {
    let current;

    try {
        current = sanitizeSettings(JSON.parse(fs.readFileSync(filePath, 'utf8')), defaultFolder);
    } catch (e) {
        current = sanitizeSettings({}, defaultFolder);
    }

    return {
        get: () => ({...current}),
        update(changes) {
            current = sanitizeSettings({...current, ...changes}, defaultFolder);
            try {
                fs.mkdirSync(path.dirname(filePath), {recursive: true});
                fs.writeFileSync(filePath, JSON.stringify(current, null, 2));
            } catch (e) {
                // The choice still applies for this session even when it cannot be saved.
            }
            return {...current};
        }
    };
}

module.exports = {BITRATES, DEFAULT_BITRATE, sanitizeSettings, createSettingsStore};
