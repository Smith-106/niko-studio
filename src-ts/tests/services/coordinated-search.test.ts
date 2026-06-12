import { describe, expect, it, vi } from 'vitest';

import type { IKnowledgeService, IVectorSearch } from '../../container/types.js';
import type { MemoryManager } from '../../memory/memory-manager.js';
import type { GraphSearchAdapter } from '../../search/graph-search-adapter.js';
import { CoordinatedSearchService } from '../../services/coordinated-search.js';
import type { StoreManager } from '../../store/store-manager.js';

function createService() {
  const service = new CoordinatedSearchService();

  const store = {
    searchByContent: vi.fn(),
  } as unknown as StoreManager;

  const memory = {
    search: vi.fn(),
  } as unknown as MemoryManager;

  const vectorSearch = {
    search: vi.fn(),
  } as unknown as IVectorSearch;

  const knowledgeService = {
    search: vi.fn(),
  } as unknown as IKnowledgeService;

  const graphSearchAdapter = {
    search: vi.fn(),
  } as unknown as GraphSearchAdapter;

  return {
    service,
    store,
    memory,
    vectorSearch,
    knowledgeService,
    graphSearchAdapter,
  };
}

describe('services/coordinated-search', () => {
  it('returns an empty result when no backends are configured', async () => {
    const service = new CoordinatedSearchService();

    await expect(service.search('hero')).resolves.toEqual({
      query: 'hero',
      totalResults: 0,
      storeResults: 0,
      memoryResults: 0,
      vectorResults: 0,
      knowledgeResults: 0,
      graphResults: 0,
      results: [],
    });
  });

  it('merges all configured backends, normalizes fallback fields, and deduplicates by id', async () => {
    const {
      service,
      store,
      memory,
      vectorSearch,
      knowledgeService,
      graphSearchAdapter,
    } = createService();

    vi.mocked(store.searchByContent).mockReturnValue([
      { id: 'shared', content: 'store wins duplicate', wordCount: 50, metadata: { source: 'store' } },
      { id: 'doc-low', content: 'store low score', wordCount: 0, metadata: { source: 'store-low' } },
    ]);
    vi.mocked(memory.search).mockReturnValue([
      {
        id: 'mem-1',
        content: 'memory result',
        importance: 0.8,
        topics: ['hero'],
        entityId: 'char-1',
        source: 'memory',
      },
      {
        id: 'shared',
        content: 'memory loses duplicate',
        importance: 0.4,
        topics: [],
        entityId: 'char-2',
        source: 'memory',
      },
    ] as never[]);
    vi.mocked(vectorSearch.search).mockResolvedValue([
      { content: 123 },
      { id: 'vec-1', content: 'vector result', score: 0.95, metadata: { lane: 'semantic' } },
    ]);
    vi.mocked(knowledgeService.search).mockResolvedValue([
      { id: 'know-1', content: 'knowledge result', score: 0.7, metadata: { lane: 'knowledge' } },
    ]);
    vi.mocked(graphSearchAdapter.search).mockResolvedValue({
      startSlug: 'hero-start',
      depth: 2,
      results: ['slug-a'],
    });

    service.setStore(store);
    service.setMemory(memory);
    service.setVectorSearch(vectorSearch);
    service.setKnowledgeService(knowledgeService);
    service.setGraphSearchAdapter(graphSearchAdapter);

    const result = await service.search('hero', 10);

    expect(result.storeResults).toBe(2);
    expect(result.memoryResults).toBe(2);
    expect(result.vectorResults).toBe(2);
    expect(result.knowledgeResults).toBe(1);
    expect(result.graphResults).toBe(1);
    expect(result.totalResults).toBe(7);
    expect(result.results.map((item) => item.id)).toEqual([
      'shared',
      'vec-1',
      'mem-1',
      'know-1',
      'graph:slug-a',
      'doc-low',
      'vector-0',
    ]);
    expect(result.results.find((item) => item.id === 'shared')).toMatchObject({
      content: 'store wins duplicate',
      source: 'store',
      score: 1,
      metadata: { source: 'store' },
    });
    expect(result.results.find((item) => item.id === 'vector-0')).toMatchObject({
      content: '123',
      score: 0,
      source: 'vector',
      metadata: {},
    });

    expect(store.searchByContent).toHaveBeenCalledWith('hero', 10);
    expect(memory.search).toHaveBeenCalledWith('hero', undefined, undefined, 10);
    expect(vectorSearch.search).toHaveBeenCalledWith('hero', { topK: 10 });
    expect(knowledgeService.search).toHaveBeenCalledWith('hero', { topK: 10 });
    expect(graphSearchAdapter.search).toHaveBeenCalledWith('hero', { maxDepth: 2, limit: 10 });
  });

  it('keeps store and memory results when optional backends fail', async () => {
    const {
      service,
      store,
      memory,
      vectorSearch,
      knowledgeService,
      graphSearchAdapter,
    } = createService();

    vi.mocked(store.searchByContent).mockReturnValue([
      { id: 'doc-1', content: 'document', wordCount: 10, metadata: { type: 'doc' } },
    ]);
    vi.mocked(memory.search).mockReturnValue([
      {
        id: 'mem-1',
        content: 'memory',
        importance: 0.6,
        topics: ['topic'],
        entityId: 'entity-1',
        source: 'memory',
      },
    ] as never[]);
    vi.mocked(vectorSearch.search).mockRejectedValue(new Error('vector down'));
    vi.mocked(knowledgeService.search).mockRejectedValue(new Error('knowledge down'));
    vi.mocked(graphSearchAdapter.search).mockRejectedValue(new Error('graph down'));

    service.setStore(store);
    service.setMemory(memory);
    service.setVectorSearch(vectorSearch);
    service.setKnowledgeService(knowledgeService);
    service.setGraphSearchAdapter(graphSearchAdapter);

    const result = await service.search('fallback-only', 5);

    expect(result.totalResults).toBe(2);
    expect(result.vectorResults).toBe(0);
    expect(result.knowledgeResults).toBe(0);
    expect(result.graphResults).toBe(0);
    expect(result.results).toEqual([
      {
        id: 'doc-1',
        content: 'document',
        score: 1,
        source: 'store',
        metadata: { type: 'doc' },
      },
      {
        id: 'mem-1',
        content: 'memory',
        score: 0.6,
        source: 'memory',
        metadata: { topics: ['topic'], entityId: 'entity-1', source: 'memory' },
      },
    ]);
  });

  it('returns an empty graph search result when no graph adapter is configured', async () => {
    const service = new CoordinatedSearchService();

    await expect(service.graphSearch('start-slug')).resolves.toEqual({
      query: 'start-slug',
      totalResults: 0,
      storeResults: 0,
      memoryResults: 0,
      vectorResults: 0,
      knowledgeResults: 0,
      graphResults: 0,
      results: [],
    });
  });

  it('enriches graph results from the knowledge service and keeps non-fatal failures isolated', async () => {
    const { service, knowledgeService, graphSearchAdapter } = createService();

    vi.mocked(graphSearchAdapter.search).mockResolvedValue({
      startSlug: 'seed',
      depth: 1,
      results: ['alpha', 'beta'],
    });
    vi.mocked(knowledgeService.search)
      .mockResolvedValueOnce([
        { id: 'graph:alpha', content: 'alpha enriched', score: 0.9, metadata: { kind: 'page' } },
      ])
      .mockRejectedValueOnce(new Error('beta enrichment failed'));

    service.setGraphSearchAdapter(graphSearchAdapter);
    service.setKnowledgeService(knowledgeService);

    const result = await service.graphSearch('seed', { maxDepth: 4, limit: 10 });

    expect(graphSearchAdapter.search).toHaveBeenCalledWith('seed', { maxDepth: 4, limit: 10 });
    expect(knowledgeService.search).toHaveBeenNthCalledWith(1, 'alpha', { topK: 1 });
    expect(knowledgeService.search).toHaveBeenNthCalledWith(2, 'beta', { topK: 1 });
    expect(result.graphResults).toBe(2);
    expect(result.totalResults).toBe(2);
    expect(result.results).toEqual([
      {
        id: 'graph:alpha',
        content: 'alpha enriched',
        score: 0.9,
        source: 'knowledge',
        metadata: { slug: 'alpha', kind: 'page' },
      },
      {
        id: 'graph:beta',
        content: 'beta',
        score: 0.5,
        source: 'graph',
        metadata: { slug: 'beta', startSlug: 'seed', depth: 1 },
      },
    ]);
  });
});
