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
    exclude: [
      '**/.claude/**',
      '**/.ccw/**',
      '**/node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90
      }
    },
  },
});
