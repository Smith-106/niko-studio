import { afterEach, describe, expect, it } from 'vitest';

import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  normalizeServiceConfigPayload,
  updateServiceConfig,
} from '../../mcp/service-config.js';

const originalConfigs = structuredClone(MCP_SERVICE_CONFIGS);
const originalHealthCache = structuredClone(MCP_SERVICE_HEALTH_CACHE);

function restoreMutableState(): void {
  for (const key of Object.keys(MCP_SERVICE_CONFIGS)) {
    if (!(key in originalConfigs)) {
      delete MCP_SERVICE_CONFIGS[key];
    }
  }
  for (const [key, value] of Object.entries(originalConfigs)) {
    MCP_SERVICE_CONFIGS[key] = structuredClone(value);
  }

  for (const key of Object.keys(MCP_SERVICE_HEALTH_CACHE)) {
    if (!(key in originalHealthCache)) {
      delete MCP_SERVICE_HEALTH_CACHE[key];
    }
  }
  for (const [key, value] of Object.entries(originalHealthCache)) {
    MCP_SERVICE_HEALTH_CACHE[key] = value;
  }
}

describe('mcp/service-config branch-gap coverage', () => {
  afterEach(() => {
    restoreMutableState();
  });

  it('falls back to the default transport when the payload transport is blank', () => {
    expect(
      normalizeServiceConfigPayload('memory', {
        transport: '   ',
      }),
    ).toMatchObject({
      serviceId: 'memory',
      path: '/memory',
      transport: 'streamable-http',
    });
  });

  it('preserves the builtin path when updating a builtin service without a path override', () => {
    const updated = updateServiceConfig('memory', {
      name: 'Memory API',
      enabled: true,
      health_url: 'http://memory.local/health',
      transport: 'stdio',
    });

    expect(updated).toEqual({
      serviceId: 'memory',
      name: 'Memory API',
      path: '/memory',
      enabled: true,
      builtin: true,
      healthUrl: 'http://memory.local/health',
      transport: 'stdio',
    });
  });
});
