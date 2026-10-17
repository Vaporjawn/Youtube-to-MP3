import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const {buildArgs} = createRequire(import.meta.url)('../electron/lib/args.js');

const base = {
    url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
    bitrate: 192,
    downloadFolder: '/Users/me/Music',
    tempFolder: '/tmp/work',
    ffmpegPath: '/app/bin/ffmpeg'
};

describe('buildArgs', () => {
    it('puts the address last, after "--"', () => {
        const args = buildArgs(base);
        expect(args.at(-1)).toBe(base.url);
        expect(args.at(-2)).toBe('--');
        expect(args.filter((arg) => arg === '--')).toHaveLength(1);
    });

    it('asks for mp3 at the chosen bitrate for one video only', () => {
        const args = buildArgs(base);
        expect(args).toContain('--no-playlist');
        expect(args.slice(args.indexOf('-x'), args.indexOf('-x') + 4)).toEqual(['-x', '--audio-format', 'mp3', '--audio-quality']);
        expect(args[args.indexOf('--audio-quality') + 1]).toBe('192K');
    });

    it('ignores the user config files so a stray yt-dlp.conf cannot change behaviour', () => {
        expect(buildArgs(base)[0]).toBe('--ignore-config');
    });

    it('saves into the download folder and works in a separate temp folder', () => {
        const args = buildArgs(base);
        expect(args).toContain('home:/Users/me/Music');
        expect(args).toContain('temp:/tmp/work');
        expect(args[args.indexOf('--ffmpeg-location') + 1]).toBe('/app/bin/ffmpeg');
    });

    it('keeps Windows-illegal characters out of file names', () => {
        expect(buildArgs(base)).toContain('--windows-filenames');
    });

    it('treats a hostile folder name as plain data', () => {
        const args = buildArgs({...base, downloadFolder: '/tmp/$(rm -rf ~) ; & x'});
        expect(args).toContain('home:/tmp/$(rm -rf ~) ; & x');
    });
});
