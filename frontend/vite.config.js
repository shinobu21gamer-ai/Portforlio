import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      // Keep the two local frontends navigable on one preview origin.
      '/hrms': { target: 'http://localhost:3001', changeOrigin: true },
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
    open: true,
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
});
