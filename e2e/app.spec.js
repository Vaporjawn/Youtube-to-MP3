import {existsSync, readdirSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {expect, test} from '@playwright/test';
import {inspectMp3, launchApp} from './launch.js';

const SHORT_VIDEO = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // "Me at the zoo", 19 seconds
const LONGER_VIDEO = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ'; // Big Buck Bunny

const ffmpegPath = process.env.E2E_FFMPEG || join(process.cwd(), 'resources', 'bin', 'mac-arm64', 'ffmpeg');

let session;
test.beforeEach(async () => {
    session = await launchApp();
});
test.afterEach(async () => {
    await session.close();
});

test('opens with the link box and shows the chosen folder and bitrate', async () => {
    const {window, downloads} = session;
    await expect(window.getByLabel('YouTube video link')).toBeVisible();
    await expect(window.getByRole('button', {name: 'Convert to .mp3'})).toBeVisible();
    await expect(window.getByText(`192 kbps · saving to ${downloads}`)).toBeVisible();
    expect(await window.title()).toBe('YouTube To MP3');
    expect(session.problems).toEqual([]);
});

test('the page has no access to Node or Electron internals', async () => {
    const exposed = await session.window.evaluate(() => ({
        require: typeof window.require,
        process: typeof window.process,
        buffer: typeof window.Buffer,
        api: Object.keys(window.api).sort()
    }));
    expect(exposed.require).toBe('undefined');
    expect(exposed.process).toBe('undefined');
    expect(exposed.buffer).toBe('undefined');
    expect(exposed.api).toEqual([
        'cancelConversion',
        'getInfo',
        'getSettings',
        'onProgress',
        'onSettingsChanged',
        'showInFolder',
        'startConversion'
    ]);
});

test('rejects things that are not a single YouTube video link', async () => {
    const {window} = session;
    const input = window.getByLabel('YouTube video link');
    for (const text of ['hello', 'https://example.com/watch?v=aqz-KE-bpKQ', '']) {
        await input.fill(text);
        await window.getByRole('button', {name: 'Convert to .mp3'}).click();
        await expect(window.getByRole('alert')).toHaveText('Paste the link to a single YouTube video.');
    }
    await input.fill('https://www.youtube.com/');
    await window.getByRole('button', {name: 'Convert to .mp3'}).click();
    // Looks like YouTube to the page, but the app refuses it because it is not one video.
    await expect(window.getByRole('alert')).toContainText('does not look like a link to a single YouTube video');
    expect(readdirSync(session.downloads)).toEqual([]);
});

test('converts a real video to an MP3 at the chosen bitrate', async () => {
    const {window, downloads} = session;
    await window.getByLabel('YouTube video link').fill(SHORT_VIDEO);
    await window.keyboard.press('Enter');

    await expect(window.getByRole('progressbar')).toBeVisible();
    await expect(window.getByText('Conversion successful!')).toBeVisible({timeout: 120000});
    await expect(window.getByText('Me at the zoo')).toBeVisible();

    const files = readdirSync(downloads);
    expect(files).toEqual(['Me at the zoo.mp3']);
    const file = join(downloads, files[0]);
    expect(statSync(file).size).toBeGreaterThan(300000);

    const info = inspectMp3(ffmpegPath, file);
    expect(info).toMatch(/Duration: 00:00:19/);
    expect(info).toMatch(/Audio: mp3.*192 kb\/s/);
    expect(info).toMatch(/title\s+: Me at the zoo/);

    await window.getByRole('button', {name: 'Convert another'}).click();
    await expect(window.getByLabel('YouTube video link')).toBeVisible();
    expect(session.problems).toEqual([]);
});

test('Cancel stops the conversion and leaves nothing behind', async () => {
    const {window, downloads} = session;
    await window.getByLabel('YouTube video link').fill(LONGER_VIDEO);
    await window.getByRole('button', {name: 'Convert to .mp3'}).click();
    await window.getByRole('button', {name: 'Cancel'}).click();

    await expect(window.getByLabel('YouTube video link')).toBeVisible({timeout: 30000});
    await window.waitForTimeout(1500);
    expect(readdirSync(downloads)).toEqual([]);
    expect(existsSync(join(downloads, 'Big Buck Bunny.mp3'))).toBe(false);
});

test('shows a clear message for a video that does not exist', async () => {
    const {window, downloads} = session;
    await window.getByLabel('YouTube video link').fill('https://www.youtube.com/watch?v=AAAAAAAAAAA');
    await window.keyboard.press('Enter');
    await expect(window.getByRole('alert')).toContainText(/unavailable|private/i, {timeout: 120000});
    await expect(window.getByRole('button', {name: 'Try again'})).toBeVisible();
    expect(readdirSync(downloads)).toEqual([]);
});
