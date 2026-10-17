import {createRequire} from 'node:module';
import {describe, expect, it, vi} from 'vitest';

const {buildMenuTemplate} = createRequire(import.meta.url)('../electron/lib/menu.js');

const actions = {
    chooseFolder: vi.fn(),
    openFolder: vi.fn(),
    setBitrate: vi.fn(),
    updateYtDlp: vi.fn(),
    openExternal: vi.fn()
};
const build = (overrides) =>
    buildMenuTemplate({appName: 'YouTube To MP3', platform: 'darwin', isDevelopment: false, settings: {bitrate: 160}, actions, ...overrides});
const find = (template, label) => template.find((item) => item.label === label);

describe('buildMenuTemplate', () => {
    it('checks only the current bitrate', () => {
        const bitrate = find(build(), 'Preferences').submenu.find((item) => item.label === 'Bitrate');
        expect(bitrate.submenu.filter((item) => item.checked).map((item) => item.label)).toEqual(['160 kbps (CD Quality)']);
        bitrate.submenu[0].click();
        expect(actions.setBitrate).toHaveBeenCalledWith(320);
    });

    it('has the app menu on macOS and a File menu elsewhere', () => {
        expect(build()[0].label).toBe('YouTube To MP3');
        for (const platform of ['win32', 'linux']) {
            expect(build({platform})[0]).toEqual({label: 'File', submenu: [{role: 'quit'}]});
        }
    });

    it('offers copy and paste so a link can be pasted', () => {
        const roles = find(build(), 'Edit').submenu.map((item) => item.role);
        expect(roles).toEqual(expect.arrayContaining(['copy', 'paste', 'selectAll']));
    });

    it('only shows developer tools in development', () => {
        expect(find(build(), 'View')).toBeUndefined();
        expect(find(build({isDevelopment: true}), 'View')).toBeDefined();
    });
});
