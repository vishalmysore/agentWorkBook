import { defineConfig } from 'vite';

export default defineConfig({
  base: '/agentWorkBook/',
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    target: 'esnext',
    sourcemap: false,
  },
  server: {
    port: 3000,
    open: true,
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
});
