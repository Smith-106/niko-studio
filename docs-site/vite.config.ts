import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import { copyFileSync } from 'fs';

export default defineConfig({
  base: process.env.VITE_BASE_URL || '/',
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'gh-pages-spa',
      closeBundle() {
        const outDir = path.resolve(__dirname, 'dist');
        const indexHtml = path.join(outDir, 'index.html');
        const notFoundHtml = path.join(outDir, '404.html');
        try {
          copyFileSync(indexHtml, notFoundHtml);
        } catch { /* ignore if index.html doesn't exist */ }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    fs: {
      allow: ['.', '..'],
    },
  },
  publicDir: 'public',
});
