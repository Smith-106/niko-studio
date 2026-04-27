import { mergeConfig, type UserConfig } from 'vitest/config';

import { baseVitestConfig } from './vitest.config';

const phase2Config: UserConfig = {
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
};

export default mergeConfig(baseVitestConfig, phase2Config);
