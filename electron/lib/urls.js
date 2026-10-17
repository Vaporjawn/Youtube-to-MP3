'use strict';

const YOUTUBE_HOSTS = new Set([
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'music.youtube.com',
    'youtube-nocookie.com',
    'www.youtube-nocookie.com',
    'youtu.be',
    'www.youtu.be'
]);

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Pulls the 11 character video id out of a YouTube address.
 * Returns null when the address is not a link to one video.
 */
function extractVideoId(input) {
    if (typeof input !== 'string') return null;
    const text = input.trim();
    if (text.length === 0 || text.length > 2048) return null;

    let url;
    try {
        url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    } catch (e) {
        return null;
    }

    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

    const segments = url.pathname.split('/').filter(Boolean);
    let candidate = null;

    if (url.hostname.toLowerCase().endsWith('youtu.be')) {
        candidate = segments[0];
    } else if (segments[0] === 'watch') {
        candidate = url.searchParams.get('v');
    } else if (['shorts', 'live', 'embed', 'v'].includes(segments[0])) {
        candidate = segments[1];
    }

    return candidate && VIDEO_ID.test(candidate) ? candidate : null;
}

/**
 * Turns whatever the user pasted into a clean single-video address, or explains why not.
 * Dropping every other query parameter keeps playlist and tracking parameters away from yt-dlp.
 */
function normalizeYouTubeUrl(input) {
    const id = extractVideoId(input);
    if (id === null) {
        return {ok: false, message: 'That does not look like a link to a single YouTube video.'};
    }
    return {ok: true, id, url: `https://www.youtube.com/watch?v=${id}`};
}

module.exports = {extractVideoId, normalizeYouTubeUrl};
