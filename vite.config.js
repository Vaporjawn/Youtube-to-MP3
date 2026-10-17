import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// The page lives in src/ so the project-site index.html in the repository root stays separate.
export default defineConfig({
    root: 'src',
    base: './',
    plugins: [react()],
    build: {outDir: '../app', emptyOutDir: true, sourcemap: false}
});
