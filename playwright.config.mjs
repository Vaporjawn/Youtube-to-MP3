import {defineConfig} from '@playwright/test';

export default defineConfig({
    testDir: 'e2e',
    timeout: 180000,
    workers: 1,
    reporter: 'list',
    use: {trace: 'off'}
});
