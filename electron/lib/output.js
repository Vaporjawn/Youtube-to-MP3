'use strict';

function toNumber(text) {
    const value = Number(text);
    return text !== 'NA' && text !== '' && Number.isFinite(value) ? value : null;
}

/**
 * Reads one line printed by yt-dlp and returns what it means, or null for lines we do not use.
 * The line formats are the ones requested by the templates in args.js.
 */
function parseLine(rawLine) {
    const line = rawLine.replace(/\r$/, '');

    if (line.startsWith('TITLE|')) {
        return {type: 'title', title: line.slice('TITLE|'.length)};
    }

    if (line.startsWith('FILE|')) {
        return {type: 'file', filePath: line.slice('FILE|'.length)};
    }

    if (line.startsWith('PROGRESS|')) {
        const [, downloaded, total, estimate] = line.split('|');
        const done = toNumber(downloaded);
        const size = toNumber(total) || toNumber(estimate);
        if (done === null || !size) return {type: 'download', percent: null};
        return {type: 'download', percent: Math.max(0, Math.min(100, Math.floor((done / size) * 100)))};
    }

    if (line.startsWith('PP|')) {
        const [, status, processor] = line.split('|');
        return {type: 'postprocess', status, processor};
    }

    return null;
}

/**
 * Splits a stream of text chunks into whole lines, holding back a trailing partial line.
 */
function createLineSplitter(onLine) {
    let buffer = '';
    return {
        push(chunk) {
            buffer += chunk;
            const lines = buffer.split(/\n/);
            buffer = lines.pop();
            lines.forEach(onLine);
        },
        end() {
            if (buffer.length > 0) onLine(buffer);
            buffer = '';
        }
    };
}

module.exports = {parseLine, createLineSplitter};
