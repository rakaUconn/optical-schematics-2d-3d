import { defineConfig } from 'vite';

// GitHub Pages serves project sites from /<repo-name>/, so the base path
// must match the repo name whenever we're building for production (CI).
// Locally (`npm run dev` / `npm run build` without CI) we keep base at '/'.
export default defineConfig(({ mode }) => ({
  base: process.env.GITHUB_ACTIONS ? '/optical-schematics-2d-3d/' : '/',
  build: {
    outDir: 'dist',
    sourcemap: true
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js']
  }
}));
