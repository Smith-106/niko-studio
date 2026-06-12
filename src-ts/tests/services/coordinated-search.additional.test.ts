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

describe('services/coordinated-search additional coverage', () => {
  it('fills vector, knowledge, and graph fallback fields during coordinated search', async () => {
    const { service, vectorSearch, knowledgeService, graphSearchAdapter } = createService();

    vi.mocked(vectorSearch.search).mockResolvedValue([
      {},
    ]);
    vi.mocked(knowledgeService.search).mockResolvedValue([
      {},
    ]);
    vi.mocked(graphSearchAdapter.search).mockResolvedValue({
      startSlug: 'seed',
      results: ['alpha'],
    });

    service.setVectorSearch(vectorSearch);
    service.setKnowledgeService(knowledgeService);
    service.setGraphSearchAdapter(graphSearchAdapter);

    const result = await service.search('fallbacks', 3);

    expect(result.totalResults).toBe(3);
    expect(result.vectorResults).toBe(1);
    expect(result.knowledgeResults).toBe(1);
    expect(result.graphResults).toBe(1);
    expect(result.results).toEqual([
      {
        id: 'graph:alpha',
        content: 'alpha',
        score: 0.5,
        source: 'graph',
        metadata: { slug: 'alpha', startSlug: 'seed', depth: undefined },
      },
      {
        id: 'vector-0',
        content: '',
        score: 0,
        source: 'vector',
        metadata: {},
      },
      {
        id: 'knowledge-0',
        content: '',
        score: 0,
        source: 'knowledge',
        metadata: {},
      },
    ]);
  });

  it('uses default graph search depth and sparse knowledge enrichment fallbacks', async () => {
    const { service, knowledgeService, graphSearchAdapter } = createService();

    vi.mocked(graphSearchAdapter.search).mockResolvedValue({
      startSlug: 'seed',
      results: ['alpha'],
    });
    vi.mocked(knowledgeService.search).mockResolvedValue([
      {},
    ]);

    service.setGraphSearchAdapter(graphSearchAdapter);
    service.setKnowledgeService(knowledgeService);

    const result = await service.graphSearch('seed', { limit: 3 });

    expect(graphSearchAdapter.search).toHaveBeenCalledWith('seed', { maxDepth: 2, limit: 3 });
    expect(knowledgeService.search).toHaveBeenCalledWith('alpha', { topK: 1 });
    expect(result.graphResults).toBe(1);
    expect(result.totalResults).toBe(2);
    expect(result.results).toEqual([
      {
        id: 'graph:alpha',
        content: 'alpha',
        score: 0.5,
        source: 'graph',
        metadata: { slug: 'alpha', startSlug: 'seed', depth: undefined },
      },
      {
        id: 'knowledge-alpha',
        content: '',
        score: 0,
        source: 'knowledge',
        metadata: { slug: 'alpha' },
      },
    ]);
  });
});
