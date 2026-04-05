import { afterEach, describe, expect, it, vi } from 'vitest';

const addMock = vi.fn();
const searchMock = vi.fn();
const getTemporalFactsMock = vi.fn();
const detectConflictsMock = vi.fn();
const resolveConflictMock = vi.fn();

let memoryEngineInstance: Record<string, unknown> | null = null;

vi.mock('../../mcp/engine', () => ({
  getMemoryEngine: vi.fn(() => memoryEngineInstance),
}));

describe('mcp memory service wiring', () => {
  afterEach(() => {
    memoryEngineInstance = null;
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('delegates memory add and search to the memory engine accessor', async () => {
    memoryEngineInstance = {
      add: addMock,
      search: searchMock,
      getTemporalFacts: getTemporalFactsMock,
      detectConflicts: detectConflictsMock,
      resolveConflict: resolveConflictMock,
    };
    addMock.mockResolvedValueOnce({ id: 'mem-1', status: 'created' });
    searchMock.mockResolvedValueOnce([{ id: 'mem-1', content: 'memory content' }]);

    const { memoryAdd, memorySearch } = await import('../../mcp/services/memory.js');

    const addResult = await memoryAdd({
      content: 'memory content',
      layer: 'session',
      entityId: 'hero-1',
      importance: 0.8,
      source: 'imported',
      confidence: 0.72,
      tags: ['plot'],
    });
    const searchResult = await memorySearch({
      query: 'memory content',
      layer: 'session',
      entityId: 'hero-1',
      limit: 3,
    });

    expect(addMock).toHaveBeenCalledWith({
      content: 'memory content',
      layer: 'session',
      dimension: null,
      entityId: 'hero-1',
      validFrom: null,
      validUntil: null,
      userId: null,
      projectId: null,
      sessionId: null,
      importance: 0.8,
      tags: ['plot'],
      source: 'imported',
      confidence: 0.72,
    });
    expect(searchMock).toHaveBeenCalledWith({
      query: 'memory content',
      layer: 'session',
      dimensions: null,
      entityId: 'hero-1',
      userId: null,
      projectId: null,
      sessionId: null,
      atTime: null,
      limit: 3,
    });
    expect(addResult).toEqual({ id: 'mem-1', status: 'created' });
    expect(searchResult).toEqual([{ id: 'mem-1', content: 'memory content' }]);
  });

  it('normalizes default add and search parameters before delegation', async () => {
    memoryEngineInstance = {
      add: addMock,
      search: searchMock,
      getTemporalFacts: getTemporalFactsMock,
      detectConflicts: detectConflictsMock,
      resolveConflict: resolveConflictMock,
    };
    addMock.mockResolvedValueOnce({ id: 'mem-default', status: 'created' });
    searchMock.mockResolvedValueOnce([{ id: 'mem-default', content: 'default memory' }]);

    const { memoryAdd, memorySearch } = await import('../../mcp/services/memory.js');

    const addResult = await memoryAdd({ content: 'default memory' });
    const searchResult = await memorySearch({ query: 'default memory' });

    expect(addMock).toHaveBeenCalledWith({
      content: 'default memory',
      layer: 'session',
      dimension: null,
      entityId: null,
      validFrom: null,
      validUntil: null,
      userId: null,
      projectId: null,
      sessionId: null,
      importance: 0.5,
      tags: [],
      source: 'user',
      confidence: 1.0,
    });
    expect(searchMock).toHaveBeenCalledWith({
      query: 'default memory',
      layer: null,
      dimensions: null,
      entityId: null,
      userId: null,
      projectId: null,
      sessionId: null,
      atTime: null,
      limit: 10,
    });
    expect(addResult).toEqual({ id: 'mem-default', status: 'created' });
    expect(searchResult).toEqual([{ id: 'mem-default', content: 'default memory' }]);
  });

  it('delegates temporal/conflict operations to the memory engine accessor and normalizes defaults', async () => {
    memoryEngineInstance = {
      add: addMock,
      search: searchMock,
      getTemporalFacts: getTemporalFactsMock,
      detectConflicts: detectConflictsMock,
      resolveConflict: resolveConflictMock,
    };
    getTemporalFactsMock.mockResolvedValueOnce([{ id: 'mem-1' }]);
    detectConflictsMock.mockResolvedValueOnce([{ conflict_type: 'contradiction' }]);
    resolveConflictMock.mockResolvedValueOnce({ status: 'resolved', kept: 'mem-1', removed: 'mem-2' });

    const {
      memoryGetTemporal,
      memoryGetConflicts,
      memoryResolveConflict,
    } = await import('../../mcp/services/memory.js');

    const temporal = await memoryGetTemporal('hero-1', undefined, {
      projectId: 'project-1',
      sessionId: 'session-1',
    });
    const conflicts = await memoryGetConflicts('hero-1', {
      projectId: 'project-1',
      sessionId: 'session-1',
    });
    const resolution = await memoryResolveConflict('mem-1', 'mem-2');

    expect(getTemporalFactsMock).toHaveBeenCalledWith({
      entityId: 'hero-1',
      atTime: null,
      userId: null,
      projectId: 'project-1',
      sessionId: 'session-1',
    });
    expect(detectConflictsMock).toHaveBeenCalledWith('hero-1', {
      userId: null,
      projectId: 'project-1',
      sessionId: 'session-1',
    });
    expect(resolveConflictMock).toHaveBeenCalledWith({
      memoryIdA: 'mem-1',
      memoryIdB: 'mem-2',
      resolution: 'auto',
    });
    expect(temporal).toEqual([{ id: 'mem-1' }]);
    expect(conflicts).toEqual([{ conflict_type: 'contradiction' }]);
    expect(resolution).toEqual({ status: 'resolved', kept: 'mem-1', removed: 'mem-2' });
  });

  it('normalizes omitted temporal and conflict scope filters and forwards explicit conflict resolution', async () => {
    memoryEngineInstance = {
      add: addMock,
      search: searchMock,
      getTemporalFacts: getTemporalFactsMock,
      detectConflicts: detectConflictsMock,
      resolveConflict: resolveConflictMock,
    };
    getTemporalFactsMock.mockResolvedValueOnce([{ id: 'mem-2' }]);
    detectConflictsMock.mockResolvedValueOnce([{ conflict_type: 'duplicate' }]);
    resolveConflictMock.mockResolvedValueOnce({ status: 'resolved', kept: 'mem-3', removed: 'mem-4' });

    const {
      memoryGetTemporal,
      memoryGetConflicts,
      memoryResolveConflict,
    } = await import('../../mcp/services/memory.js');

    const temporal = await memoryGetTemporal('hero-2');
    const conflicts = await memoryGetConflicts('hero-2');
    const resolution = await memoryResolveConflict('mem-3', 'mem-4', 'merge');

    expect(getTemporalFactsMock).toHaveBeenCalledWith({
      entityId: 'hero-2',
      atTime: null,
      userId: null,
      projectId: null,
      sessionId: null,
    });
    expect(detectConflictsMock).toHaveBeenCalledWith('hero-2', {
      userId: null,
      projectId: null,
      sessionId: null,
    });
    expect(resolveConflictMock).toHaveBeenCalledWith({
      memoryIdA: 'mem-3',
      memoryIdB: 'mem-4',
      resolution: 'merge',
    });
    expect(temporal).toEqual([{ id: 'mem-2' }]);
    expect(conflicts).toEqual([{ conflict_type: 'duplicate' }]);
    expect(resolution).toEqual({ status: 'resolved', kept: 'mem-3', removed: 'mem-4' });
  });

  it('forwards scope-aware add and search filters to the memory engine accessor', async () => {
    memoryEngineInstance = {
      add: addMock,
      search: searchMock,
      getTemporalFacts: getTemporalFactsMock,
      detectConflicts: detectConflictsMock,
      resolveConflict: resolveConflictMock,
    };
    addMock.mockResolvedValueOnce({ id: 'mem-scope', status: 'created' });
    searchMock.mockResolvedValueOnce([{ id: 'mem-scope', content: 'scoped memory' }]);

    const { memoryAdd, memorySearch } = await import('../../mcp/services/memory.js');

    const addResult = await memoryAdd({
      content: 'scoped memory',
      layer: 'project',
      entityId: 'hero-scope',
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      source: 'session-import',
      confidence: 0.64,
      tags: ['scope'],
    });
    const searchResult = await memorySearch({
      query: 'scoped memory',
      entityId: 'hero-scope',
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      limit: 2,
    });

    expect(addMock).toHaveBeenCalledWith({
      content: 'scoped memory',
      layer: 'project',
      dimension: null,
      entityId: 'hero-scope',
      validFrom: null,
      validUntil: null,
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      importance: 0.5,
      tags: ['scope'],
      source: 'session-import',
      confidence: 0.64,
    });
    expect(searchMock).toHaveBeenCalledWith({
      query: 'scoped memory',
      layer: null,
      dimensions: null,
      entityId: 'hero-scope',
      userId: 'user-1',
      projectId: 'project-1',
      sessionId: 'session-1',
      atTime: null,
      limit: 2,
    });
    expect(addResult).toEqual({ id: 'mem-scope', status: 'created' });
    expect(searchResult).toEqual([{ id: 'mem-scope', content: 'scoped memory' }]);
  });

  it('rejects partial memory engine objects and keeps fallback responses intact', async () => {
    const partialEngine = {
      add: addMock,
      search: searchMock,
    };
    memoryEngineInstance = partialEngine;

    const {
      memoryAdd,
      memorySearch,
      memoryGetTemporal,
      memoryGetConflicts,
      memoryResolveConflict,
    } = await import('../../mcp/services/memory.js');

    await expect(memoryAdd({ content: 'partial memory' })).resolves.toEqual({
      error: 'Memory engine unavailable',
    });
    await expect(memorySearch({ query: 'partial memory' })).resolves.toEqual([]);
    await expect(memoryGetTemporal('hero-1')).resolves.toEqual([]);
    await expect(memoryGetConflicts('hero-1')).resolves.toEqual([]);
    await expect(memoryResolveConflict('mem-1', 'mem-2')).resolves.toEqual({
      error: 'Memory engine unavailable',
    });
    expect(addMock).not.toHaveBeenCalled();
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('preserves fallback responses when the memory engine is unavailable', async () => {
    const {
      memoryAdd,
      memorySearch,
      memoryGetTemporal,
      memoryGetConflicts,
      memoryResolveConflict,
    } = await import('../../mcp/services/memory.js');

    await expect(memoryAdd({ content: 'memory content' })).resolves.toEqual({ error: 'Memory engine unavailable' });
    await expect(memorySearch({ query: 'memory content' })).resolves.toEqual([]);
    await expect(memoryGetTemporal('hero-1')).resolves.toEqual([]);
    await expect(memoryGetConflicts('hero-1')).resolves.toEqual([]);
    await expect(memoryResolveConflict('mem-1', 'mem-2')).resolves.toEqual({ error: 'Memory engine unavailable' });
  });
});
