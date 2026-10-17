'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Finds the MP3 that was just written to a folder: the newest .mp3 modified since `sinceMs`.
 * Used when the path printed by yt-dlp cannot be trusted, for example after a text encoding mix-up on Windows.
 */
function findNewestMp3(folder, sinceMs) {
    let newest = null;
    try {
        for (const name of fs.readdirSync(folder)) {
            if (!name.toLowerCase().endsWith('.mp3')) continue;
            const file = path.join(folder, name);
            const modified = fs.statSync(file).mtimeMs;
            if (modified >= sinceMs && (newest === null || modified > newest.modified)) newest = {file, modified};
        }
    } catch (e) {
        return null;
    }
    return newest ? newest.file : null;
}

module.exports = {findNewestMp3};
