/**
 * GraphSearchAdapter
 *
 * SH4.3: Wraps wiki-graph-search.ts standalone functions into an adapter
 * class that integrates graph-based search into the coordinated search
 * pipeline.
 *
 * Bridges the existing BFS traversal logic from project/wiki-graph-search.ts
 * to the search subsystem, providing a clean interface for the
 * CoordinatedSearchService.
 *
 * @module search/graph-search-adapter
 */

import {
  buildWikiLinkGraph,
  wikiGraphSearch,
  type WikiLinkGraph,
  type WikiGraphSearchResult,
} from '../project/wiki-graph-search';
import type { ProjectWikiStoreResolution } from '../project/wiki-store';
import { resolveProjectWikiStore } from '../project/wiki-store';
import type { ProjectWorkspaceContext } from '../project/workspace-model';
import { createLogger } from '../logger/index.js';

const _log = createLogger('search-graph-adapter');

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GraphSearchOptions {
  /** Maximum BFS traversal depth (default 2) */
  maxDepth?: number;
  /** Maximum number of results (default 50) */
  limit?: number;
}

export interface GraphSearchResult {
  /** The starting slug */
  startSlug: string;
  /** Reachable page slugs (excluding start) */
  results: string[];
  /** Actual traversal depth reached */
  depth: number;
}

// ---------------------------------------------------------------------------
// GraphSearchAdapter
// ---------------------------------------------------------------------------

/**
 * Adapter that wraps wiki-graph-search.ts functionality and provides
 * a search subsystem-compatible interface.
 *
 * Caches the wiki link graph after first build to avoid redundant I/O
 * on repeated searches. Call `invalidateCache()` to force a rebuild.
 */
export class GraphSearchAdapter {
  private _workspace: ProjectWorkspaceContext | null = null;
  private _storeResolution: ProjectWikiStoreResolution | null = null;
  private _cachedGraph: WikiLinkGraph | null = null;
  private _graphBuildPromise: Promise<WikiLinkGraph> | null = null;

  /**
   * Configure with a workspace context for resolving the wiki store.
   */
  setWorkspace(workspace: ProjectWorkspaceContext): void {
    this._workspace = workspace;
    this._storeResolution = resolveProjectWikiStore(
      workspace.identity.workspaceRoot,
      workspace.identity.workspaceId,
    );
    this.invalidateCache();
  }

  /**
   * Configure with an explicit store resolution (bypasses workspace).
   */
  setStoreResolution(resolution: ProjectWikiStoreResolution): void {
    this._storeResolution = resolution;
    this.invalidateCache();
  }

  /**
   * Invalidate the cached graph, forcing a rebuild on next search.
   */
  invalidateCache(): void {
    this._cachedGraph = null;
    this._graphBuildPromise = null;
  }

  /**
   * Execute a graph search starting from a slug.
   *
   * Builds (or reuses cached) wiki link graph, then performs BFS traversal.
   *
   * @param startSlug - Slug or query to start traversal from
   * @param options - Search options (maxDepth, limit)
   */
  async search(startSlug: string, options?: GraphSearchOptions): Promise<GraphSearchResult> {
    const graph = await this.getGraph();

    if (!graph || graph.size === 0) {
      return { startSlug, results: [], depth: 0 };
    }

    const result = wikiGraphSearch(
      graph,
      startSlug,
      options?.maxDepth ?? 2,
      options?.limit ?? 50,
    );

    return {
      startSlug: result.startSlug,
      results: result.visited,
      depth: result.depth,
    };
  }

  /**
   * Get or build the wiki link graph.
   *
   * Uses a singleton promise to avoid concurrent builds.
   */
  private async getGraph(): Promise<WikiLinkGraph | null> {
    if (this._cachedGraph) {
      return this._cachedGraph;
    }

    if (!this._storeResolution) {
      _log.warn('No store resolution configured; graph search unavailable');
      return null;
    }

    // Use singleton promise to prevent concurrent builds
    if (!this._graphBuildPromise) {
      this._graphBuildPromise = buildWikiLinkGraph(this._storeResolution);
    }

    try {
      this._cachedGraph = await this._graphBuildPromise;
      return this._cachedGraph;
    } catch (error) {
      _log.error('Failed to build wiki link graph', { detail: error });
      this._graphBuildPromise = null;
      return null;
    }
  }
}