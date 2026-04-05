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

describe('mcp graph service wiring', () => {
  afterEach(() => {
    graphEngineInstance = null;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('delegates graph queries and mutations to the graph engine accessor', async () => {
    graphEngineInstance = createMockGraphEngine();
    graphEngineInstance.executeCypher.mockResolvedValueOnce([
      {
        n: {
          id: 'node-1',
          name: 'Alice',
          type: 'Character',
        },
      },
    ]);
    graphEngineInstance.getCharacter.mockResolvedValueOnce({ name: 'Alice' });
    graphEngineInstance.getRelationships.mockResolvedValueOnce([{ type: 'KNOWS' }]);
    graphEngineInstance.getForeshadows.mockResolvedValueOnce([{ id: 'f-1' }]);
    graphEngineInstance.createEntity.mockResolvedValueOnce({ id: 'entity-1', status: 'created' });
    graphEngineInstance.createRelation.mockResolvedValueOnce({ id: 'rel-1', status: 'created' });

    const {
      graphQuery,
      graphGetCharacter,
      graphGetRelationships,
      graphGetForeshadows,
      graphAddEntity,
      graphAddRelation,
    } = await import('../../mcp/services/graph.js');

    const queryResult = await graphQuery("MATCH (n:Character) RETURN n");
    const characterResult = await graphGetCharacter('Alice', false, true);
    const relationshipResult = await graphGetRelationships('Alice', 'KNOWS', 2);
    const foreshadowResult = await graphGetForeshadows('pending', 3);
    const entityResult = await graphAddEntity('Character', 'Alice', { role: 'lead' });
    const relationResult = await graphAddRelation('Alice', 'Bob', 'KNOWS', { since: '2024' });

    expect(graphEngineInstance.executeCypher).toHaveBeenCalledWith("MATCH (n:Character) RETURN n");
    expect(graphEngineInstance.getCharacter).toHaveBeenCalledWith('Alice', false, true);
    expect(graphEngineInstance.getRelationships).toHaveBeenCalledWith('Alice', 'KNOWS', 2);
    expect(graphEngineInstance.getForeshadows).toHaveBeenCalledWith('pending', 3);
    expect(graphEngineInstance.createEntity).toHaveBeenCalledWith('Character', 'Alice', { role: 'lead' });
    expect(graphEngineInstance.createRelation).toHaveBeenCalledWith('Alice', 'Bob', 'KNOWS', { since: '2024' });

    expect(queryResult).toEqual([
      {
        n: {
          id: 'node-1',
          name: 'Alice',
          type: 'Character',
        },
      },
    ]);
    expect(characterResult).toEqual({ name: 'Alice' });
    expect(relationshipResult).toEqual([{ type: 'KNOWS' }]);
    expect(foreshadowResult).toEqual([{ id: 'f-1' }]);
    expect(entityResult).toEqual({ id: 'entity-1', status: 'created' });
    expect(relationResult).toEqual({ id: 'rel-1', status: 'created' });
  });

  it('preserves fallback responses when the graph engine is unavailable', async () => {
    const {
      graphQuery,
      graphGetCharacter,
      graphGetRelationships,
      graphGetForeshadows,
      graphAddEntity,
      graphAddRelation,
    } = await import('../../mcp/services/graph.js');

    await expect(graphQuery('MATCH (n) RETURN n')).resolves.toEqual([]);
    await expect(graphGetCharacter('Alice')).resolves.toEqual({});
    await expect(graphGetRelationships('Alice')).resolves.toEqual([]);
    await expect(graphGetForeshadows()).resolves.toEqual([]);
    await expect(graphAddEntity('Character', 'Alice')).resolves.toEqual({ error: 'Graph engine unavailable' });
    await expect(graphAddRelation('Alice', 'Bob', 'KNOWS')).resolves.toEqual({ error: 'Graph engine unavailable' });
  });

  it('rejects partial graph engine objects and keeps fallback responses intact', async () => {
    const partialEngine = {
      executeCypher: vi.fn(),
    };
    graphEngineInstance = partialEngine;

    const {
      graphQuery,
      graphAddEntity,
      graphAddRelation,
    } = await import('../../mcp/services/graph.js');

    await expect(graphQuery('MATCH (n) RETURN n')).resolves.toEqual([]);
    await expect(graphAddEntity('Character', 'Alice')).resolves.toEqual({
      error: 'Graph engine unavailable',
    });
    await expect(graphAddRelation('Alice', 'Bob', 'KNOWS')).resolves.toEqual({
      error: 'Graph engine unavailable',
    });
    expect(partialEngine.executeCypher).not.toHaveBeenCalled();
  });

  it('normalizes missing mutation properties to empty objects before delegation', async () => {
    graphEngineInstance = createMockGraphEngine();
    (graphEngineInstance as MockGraphEngine).createEntity.mockResolvedValueOnce({
      status: 'created',
      id: 'entity-default-props',
    });
    (graphEngineInstance as MockGraphEngine).createRelation.mockResolvedValueOnce({
      status: 'created',
      id: 'relation-default-props',
    });

    const {
      graphAddEntity,
      graphAddRelation,
    } = await import('../../mcp/services/graph.js');

    await expect(graphAddEntity('Character', 'Alice', null)).resolves.toEqual({
      status: 'created',
      id: 'entity-default-props',
    });
    await expect(graphAddRelation('Alice', 'Bob', 'KNOWS')).resolves.toEqual({
      status: 'created',
      id: 'relation-default-props',
    });
    expect((graphEngineInstance as MockGraphEngine).createEntity).toHaveBeenCalledWith(
      'Character',
      'Alice',
      {},
    );
    expect((graphEngineInstance as MockGraphEngine).createRelation).toHaveBeenCalledWith(
      'Alice',
      'Bob',
      'KNOWS',
      {},
    );
  });
});
