import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base: works at sibhod.github.io/traduz.co/ AND a future custom domain.
  base: './',
  server: { host: true },
});
