import { defineConfig, mergeConfig } from 'vitest/config';

import baseConfig from './vitest.config';

// Mirror the production guard environment used by the release workflow.
process.env.NIKO_ENV ??= 'production';
process.env.NIKO_CORS_PROD_ORIGINS ??= 'https://app.example.com,https://gray.example.com';
process.env.NIKO_GATEWAY_METRICS_ENABLED ??= 'true';

export default mergeConfig(
  baseConfig,
  defineConfig({
    test: {
      pool: 'forks',
      include: [
        'tests/gateway-server.runtime.test.ts',
        'tests/mcp/health-endpoints.test.ts',
        'tests/mcp/workflow-endpoints.integration.test.ts',
        'tests/mcp/workflow-critic-smoke.integration.test.ts',
      ],
    },
  }),
);
