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
          'mcp/services/graph.ts',
          'mcp/services/memory.ts',
          'graph/index.ts',
          'graph/graph-manager.ts',
          'graph/graph-engine.ts',
          'memory/index.ts',
          'store/openkl-contract.ts',
          'store/index.ts',
          'store/store-manager.ts',
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
