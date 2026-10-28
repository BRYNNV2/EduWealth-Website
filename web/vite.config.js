import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        eksplorasi: resolve(__dirname, 'eksplorasi.html'),
        simulator: resolve(__dirname, 'simulator.html')
      }
    }
  },
  server: {
    port: 5173,
    open: false,
    headers: {
      'Cache-Control': 'no-store'
    }
  }
});
