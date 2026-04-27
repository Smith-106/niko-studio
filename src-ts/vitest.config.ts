import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const srcTsRoot = fileURLToPath(new URL('./', import.meta.url));

export default defineConfig({
  root: srcTsRoot,
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
  },
  test: {
    globals: true,
    environment: 'node',
    pool: 'forks',
    globalTeardown: 'tests/globalTeardown.ts',
    exclude: [
      '**/.claude/**',
      '**/.ccw/**',
      '**/node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/index.ts',
        '**/types.ts',
        'tests/**',
        '*.config.*',
        'dist/**',
        'verify.js',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80
      }
    },
  },
});
