import { afterEach, describe, expect, it, vi } from 'vitest';

const knowledgeBridgeCtor = vi.hoisted(() => vi.fn());
const narrativeEngineCtor = vi.hoisted(() => vi.fn());

vi.mock('../../services/knowledge-bridge-v2', () => ({
  KnowledgeBridgeV2: vi.fn().mockImplementation(function KnowledgeBridgeV2(this: Record<string, unknown>, config: unknown) {
    knowledgeBridgeCtor(config);
    Object.assign(this, { kind: 'bridge', config });
  }),
}));

vi.mock('../../services/narrative-engine', () => ({
  NarrativeEngine: vi.fn().mockImplementation(function NarrativeEngine(
    this: Record<string, unknown>,
    graphManager: unknown,
    memoryStore: unknown,
    bridge: unknown,
  ) {
    narrativeEngineCtor(graphManager, memoryStore, bridge);
    Object.assign(this, { kind: 'engine', graphManager, memoryStore, bridge });
  }),
}));

describe('container/app-container', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('creates the bridge and engine with default host/port values', async () => {
    const { createAppContainer } = await import('../../container/app-container.js');
    const graphManager = { id: 'graph' };
    const memoryStore = { id: 'memory' };

    const container = await createAppContainer({
      graphManager: graphManager as never,
      memoryStore: memoryStore as never,
      dataDir: '/tmp/atlas',
    });

    expect(knowledgeBridgeCtor).toHaveBeenCalledWith({
      host: '127.0.0.1',
      port: 19828,
      dataDir: '/tmp/atlas',
    });
    expect(narrativeEngineCtor).toHaveBeenCalledTimes(1);
    expect(container.graphManager).toBe(graphManager);
    expect(container.memoryStore).toBe(memoryStore);
    expect(container.knowledgeBridge).toMatchObject({ kind: 'bridge' });
    expect(container.narrativeEngine).toMatchObject({ kind: 'engine' });
  });

  it('passes explicit Nowledge Mem host and port overrides through to the bridge', async () => {
    const { createAppContainer } = await import('../../container/app-container.js');

    await createAppContainer({
      graphManager: { id: 'graph' } as never,
      memoryStore: { id: 'memory' } as never,
      dataDir: '/tmp/atlas',
      nowledgeMemHost: '10.0.0.8',
      nowledgeMemPort: 22100,
    });

    expect(knowledgeBridgeCtor).toHaveBeenCalledWith({
      host: '10.0.0.8',
      port: 22100,
      dataDir: '/tmp/atlas',
    });
  });
});
