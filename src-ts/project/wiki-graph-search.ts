/**
 * Wiki Graph Search
 *
 * Provides BFS/DFS traversal over wiki page internal links ([[slug]] syntax).
 * Reads the wiki index, extracts cross-references from page content,
 * and traverses the resulting graph to discover related pages.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { normalizeProjectWikiSlug } from './wiki-schema.js';
import {
  resolveProjectWikiStore,
  readProjectWikiIndex,
  type ProjectWikiIndexEntry,
  type ProjectWikiStoreResolution,
} from './wiki-store.js';
import type { ProjectWorkspaceContext } from './workspace-model.js';

// ---------------------------------------------------------------------------
// Link extraction
// ---------------------------------------------------------------------------

/** Pattern matching wiki-style internal links: [[slug]] or [[slug|display text]] */
const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

/**
 * Extract wiki-style internal link slugs from markdown content.
 *
 * Matches patterns like `[[characters/hero]]` or `[[characters/hero|Hero]]`.
 * Returns normalized slugs.
 */
export function extractWikiLinks(markdown: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  WIKI_LINK_PATTERN.lastIndex = 0;

  while ((match = WIKI_LINK_PATTERN.exec(markdown)) !== null) {
    const rawSlug = match[1].trim();
    if (rawSlug) {
      links.push(normalizeProjectWikiSlug(rawSlug));
    }
  }

  return [...new Set(links)];
}

// ---------------------------------------------------------------------------
// Adjacency builder
// ---------------------------------------------------------------------------

/** Adjacency map: slug -> set of linked slugs */
export type WikiLinkGraph = Map<string, Set<string>>;

/**
 * Build the wiki link graph by reading all pages and extracting internal links.
 */
export async function buildWikiLinkGraph(
  store: ProjectWikiStoreResolution,
): Promise<WikiLinkGraph> {
  const graph: WikiLinkGraph = new Map();

  if (!store.available) return graph;

  const index = await readProjectWikiIndex(store);
  if (!index) return graph;

  // Initialize all indexed slugs as nodes (even if they have no links)
  for (const entry of index.pages) {
    if (!graph.has(entry.slug)) {
      graph.set(entry.slug, new Set());
    }
  }

  // Read each page and extract links
  for (const entry of index.pages) {
    const pagePath = path.join(store.paths.pagesDir, entry.filePath);
    try {
      const markdown = await readFile(pagePath, 'utf8');
      const links = extractWikiLinks(markdown);

      const existing = graph.get(entry.slug)!;
      for (const linkSlug of links) {
        existing.add(linkSlug);
        // Ensure the linked slug exists as a node (even if not yet indexed)
        if (!graph.has(linkSlug)) {
          graph.set(linkSlug, new Set());
        }
      }
      graph.set(entry.slug, existing);
    } catch {
      // Page file not readable — skip
    }
  }

  return graph;
}

// ---------------------------------------------------------------------------
// BFS graph search
// ---------------------------------------------------------------------------

export interface WikiGraphSearchResult {
  startSlug: string;
  visited: string[];
  depth: number;
}

/**
 * Search the wiki graph by BFS traversal from a starting slug.
 *
 * Traverses internal wiki links up to `maxDepth` hops, collecting
 * all reachable page slugs.
 *
 * @param graph - The wiki link adjacency map
 * @param startSlug - The slug to start traversal from
 * @param maxDepth - Maximum traversal depth (default 2)
 * @param limit - Maximum number of results (default 50)
 */
export function wikiGraphSearch(
  graph: WikiLinkGraph,
  startSlug: string,
  maxDepth: number = 2,
  limit: number = 50,
): WikiGraphSearchResult {
  const normalizedStart = normalizeProjectWikiSlug(startSlug);

  if (!graph.has(normalizedStart) || maxDepth <= 0 || limit <= 0) {
    return { startSlug: normalizedStart, visited: [], depth: 0 };
  }

  const visited = new Set<string>([normalizedStart]);
  let frontier: string[] = [normalizedStart];
  let actualDepth = 0;

  for (let depth = 1; depth <= maxDepth; depth++) {
    if (frontier.length === 0 || visited.size - 1 >= limit) break;

    const nextFrontier: string[] = [];

    for (const slug of frontier) {
      const neighbors = graph.get(slug);
      if (!neighbors) continue;

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        nextFrontier.push(neighbor);

        if (visited.size - 1 >= limit) break;
      }

      if (visited.size - 1 >= limit) break;
    }

    if (nextFrontier.length > 0) {
      actualDepth = depth;
    }
    frontier = nextFrontier;
  }

  // Exclude the start slug from results
  const resultSlugs = Array.from(visited).filter((s) => s !== normalizedStart);

  return {
    startSlug: normalizedStart,
    visited: resultSlugs.slice(0, limit),
    depth: actualDepth,
  };
}

// ---------------------------------------------------------------------------
// Convenience: one-shot graph search from workspace context
// ---------------------------------------------------------------------------

/**
 * Perform a wiki graph search from a workspace context.
 *
 * Builds the link graph on-the-fly, then performs BFS traversal.
 * For repeated searches, prefer building the graph once with `buildWikiLinkGraph`
 * and calling `wikiGraphSearch` directly.
 */
export async function searchWikiGraph(
  workspace: ProjectWorkspaceContext,
  startSlug: string,
  maxDepth: number = 2,
  limit: number = 50,
): Promise<WikiGraphSearchResult> {
  const store = resolveProjectWikiStore(
    workspace.identity.workspaceRoot,
    workspace.identity.workspaceId,
  );

  const graph = await buildWikiLinkGraph(store);
  return wikiGraphSearch(graph, startSlug, maxDepth, limit);
}
