/**
 * SmartSearch TypeScript Implementation
 *
 * Migrated from src/search/smart_search.py
 *
 * Features:
 * - SearchMode: FUZZY, SEMANTIC, HYBRID, AUTO
 * - Fuzzy Search: FTS5 + ripgrep for keyword matching
 * - Semantic Search: Vector embeddings via VectorIndex
 * - RRF (Reciprocal Rank Fusion) for result merging
 * - Auto mode: intelligent mode selection based on query
 */

import { execFile } from 'node:child_process';

import { createLogger } from '../logger/index.js';

const _log = createLogger('smart-search');

import type { SearchInterface } from '../protocols/search';
import type { EmbeddingService } from '../protocols/embedding';

function execFileAsync(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, (error, stdout, stderr) => {
      if (error) {
        const candidate = error as NodeJS.ErrnoException & {
          stdout?: string;
          stderr?: string;
        };
        candidate.stdout = stdout;
        candidate.stderr = stderr;
        reject(candidate);
        return;
      }

      resolve({
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Search mode enumeration
 */
export enum SearchMode {
  FUZZY = 'fuzzy',       // FTS5 + ripgrep keyword search
  SEMANTIC = 'semantic', // Vector embedding search
  HYBRID = 'hybrid',     // Combined fuzzy + semantic with RRF
  AUTO = 'auto',         // Intelligent mode selection
}

/**
 * Search result location schema
 */
export interface SearchResultLocation {
  kind: 'line' | 'char' | 'range';
  start: number;
  end?: number;
}

/**
 * Search result metadata
 */
export interface SearchResultMetadata {
  path?: string;
  doc_id?: string;
  surface?: string;
  loc?: SearchResultLocation;
  chunk_index?: number;
  extra?: Record<string, unknown>;
}

/**
 * Enhanced search result with source tracking
 */
export interface SmartSearchResult {
  id: string;
  content: string;
  score: number;
  type: string;
  metadata: SearchResultMetadata;
  source: string; // fuzzy, semantic, hybrid, ripgrep
  mode_used: string;
  loc?: SearchResultLocation;
  snapshot_query?: string;
}

/**
 * Search options
 */
export interface SearchOptions {
  topK?: number;
  typeFilter?: string;
  minScore?: number;
  mode?: SearchMode | string;
}

/**
 * Vector index interface (will be implemented separately)
 */
export interface VectorIndexInterface {
  search(
    query: string,
    options?: {
      topK?: number;
      minScore?: number;
      typeFilter?: string;
    }
  ): Promise<SmartSearchResult[]>;

  upsert(
    id: string,
    content: string,
    metadata?: Record<string, unknown>,
    type?: string
  ): void;

  delete(id: string): boolean;
}

/**
 * Database connection interface
 */
export interface DatabaseConnection {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): void;
}

/**
 * SmartSearch configuration
 */
export interface SmartSearchConfig {
  vectorIndex?: VectorIndexInterface;
  dbConnection?: DatabaseConnection;
  embeddingService?: EmbeddingService;
  rrfK?: number;
  semanticWeight?: number;
  fuzzyWeight?: number;
  ripgrepPaths?: string[];
}

/**
 * Smart Search Service
 *
 * Combines Semantic Search (Vector) and Fuzzy Search (Keyword).
 * Supports multiple search modes with RRF fusion for hybrid results.
 */
export class SmartSearch implements SearchInterface {
  private readonly vectorIndex?: VectorIndexInterface;
  private readonly dbConnection?: DatabaseConnection;
  private readonly embeddingService?: EmbeddingService;
  private readonly rrfK: number;
  private readonly semanticWeight: number;
  private readonly fuzzyWeight: number;
  private readonly ripgrepPaths: string[];
  private ripgrepAvailable: boolean;
  private ripgrepChecked: boolean;

  constructor(config: SmartSearchConfig = {}) {
    this.vectorIndex = config.vectorIndex;
    this.dbConnection = config.dbConnection;
    this.embeddingService = config.embeddingService;
    this.rrfK = config.rrfK ?? 60;
    this.semanticWeight = config.semanticWeight ?? 0.6;
    this.fuzzyWeight = config.fuzzyWeight ?? 0.4;
    this.ripgrepPaths = config.ripgrepPaths ?? [];
    this.ripgrepAvailable = false; // Will be checked on first use
    this.ripgrepChecked = false;
  }

  /**
   * Execute search with specified mode
   */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<Record<string, unknown>[]> {
    const topK = options?.topK ?? 5;
    const typeFilter = options?.typeFilter;
    const minScore = options?.minScore ?? 0.0;
    let mode = options?.mode ?? SearchMode.AUTO;

    // Normalize mode
    if (typeof mode === 'string') {
      mode = SearchMode[mode.toUpperCase() as keyof typeof SearchMode] || SearchMode.HYBRID;
    }

    // Auto mode selection
    if (mode === SearchMode.AUTO) {
      mode = this.selectMode(query);
    }

    // Execute based on mode
    let results: SmartSearchResult[];
    switch (mode) {
      case SearchMode.FUZZY:
        results = await this.fuzzySearch(query, { topK: topK * 2, typeFilter });
        break;
      case SearchMode.SEMANTIC:
        results = await this.semanticSearch(query, { topK: topK * 2, typeFilter });
        if (results.length === 0) {
          results = await this.fuzzySearch(query, { topK: topK * 2, typeFilter });
        }
        break;
      case SearchMode.HYBRID:
      default:
        results = await this.hybridSearch(query, { topK: topK * 2, typeFilter });
        break;
    }

    // Apply min_score filter and limit
    const filtered = results.filter(r => r.score >= minScore);

    // Update mode_used
    const modeStr = typeof mode === 'string' ? mode : (mode as SearchMode).toString();
    for (const r of filtered) {
      r.mode_used = modeStr;
    }

    return filtered.slice(0, topK).map(r => this.resultToDict(r));
  }

  /**
   * Index a document
   */
  async index(
    id: string,
    content: string,
    options?: {
      metadata?: Record<string, unknown>;
      type?: string;
    }
  ): Promise<void> {
    if (!this.vectorIndex) {
      throw new Error('No vector index available for indexing');
    }

    this.vectorIndex.upsert(
      id,
      content,
      options?.metadata,
      options?.type ?? 'chunk'
    );
  }

  /**
   * Delete a document
   */
  async delete(id: string): Promise<boolean> {
    if (!this.vectorIndex) {
      throw new Error('No vector index available for deletion');
    }

    return this.vectorIndex.delete(id);
  }

  /**
   * Fuzzy search using FTS5
   */
  async fuzzySearch(
    query: string,
    options?: { topK?: number; typeFilter?: string }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 10;
    const typeFilter = options?.typeFilter;

    // FTS5 search on database
    const ftsResults = await this.fts5Search(query, { topK, typeFilter });
    const ripgrepResults = await this.ripgrepSearch(query, { topK, typeFilter });

    // Deduplicate by ID, keeping highest score
    const seen = new Map<string, SmartSearchResult>();
    for (const r of [...ftsResults, ...ripgrepResults]) {
      if (!seen.has(r.id) || r.score > seen.get(r.id)!.score) {
        seen.set(r.id, r);
      }
    }

    // Sort by score
    const deduped = Array.from(seen.values()).sort((a, b) => b.score - a.score);
    return deduped.slice(0, topK);
  }

  /**
   * Semantic search using vector embeddings
   */
  async semanticSearch(
    query: string,
    options?: { topK?: number; typeFilter?: string; minScore?: number }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 10;
    const typeFilter = options?.typeFilter;
    const minScore = options?.minScore ?? 0.0;

    if (!this.vectorIndex) {
      return [];
    }

    try {
      const searchResults = await this.vectorIndex.search(query, {
        topK,
        minScore,
        typeFilter,
      });

      return searchResults.map(sr => ({
        id: sr.id,
        content: sr.content,
        score: sr.score,
        type: sr.type,
        metadata: sr.metadata,
        source: 'semantic',
        mode_used: 'semantic',
        loc: sr.loc,
        snapshot_query: sr.snapshot_query,
      }));
    } catch (error) {
      console.error('Semantic search failed:', error);
      return [];
    }
  }

  /**
   * Hybrid search combining fuzzy and semantic with RRF fusion
   */
  async hybridSearch(
    query: string,
    options?: { topK?: number; typeFilter?: string; minScore?: number }
  ): Promise<SmartSearchResult[]> {
    const topK = options?.topK ?? 10;
    const typeFilter = options?.typeFilter;
    const minScore = options?.minScore ?? 0.0;

    // Get results from both methods in parallel
    let fuzzyResults: SmartSearchResult[] = [];
    let semanticResults: SmartSearchResult[] = [];

    try {
      fuzzyResults = await this.fuzzySearch(query, { topK: topK * 2, typeFilter });
    } catch (error) {
      _log.error('Fuzzy search failed', { detail: error });
    }

    try {
      semanticResults = await this.semanticSearch(query, { topK: topK * 2, typeFilter });
    } catch (error) {
      _log.error('Semantic search failed', { detail: error });
    }

    // RRF Fusion
    const merged = this.rrfMerge(semanticResults, fuzzyResults);

    // Apply min_score filter
    const filtered = merged.filter(r => r.score >= minScore);

    return filtered.slice(0, topK);
  }

  /**
   * Intelligently select search mode based on query characteristics
   */
  private selectMode(query: string): SearchMode {
    const tokens = query.split(/\s+/);

    // Check for quoted phrases
    if (query.includes('"') || query.includes("'")) {
      return SearchMode.HYBRID;
    }

    // Short exact term queries
    if (tokens.length <= 2) {
      const stopwords = ['the', 'a', 'an', 'is', 'are', 'what', 'how', 'why'];
      const hasStopwords = tokens.some(t => stopwords.includes(t.toLowerCase()));
      if (!hasStopwords) {
        return SearchMode.FUZZY;
      }
    }

    // Natural language / question queries
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    if (questionWords.some(w => query.toLowerCase().startsWith(w))) {
      return SearchMode.SEMANTIC;
    }

    // Long queries benefit from semantic understanding
    if (tokens.length > 5) {
      return SearchMode.SEMANTIC;
    }

    // Default to hybrid for balanced results
    return SearchMode.HYBRID;
  }

  /**
   * FTS5 full-text search
   */
  private async fts5Search(
    query: string,
    options?: { topK?: number; typeFilter?: string }
  ): Promise<SmartSearchResult[]> {
    if (!this.dbConnection) {
      return [];
    }

    const topK = options?.topK ?? 10;
    const typeFilter = options?.typeFilter;

    // Tokenize query for FTS5
    const tokens = query.split(/\s+/).filter(t => t.trim());
    if (tokens.length === 0) {
      return [];
    }

    // Build FTS5 query with OR
    const ftsQuery = tokens.map(t => `"${t}"`).join(' OR ');

    try {
      // Try FTS5 on vector_items_fts
      let sql = `
        SELECT
          vi.id,
          vi.content,
          vi.metadata,
          vi.type,
          bm25(vector_items_fts) as rank
        FROM vector_items_fts
        JOIN vector_items vi ON vi.id = vector_items_fts.id
        WHERE vector_items_fts MATCH ?
      `;
      const params: unknown[] = [ftsQuery];

      if (typeFilter) {
        sql += ' AND vi.type = ?';
        params.push(typeFilter);
      }

      sql += ' ORDER BY rank LIMIT ?';
      params.push(topK);

      const rows = await this.dbConnection.query<{
        id: string;
        content: string;
        metadata: string;
        type: string;
        rank: number;
      }>(sql, params);

      return rows.map(row => {
        // BM25 scores are negative, lower is better
        const bm25Score = Math.abs(row.rank);
        const normalizedScore = 1.0 / (1.0 + bm25Score);
        const metadata = this.parseMetadata(row.metadata);

        return {
          id: row.id,
          content: row.content,
          score: normalizedScore,
          type: row.type,
          metadata: this.buildSearchMetadata(metadata),
          source: 'fts5',
          mode_used: 'fuzzy',
          loc: metadata.loc as SearchResultLocation,
          snapshot_query: 'search_result_sample_query',
        };
      });
    } catch (error) {
      // Fallback to LIKE search
      return this.likeSearch(query, { topK, typeFilter });
    }
  }

  /**
   * Fallback LIKE-based search
   */
  private async likeSearch(
    query: string,
    options?: { topK?: number; typeFilter?: string }
  ): Promise<SmartSearchResult[]> {
    if (!this.dbConnection) {
      return [];
    }

    const topK = options?.topK ?? 10;
    const typeFilter = options?.typeFilter;
    const tokens = query.split(/\s+/).filter(t => t.trim());

    if (tokens.length === 0) {
      return [];
    }

    const conditions = tokens.map(() => 'content LIKE ?');
    const params: unknown[] = tokens.map(t => `%${t}%`);
    const whereClause = conditions.join(' OR ');

    // Try vector_items table first, then items
    for (const table of ['vector_items', 'items']) {
      try {
        let sql = `SELECT id, content, metadata, type FROM ${table} WHERE (${whereClause})`;

        if (typeFilter) {
          sql += ' AND type = ?';
          params.push(typeFilter);
        }

        sql += ` LIMIT ${topK * 2}`;

        const rows = await this.dbConnection.query<{
          id: string;
          content: string;
          metadata: string;
          type: string;
        }>(sql, params);

        const results: SmartSearchResult[] = rows.map(row => {
          const contentLower = row.content.toLowerCase();
          const matchCount = tokens.filter(t => contentLower.includes(t.toLowerCase())).length;
          const score = matchCount / tokens.length;
          const metadata = this.parseMetadata(row.metadata);

          return {
            id: row.id,
            content: row.content,
            score,
            type: row.type,
            metadata: this.buildSearchMetadata(metadata),
            source: 'like',
            mode_used: 'fuzzy',
            loc: metadata.loc as SearchResultLocation,
            snapshot_query: 'search_result_sample_query',
          };
        });

        results.sort((a, b) => b.score - a.score);

        if (results.length > 0) {
          return results.slice(0, topK);
        }
      } catch (error) {
        continue;
      }
    }

    return [];
  }

  /**
   * Ripgrep-based fuzzy search over configured filesystem paths
   */
  private async ripgrepSearch(
    query: string,
    options?: { topK?: number; typeFilter?: string }
  ): Promise<SmartSearchResult[]> {
    if (this.ripgrepPaths.length === 0) {
      return [];
    }

    const ripgrepAvailable = await this.ensureRipgrepAvailable();
    if (!ripgrepAvailable) {
      return [];
    }

    const topK = options?.topK ?? 10;
    const tokens = query.split(/\s+/).filter(t => t.trim());
    if (tokens.length === 0) {
      return [];
    }

    const args = [
      '--json',
      '--line-number',
      '--color',
      'never',
      '--no-config',
      '--fixed-strings',
    ];

    for (const token of tokens) {
      args.push('-e', token);
    }

    args.push(...this.ripgrepPaths);

    try {
      const { stdout } = await execFileAsync('rg', args);
      const results: SmartSearchResult[] = [];
      const queryTokenCount = tokens.length;

      for (const rawLine of stdout.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line) continue;

        let event: Record<string, unknown>;
        try {
          event = JSON.parse(line) as Record<string, unknown>;
        } catch {
          continue;
        }

        if (event['type'] !== 'match') {
          continue;
        }

        const data = event['data'] as Record<string, unknown> | undefined;
        const pathRecord = data?.['path'] as Record<string, unknown> | undefined;
        const linesRecord = data?.['lines'] as Record<string, unknown> | undefined;
        const submatches = Array.isArray(data?.['submatches'])
          ? (data?.['submatches'] as Array<Record<string, unknown>>)
          : [];

        const path = typeof pathRecord?.['text'] === 'string'
          ? pathRecord['text']
          : undefined;
        const content = typeof linesRecord?.['text'] === 'string'
          ? linesRecord['text'].replace(/\r?\n$/, '')
          : '';
        const lineNumber = typeof data?.['line_number'] === 'number'
          ? data['line_number']
          : Number(data?.['line_number'] ?? 0);

        if (!path || !content || !Number.isFinite(lineNumber) || lineNumber <= 0) {
          continue;
        }

        const contentLower = content.toLowerCase();
        const matchedTokenCount = tokens.filter(token => contentLower.includes(token.toLowerCase())).length;
        const submatchBonus = Math.min(submatches.length / Math.max(queryTokenCount, 1), 1);
        const score = Math.min(
          1,
          matchedTokenCount / queryTokenCount + submatchBonus * 0.1,
        );

        results.push({
          id: `ripgrep:${path}:${lineNumber}`,
          content,
          score,
          type: options?.typeFilter ?? 'file',
          metadata: {
            path,
            loc: {
              kind: 'line',
              start: lineNumber,
              end: lineNumber,
            },
            extra: {
              submatch_count: submatches.length,
            },
          },
          source: 'ripgrep',
          mode_used: 'fuzzy',
          loc: {
            kind: 'line',
            start: lineNumber,
            end: lineNumber,
          },
          snapshot_query: query,
        });
      }

      results.sort((a, b) => b.score - a.score);
      return results.slice(0, topK);
    } catch (error) {
      const candidate = error as NodeJS.ErrnoException & { code?: string | number };
      const errorCode = String(candidate?.code ?? '');
      if (errorCode === '1') {
        return [];
      }
      if (errorCode === 'ENOENT') {
        this.ripgrepAvailable = false;
        this.ripgrepChecked = true;
        return [];
      }
      return [];
    }
  }

  /**
   * Detect ripgrep availability once and cache the result
   */
  private async ensureRipgrepAvailable(): Promise<boolean> {
    if (this.ripgrepChecked) {
      return this.ripgrepAvailable;
    }

    this.ripgrepChecked = true;

    try {
      await execFileAsync('rg', ['--version']);
      this.ripgrepAvailable = true;
    } catch {
      this.ripgrepAvailable = false;
    }

    return this.ripgrepAvailable;
  }

  /**
   * Reciprocal Rank Fusion to merge results
   *
   * RRF score = weight / (k + rank)
   */
  private rrfMerge(
    semanticResults: SmartSearchResult[],
    fuzzyResults: SmartSearchResult[]
  ): SmartSearchResult[] {
    const scores = new Map<string, number>();
    const resultMap = new Map<string, SmartSearchResult>();

    // Process semantic results
    semanticResults.forEach((result, rank) => {
      const docId = result.id;
      const rrfScore = this.semanticWeight / (this.rrfK + rank + 1);
      scores.set(docId, (scores.get(docId) || 0) + rrfScore);
      resultMap.set(docId, result);
    });

    // Process fuzzy results
    fuzzyResults.forEach((result, rank) => {
      const docId = result.id;
      const rrfScore = this.fuzzyWeight / (this.rrfK + rank + 1);
      scores.set(docId, (scores.get(docId) || 0) + rrfScore);
      if (!resultMap.has(docId)) {
        resultMap.set(docId, result);
      }
    });

    // Sort by combined score
    const sortedIds = Array.from(scores.keys()).sort((a, b) => scores.get(b)! - scores.get(a)!);

    // Build result list
    const merged: SmartSearchResult[] = [];
    for (const docId of sortedIds) {
      const result = resultMap.get(docId)!;
      merged.push({
        id: result.id,
        content: result.content,
        score: scores.get(docId)!,
        type: result.type,
        metadata: result.metadata,
        source: 'hybrid',
        mode_used: result.mode_used,
        loc: result.loc || result.metadata.loc,
        snapshot_query: result.snapshot_query || 'search_result_sample_query',
      });
    }

    return merged;
  }

  /**
   * Parse metadata JSON
   */
  private parseMetadata(metadataStr: string | null): Record<string, unknown> {
    if (!metadataStr) {
      return {};
    }

    try {
      return JSON.parse(metadataStr);
    } catch {
      return {};
    }
  }

  /**
   * Build search metadata from raw metadata
   */
  private buildSearchMetadata(metadata: Record<string, unknown>): SearchResultMetadata {
    const {
      path,
      doc_id,
      surface,
      loc,
      chunk_index,
      ...extra
    } = metadata;

    return {
      path: path as string | undefined,
      doc_id: doc_id as string | undefined,
      surface: surface as string | undefined,
      loc: loc as SearchResultLocation | undefined,
      chunk_index: chunk_index as number | undefined,
      extra: extra as Record<string, unknown>,
    };
  }

  /**
   * Convert result to dictionary format
   */
  private resultToDict(result: SmartSearchResult): Record<string, unknown> {
    return {
      id: result.id,
      content: result.content,
      score: Math.round(result.score * 10000) / 10000, // Round to 4 decimals
      type: result.type,
      source: result.source,
      mode_used: result.mode_used,
      metadata: result.metadata,
      loc: result.loc,
      snapshot_query: result.snapshot_query,
    };
  }
}

/**
 * Factory function to create SmartSearch instance
 */
export function createSmartSearch(config: SmartSearchConfig): SmartSearch {
  return new SmartSearch(config);
}
