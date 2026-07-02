import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: subpath-safe anywhere (pages.dev root or a custom domain).
  base: './',
  server: { host: true },
});
