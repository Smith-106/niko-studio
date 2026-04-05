import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        include: [
          'mcp/services/search.ts',
          'mcp/services/memory.ts',
          'search/smart-search.ts',
          'search/hybrid-search.ts',
          'search/vector-search.ts',
          'services/knowledge-service.ts',
          'container/ServiceContainer.ts',
        ],
        thresholds: {
          lines: 80,
          branches: 70,
          functions: 70,
          statements: 80,
        },
      },
    },
  }),
);
