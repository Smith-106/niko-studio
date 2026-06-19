import { afterEach, describe, expect, it, vi } from 'vitest';

type MockGraphEngine = {
  executeCypher: ReturnType<typeof vi.fn>;
  getCharacter: ReturnType<typeof vi.fn>;
  getRelationships: ReturnType<typeof vi.fn>;
  getForeshadows: ReturnType<typeof vi.fn>;
  createEntity: ReturnType<typeof vi.fn>;
  createRelation: ReturnType<typeof vi.fn>;
};

let graphEngineInstance: unknown = null;

vi.mock('../../mcp/engine', () => ({
  getGraphEngine: vi.fn(() => graphEngineInstance),
}));

function createMockGraphEngine(): MockGraphEngine {
  return {
    executeCypher: vi.fn(),
    getCharacter: vi.fn(),
    getRelationships: vi.fn(),
    getForeshadows: vi.fn(),
    createEntity: vi.fn(),
    createRelation: vi.fn(),
  };
}

describe('mcp graph service scope branches', () => {
  afterEach(() => {
    graphEngineInstance = null;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('calls getForeshadows without scope (2 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getForeshadows.mockResolvedValueOnce([{ id: 'f-no-scope' }]);

    const { graphGetForeshadows } = await import('../../mcp/services/graph.js');

    const result = await graphGetForeshadows('pending', 3);

    expect(result).toEqual([{ id: 'f-no-scope' }]);
    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledWith('pending', 3);
    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledTimes(1);
  });

  it('calls getForeshadows with scope (3 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getForeshadows.mockResolvedValueOnce([{ id: 'f-scoped' }]);

    const { graphGetForeshadows } = await import('../../mcp/services/graph.js');

    const scope = { workspaceId: 'w-1', projectId: 'p-1', allowLegacy: false };
    const result = await graphGetForeshadows('pending', 5, scope);

    expect(result).toEqual([{ id: 'f-scoped' }]);
    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledWith('pending', 5, scope);
    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledTimes(1);
  });

  it('calls getForeshadows with null scope (no-scope branch)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getForeshadows.mockResolvedValueOnce([{ id: 'f-null-scope' }]);

    const { graphGetForeshadows } = await import('../../mcp/services/graph.js');

    const result = await graphGetForeshadows('active', 1, null);

    expect(result).toEqual([{ id: 'f-null-scope' }]);
    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledWith('active', 1);
  });

  it('calls getForeshadows with undefined scope (no-scope branch)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getForeshadows.mockResolvedValueOnce([{ id: 'f-undef-scope' }]);

    const { graphGetForeshadows } = await import('../../mcp/services/graph.js');

    const result = await graphGetForeshadows('active', 2, undefined);

    expect(result).toEqual([{ id: 'f-undef-scope' }]);
    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledWith('active', 2);
  });

  it('normalizes null status to undefined in no-scope branch', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getForeshadows.mockResolvedValueOnce([]);

    const { graphGetForeshadows } = await import('../../mcp/services/graph.js');

    await graphGetForeshadows(null, 1);

    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledWith(undefined, 1);
  });

  it('normalizes null status to undefined in scope branch', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getForeshadows.mockResolvedValueOnce([]);

    const { graphGetForeshadows } = await import('../../mcp/services/graph.js');

    const scope = { workspaceId: 'w-1' };
    await graphGetForeshadows(null, 1, scope);

    expect((graphEngineInstance as MockGraphEngine).getForeshadows).toHaveBeenCalledWith(undefined, 1, scope);
  });

  it('calls graphQuery without scope (1 arg)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).executeCypher.mockResolvedValueOnce([{ n: { id: 'q-1' } }]);

    const { graphQuery } = await import('../../mcp/services/graph.js');

    const result = await graphQuery('MATCH (n) RETURN n');

    expect(result).toEqual([{ n: { id: 'q-1' } }]);
    expect((graphEngineInstance as MockGraphEngine).executeCypher).toHaveBeenCalledWith('MATCH (n) RETURN n');
  });

  it('calls graphQuery with scope (2 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).executeCypher.mockResolvedValueOnce([{ n: { id: 'q-s' } }]);

    const { graphQuery } = await import('../../mcp/services/graph.js');

    const scope = { workspaceId: 'w-1', projectId: 'p-1' };
    const result = await graphQuery('MATCH (n) RETURN n', scope);

    expect(result).toEqual([{ n: { id: 'q-s' } }]);
    expect((graphEngineInstance as MockGraphEngine).executeCypher).toHaveBeenCalledWith('MATCH (n) RETURN n', scope);
  });

  it('calls graphGetCharacter without scope (3 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getCharacter.mockResolvedValueOnce({ name: 'Alice' });

    const { graphGetCharacter } = await import('../../mcp/services/graph.js');

    const result = await graphGetCharacter('Alice', true, false);

    expect(result).toEqual({ name: 'Alice' });
    expect((graphEngineInstance as MockGraphEngine).getCharacter).toHaveBeenCalledWith('Alice', true, false);
  });

  it('calls graphGetCharacter with scope (4 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getCharacter.mockResolvedValueOnce({ name: 'Scoped Alice' });

    const { graphGetCharacter } = await import('../../mcp/services/graph.js');

    const scope = { workspaceId: 'w-1' };
    const result = await graphGetCharacter('Scoped Alice', true, false, scope);

    expect(result).toEqual({ name: 'Scoped Alice' });
    expect((graphEngineInstance as MockGraphEngine).getCharacter).toHaveBeenCalledWith('Scoped Alice', true, false, scope);
  });

  it('calls graphGetRelationships without scope (3 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getRelationships.mockResolvedValueOnce([{ type: 'KNOWS' }]);

    const { graphGetRelationships } = await import('../../mcp/services/graph.js');

    const result = await graphGetRelationships('Alice', 'KNOWS', 2);

    expect(result).toEqual([{ type: 'KNOWS' }]);
    expect((graphEngineInstance as MockGraphEngine).getRelationships).toHaveBeenCalledWith('Alice', 'KNOWS', 2);
  });

  it('calls graphGetRelationships with scope (4 args)', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).getRelationships.mockResolvedValueOnce([{ type: 'FRIEND' }]);

    const { graphGetRelationships } = await import('../../mcp/services/graph.js');

    const scope = { workspaceId: 'w-1' };
    const result = await graphGetRelationships('Alice', 'FRIEND', 3, scope);

    expect(result).toEqual([{ type: 'FRIEND' }]);
    expect((graphEngineInstance as MockGraphEngine).getRelationships).toHaveBeenCalledWith('Alice', 'FRIEND', 3, scope);
  });
});
