/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sentryVitePlugin } from '@sentry/vite-plugin'

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.npm_package_version },
      sourcemaps: { filesToDeleteAfterUpload: ['dist/**/*.map'] },
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
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
    sourcemap: true,
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
    testTimeout: 10_000,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'src-tauri/bin/sidecar/**',
      'src-tauri/target/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/test/**',
        'src/types/**',
        'src/i18n/**',
        'src/styles/**',
      ],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 70,
        statements: 75,
      },
    },
  },
})
