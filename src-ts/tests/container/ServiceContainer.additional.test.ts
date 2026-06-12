import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ServiceContainer, resetContainer } from '../../container/ServiceContainer';
import { ServiceTypes } from '../../container/types';

function createInitializable(overrides: Record<string, unknown> = {}) {
  return {
    initialize: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ServiceContainer additional coverage', () => {
  let container: ServiceContainer;

  beforeEach(() => {
    container = new ServiceContainer();
  });

  afterEach(() => {
    container.reset();
    resetContainer();
    vi.restoreAllMocks();
  });

  it('routes uncovered getters through the internal container and mock branches', () => {
    const embeddingService = { kind: 'embedding' };
    const hybridSearch = { kind: 'hybrid' };
    const phaseOrchestrator = { kind: 'phase' };
    const relayService = { kind: 'relay' };
    const internalGet = vi.fn((identifier: symbol) => {
      if (identifier === ServiceTypes.EmbeddingService) return embeddingService;
      if (identifier === ServiceTypes.HybridSearch) return hybridSearch;
      if (identifier === ServiceTypes.PhaseOrchestrator) return phaseOrchestrator;
      if (identifier === ServiceTypes.WebSocketRelayService) return relayService;
      return undefined;
    });

    (
      container as unknown as {
        container: { get: (identifier: symbol) => unknown };
      }
    ).container = { get: internalGet };

    expect(container.embedding).toBe(embeddingService);
    expect(container.hybridSearch).toBe(hybridSearch);
    expect(container.phaseOrchestrator).toBe(phaseOrchestrator);
    expect(container.wsRelay).toBe(relayService);

    const mockPhaseOrchestrator = { mocked: 'phase' };
    const mockRelayService = { mocked: 'relay' };
    container.registerMock(ServiceTypes.PhaseOrchestrator, mockPhaseOrchestrator);
    container.registerMock(ServiceTypes.WebSocketRelayService, mockRelayService);

    expect(container.phaseOrchestrator).toBe(mockPhaseOrchestrator);
    expect(container.wsRelay).toBe(mockRelayService);
  });

  it('logs initialization errors when a service getter throws during pre-warm', async () => {
    container.registerMock(ServiceTypes.MemoryEngine, createInitializable());
    container.registerMock(ServiceTypes.GraphEngine, createInitializable());
    container.registerMock(ServiceTypes.CriticEngine, createInitializable());
    container.registerMock(ServiceTypes.WorkflowEngine, createInitializable());

    Object.defineProperty(container, 'search', {
      configurable: true,
      get() {
        throw new Error('search getter failed');
      },
    });

    await expect(container.initializeAll()).resolves.toBeUndefined();
    expect(container.enginesInitialized).toBe(true);
  });

  it('hydrates workflow state after initialization and tolerates hydrate failures', async () => {
    const workflow = createInitializable({
      hydrateFromStore: vi.fn().mockResolvedValue(undefined),
    });

    container.registerMock(ServiceTypes.MemoryEngine, createInitializable());
    container.registerMock(ServiceTypes.GraphEngine, createInitializable());
    container.registerMock(ServiceTypes.CriticEngine, createInitializable());
    container.registerMock(ServiceTypes.SearchEngine, createInitializable());
    container.registerMock(ServiceTypes.WorkflowEngine, workflow);

    await container.initializeAll();
    expect(workflow.hydrateFromStore).toHaveBeenCalledTimes(1);

    container.reset();

    const failingContainer = new ServiceContainer();
    const failingWorkflow = createInitializable({
      hydrateFromStore: vi.fn().mockRejectedValue(new Error('hydrate failed')),
    });

    failingContainer.registerMock(ServiceTypes.MemoryEngine, createInitializable());
    failingContainer.registerMock(ServiceTypes.GraphEngine, createInitializable());
    failingContainer.registerMock(ServiceTypes.CriticEngine, createInitializable());
    failingContainer.registerMock(ServiceTypes.SearchEngine, createInitializable());
    failingContainer.registerMock(ServiceTypes.WorkflowEngine, failingWorkflow);

    await expect(failingContainer.initializeAll()).resolves.toBeUndefined();
    expect(failingWorkflow.hydrateFromStore).toHaveBeenCalledTimes(1);

    failingContainer.reset();
  });

  it('reuses the in-flight initialization promise for concurrent callers', async () => {
    let releaseInitialize: (() => void) | null = null;
    const memoryEngine = {
      initialize: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseInitialize = resolve;
          }),
      ),
    };
    const workflow = createInitializable({
      hydrateFromStore: vi.fn().mockResolvedValue(undefined),
    });

    container.registerMock(ServiceTypes.MemoryEngine, memoryEngine);
    container.registerMock(ServiceTypes.GraphEngine, createInitializable());
    container.registerMock(ServiceTypes.CriticEngine, createInitializable());
    container.registerMock(ServiceTypes.SearchEngine, createInitializable());
    container.registerMock(ServiceTypes.WorkflowEngine, workflow);

    const first = container.initializeAll();
    const second = container.initializeAll();

    expect(releaseInitialize).not.toBeNull();

    releaseInitialize?.();
    await Promise.all([first, second]);
    expect(memoryEngine.initialize).toHaveBeenCalledTimes(1);
    expect(workflow.hydrateFromStore).toHaveBeenCalledTimes(1);
  });

  it('flushes workflow state on shutdown and swallows flush failures', async () => {
    const workflow = {
      flushToStore: vi.fn().mockResolvedValue(undefined),
    };

    container.registerMock(ServiceTypes.WorkflowEngine, workflow);
    await expect(container.shutdown()).resolves.toBeUndefined();
    expect(workflow.flushToStore).toHaveBeenCalledTimes(1);

    const failingContainer = new ServiceContainer();
    const failingWorkflow = {
      flushToStore: vi.fn().mockRejectedValue(new Error('flush failed')),
    };

    failingContainer.registerMock(ServiceTypes.WorkflowEngine, failingWorkflow);
    await expect(failingContainer.shutdown()).resolves.toBeUndefined();
    expect(failingWorkflow.flushToStore).toHaveBeenCalledTimes(1);

    failingContainer.reset();
  });
});
