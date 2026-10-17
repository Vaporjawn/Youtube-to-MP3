import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const {classifyError, summarizeDetail} = createRequire(import.meta.url)('../electron/lib/errors.js');

describe('classifyError', () => {
    it.each([
        ['ERROR: [youtube] abc: Private video. Sign in if you\'ve been granted access', 'private'],
        ['ERROR: [youtube] abc: Video unavailable', 'unavailable'],
        ['ERROR: [youtube] AAAAAAAAAAA: This video is unavailable', 'unavailable'],
        ['ERROR: [youtube] abc: This video has been removed by the uploader', 'unavailable'],
        ['ERROR: [youtube] abc: Sign in to confirm your age. This video may be inappropriate for some users.', 'age'],
        ['ERROR: [youtube] abc: Sign in to confirm you’re not a bot', 'bot'],
        ['ERROR: [youtube] abc: This video is available to this channel\'s members on level: Gold', 'members'],
        ['ERROR: [youtube] abc: The uploader has not made this video available in your country', 'geo'],
        ['ERROR: [youtube] abc: This live event will begin in 3 hours.', 'live'],
        ['ERROR: Unable to download webpage: <urlopen error [Errno 8] nodename nor servname provided>', 'network'],
        ['OSError: [Errno 28] No space left on device', 'disk'],
        ['PermissionError: [Errno 13] Permission denied: \'/Library/x.mp3\'', 'disk']
    ])('recognises %s', (text, code) => {
        const result = classifyError(text);
        expect(result.code).toBe(code);
        expect(result.retryAfterUpdate).toBe(false);
        expect(result.message.length).toBeGreaterThan(10);
    });

    it('treats unknown failures as a reason to update yt-dlp', () => {
        const result = classifyError('ERROR: [youtube] abc: Unable to extract player response; please report this issue');
        expect(result.code).toBe('unknown');
        expect(result.retryAfterUpdate).toBe(true);
    });

    it('handles empty input', () => {
        expect(classifyError('').code).toBe('unknown');
        expect(classifyError(undefined).code).toBe('unknown');
    });
});

describe('summarizeDetail', () => {
    it('drops the harmless JavaScript runtime warning and keeps the last lines', () => {
        const text = [
            'WARNING: [youtube] No supported JavaScript runtime could be found. Only deno is enabled by default',
            ...Array.from({length: 10}, (v, i) => `line ${i}`)
        ].join('\n');
        const detail = summarizeDetail(text);
        expect(detail).not.toMatch(/JavaScript runtime/);
        expect(detail.split('\n')).toHaveLength(6);
        expect(detail.endsWith('line 9')).toBe(true);
    });
});
