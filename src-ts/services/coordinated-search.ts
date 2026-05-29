/**
 * CoordinatedSearchService
 *
 * Coordinates search queries across multiple stores (knowledge, memory,
 * vector, graph) and merges deduplicated results by ID.
 *
 * Each store contributes its own results with a `source` tag. Results are
 * merged, deduplicated by ID, and sorted by descending score.
 *
 * SH4.2: Extended to also query VectorSearch and KnowledgeService.
 * SH4.3: Extended to support graph-based search via GraphSearchAdapter.
 */

import { StoreManager } from '../store/store-manager';
import { MemoryManager, MemoryEntry } from '../memory/memory-manager';
import type { IVectorSearch, IKnowledgeService } from '../container/types';
import type { GraphSearchAdapter, GraphSearchResult } from '../search/graph-search-adapter';

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export type CoordinatedSearchSource = 'store' | 'memory' | 'vector' | 'knowledge' | 'graph';

export interface CoordinatedSearchResultItem {
  id: string;
  content: string;
  score: number;
  source: CoordinatedSearchSource;
  metadata: Record<string, unknown>;
}

export interface CoordinatedSearchResult {
  query: string;
  totalResults: number;
  storeResults: number;
  memoryResults: number;
  vectorResults: number;
  knowledgeResults: number;
  graphResults: number;
  results: CoordinatedSearchResultItem[];
}

// ---------------------------------------------------------------------------
// CoordinatedSearchService
// ---------------------------------------------------------------------------

/**
 * Service that queries multiple stores — document store, memory store,
 * vector search, knowledge service, and graph search — merges results,
 * and returns a unified deduplicated result set.
 */
export class CoordinatedSearchService {
  private _store: StoreManager | null = null;
  private _memory: MemoryManager | null = null;
  private _vectorSearch: IVectorSearch | null = null;
  private _knowledgeService: IKnowledgeService | null = null;
  private _graphSearchAdapter: GraphSearchAdapter | null = null;

  /**
   * Configure the store backend.
   */
  setStore(store: StoreManager): void {
    this._store = store;
  }

  /**
   * Configure the memory backend.
   */
  setMemory(memory: MemoryManager): void {
    this._memory = memory;
  }

  /**
   * Configure the vector search backend.
   */
  setVectorSearch(vectorSearch: IVectorSearch): void {
    this._vectorSearch = vectorSearch;
  }

  /**
   * Configure the knowledge service backend.
   */
  setKnowledgeService(knowledgeService: IKnowledgeService): void {
    this._knowledgeService = knowledgeService;
  }

  /**
   * Configure the graph search adapter for wiki graph traversal.
   */
  setGraphSearchAdapter(adapter: GraphSearchAdapter): void {
    this._graphSearchAdapter = adapter;
  }

  /**
   * Execute a coordinated search across all configured stores.
   *
   * Queries each store independently, tags results with their source,
   * deduplicates by ID, and merges into a single sorted result set.
   *
   * @param query - Search query string
   * @param limit - Maximum total results (default 20)
   */
  async search(query: string, limit: number = 20): Promise<CoordinatedSearchResult> {
    const perStoreLimit = limit;
    const allResults: CoordinatedSearchResultItem[] = [];
    let storeCount = 0;
    let memoryCount = 0;
    let vectorCount = 0;
    let knowledgeCount = 0;
    let graphCount = 0;

    // Query store (documents)
    if (this._store) {
      const docs = this._store.searchByContent(query, perStoreLimit);
      for (const doc of docs) {
        allResults.push({
          id: doc.id,
          content: doc.content,
          score: doc.wordCount > 0 ? 1 : 0, // Simple relevance proxy
          source: 'store',
          metadata: doc.metadata,
        });
        storeCount++;
      }
    }

    // Query memory
    if (this._memory) {
      const memories = this._memory.search(query, undefined, undefined, perStoreLimit);
      for (const entry of memories) {
        allResults.push({
          id: entry.id,
          content: entry.content,
          score: entry.importance,
          source: 'memory',
          metadata: { topics: entry.topics, entityId: entry.entityId, source: entry.source },
        });
        memoryCount++;
      }
    }

    // Query vector search (SH4.2)
    if (this._vectorSearch) {
      try {
        const vectorResults = await this._vectorSearch.search(query, { topK: perStoreLimit });
        if (Array.isArray(vectorResults)) {
          for (const item of vectorResults) {
            const r = item as Record<string, unknown>;
            allResults.push({
              id: typeof r.id === 'string' ? r.id : `vector-${vectorCount}`,
              content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
              score: typeof r.score === 'number' ? r.score : 0,
              source: 'vector',
              metadata: (r.metadata as Record<string, unknown>) ?? {},
            });
            vectorCount++;
          }
        }
      } catch {
        // Vector search failure is non-fatal
      }
    }

    // Query knowledge service (SH4.2)
    if (this._knowledgeService) {
      try {
        const knowledgeResults = await this._knowledgeService.search(query, { topK: perStoreLimit });
        if (Array.isArray(knowledgeResults)) {
          for (const item of knowledgeResults) {
            const r = item as Record<string, unknown>;
            allResults.push({
              id: typeof r.id === 'string' ? r.id : `knowledge-${knowledgeCount}`,
              content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
              score: typeof r.score === 'number' ? r.score : 0,
              source: 'knowledge',
              metadata: (r.metadata as Record<string, unknown>) ?? {},
            });
            knowledgeCount++;
          }
        }
      } catch {
        // Knowledge search failure is non-fatal
      }
    }

    // Query graph search (SH4.3)
    if (this._graphSearchAdapter) {
      try {
        const graphResult = await this._graphSearchAdapter.search(query, { maxDepth: 2, limit: perStoreLimit });
        if (graphResult && graphResult.results.length > 0) {
          for (const slug of graphResult.results) {
            allResults.push({
              id: `graph:${slug}`,
              content: slug,
              score: 1 / (1 + (graphResult.depth ?? 1)), // Score decays with depth
              source: 'graph',
              metadata: { slug, startSlug: graphResult.startSlug, depth: graphResult.depth },
            });
            graphCount++;
          }
        }
      } catch {
        // Graph search failure is non-fatal
      }
    }

    // Deduplicate by ID (prefer higher-scoring duplicate)
    const seen = new Map<string, CoordinatedSearchResultItem>();
    for (const item of allResults) {
      const existing = seen.get(item.id);
      if (!existing || item.score > existing.score) {
        seen.set(item.id, item);
      }
    }

    // Sort by descending score and apply limit
    const merged = Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      query,
      totalResults: merged.length,
      storeResults: storeCount,
      memoryResults: memoryCount,
      vectorResults: vectorCount,
      knowledgeResults: knowledgeCount,
      graphResults: graphCount,
      results: merged,
    };
  }

  /**
   * Execute a graph-based search starting from a wiki slug.
   *
   * Performs BFS traversal over wiki page links, then optionally enriches
   * results from other configured stores.
   *
   * @param startSlug - Wiki slug to start traversal from
   * @param options - Graph search options (maxDepth, limit)
   */
  async graphSearch(
    startSlug: string,
    options?: { maxDepth?: number; limit?: number },
  ): Promise<CoordinatedSearchResult> {
    const limit = options?.limit ?? 20;

    if (!this._graphSearchAdapter) {
      return {
        query: startSlug,
        totalResults: 0,
        storeResults: 0,
        memoryResults: 0,
        vectorResults: 0,
        knowledgeResults: 0,
        graphResults: 0,
        results: [],
      };
    }

    const graphResult = await this._graphSearchAdapter.search(startSlug, {
      maxDepth: options?.maxDepth ?? 2,
      limit,
    });

    const allResults: CoordinatedSearchResultItem[] = [];
    let graphCount = 0;

    for (const slug of graphResult.results) {
      allResults.push({
        id: `graph:${slug}`,
        content: slug,
        score: 1 / (1 + (graphResult.depth ?? 1)),
        source: 'graph',
        metadata: { slug, startSlug: graphResult.startSlug, depth: graphResult.depth },
      });
      graphCount++;
    }

    // Enrich graph slugs from knowledge service
    if (this._knowledgeService) {
      for (const slug of graphResult.results) {
        try {
          const knowledgeResults = await this._knowledgeService.search(slug, { topK: 1 });
          if (Array.isArray(knowledgeResults) && knowledgeResults.length > 0) {
            const r = knowledgeResults[0] as Record<string, unknown>;
            allResults.push({
              id: typeof r.id === 'string' ? r.id : `knowledge-${slug}`,
              content: typeof r.content === 'string' ? r.content : String(r.content ?? ''),
              score: typeof r.score === 'number' ? r.score : 0,
              source: 'knowledge',
              metadata: { slug, ...(r.metadata as Record<string, unknown> ?? {}) },
            });
          }
        } catch {
          // Non-fatal
        }
      }
    }

    // Deduplicate by ID
    const seen = new Map<string, CoordinatedSearchResultItem>();
    for (const item of allResults) {
      const existing = seen.get(item.id);
      if (!existing || item.score > existing.score) {
        seen.set(item.id, item);
      }
    }

    const merged = Array.from(seen.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      query: startSlug,
      totalResults: merged.length,
      storeResults: 0,
      memoryResults: 0,
      vectorResults: 0,
      knowledgeResults: 0,
      graphResults: graphCount,
      results: merged,
    };
  }
}