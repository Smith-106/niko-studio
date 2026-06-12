import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createDefaultProjectWorkspaceContext } from './workspace-model.js';
import {
  buildWikiLinkGraph,
  extractWikiLinks,
  searchWikiGraph,
  wikiGraphSearch,
} from './wiki-graph-search.js';
import { resolveProjectWikiStore, writeProjectWikiPage } from './wiki-store.js';

describe('project wiki graph search', () => {
  it('extracts normalized unique wiki links from markdown', () => {
    const markdown = [
      'See [[ Characters / Atlas Hero ]] for the lead.',
      'Support notes live in [[teams/atlas-crew|Atlas Crew]].',
      'The hero also references [[characters/atlas-hero]].',
    ].join(' ');

    expect(extractWikiLinks(markdown)).toEqual([
      'characters/atlas-hero',
      'teams/atlas-crew',
    ]);
  });

  it('builds a graph from indexed pages and skips unreadable page files', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-graph-'));

    try {
      const unavailable = await buildWikiLinkGraph(resolveProjectWikiStore(null));
      expect(unavailable.size).toBe(0);

      const store = resolveProjectWikiStore(workspaceRoot, 'Atlas Project');
      expect(store.available).toBe(true);
      if (!store.available) return;

      const heroPage = await writeProjectWikiPage(store, {
        workspaceId: store.workspaceId,
        title: 'Atlas Hero',
        slug: 'characters/atlas-hero',
        idSeed: 'hero-1',
        promotedFrom: 'manual',
        body: 'References [[teams/atlas-crew]] and [[locations/old-harbor]].',
      });
      const crewPage = await writeProjectWikiPage(store, {
        workspaceId: store.workspaceId,
        title: 'Atlas Crew',
        slug: 'teams/atlas-crew',
        idSeed: 'crew-1',
        promotedFrom: 'manual',
        body: 'Crew members watch [[events/archive-heist]].',
      });
      const brokenPage = await writeProjectWikiPage(store, {
        workspaceId: store.workspaceId,
        title: 'Broken Page',
        slug: 'drafts/broken-page',
        idSeed: 'broken-1',
        promotedFrom: 'manual',
        body: 'This would mention [[ghost/missing-page]].',
      });

      expect(heroPage).not.toBeNull();
      expect(crewPage).not.toBeNull();
      expect(brokenPage).not.toBeNull();
      if (!store.available || !brokenPage) return;

      await rm(brokenPage.path, { force: true });

      const graph = await buildWikiLinkGraph(store);

      expect([...graph.get('characters/atlas-hero') ?? []]).toEqual([
        'teams/atlas-crew',
        'locations/old-harbor',
      ]);
      expect([...graph.get('teams/atlas-crew') ?? []]).toEqual(['events/archive-heist']);
      expect(graph.has('locations/old-harbor')).toBe(true);
      expect(graph.has('drafts/broken-page')).toBe(true);
      expect(graph.has('ghost/missing-page')).toBe(false);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('performs bounded breadth-first traversal with normalized start slugs', () => {
    const graph = new Map<string, Set<string>>([
      ['characters/atlas-hero', new Set(['teams/atlas-crew', 'locations/old-harbor'])],
      ['teams/atlas-crew', new Set(['events/archive-heist'])],
      ['locations/old-harbor', new Set(['events/archive-heist'])],
      ['events/archive-heist', new Set(['clues/archive-key'])],
      ['clues/archive-key', new Set()],
    ]);

    expect(wikiGraphSearch(graph, ' Characters / Atlas Hero ', 0, 5)).toEqual({
      startSlug: 'characters/atlas-hero',
      visited: [],
      depth: 0,
    });

    expect(wikiGraphSearch(graph, 'Characters / Atlas Hero', 2, 2)).toEqual({
      startSlug: 'characters/atlas-hero',
      visited: ['teams/atlas-crew', 'locations/old-harbor'],
      depth: 1,
    });
  });

  it('searches the workspace wiki graph in one step from workspace context', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'niko-project-wiki-search-'));

    try {
      const workspace = createDefaultProjectWorkspaceContext({ workspaceRoot });
      const store = resolveProjectWikiStore(
        workspace.identity.workspaceRoot,
        workspace.identity.workspaceId,
      );
      expect(store.available).toBe(true);
      if (!store.available) return;

      await writeProjectWikiPage(store, {
        workspaceId: store.workspaceId,
        title: 'Atlas Hero',
        slug: 'characters/atlas-hero',
        idSeed: 'hero-1',
        promotedFrom: 'manual',
        body: 'Tracks [[events/archive-heist]] from [[locations/old-harbor]].',
      });
      await writeProjectWikiPage(store, {
        workspaceId: store.workspaceId,
        title: 'Old Harbor',
        slug: 'locations/old-harbor',
        idSeed: 'harbor-1',
        promotedFrom: 'manual',
        body: 'Connects to [[events/archive-heist]].',
      });
      await writeProjectWikiPage(store, {
        workspaceId: store.workspaceId,
        title: 'Archive Heist',
        slug: 'events/archive-heist',
        idSeed: 'event-1',
        promotedFrom: 'manual',
        body: 'The archive key vanished.',
      });

      const result = await searchWikiGraph(workspace, 'characters/atlas-hero', 3, 5);

      expect(result.startSlug).toBe('characters/atlas-hero');
      expect(result.visited).toEqual([
        'events/archive-heist',
        'locations/old-harbor',
      ]);
      expect(result.depth).toBe(1);
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });
});
