// Downloads the pinned yt-dlp and ffmpeg builds into resources/bin/<target>/ and checks every download
// against the SHA-256 in scripts/binaries.json. A mismatch stops the build.
//
//   node scripts/fetch-binaries.mjs [target ...]      targets: mac-arm64 mac-x64 win-x64 linux-x64 linux-arm64
//   (no target = the machine this runs on)
import {createHash} from 'node:crypto';
import {chmodSync, createWriteStream, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {unzipSync} from 'fflate';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'scripts', 'binaries.json'), 'utf8'));
const cacheDir = join(root, '.cache', 'binaries');

function hostTarget() {
    const os = {darwin: 'mac', win32: 'win', linux: 'linux'}[process.platform];
    return `${os}-${process.arch}`;
}

function sha256(buffer) {
    return createHash('sha256').update(buffer).digest('hex');
}

const MAX_FAILURES_IN_A_ROW = 6;
const STALL_MS = 30000;

/**
 * Downloads one URL into `partial`, resuming from what is already there. A transfer that stops sending data
 * for STALL_MS is abandoned and retried, so a slow or flaky connection cannot hang the build. Only attempts that
 * get no data at all count towards giving up.
 */
async function downloadWithResume(url, partial) {
    let failuresInARow = 0;
    for (;;) {
        const have = existsSync(partial) ? statSync(partial).size : 0;
        const controller = new AbortController();
        let timer = setTimeout(() => controller.abort(), STALL_MS);
        const touch = () => {
            clearTimeout(timer);
            timer = setTimeout(() => controller.abort(), STALL_MS);
        };

        try {
            const response = await fetch(url, {
                redirect: 'follow',
                signal: controller.signal,
                headers: have > 0 ? {Range: `bytes=${have}-`} : {}
            });
            if (response.status === 416) return; // already complete
            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            const resumed = response.status === 206;
            if (!resumed && have > 0) writeFileSync(partial, '');
            const out = createWriteStream(partial, {flags: resumed ? 'a' : 'w'});
            for await (const chunk of response.body) {
                failuresInARow = 0;
                touch();
                if (!out.write(chunk)) await new Promise((resolve) => out.once('drain', resolve));
            }
            await new Promise((resolve, reject) => out.end((error) => (error ? reject(error) : resolve())));
            clearTimeout(timer);
            return;
        } catch (error) {
            clearTimeout(timer);
            failuresInARow++;
            if (failuresInARow >= MAX_FAILURES_IN_A_ROW) throw new Error(`Download failed for ${url}: ${error.message}`);
            console.log(`  interrupted (${error.name === 'AbortError' ? 'stalled' : error.message}), resuming`);
            await new Promise((resolve) => setTimeout(resolve, 1500 * failuresInARow));
        }
    }
}

async function download(asset) {
    mkdirSync(cacheDir, {recursive: true});
    const cached = join(cacheDir, asset.sha256);
    if (existsSync(cached) && sha256(readFileSync(cached)) === asset.sha256) return readFileSync(cached);

    console.log(`  downloading ${asset.url}`);
    const partial = `${cached}.partial`;
    await downloadWithResume(asset.url, partial);

    const data = readFileSync(partial);
    const actual = sha256(data);
    if (actual !== asset.sha256) {
        rmSync(partial, {force: true});
        throw new Error(`Checksum mismatch for ${asset.url}\n  expected ${asset.sha256}\n  actual   ${actual}`);
    }
    renameSync(partial, cached);
    return data;
}

function writeExecutable(file, data) {
    writeFileSync(file, data);
    chmodSync(file, 0o755);
}

async function fetchTarget(target) {
    const ytDlp = manifest.ytDlp.assets[target];
    const ffmpeg = manifest.ffmpeg.assets[target];
    if (!ytDlp || !ffmpeg) throw new Error(`No pinned binaries for "${target}"`);

    console.log(`[${target}]`);
    const isWindows = target.startsWith('win-');
    const outDir = join(root, 'resources', 'bin', target);
    mkdirSync(outDir, {recursive: true});

    writeExecutable(join(outDir, isWindows ? 'yt-dlp.exe' : 'yt-dlp'), await download(ytDlp));

    const files = unzipSync(new Uint8Array(await download(ffmpeg)), {filter: (file) => file.name === ffmpeg.entry});
    if (!files[ffmpeg.entry]) throw new Error(`"${ffmpeg.entry}" not found in the ffmpeg archive for ${target}`);
    writeExecutable(join(outDir, isWindows ? 'ffmpeg.exe' : 'ffmpeg'), Buffer.from(files[ffmpeg.entry]));

    writeFileSync(
        join(outDir, 'versions.json'),
        JSON.stringify({ytDlp: manifest.ytDlp.version, ffmpeg: manifest.ffmpeg.version}, null, 2)
    );
}

const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : [hostTarget()];
for (const target of targets) await fetchTarget(target);
console.log('Done.');
