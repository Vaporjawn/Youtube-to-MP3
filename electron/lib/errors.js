'use strict';

// Ordered: the first matching rule wins. "retryAfterUpdate" marks failures that a newer yt-dlp can fix.
const RULES = [
    {code: 'private', test: /private video/i, message: 'This video is private.'},
    {
        code: 'members',
        test: /members-only|join this channel|available to this channel's members/i,
        message: 'This video is only for channel members.'
    },
    {
        code: 'age',
        test: /confirm your age|age-restricted|inappropriate for some users/i,
        message: 'This video is age-restricted, so it cannot be downloaded without signing in.'
    },
    {
        code: 'bot',
        test: /not a bot/i,
        message:
            'YouTube is asking this connection to prove it is not a bot. Try again later or from a different network.'
    },
    {
        code: 'geo',
        test: /in your country|geo.?restrict/i,
        message: 'This video is not available in your country.'
    },
    {
        code: 'live',
        test: /live event will begin|premieres in|this live event|is not yet available/i,
        message: 'This video is a live stream or premiere that has not finished yet.'
    },
    {
        code: 'unavailable',
        test: /video (is )?unavailable|is unavailable|not available|has been removed|account associated with this video has been terminated|no longer available|copyright/i,
        message: 'This video is unavailable. It may have been removed.'
    },
    {
        code: 'disk',
        test: /no space left|enospc|permission denied|errno 13|read-only file system|errno 28/i,
        message: 'The file could not be saved. Check the download folder and the free disk space.'
    },
    {
        code: 'network',
        test: /getaddrinfo|name resolution|network is unreachable|timed out|connection (reset|refused|aborted)|unable to download (webpage|json)|http error 5\d\d|ssl|certificate|urlopen error/i,
        message: 'Could not reach YouTube. Check your internet connection and try again.'
    }
];

/**
 * Maps yt-dlp's error text to a code and a message a person can act on.
 * Anything unrecognised is treated as "yt-dlp is out of date", which the converter answers by updating yt-dlp.
 */
function classifyError(stderrText) {
    const text = String(stderrText || '');
    for (const rule of RULES) {
        if (rule.test.test(text)) return {code: rule.code, message: rule.message, retryAfterUpdate: false};
    }
    return {
        code: 'unknown',
        message: 'The video could not be converted. YouTube may have changed something, so try updating and run it again.',
        retryAfterUpdate: true
    };
}

/**
 * Keeps the last meaningful lines of yt-dlp's error output for the "details" section.
 */
function summarizeDetail(stderrText) {
    return String(stderrText || '')
        .split(/\r?\n/)
        .filter((line) => line.trim() && !/No supported JavaScript runtime/i.test(line))
        .slice(-6)
        .join('\n');
}

module.exports = {classifyError, summarizeDetail};
