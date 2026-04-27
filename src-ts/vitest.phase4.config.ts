import { mergeConfig, type UserConfig } from 'vitest/config';

import { baseVitestConfig } from './vitest.config';

const phase4Config: UserConfig = {
  test: {
    pool: 'forks',
    include: [
      'tests/mcp/graph-service.test.ts',
      'tests/graph/index.test.ts',
      'tests/mcp/memory-service.test.ts',
      'tests/memory/index.test.ts',
      'tests/store/openkl-contract.test.ts',
      'tests/store/index.test.ts',
      'tests/graph/graph-manager.test.ts',
      'tests/store/store-manager.test.ts',
      'tests/integrations/adapters.test.ts',
      'tests/memory/unified-memory.integration-adapters.test.ts',
      'tests/graph/graph-engine.test.ts',
    ],
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
};

export default mergeConfig(baseVitestConfig, phase4Config);
