import { beforeEach, describe, expect, it, vi } from 'vitest';

const buildWikiLinkGraphMock = vi.hoisted(() => vi.fn());
const wikiGraphSearchMock = vi.hoisted(() => vi.fn());
const resolveProjectWikiStoreMock = vi.hoisted(() => vi.fn());
const warnMock = vi.hoisted(() => vi.fn());
const errorMock = vi.hoisted(() => vi.fn());

vi.mock('../../project/wiki-graph-search.js', () => ({
  buildWikiLinkGraph: buildWikiLinkGraphMock,
  wikiGraphSearch: wikiGraphSearchMock,
}));

vi.mock('../../project/wiki-store.js', () => ({
  resolveProjectWikiStore: resolveProjectWikiStoreMock,
}));

vi.mock('../../logger/index.js', () => ({
  createLogger: vi.fn(() => ({
    warn: warnMock,
    error: errorMock,
  })),
}));

import { GraphSearchAdapter } from '../../search/graph-search-adapter.js';

describe('search/graph-search-adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an empty result and logs a warning when no store resolution is configured', async () => {
    const adapter = new GraphSearchAdapter();

    await expect(adapter.search('Hero')).resolves.toEqual({
      startSlug: 'Hero',
      results: [],
      depth: 0,
    });

    expect(warnMock).toHaveBeenCalledWith('No store resolution configured; graph search unavailable');
    expect(buildWikiLinkGraphMock).not.toHaveBeenCalled();
    expect(wikiGraphSearchMock).not.toHaveBeenCalled();
  });

  it('resolves the workspace store, caches the graph, and forwards default and custom options', async () => {
    const graph = new Map<string, Set<string>>([
      ['hero', new Set(['ally'])],
    ]);
    const resolution = {
      available: true,
      reason: null,
      workspaceRoot: '/tmp/wiki',
      workspaceId: 'workspace-1',
      paths: {
        rootDir: '/tmp/wiki/.niko/wiki',
        pagesDir: '/tmp/wiki/.niko/wiki/pages',
        rawDir: '/tmp/wiki/.niko/wiki/raw',
        projectionsDir: '/tmp/wiki/.niko/wiki/projections',
        graphProjectionDir: '/tmp/wiki/.niko/wiki/projections/graph',
        memoryProjectionDir: '/tmp/wiki/.niko/wiki/projections/memory',
        indexFile: '/tmp/wiki/.niko/wiki/index.json',
        logFile: '/tmp/wiki/.niko/wiki/log.jsonl',
      },
    };

    resolveProjectWikiStoreMock.mockReturnValue(resolution);
    buildWikiLinkGraphMock.mockResolvedValue(graph);
    wikiGraphSearchMock
      .mockReturnValueOnce({ startSlug: 'hero', visited: ['ally'], depth: 1 })
      .mockReturnValueOnce({ startSlug: 'hero', visited: ['ally'], depth: 1 });

    const adapter = new GraphSearchAdapter();
    adapter.setWorkspace({
      identity: {
        workspaceRoot: '/tmp/wiki',
        workspaceId: 'workspace-1',
      },
    } as never);

    await expect(adapter.search('Hero')).resolves.toEqual({
      startSlug: 'hero',
      results: ['ally'],
      depth: 1,
    });
    await expect(adapter.search('Hero', { maxDepth: 4, limit: 9 })).resolves.toEqual({
      startSlug: 'hero',
      results: ['ally'],
      depth: 1,
    });

    expect(resolveProjectWikiStoreMock).toHaveBeenCalledWith('/tmp/wiki', 'workspace-1');
    expect(buildWikiLinkGraphMock).toHaveBeenCalledTimes(1);
    expect(wikiGraphSearchMock).toHaveBeenNthCalledWith(1, graph, 'Hero', 2, 50);
    expect(wikiGraphSearchMock).toHaveBeenNthCalledWith(2, graph, 'Hero', 4, 9);
  });

  it('shares the same graph build promise across concurrent searches and rebuilds after invalidation', async () => {
    const resolution = {
      available: true,
      reason: null,
      workspaceRoot: '/tmp/wiki',
      workspaceId: 'workspace-2',
      paths: {
        rootDir: '/tmp/wiki/.niko/wiki',
        pagesDir: '/tmp/wiki/.niko/wiki/pages',
        rawDir: '/tmp/wiki/.niko/wiki/raw',
        projectionsDir: '/tmp/wiki/.niko/wiki/projections',
        graphProjectionDir: '/tmp/wiki/.niko/wiki/projections/graph',
        memoryProjectionDir: '/tmp/wiki/.niko/wiki/projections/memory',
        indexFile: '/tmp/wiki/.niko/wiki/index.json',
        logFile: '/tmp/wiki/.niko/wiki/log.jsonl',
      },
    };
    const graph = new Map<string, Set<string>>([
      ['seed', new Set(['alpha', 'beta'])],
    ]);
    let resolveGraph: (value: Map<string, Set<string>>) => void = () => undefined;
    const pendingGraph = new Promise<Map<string, Set<string>>>((resolve) => {
      resolveGraph = resolve;
    });

    buildWikiLinkGraphMock
      .mockReturnValueOnce(pendingGraph)
      .mockResolvedValueOnce(graph);
    wikiGraphSearchMock
      .mockReturnValueOnce({ startSlug: 'seed', visited: ['alpha'], depth: 1 })
      .mockReturnValueOnce({ startSlug: 'seed', visited: ['beta'], depth: 1 })
      .mockReturnValueOnce({ startSlug: 'seed', visited: ['alpha', 'beta'], depth: 2 });

    const adapter = new GraphSearchAdapter();
    adapter.setStoreResolution(resolution as never);

    const firstSearch = adapter.search('seed');
    const secondSearch = adapter.search('seed', { limit: 1 });

    expect(buildWikiLinkGraphMock).toHaveBeenCalledTimes(1);

    resolveGraph(graph);

    await expect(firstSearch).resolves.toEqual({
      startSlug: 'seed',
      results: ['alpha'],
      depth: 1,
    });
    await expect(secondSearch).resolves.toEqual({
      startSlug: 'seed',
      results: ['beta'],
      depth: 1,
    });

    adapter.invalidateCache();

    await expect(adapter.search('seed', { maxDepth: 3, limit: 10 })).resolves.toEqual({
      startSlug: 'seed',
      results: ['alpha', 'beta'],
      depth: 2,
    });

    expect(buildWikiLinkGraphMock).toHaveBeenCalledTimes(2);
    expect(wikiGraphSearchMock).toHaveBeenNthCalledWith(3, graph, 'seed', 3, 10);
  });

  it('logs build failures, returns an empty result, and retries on the next search', async () => {
    const resolution = {
      available: true,
      reason: null,
      workspaceRoot: '/tmp/wiki',
      workspaceId: 'workspace-3',
      paths: {
        rootDir: '/tmp/wiki/.niko/wiki',
        pagesDir: '/tmp/wiki/.niko/wiki/pages',
        rawDir: '/tmp/wiki/.niko/wiki/raw',
        projectionsDir: '/tmp/wiki/.niko/wiki/projections',
        graphProjectionDir: '/tmp/wiki/.niko/wiki/projections/graph',
        memoryProjectionDir: '/tmp/wiki/.niko/wiki/projections/memory',
        indexFile: '/tmp/wiki/.niko/wiki/index.json',
        logFile: '/tmp/wiki/.niko/wiki/log.jsonl',
      },
    };
    const graph = new Map<string, Set<string>>([
      ['seed', new Set(['alpha'])],
    ]);

    buildWikiLinkGraphMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(graph);
    wikiGraphSearchMock.mockReturnValueOnce({
      startSlug: 'seed',
      visited: ['alpha'],
      depth: 1,
    });

    const adapter = new GraphSearchAdapter();
    adapter.setStoreResolution(resolution as never);

    await expect(adapter.search('seed')).resolves.toEqual({
      startSlug: 'seed',
      results: [],
      depth: 0,
    });
    await expect(adapter.search('seed')).resolves.toEqual({
      startSlug: 'seed',
      results: ['alpha'],
      depth: 1,
    });

    expect(errorMock).toHaveBeenCalledWith('Failed to build wiki link graph', {
      detail: expect.any(Error),
    });
    expect(buildWikiLinkGraphMock).toHaveBeenCalledTimes(2);
  });
});
