/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')
          if (normalizedId.includes('/node_modules/@tiptap/pm/')) {
            return 'vendor-editor-pm'
          }
          if (normalizedId.includes('/node_modules/@tiptap/') || normalizedId.includes('/node_modules/tippy.js/')) {
            return 'vendor-editor'
          }
          if (normalizedId.includes('/node_modules/react-markdown/')) {
            return 'vendor-markdown'
          }
          if (normalizedId.includes('/node_modules/@tanstack/react-virtual/')) {
            return 'vendor-virtual'
          }
          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'vendor-lucide'
          }
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    css: true,
  },
})
