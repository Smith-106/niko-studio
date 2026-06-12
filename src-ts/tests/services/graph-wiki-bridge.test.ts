import { afterEach, describe, expect, it, vi } from 'vitest';

import { GraphWikiLinkBridgeImpl } from '../../services/graph-wiki-bridge.js';

interface SearchResult {
  name: string;
  path: string;
  relativePath: string;
}

function createSearchResult(path: string): SearchResult {
  return {
    name: path.replace(/\.md$/, '').split('/').pop() ?? path,
    path,
    relativePath: path,
  };
}

class MockEventBus {
  readonly published: Array<{ channel: string; payload: unknown }> = [];
  readonly handlers = new Map<string, Array<(payload: unknown) => void>>();
  throwOnPublish = false;

  publish = vi.fn((channel: string, payload: unknown) => {
    this.published.push({ channel, payload });
    if (this.throwOnPublish) {
      throw new Error('publish failed');
    }
  });

  subscribe = vi.fn((channel: string, handler: (payload: unknown) => void) => {
    const list = this.handlers.get(channel) ?? [];
    list.push(handler);
    this.handlers.set(channel, list);
  });

  emit(channel: string, payload: unknown): void {
    for (const handler of this.handlers.get(channel) ?? []) {
      handler(payload);
    }
  }
}

class MockObsidianService {
  readonly notes = new Map<string, string | null>();
  readonly searchResults = new Map<string, SearchResult[]>();
  readonly searchFailures = new Set<string>();
  readonly readFailures = new Set<string>();
  files: string[] = [];
  failGetFiles = false;

  readNote = vi.fn(async (_vaultPath: string, notePath: string) => {
    if (this.readFailures.has(notePath)) {
      throw new Error(`read failed: ${notePath}`);
    }
    return this.notes.get(notePath) ?? null;
  });

  search = vi.fn((_: string, query: string, _searchContent?: boolean, limit?: number) => {
    if (this.searchFailures.has(query)) {
      throw new Error(`search failed: ${query}`);
    }
    return (this.searchResults.get(query) ?? []).slice(0, limit ?? 50);
  });

  getFiles = vi.fn((_vaultPath: string, _pattern?: string) => {
    if (this.failGetFiles) {
      throw new Error('getFiles failed');
    }
    return [...this.files];
  });
}

class MockGraphEngine {
  readonly nodes = new Map<string, unknown>();
  readonly nodeFailures = new Set<string>();
  traverseFailure: Error | null = null;
  traverseZero: unknown[] = [];
  traverseOne: unknown[] = [];

  getNode = vi.fn(async (entityId: string) => {
    if (this.nodeFailures.has(entityId)) {
      throw new Error(`getNode failed: ${entityId}`);
    }
    return this.nodes.get(entityId) ?? null;
  });

  traverse = vi.fn(async (startId: string, depth = 0) => {
    if (this.traverseFailure) {
      throw this.traverseFailure;
    }
    if (startId === '__all__' && depth === 0) {
      return this.traverseZero;
    }
    if (startId === '__all__' && depth === 1) {
      return this.traverseOne;
    }
    return [];
  });
}

function createHarness() {
  const eventBus = new MockEventBus();
  const obsidian = new MockObsidianService();
  const graphEngine = new MockGraphEngine();
  const bridge = new GraphWikiLinkBridgeImpl({
    graphEngine: graphEngine as never,
    obsidianService: obsidian as never,
    eventBus: eventBus as never,
    vaultPath: '/vault',
  });

  return {
    bridge,
    eventBus,
    obsidian,
    graphEngine,
    internals: bridge as unknown as {
      byEntity: Map<string, { entityId: string; wikiPath: string; lastResolved: number; isOrphaned: boolean }>;
      byWikiPath: Map<string, string>;
      removeFromIndex: (entityId: string, markOrphanedIfReferenced?: string) => void;
    },
  };
}

describe('services/graph-wiki-bridge', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves graph entities to wiki pages through fallback search and then serves cached lookups', async () => {
    const { bridge, eventBus, obsidian, internals } = createHarness();
    obsidian.searchResults.set('hero', [createSearchResult('characters/Hero.md')]);

    const first = await bridge.resolveGraphToWiki('hero');
    const before = internals.byEntity.get('hero')?.lastResolved ?? 0;

    await new Promise(resolve => setTimeout(resolve, 2));

    const second = await bridge.resolveGraphToWiki('hero');
    const after = internals.byEntity.get('hero')?.lastResolved ?? 0;

    expect(first).toBe('characters/Hero.md');
    expect(second).toBe('characters/Hero.md');
    expect(obsidian.search).toHaveBeenCalledTimes(1);
    expect(after).toBeGreaterThan(before);
    expect(eventBus.published).toContainEqual({
      channel: 'graph-wiki:link-resolved',
      payload: { entityId: 'hero', wikiPath: 'characters/Hero.md' },
    });
  });

  it('handles search failures and publish failures without breaking graph-to-wiki resolution', async () => {
    const { bridge, eventBus, obsidian } = createHarness();
    obsidian.searchFailures.add('ghost');

    await expect(bridge.resolveGraphToWiki('ghost')).resolves.toBeNull();

    eventBus.throwOnPublish = true;
    obsidian.searchResults.set('resilient', [createSearchResult('notes/Resilient.md')]);

    await expect(bridge.resolveGraphToWiki('resilient')).resolves.toBe('notes/Resilient.md');
  });

  it('resolves wiki paths to graph entities, parses deduplicated wiki links, and tolerates unreadable notes', async () => {
    const { bridge, obsidian, graphEngine } = createHarness();
    graphEngine.nodes.set('Hero', { id: 'hero-id' });
    obsidian.notes.set('story/scene.md', 'Meet [[Hero]] [[Hero|Masked Hero]] and fear [[Missing]].');
    obsidian.readFailures.add('broken.md');

    const entityId = await bridge.resolveWikiToGraph('notes/Hero.md');
    const links = await bridge.resolveWikiLinks('story/scene.md');
    const unreadable = await bridge.resolveWikiLinks('broken.md');

    expect(entityId).toBe('hero-id');
    expect(await bridge.resolveWikiToGraph('notes/Hero.md')).toBe('hero-id');
    expect(graphEngine.getNode).toHaveBeenCalledWith('Hero');
    expect(graphEngine.getNode).toHaveBeenCalledWith('Missing');
    expect(links).toEqual([
      { linkText: 'Hero', entityId: 'hero-id' },
      { linkText: 'Missing', entityId: null },
    ]);
    expect(unreadable).toEqual([]);
  });

  it('rebuilds indexes from graph and wiki sources, preserving orphaned entries on misses and search errors', async () => {
    const { bridge, obsidian, graphEngine, internals } = createHarness();
    graphEngine.traverseZero = [
      { id: 'hero', name: 'Hero' },
      { id: 'ghost', name: 'Ghost' },
      { id: 'bad', name: 'Bad' },
      {},
    ];
    obsidian.searchResults.set('Hero', [createSearchResult('characters/Hero.md')]);
    obsidian.searchFailures.add('Bad');
    obsidian.files = ['characters/Hero.md', 'loose/Loose.md'];

    const count = await bridge.rebuildIndex();

    expect(count).toBe(2);
    expect(internals.byEntity.get('hero')).toMatchObject({
      entityId: 'hero',
      wikiPath: 'characters/Hero.md',
      isOrphaned: false,
    });
    expect(internals.byEntity.get('ghost')).toMatchObject({
      entityId: 'ghost',
      wikiPath: '',
      isOrphaned: true,
    });
    expect(internals.byEntity.get('bad')).toMatchObject({
      entityId: 'bad',
      wikiPath: '',
      isOrphaned: true,
    });
    expect(internals.byEntity.get('wiki:loose/Loose.md')).toMatchObject({
      entityId: 'wiki:loose/Loose.md',
      wikiPath: 'loose/Loose.md',
      isOrphaned: true,
    });
    expect(bridge.getLinkIndex()).toHaveLength(4);
  });

  it('detects dangling, wiki-only, graph-only, and edge-based orphaned links and publishes them', async () => {
    const { bridge, eventBus, obsidian, graphEngine, internals } = createHarness();
    internals.byEntity.set('hero-id', {
      entityId: 'hero-id',
      wikiPath: 'Hero.md',
      lastResolved: Date.now(),
      isOrphaned: false,
    });
    internals.byWikiPath.set('Hero.md', 'hero-id');
    internals.byEntity.set('graph-orphan', {
      entityId: 'graph-orphan',
      wikiPath: '',
      lastResolved: Date.now(),
      isOrphaned: true,
    });
    internals.byEntity.set('wiki:Loose.md', {
      entityId: 'wiki:Loose.md',
      wikiPath: 'Loose.md',
      lastResolved: Date.now(),
      isOrphaned: true,
    });
    internals.byWikiPath.set('Loose.md', 'wiki:Loose.md');

    obsidian.files = ['Scene.md', 'Broken.md'];
    obsidian.notes.set('Scene.md', '[[Missing]] [[Hero]]');
    obsidian.readFailures.add('Broken.md');
    graphEngine.nodes.set('Hero', { id: 'hero-id' });
    graphEngine.traverseOne = [
      { type: 'edge', source: 'hero-id', target: 'graph-orphan' },
      { type: 'node', id: 'hero-id' },
      { source: '', target: 'missing-target' },
    ];

    const orphans = await bridge.detectOrphanedLinks();

    expect(orphans).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'dangling-reference', source: 'Scene.md', target: 'Missing' }),
      expect.objectContaining({ type: 'graph-no-wiki', source: 'graph-orphan' }),
      expect.objectContaining({ type: 'wiki-no-graph', source: 'Loose.md', target: 'wiki:Loose.md' }),
      expect.objectContaining({ type: 'graph-no-wiki', source: 'hero-id', target: 'graph-orphan' }),
    ]));
    expect(eventBus.published.filter(event => event.channel === 'graph-wiki:orphan-detected')).toHaveLength(4);
  });

  it('summarizes integrity results from rebuild and orphan detection', async () => {
    const { bridge, internals } = createHarness();
    internals.byEntity.set('hero', {
      entityId: 'hero',
      wikiPath: 'Hero.md',
      lastResolved: Date.now(),
      isOrphaned: false,
    });

    vi.spyOn(bridge, 'rebuildIndex').mockResolvedValue(1);
    vi.spyOn(bridge, 'detectOrphanedLinks').mockResolvedValue([
      { type: 'dangling-reference', source: 'Scene.md', target: 'Missing', detectedAt: 1 },
      { type: 'graph-no-wiki', source: 'hero', target: 'ghost', detectedAt: 2 },
      { type: 'wiki-no-graph', source: 'Loose.md', target: 'wiki:Loose.md', detectedAt: 3 },
    ]);

    await expect(bridge.checkIntegrity()).resolves.toEqual({
      totalIndexed: 1,
      orphanedCount: 3,
      brokenLinks: 2,
      details: [
        { type: 'dangling-reference', source: 'Scene.md', target: 'Missing', detectedAt: 1 },
        { type: 'graph-no-wiki', source: 'hero', target: 'ghost', detectedAt: 2 },
        { type: 'wiki-no-graph', source: 'Loose.md', target: 'wiki:Loose.md', detectedAt: 3 },
      ],
    });
  });

  it('updates the index from knowledge and obsidian events, including path refreshes and async file resolution', async () => {
    const { bridge, eventBus, obsidian, graphEngine, internals } = createHarness();
    obsidian.searchResults.set('Hero', [createSearchResult('characters/Hero.md')]);

    eventBus.emit('knowledge:entity-created', { id: 'hero', label: 'Hero' });
    expect(internals.byEntity.get('hero')).toMatchObject({
      wikiPath: 'characters/Hero.md',
      isOrphaned: false,
    });

    obsidian.searchResults.set('Hero', [createSearchResult('characters/Hero-v2.md')]);
    eventBus.emit('knowledge:entity-updated', { id: 'hero', label: 'Hero' });
    expect(internals.byEntity.get('hero')?.wikiPath).toBe('characters/Hero-v2.md');
    expect(internals.byWikiPath.has('characters/Hero.md')).toBe(false);

    eventBus.emit('knowledge:entity-deleted', { id: 'hero' });
    expect(internals.byEntity.has('hero')).toBe(false);

    graphEngine.nodes.set('FreshPage', { id: 'fresh-entity' });
    eventBus.emit('obsidian:file-changed', { path: 'notes/FreshPage.md' });
    await Promise.resolve();
    await Promise.resolve();

    expect(internals.byEntity.get('fresh-entity')).toMatchObject({
      wikiPath: 'notes/FreshPage.md',
      isOrphaned: false,
    });

    const before = internals.byEntity.get('fresh-entity')?.lastResolved ?? 0;
    await new Promise(resolve => setTimeout(resolve, 2));
    eventBus.emit('obsidian:file-changed', { path: 'notes/FreshPage.md' });
    const after = internals.byEntity.get('fresh-entity')?.lastResolved ?? 0;

    expect(after).toBeGreaterThan(before);

    graphEngine.nodeFailures.add('BrokenPage');
    eventBus.emit('obsidian:file-changed', { path: 'notes/BrokenPage.md' });
    await Promise.resolve();
    await Promise.resolve();

    expect(internals.byEntity.has('BrokenPage')).toBe(false);
    void bridge;
  });

  it('removes indexed entries and emits orphan events when a referenced entity is manually removed', () => {
    const { eventBus, internals } = createHarness();
    internals.byEntity.set('hero', {
      entityId: 'hero',
      wikiPath: 'characters/Hero.md',
      lastResolved: Date.now(),
      isOrphaned: false,
    });
    internals.byWikiPath.set('characters/Hero.md', 'hero');

    internals.removeFromIndex('hero', 'story-root');

    expect(internals.byEntity.has('hero')).toBe(false);
    expect(internals.byWikiPath.has('characters/Hero.md')).toBe(false);
    expect(eventBus.published).toContainEqual({
      channel: 'graph-wiki:orphan-detected',
      payload: expect.objectContaining({
        type: 'graph-no-wiki',
        source: 'story-root',
        target: 'hero',
      }),
    });
  });
});
