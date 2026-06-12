import { fileURLToPath } from 'node:url';

import { defineConfig, type UserConfig } from 'vitest/config';

const srcTsRoot = fileURLToPath(new URL('./', import.meta.url));

export const baseVitestConfig: UserConfig = {
  root: srcTsRoot,
  esbuild: {
    // Required so v8 coverage can ignore empty/comment-only lines consistently in TS sources.
    include: ['**/*.js', '**/*.jsx', '**/*.mjs', '**/*.ts', '**/*.tsx', '**/*.mts'],
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup-node.ts'],
    testTimeout: 15_000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_OPTIONS: '--max-old-space-size=24576',
    },
    globalSetup: 'tests/globalTeardown.ts',
    exclude: ['**/.claude/**', '**/.ccw/**', '**/node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      ignoreEmptyLines: true,
      reporter: ['text', 'json', 'html'],
      exclude: [
        '**/index.ts',
        '**/types.ts',
        '**/*.d.ts',
        'tests/**',
        '*.config.*',
        '.coverage_runs/**',
        'coverage/**',
        'coverage-*/**',
        '**/coverage-*/**',
        'dist/**',
        '**/lcov-report/**',
        'verify.js',
        'protocols/knowledge.ts',
        'knowledge/protocols.ts',
        'workflow/iworkflow-state-store.ts',
        'search/retrieval-types.ts',
      ],
      thresholds: {
        lines: 80,
        branches: 70,
        functions: 80,
        statements: 80,
      },
    },
  },
};

export default defineConfig(baseVitestConfig);
