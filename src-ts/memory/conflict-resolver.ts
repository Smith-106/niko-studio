/**
 * Conflict Resolver Module
 *
 * Extracted from unified_memory.py with enhancements:
 * - ConflictResolutionStrategy enum for strategy selection
 * - Enhanced semantic similarity detection
 * - Conflict resolution with configurable strategies
 *
 * Strategies:
 * - AUTO: Newer information supersedes older (default)
 * - KEEP_OLD: Preserve existing information
 * - KEEP_NEW: Replace with new information
 * - MERGE: Combine both versions
 * - MANUAL: Defer to user decision
 */

import { createLogger } from "../logger/index.js";

const _log = createLogger("conflict");

/** Strategies for resolving memory conflicts. */
export enum ConflictResolutionStrategy {
  AUTO = "auto", // Automatic: newer supersedes older
  KEEP_OLD = "keep_old", // Preserve existing information
  KEEP_NEW = "keep_new", // Replace with new information
  MERGE = "merge", // Combine both versions
  MANUAL = "manual", // Defer to user decision
}

/** Types of detected conflicts. */
export enum ConflictType {
  CONTRADICTION = "contradiction", // Direct semantic contradiction
  TEMPORAL = "temporal", // Time-based conflict
  DUPLICATE = "duplicate", // Near-duplicate content
  UPDATE = "update", // Information update
  AMBIGUOUS = "ambiguous", // Unclear conflict
}

/** Information about a detected conflict. */
export class ConflictInfo {
  id: string;
  content: string;
  validFrom: string | null;
  validUntil: string | null;
  importance: number;
  conflictType: ConflictType;
  similarityScore: number;
  metadata: Record<string, unknown>;

  constructor(params: {
    id: string;
    content: string;
    validFrom?: string | null;
    validUntil?: string | null;
    importance?: number;
    conflictType?: ConflictType;
    similarityScore?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.validFrom = params.validFrom ?? null;
    this.validUntil = params.validUntil ?? null;
    this.importance = params.importance ?? 0.5;
    this.conflictType = params.conflictType ?? ConflictType.CONTRADICTION;
    this.similarityScore = params.similarityScore ?? 0.0;
    this.metadata = params.metadata ?? {};
  }
}

/** Result of conflict resolution. */
export class ResolutionResult {
  action: string; // "update", "reject", "merge", "defer"
  keptIds: string[];
  obsoleteIds: string[];
  mergedContent: string | null;
  reason: string;
  requiresManual: boolean;
  metadata: Record<string, unknown>;

  constructor(params: {
    action: string;
    keptIds?: string[];
    obsoleteIds?: string[];
    mergedContent?: string | null;
    reason?: string;
    requiresManual?: boolean;
    metadata?: Record<string, unknown>;
  }) {
    this.action = params.action;
    this.keptIds = params.keptIds ?? [];
    this.obsoleteIds = params.obsoleteIds ?? [];
    this.mergedContent = params.mergedContent ?? null;
    this.reason = params.reason ?? "";
    this.requiresManual = params.requiresManual ?? false;
    this.metadata = params.metadata ?? {};
  }
}

/** Interface for conflict resolution implementations. */
export interface IConflictResolver {
  /**
   * Check for potential conflicts.
   *
   * @param content - New content to check.
   * @param entityId - Entity ID to scope the check.
   * @returns List of detected conflicts.
   */
  check(
    content: string,
    entityId?: string | null,
    scope?: {
      userId?: string | null;
      projectId?: string | null;
      sessionId?: string | null;
    }
  ): Promise<ConflictInfo[]>;

  /**
   * Resolve detected conflicts.
   *
   * @param content - New content being added.
   * @param conflicts - List of detected conflicts.
   * @param strategy - Resolution strategy to use.
   * @returns ResolutionResult with action to take.
   */
  resolve(
    content: string,
    conflicts: ConflictInfo[],
    strategy?: ConflictResolutionStrategy
  ): Promise<ResolutionResult>;
}

/** Interface for database connections used by ConflictResolver */
export interface ConflictDbConnection {
  execute(sql: string, params: unknown[]): { fetchAll(): unknown[][] };
}

/** Interface for embedder used by ConflictResolver */
export interface ConflictEmbedder {
  embed(text: string): number[];
  similarity(vecA: number[], vecB: number[]): number;
}

/**
 * Conflict detection and resolution engine.
 *
 * Detects contradictions, duplicates, and temporal conflicts
 * in memory content and provides resolution strategies.
 */
export class ConflictResolver implements IConflictResolver {
  /** Negation pairs for contradiction detection */
  static readonly NEGATION_PAIRS: [string, string][] = [
    ["is", "is not"],
    ["are", "are not"],
    ["was", "was not"],
    ["were", "were not"],
    ["has", "has not"],
    ["have", "have not"],
    ["can", "cannot"],
    ["will", "will not"],
    ["does", "does not"],
    ["do", "do not"],
    ["alive", "dead"],
    ["true", "false"],
    ["yes", "no"],
    ["accept", "reject"],
    ["love", "hate"],
    ["friend", "enemy"],
    ["success", "failure"],
    ["win", "lose"],
  ];

  db: ConflictDbConnection | null;
  similarityThreshold: number;
  private _embedder: ConflictEmbedder | null;

  constructor(
    dbConnection?: ConflictDbConnection | null,
    similarityThreshold: number = 0.85
  ) {
    this.db = dbConnection ?? null;
    this.similarityThreshold = similarityThreshold;
    this._embedder = null;
    _log.info("ConflictResolver initialized");
  }

  /** Set or update database connection. */
  setDbConnection(dbConnection: ConflictDbConnection): void {
    this.db = dbConnection;
  }

  /** Set embedding engine for semantic similarity. */
  setEmbedder(embedder: ConflictEmbedder): void {
    this._embedder = embedder;
  }

  /**
   * Check for potential conflicts with existing memories.
   *
   * @param content - New content to check.
   * @param entityId - Entity ID to scope the check.
   * @returns List of detected conflicts.
   */
  async check(
    content: string,
    entityId?: string | null,
    scope: {
      userId?: string | null;
      projectId?: string | null;
      sessionId?: string | null;
    } = {}
  ): Promise<ConflictInfo[]> {
    if (!entityId || !this.db) {
      return [];
    }

    try {
      let sql = `
        SELECT id, content, valid_from, valid_until, importance
        FROM memories
        WHERE entity_id = ?
        AND superseded_by IS NULL
        AND (valid_until IS NULL OR valid_until > datetime('now'))
      `;
      const sqlParams: unknown[] = [entityId];

      if (scope.userId !== undefined && scope.userId !== null) {
        sql += ' AND user_id = ?';
        sqlParams.push(scope.userId);
      }
      if (scope.projectId !== undefined && scope.projectId !== null) {
        sql += ' AND project_id = ?';
        sqlParams.push(scope.projectId);
      }
      if (scope.sessionId !== undefined && scope.sessionId !== null) {
        sql += ' AND session_id = ?';
        sqlParams.push(scope.sessionId);
      }

      const cursor = this.db.execute(
        sql,
        sqlParams
      );

      const conflicts: ConflictInfo[] = [];
      const rows = cursor.fetchAll();
      for (const row of rows) {
        const existingContent = row[1] as string;
        const [conflictType, similarity] = this._analyzeConflict(
          content,
          existingContent
        );

        if (conflictType !== null) {
          conflicts.push(
            new ConflictInfo({
              id: row[0] as string,
              content: existingContent,
              validFrom: (row[2] as string) ?? null,
              validUntil: (row[3] as string) ?? null,
              importance: (row[4] as number) ?? 0.5,
              conflictType,
              similarityScore: similarity,
            })
          );
        }
      }

      return conflicts;
    } catch (e) {
      _log.error(`Conflict check failed: ${e}`);
      return [];
    }
  }

  /**
   * Analyze potential conflict between contents.
   *
   * @returns Tuple of [conflictType, similarityScore] or [null, 0.0] if no conflict.
   */
  private _analyzeConflict(
    newContent: string,
    existingContent: string
  ): [ConflictType | null, number] {
    // Check for contradiction
    if (this._isContradictory(newContent, existingContent)) {
      return [ConflictType.CONTRADICTION, 0.0];
    }

    // Check for semantic similarity (duplicate/update)
    const similarity = this._calculateSimilarity(newContent, existingContent);

    if (similarity >= this.similarityThreshold) {
      return [ConflictType.DUPLICATE, similarity];
    } else if (similarity >= 0.6) {
      return [ConflictType.UPDATE, similarity];
    }

    return [null, 0.0];
  }

  /**
   * Detect if two contents are contradictory.
   *
   * Uses negation pair detection and semantic analysis.
   */
  private _isContradictory(contentA: string, contentB: string): boolean {
    const aLower = contentA.toLowerCase();
    const bLower = contentB.toLowerCase();

    // Check negation pairs
    for (const [pos, neg] of ConflictResolver.NEGATION_PAIRS) {
      if (
        (aLower.includes(pos) && bLower.includes(neg)) ||
        (aLower.includes(neg) && bLower.includes(pos))
      ) {
        // Verify they're talking about the same subject
        if (this._shareSubject(contentA, contentB)) {
          return true;
        }
      }
    }

    return false;
  }

  /** Check if two contents share a common subject. */
  private _shareSubject(contentA: string, contentB: string): boolean {
    const stopwords = new Set([
      "the", "a", "an", "is", "are", "was", "were", "be",
      "been", "being", "have", "has", "had", "do", "does",
      "did", "will", "would", "could", "should", "may",
      "might", "must", "shall", "can", "need", "to", "of",
      "in", "for", "on", "with", "at", "by", "from", "as",
      "into", "through", "during", "before", "after",
      "above", "below", "between", "under", "again",
      "further", "then", "once", "and", "but", "or", "nor",
      "so", "yet", "both", "either", "neither", "not",
      "only", "own", "same", "than", "too", "very", "just",
    ]);

    function extractWords(text: string): Set<string> {
      const matches = text.toLowerCase().match(/\b[a-z]+\b/g) ?? [];
      return new Set(matches.filter((w) => !stopwords.has(w)));
    }

    const wordsA = extractWords(contentA);
    const wordsB = extractWords(contentB);

    // Check for significant overlap
    const overlap = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const minSize = Math.min(wordsA.size, wordsB.size);

    if (minSize === 0) {
      return false;
    }

    return overlap.size / minSize >= 0.3;
  }

  /**
   * Calculate semantic similarity between contents.
   *
   * Uses embedding similarity if available, falls back to lexical.
   */
  private _calculateSimilarity(contentA: string, contentB: string): number {
    if (this._embedder !== null) {
      try {
        const vecA = this._embedder.embed(contentA);
        const vecB = this._embedder.embed(contentB);
        return this._embedder.similarity(vecA, vecB);
      } catch (e) {
        _log.warn('Embedding similarity failed, falling back to Jaccard', { detail: e });
      }
    }

    // Fallback: Jaccard similarity
    const wordsA = new Set(contentA.toLowerCase().split(/\s+/).filter(Boolean));
    const wordsB = new Set(contentB.toLowerCase().split(/\s+/).filter(Boolean));

    if (wordsA.size === 0 || wordsB.size === 0) {
      return 0.0;
    }

    const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  /**
   * Resolve detected conflicts using specified strategy.
   *
   * @param content - New content being added.
   * @param conflicts - List of detected conflicts.
   * @param strategy - Resolution strategy to use.
   * @returns ResolutionResult with action to take.
   */
  async resolve(
    content: string,
    conflicts: ConflictInfo[],
    strategy: ConflictResolutionStrategy = ConflictResolutionStrategy.AUTO
  ): Promise<ResolutionResult> {
    if (conflicts.length === 0) {
      return new ResolutionResult({
        action: "accept",
        reason: "No conflicts detected",
      });
    }

    switch (strategy) {
      case ConflictResolutionStrategy.AUTO:
        return this._resolveAuto(content, conflicts);
      case ConflictResolutionStrategy.KEEP_OLD:
        return this._resolveKeepOld(conflicts);
      case ConflictResolutionStrategy.KEEP_NEW:
        return this._resolveKeepNew(conflicts);
      case ConflictResolutionStrategy.MERGE:
        return this._resolveMerge(content, conflicts);
      case ConflictResolutionStrategy.MANUAL:
        return this._resolveManual(content, conflicts);
      default:
        return this._resolveAuto(content, conflicts);
    }
  }

  /**
   * Automatic resolution: newer information supersedes older.
   *
   * For duplicates, keeps the most important.
   * For contradictions, uses recency.
   */
  private async _resolveAuto(
    _content: string,
    conflicts: ConflictInfo[]
  ): Promise<ResolutionResult> {
    const obsoleteIds: string[] = [];

    for (const conflict of conflicts) {
      if (conflict.conflictType === ConflictType.DUPLICATE) {
        // Keep higher importance
        if (conflict.importance < 0.5) {
          obsoleteIds.push(conflict.id);
        }
      } else if (
        conflict.conflictType === ConflictType.CONTRADICTION ||
        conflict.conflictType === ConflictType.UPDATE
      ) {
        // Newer supersedes older
        obsoleteIds.push(conflict.id);
      }
    }

    return new ResolutionResult({
      action: "update",
      obsoleteIds,
      reason: "Newer information supersedes older (auto strategy)",
    });
  }

  /** Keep existing information, reject new content. */
  private _resolveKeepOld(conflicts: ConflictInfo[]): ResolutionResult {
    return new ResolutionResult({
      action: "reject",
      keptIds: conflicts.map((c) => c.id),
      reason: "Keeping existing information (keep_old strategy)",
    });
  }

  /** Replace with new information. */
  private _resolveKeepNew(conflicts: ConflictInfo[]): ResolutionResult {
    return new ResolutionResult({
      action: "update",
      obsoleteIds: conflicts.map((c) => c.id),
      reason: "Replacing with new information (keep_new strategy)",
    });
  }

  /** Merge old and new content. */
  private _resolveMerge(
    content: string,
    conflicts: ConflictInfo[]
  ): ResolutionResult {
    // Find the most relevant conflict to merge with
    const primaryConflict = conflicts.reduce((max, c) =>
      c.importance > max.importance ? c : max
    );

    // Create merged content
    const merged = `${primaryConflict.content}\n\n[Updated]: ${content}`;

    return new ResolutionResult({
      action: "merge",
      obsoleteIds: conflicts.map((c) => c.id),
      mergedContent: merged,
      reason: "Merged old and new information (merge strategy)",
    });
  }

  /** Defer to manual resolution. */
  private _resolveManual(
    content: string,
    conflicts: ConflictInfo[]
  ): ResolutionResult {
    return new ResolutionResult({
      action: "defer",
      requiresManual: true,
      reason: "Manual resolution required",
      metadata: {
        new_content: content,
        conflicts: conflicts.map((c) => ({
          id: c.id,
          content: c.content,
          type: c.conflictType,
          similarity: c.similarityScore,
        })),
      },
    });
  }

  /**
   * Detect all conflicts within a set of memories.
   *
   * @param memories - List of memory objects with 'id' and 'content'.
   * @returns List of [idA, idB, conflictType] tuples.
   */
  detectAllConflicts(
    memories: Array<{ id?: string; content?: string }>
  ): [string, string, ConflictType][] {
    const conflicts: [string, string, ConflictType][] = [];

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const [conflictType] = this._analyzeConflict(
          memories[i].content ?? "",
          memories[j].content ?? ""
        );
        if (conflictType !== null) {
          conflicts.push([
            memories[i].id ?? "",
            memories[j].id ?? "",
            conflictType,
          ]);
        }
      }
    }

    return conflicts;
  }
}

// Singleton instance
let _conflictResolver: ConflictResolver | null = null;

/** Get or create ConflictResolver singleton. */
export function getConflictResolver(
  dbConnection?: ConflictDbConnection | null,
  similarityThreshold?: number
): ConflictResolver {
  if (_conflictResolver === null) {
    _conflictResolver = new ConflictResolver(dbConnection, similarityThreshold);
  } else if (dbConnection != null && _conflictResolver.db === null) {
    _conflictResolver.setDbConnection(dbConnection);
  }
  return _conflictResolver;
}

/** Reset ConflictResolver singleton (for testing). */
export function resetConflictResolver(): void {
  _conflictResolver = null;
}
