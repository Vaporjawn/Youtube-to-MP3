import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const {extractVideoId, normalizeYouTubeUrl} = createRequire(import.meta.url)('../electron/lib/urls.js');

const ID = 'aqz-KE-bpKQ';

describe('normalizeYouTubeUrl', () => {
    it.each([
        [`https://www.youtube.com/watch?v=${ID}`],
        [`https://youtube.com/watch?v=${ID}&t=42s`],
        [`https://m.youtube.com/watch?v=${ID}`],
        [`https://music.youtube.com/watch?v=${ID}&list=RDAMVM${ID}`],
        [`https://youtu.be/${ID}?si=abc`],
        [`https://www.youtube.com/shorts/${ID}`],
        [`https://www.youtube.com/live/${ID}`],
        [`https://www.youtube.com/embed/${ID}`],
        [`https://www.youtube-nocookie.com/embed/${ID}`],
        [`youtube.com/watch?v=${ID}`],
        [`  https://youtu.be/${ID}  `],
        [`HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`]
    ])('accepts %s and returns the clean watch address', (input) => {
        expect(normalizeYouTubeUrl(input)).toEqual({
            ok: true,
            id: ID,
            url: `https://www.youtube.com/watch?v=${ID}`
        });
    });

    it('drops playlist and tracking parameters', () => {
        const result = normalizeYouTubeUrl(`https://www.youtube.com/watch?v=${ID}&list=PL123&index=4&utm_source=x`);
        expect(result.url).toBe(`https://www.youtube.com/watch?v=${ID}`);
    });

    it.each([
        [''],
        ['   '],
        ['hello'],
        ['https://www.youtube.com/'],
        ['https://www.youtube.com/playlist?list=PL123'],
        ['https://www.youtube.com/@somechannel'],
        ['https://www.youtube.com/watch?v=short'],
        [`https://www.youtube.com/watch?v=${ID}extra`],
        [`https://youtube.com.evil.example/watch?v=${ID}`],
        [`https://evilyoutube.com/watch?v=${ID}`],
        [`https://example.com/watch?v=${ID}`],
        [`https://www.youtube.com@evil.example/watch?v=${ID}`],
        [`javascript:alert(1)//youtube.com/watch?v=${ID}`],
        [`file:///etc/passwd`],
        [`ftp://youtube.com/watch?v=${ID}`],
        ['--exec calc.exe'],
        [`-o /etc/passwd https://youtu.be/${ID}`],
        ['x'.repeat(5000)],
        [null],
        [undefined],
        [42],
        [{}]
    ])('rejects %s', (input) => {
        const result = normalizeYouTubeUrl(input);
        expect(result.ok).toBe(false);
        expect(result.message).toMatch(/single YouTube video/);
    });

    it('never lets a value that starts with a dash through', () => {
        expect(extractVideoId(`--version`)).toBeNull();
    });
});
