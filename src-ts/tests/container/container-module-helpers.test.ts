import 'reflect-metadata';

import { describe, expect, it, vi } from 'vitest';

import {
  ContainerModule,
  bindAgentFactory,
  bindBackupManager,
  bindCriticEngine,
  bindGraphEngine,
  bindMCPGateway,
  bindMemoryEngine,
  bindObsidianService,
  bindPersonalizationService,
  bindRevisionService,
  bindSearchEngine,
  bindSessionIntelligenceService,
  bindTokenService,
  bindWorkflowEngine,
} from '../../container/ContainerModule';
import { ServiceTypes } from '../../container/types';

function createBindDouble() {
  const inSingletonScope = vi.fn();
  const to = vi.fn(() => ({ inSingletonScope }));
  const bind = vi.fn(() => ({ to }));
  return { bind, to, inSingletonScope };
}

class DummyImplementation {}

describe('container/ContainerModule helper bindings', () => {
  it('exports a loadable inversify module', () => {
    expect(ContainerModule).toBeDefined();
    expect(typeof ContainerModule).toBe('object');
  });

  it.each([
    ['memory', bindMemoryEngine, ServiceTypes.MemoryEngine],
    ['graph', bindGraphEngine, ServiceTypes.GraphEngine],
    ['search', bindSearchEngine, ServiceTypes.SearchEngine],
    ['workflow', bindWorkflowEngine, ServiceTypes.WorkflowEngine],
    ['critic', bindCriticEngine, ServiceTypes.CriticEngine],
    ['agent factory', bindAgentFactory, ServiceTypes.AgentFactory],
    ['backup', bindBackupManager, ServiceTypes.BackupManager],
    ['token', bindTokenService, ServiceTypes.TokenService],
    ['obsidian', bindObsidianService, ServiceTypes.ObsidianService],
    ['mcp gateway', bindMCPGateway, ServiceTypes.MCPGateway],
    ['revision', bindRevisionService, ServiceTypes.RevisionService],
    ['session intelligence', bindSessionIntelligenceService, ServiceTypes.SessionIntelligenceService],
    ['personalization', bindPersonalizationService, ServiceTypes.PersonalizationService],
  ])('binds %s implementations as singletons', (_label, helper, identifier) => {
    const { bind, to, inSingletonScope } = createBindDouble();

    (helper as (bind: unknown, implementation: new () => unknown) => void)(
      bind,
      DummyImplementation,
    );

    expect(bind).toHaveBeenCalledWith(identifier);
    expect(to).toHaveBeenCalledWith(DummyImplementation);
    expect(inSingletonScope).toHaveBeenCalledTimes(1);
  });
});
