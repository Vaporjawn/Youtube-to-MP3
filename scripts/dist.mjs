// Builds the installers: fetches the pinned binaries, builds the page, then runs electron-builder.
//
//   node scripts/dist.mjs mac|win|linux|all
//
// Output goes to release/. Windows and Linux installers can be built on a Mac; see the README.
import {spawnSync} from 'node:child_process';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PLANS = {
    mac: {targets: ['mac-arm64', 'mac-x64'], builderArgs: ['--mac', '--arm64', '--x64']},
    win: {targets: ['win-x64'], builderArgs: ['--win', '--x64']},
    linux: {targets: ['linux-x64', 'linux-arm64'], builderArgs: ['--linux', '--x64', '--arm64']}
};

// electron-builder downloads Electron and its packaging tools itself and cannot resume a dropped connection.
// Everything it finished downloading is cached, so running it again picks up where it stopped.
function run(command, args, attempts = 1) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        const result = spawnSync(command, args, {cwd: root, stdio: 'inherit', shell: process.platform === 'win32'});
        if (result.status === 0) return;
        if (attempt === attempts) process.exit(result.status ?? 1);
        console.log(`\n${command} failed (attempt ${attempt} of ${attempts}); trying again...\n`);
    }
}

const requested = process.argv[2] || 'all';
const names = requested === 'all' ? Object.keys(PLANS) : [requested];
if (names.some((name) => !PLANS[name])) {
    console.error(`Unknown platform "${requested}". Use mac, win, linux or all.`);
    process.exit(1);
}

run('node', ['scripts/fetch-binaries.mjs', ...names.flatMap((name) => PLANS[name].targets)]);
run('npx', ['vite', 'build']);
for (const name of names) run('npx', ['electron-builder', ...PLANS[name].builderArgs, '--publish', 'never'], 5);
