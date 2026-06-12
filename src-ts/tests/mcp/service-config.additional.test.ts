import { afterEach, describe, expect, it } from 'vitest';

import {
  MCP_SERVICE_CONFIGS,
  MCP_SERVICE_HEALTH_CACHE,
  normalizeServiceConfigPayload,
  refreshServiceHealthCache,
  serializeServiceConfig,
  setServiceEnabled,
  updateServiceConfig,
  validateMcpTransport,
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

describe('mcp/service-config additional coverage', () => {
  afterEach(() => {
    restoreMutableState();
  });

  it('validates transports and normalizes payload fields', () => {
    expect(validateMcpTransport('stdio')).toBe('stdio');
    expect(() => validateMcpTransport('grpc')).toThrow(/Invalid transport/);

    expect(
      normalizeServiceConfigPayload('  Custom-Service  ', {
        name: '  Custom Name  ',
        path: 'custom/path',
        enabled: 0,
        builtin: '',
        health_url: 'http://health.local',
        transport: ' sse ',
      }),
    ).toEqual({
      serviceId: 'custom-service',
      name: 'Custom Name',
      path: '/custom/path',
      enabled: false,
      builtin: false,
      healthUrl: 'http://health.local',
      transport: 'sse',
    });

    expect(() => normalizeServiceConfigPayload('   ', {})).toThrow('service_id is required');
    expect(() => normalizeServiceConfigPayload('demo', { path: '   ' })).toThrow('path is required');
  });

  it('serializes runtime status and refreshes the health cache', () => {
    MCP_SERVICE_HEALTH_CACHE.memory = 'degraded';

    expect(serializeServiceConfig(MCP_SERVICE_CONFIGS.memory)).toMatchObject({
      id: 'memory',
      status: 'degraded',
    });

    const created = updateServiceConfig(
      'custom',
      {
        name: 'Custom',
        path: 'custom',
        enabled: false,
        transport: 'stdio',
      },
      { createIfMissing: true },
    );

    refreshServiceHealthCache({
      memory: 'ok',
      custom: 'ok',
    });

    expect(MCP_SERVICE_HEALTH_CACHE.memory).toBe('ok');
    expect(MCP_SERVICE_HEALTH_CACHE.custom).toBe('disabled');
    expect(serializeServiceConfig(created, { custom: 'ok' })).toMatchObject({
      id: 'custom',
      status: 'disabled',
      transport: 'stdio',
    });
  });

  it('creates and updates custom services while enforcing builtin guards', () => {
    expect(() => updateServiceConfig('missing', {})).toThrow('Unknown service: missing');

    const created = updateServiceConfig(
      'custom',
      {
        name: 'Custom',
        path: 'custom',
        enabled: false,
        transport: 'stdio',
        health_url: 'http://custom.local/health',
      },
      { createIfMissing: true },
    );

    expect(created).toEqual({
      serviceId: 'custom',
      name: 'Custom',
      path: '/custom',
      enabled: false,
      builtin: false,
      healthUrl: 'http://custom.local/health',
      transport: 'stdio',
    });
    expect(MCP_SERVICE_HEALTH_CACHE.custom).toBe('unknown');

    const updated = updateServiceConfig('custom', {
      name: 'Custom V2',
      path: '/custom-v2',
      enabled: true,
      builtin: true,
      transport: 'sse',
      health_url: null,
    });

    expect(updated).toEqual({
      serviceId: 'custom',
      name: 'Custom V2',
      path: '/custom-v2',
      enabled: true,
      builtin: false,
      healthUrl: null,
      transport: 'sse',
    });

    expect(setServiceEnabled('custom', false)).toMatchObject({
      serviceId: 'custom',
      enabled: false,
    });

    expect(() => setServiceEnabled('missing', true)).toThrow('Unknown service: missing');
    expect(() => setServiceEnabled('memory', false)).toThrow('builtin service cannot be disabled');
    expect(() => updateServiceConfig('memory', { path: '/override' })).toThrow(
      'builtin service path is immutable',
    );
    expect(() => updateServiceConfig('memory', { builtin: false })).toThrow(
      'builtin service cannot be downgraded',
    );
  });
});
