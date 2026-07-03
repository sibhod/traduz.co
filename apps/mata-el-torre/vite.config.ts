import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: subpath-safe anywhere (served at /mata-el-torre/ on pages.dev or a custom domain).
  base: './',
  server: { host: true },
});
