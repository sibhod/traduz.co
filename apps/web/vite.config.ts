import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  // Absolute base: deployed at the domain root, not relocatable via relative
  // URLs.
  base: '/',
  plugins: [
    // SPA/static mode: prerendered shell + client bundle, no server output
    // to deploy. MUST come before viteReact().
    // outputPath '/index' emits the shell as dist/client/index.html instead
    // of the default '/_shell' (_shell.html). The default expects a host-level
    // catch-all rewrite, which is forbidden here: a Pages catch-all would
    // swallow /mata-el-torre/.
    tanstackStart({ spa: { enabled: true, prerender: { outputPath: '/index' } } }),
    viteReact(),
  ],
  server: { host: true },
});
