import { defineConfig } from 'vite';

export default defineConfig({
  base: '/agentWorkBook/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: true,
  },
});
