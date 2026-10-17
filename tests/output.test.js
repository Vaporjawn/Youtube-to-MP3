import {createRequire} from 'node:module';
import {describe, expect, it} from 'vitest';

const {parseLine, createLineSplitter} = createRequire(import.meta.url)('../electron/lib/output.js');

describe('parseLine', () => {
    it('reads titles, including ones containing pipes', () => {
        expect(parseLine('TITLE|A | B | C')).toEqual({type: 'title', title: 'A | B | C'});
    });

    it('reads the final file path', () => {
        expect(parseLine('FILE|/Users/me/Music/Song.mp3\r')).toEqual({type: 'file', filePath: '/Users/me/Music/Song.mp3'});
    });

    it('computes download percent from the total', () => {
        expect(parseLine('PROGRESS|50|200|NA')).toEqual({type: 'download', percent: 25});
    });

    it('falls back to the estimated total', () => {
        expect(parseLine('PROGRESS|50|NA|100')).toEqual({type: 'download', percent: 50});
    });

    it('reports no percent when the size is unknown', () => {
        expect(parseLine('PROGRESS|50|NA|NA')).toEqual({type: 'download', percent: null});
        expect(parseLine('PROGRESS|NA|NA|NA')).toEqual({type: 'download', percent: null});
    });

    it('never goes over 100', () => {
        expect(parseLine('PROGRESS|500|100|NA').percent).toBe(100);
    });

    it('reads post-processing steps', () => {
        expect(parseLine('PP|started|ExtractAudio')).toEqual({type: 'postprocess', status: 'started', processor: 'ExtractAudio'});
    });

    it('ignores everything else', () => {
        expect(parseLine('WARNING: [youtube] something')).toBeNull();
        expect(parseLine('')).toBeNull();
    });
});

describe('createLineSplitter', () => {
    it('joins a line split across chunks', () => {
        const lines = [];
        const splitter = createLineSplitter((line) => lines.push(line));
        splitter.push('TITLE|Hel');
        splitter.push('lo\nPROGRESS|1|2|NA\nPAR');
        splitter.push('TIAL');
        splitter.end();
        expect(lines).toEqual(['TITLE|Hello', 'PROGRESS|1|2|NA', 'PARTIAL']);
    });
});
