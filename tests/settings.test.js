import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';

const {sanitizeSettings, createSettingsStore, DEFAULT_BITRATE} = createRequire(import.meta.url)('../electron/lib/settings.js');

let dir;
beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'settings-test-'));
});
afterEach(() => rmSync(dir, {recursive: true, force: true}));

describe('sanitizeSettings', () => {
    it('keeps valid values', () => {
        expect(sanitizeSettings({bitrate: 320, downloadFolder: dir}, '/nope')).toEqual({bitrate: 320, downloadFolder: dir});
    });

    it('replaces an unsupported bitrate', () => {
        expect(sanitizeSettings({bitrate: 9999, downloadFolder: dir}, dir).bitrate).toBe(DEFAULT_BITRATE);
        expect(sanitizeSettings({bitrate: '320', downloadFolder: dir}, dir).bitrate).toBe(DEFAULT_BITRATE);
    });

    it('falls back when the folder is missing, relative, or not a string', () => {
        expect(sanitizeSettings({downloadFolder: join(dir, 'missing')}, dir).downloadFolder).toBe(dir);
        expect(sanitizeSettings({downloadFolder: 'relative/path'}, dir).downloadFolder).toBe(dir);
        expect(sanitizeSettings({downloadFolder: 5}, dir).downloadFolder).toBe(dir);
    });

    it('survives non-object input', () => {
        for (const raw of [null, undefined, 'x', 7, []]) {
            expect(sanitizeSettings(raw, dir)).toEqual({bitrate: DEFAULT_BITRATE, downloadFolder: dir});
        }
    });
});

describe('createSettingsStore', () => {
    it('saves and reloads', () => {
        const file = join(dir, 'config', 'settings.json');
        const store = createSettingsStore(file, dir);
        store.update({bitrate: 192});
        expect(createSettingsStore(file, dir).get().bitrate).toBe(192);
    });

    it('starts from defaults when the file is damaged', () => {
        const file = join(dir, 'settings.json');
        writeFileSync(file, '{not json');
        expect(createSettingsStore(file, dir).get()).toEqual({bitrate: DEFAULT_BITRATE, downloadFolder: dir});
    });

    it('rejects a bad update without corrupting the file', () => {
        const file = join(dir, 'settings.json');
        const store = createSettingsStore(file, dir);
        store.update({bitrate: 'loud'});
        expect(JSON.parse(readFileSync(file, 'utf8')).bitrate).toBe(DEFAULT_BITRATE);
    });
});
