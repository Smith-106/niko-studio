import { afterEach, describe, expect, it } from 'vitest';

import { buildConfigAccess, buildGatewayDeps } from '../gateway-server';
import { ConfigManager, getConfigValue as getSharedConfigValue, setConfigValue as setSharedConfigValue } from '../config';
import { ServiceContainer } from '../container/ServiceContainer';
import { ServiceTypes } from '../container/types';

describe('gateway-server runtime wiring', () => {
  afterEach(() => {
    ConfigManager.resetInstance();
  });

  it('buildConfigAccess exposes snake_case config payloads and maps updates back to shared config', () => {
    const access = buildConfigAccess();
    const config = access.getConfig() as Record<string, unknown>;
    const gateway = config['gateway'] as Record<string, unknown>;
    const integration = config['integration'] as Record<string, unknown>;

    expect(gateway['metrics_enabled']).toBe(true);
    expect(gateway['localhost_only']).toBe(true);
    expect(integration['langflow_flow_name']).toBe('niko-search-pilot');

    access.setConfigValue('gateway.metrics_enabled', false);
    access.setConfigValue('integration.langflow_flow_name', 'pilot-from-runtime');

    expect(getSharedConfigValue('gateway.metricsEnabled', true)).toBe(false);
    expect(getSharedConfigValue('integration.langflowFlowName', 'fallback')).toBe('pilot-from-runtime');
    expect(access.getConfigValue('gateway.metrics_enabled')).toBe(false);
  });

  it('buildGatewayDeps wires real service/runtime helpers and seeded MCP configs', () => {
    const container = new ServiceContainer();
    const memoryMock = { healthCheck: async () => ({ status: 'ok' }) };
    const graphMock = { healthCheck: async () => ({ status: 'ok' }) };
    const searchMock = { healthCheck: async () => ({ status: 'ok' }) };
    const workflowMock = { healthCheck: async () => ({ status: 'ok' }) };
    const criticMock = { healthCheck: async () => ({ status: 'ok' }) };

    container.registerMock(ServiceTypes.MemoryEngine, memoryMock);
    container.registerMock(ServiceTypes.GraphEngine, graphMock);
    container.registerMock(ServiceTypes.SearchEngine, searchMock);
    container.registerMock(ServiceTypes.WorkflowEngine, workflowMock);
    container.registerMock(ServiceTypes.CriticEngine, criticMock);

    const deps = buildGatewayDeps(container);

    expect(deps.getEngine('memory')).toBe(memoryMock);
    expect(deps.getEngine('graph')).toBe(graphMock);
    expect(deps.runtimeServerOrder).toContain('skills');
    expect(Array.from(deps.mcpServiceConfigs.keys())).toEqual(
      expect.arrayContaining(['memory', 'graph', 'search', 'workflow', 'critic', 'agent', 'skills']),
    );

    deps.refreshServiceHealthCache({
      memory: 'ok',
      graph: 'ok',
      search: 'ok',
      workflow: 'ok',
      critic: 'ok',
      agent: 'ok',
      skills: 'ok',
    });

    const serialized = deps.serializeServiceConfig(deps.mcpServiceConfigs.get('skills') ?? {}, {
      skills: 'ok',
    }) as Record<string, unknown>;

    expect(serialized).toMatchObject({
      id: 'skills',
      enabled: true,
      builtin: true,
      status: 'ok',
    });
    expect(deps.getMetricsSnapshot()).toHaveProperty('requests_total');
    expect(deps.getObservabilitySnapshot({ memory: 'ok', search: 'ok', workflow: 'ok' }, {})).toHaveProperty('runtime');
  });
});
