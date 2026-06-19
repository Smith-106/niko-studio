import { describe, expect, it, vi } from 'vitest';

import { wikiGraphSearch } from './wiki-graph-search.js';

describe('project wiki graph search branch-gap coverage', () => {
  it('returns an empty graph when the wiki index cannot be loaded', async () => {
    vi.resetModules();

    vi.doMock('./wiki-store.js', async () => {
      const actual = await vi.importActual<typeof import('./wiki-store.js')>('./wiki-store.js');
      return {
        ...actual,
        readProjectWikiIndex: vi.fn().mockResolvedValue(null),
      };
    });

    const { buildWikiLinkGraph } = await import('./wiki-graph-search.js');

    const graph = await buildWikiLinkGraph({
      available: true,
      workspaceId: 'atlas-project',
      reason: null,
      paths: {
        rootDir: 'C:/tmp/wiki',
        pagesDir: 'C:/tmp/wiki/pages',
        rawDir: 'C:/tmp/wiki/raw',
        projectionsDir: 'C:/tmp/wiki/projections',
        graphProjectionDir: 'C:/tmp/wiki/projections/graph',
        memoryProjectionDir: 'C:/tmp/wiki/projections/memory',
        indexFile: 'C:/tmp/wiki/index.json',
        logFile: 'C:/tmp/wiki/events.ndjson',
      },
    } as never);

    expect(graph.size).toBe(0);
  });

  it('skips missing neighbor adjacency entries during deeper traversal', () => {
    const graph = new Map<string, Set<string>>([
      ['characters/atlas-hero', new Set(['ghost/missing-node'])],
    ]);

    expect(wikiGraphSearch(graph, 'characters/atlas-hero', 3, 10)).toEqual({
      startSlug: 'characters/atlas-hero',
      visited: ['ghost/missing-node'],
      depth: 1,
    });
  });
});
