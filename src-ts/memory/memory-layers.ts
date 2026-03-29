/**
 * Memory Layer Handlers - Four-Layer Memory Architecture
 *
 * Implements IMemoryLayer interface with 4 layer handlers:
 * - EphemeralLayer: Temporary memory (< 1 hour TTL)
 * - SessionLayer: Current task scope
 * - UserLayer: Long-term user preferences
 * - ProjectLayer: Novel-level scope
 *
 * Each layer has different TTL, scope, and persistence characteristics.
 */

/** Memory layer types with TTL characteristics. */
export enum LayerType {
  EPHEMERAL = "ephemeral", // < 1 hour
  SESSION = "session", // Current task
  USER = "user", // Long-term preferences
  PROJECT = "project", // Novel-level scope
}

/** Configuration for a memory layer. */
export class LayerConfig {
  layerType: LayerType;
  defaultTtlSeconds: number | null;
  maxEntries: number;
  autoExpire: boolean;
  persistOnClose: boolean;

  constructor(params: {
    layerType: LayerType;
    defaultTtlSeconds?: number | null;
    maxEntries?: number;
    autoExpire?: boolean;
    persistOnClose?: boolean;
  }) {
    this.layerType = params.layerType;
    this.defaultTtlSeconds = params.defaultTtlSeconds ?? null;
    this.maxEntries = params.maxEntries ?? 10000;
    this.autoExpire = params.autoExpire ?? true;
    this.persistOnClose = params.persistOnClose ?? true;
  }
}

/** Default configurations for each layer */
export const LAYER_CONFIGS: Record<LayerType, LayerConfig> = {
  [LayerType.EPHEMERAL]: new LayerConfig({
    layerType: LayerType.EPHEMERAL,
    defaultTtlSeconds: 3600, // 1 hour
    maxEntries: 1000,
    autoExpire: true,
    persistOnClose: false,
  }),
  [LayerType.SESSION]: new LayerConfig({
    layerType: LayerType.SESSION,
    defaultTtlSeconds: 86400, // 24 hours
    maxEntries: 5000,
    autoExpire: true,
    persistOnClose: true,
  }),
  [LayerType.USER]: new LayerConfig({
    layerType: LayerType.USER,
    defaultTtlSeconds: null, // No expiration
    maxEntries: 10000,
    autoExpire: false,
    persistOnClose: true,
  }),
  [LayerType.PROJECT]: new LayerConfig({
    layerType: LayerType.PROJECT,
    defaultTtlSeconds: null, // No expiration
    maxEntries: 50000,
    autoExpire: false,
    persistOnClose: true,
  }),
};

/** Entry stored in a memory layer. */
export class LayerEntry {
  id: string;
  content: string;
  createdAt: Date;
  expiresAt: Date | null;
  importance: number;
  accessCount: number;
  lastAccessed: Date | null;
  metadata: Record<string, unknown>;

  constructor(params: {
    id: string;
    content: string;
    createdAt?: Date;
    expiresAt?: Date | null;
    importance?: number;
    accessCount?: number;
    lastAccessed?: Date | null;
    metadata?: Record<string, unknown>;
  }) {
    this.id = params.id;
    this.content = params.content;
    this.createdAt = params.createdAt ?? new Date();
    this.expiresAt = params.expiresAt ?? null;
    this.importance = params.importance ?? 0.5;
    this.accessCount = params.accessCount ?? 0;
    this.lastAccessed = params.lastAccessed ?? null;
    this.metadata = params.metadata ?? {};
  }

  /** Check if entry has expired. */
  isExpired(): boolean {
    if (this.expiresAt === null) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  /** Update access tracking. */
  touch(): void {
    this.accessCount += 1;
    this.lastAccessed = new Date();
  }
}

/** Statistics for a memory layer. */
export interface LayerStats {
  layerType: LayerType;
  totalEntries: number;
  expiredEntries: number;
  totalAccessCount: number;
  avgImportance: number;
  oldestEntry: Date | null;
  newestEntry: Date | null;
}

/**
 * Interface for memory layer implementations.
 *
 * Each layer handles storage, retrieval, and expiration
 * of memories within its scope.
 */
export interface IMemoryLayer {
  /** Get the layer type. */
  readonly layerType: LayerType;

  /** Get layer configuration. */
  readonly config: LayerConfig;

  /**
   * Store content in this layer.
   *
   * @param id - Unique identifier for the entry.
   * @param content - Content to store.
   * @param importance - Importance score (0.0-1.0).
   * @param ttlSeconds - Time-to-live in seconds (overrides default).
   * @param metadata - Additional metadata.
   * @returns Created LayerEntry.
   */
  store(
    id: string,
    content: string,
    importance?: number,
    ttlSeconds?: number | null,
    metadata?: Record<string, unknown> | null
  ): Promise<LayerEntry>;

  /**
   * Retrieve an entry by ID.
   *
   * @param id - Entry identifier.
   * @returns LayerEntry or null if not found/expired.
   */
  retrieve(id: string): Promise<LayerEntry | null>;

  /**
   * Manually expire an entry.
   *
   * @param id - Entry identifier.
   * @returns True if expired, False if not found.
   */
  expire(id: string): Promise<boolean>;

  /**
   * Expire all entries that have passed their TTL.
   *
   * @returns Number of entries expired.
   */
  expireAll(): Promise<number>;

  /**
   * Get layer statistics.
   *
   * @returns LayerStats with current state.
   */
  stats(): Promise<LayerStats>;

  /**
   * List entries in this layer.
   *
   * @param limit - Maximum entries to return.
   * @param includeExpired - Whether to include expired entries.
   * @returns List of LayerEntry objects.
   */
  listEntries(limit?: number, includeExpired?: boolean): Promise<LayerEntry[]>;

  /**
   * Clear all entries from this layer.
   *
   * @returns Number of entries cleared.
   */
  clear(): Promise<number>;
}

/**
 * Base implementation for memory layers.
 *
 * Provides common functionality for all layer types.
 */
export class BaseMemoryLayer implements IMemoryLayer {
  protected _config: LayerConfig;
  protected _entries: Map<string, LayerEntry> = new Map();

  constructor(config: LayerConfig) {
    this._config = config;
    console.log(`Initialized ${config.layerType} layer`);
  }

  get layerType(): LayerType {
    return this._config.layerType;
  }

  get config(): LayerConfig {
    return this._config;
  }

  async store(
    id: string,
    content: string,
    importance: number = 0.5,
    ttlSeconds: number | null = null,
    metadata: Record<string, unknown> | null = null
  ): Promise<LayerEntry> {
    // Calculate expiration
    let expiresAt: Date | null = null;
    const ttl = ttlSeconds ?? this._config.defaultTtlSeconds;
    if (ttl !== null) {
      expiresAt = new Date(Date.now() + ttl * 1000);
    }

    const entry = new LayerEntry({
      id,
      content,
      importance,
      expiresAt,
      metadata: metadata ?? {},
    });

    // Check capacity
    if (this._entries.size >= this._config.maxEntries) {
      await this._evictOldest();
    }

    this._entries.set(id, entry);
    return entry;
  }

  async retrieve(id: string): Promise<LayerEntry | null> {
    const entry = this._entries.get(id);
    if (entry === undefined) {
      return null;
    }

    if (entry.isExpired()) {
      if (this._config.autoExpire) {
        this._entries.delete(id);
      }
      return null;
    }

    entry.touch();
    return entry;
  }

  async expire(id: string): Promise<boolean> {
    if (this._entries.has(id)) {
      this._entries.delete(id);
      return true;
    }
    return false;
  }

  async expireAll(): Promise<number> {
    const expiredIds: string[] = [];
    for (const [id, entry] of this._entries) {
      if (entry.isExpired()) {
        expiredIds.push(id);
      }
    }
    for (const id of expiredIds) {
      this._entries.delete(id);
    }

    if (expiredIds.length > 0) {
      console.log(
        `Expired ${expiredIds.length} entries from ${this.layerType} layer`
      );
    }
    return expiredIds.length;
  }

  async stats(): Promise<LayerStats> {
    const entries = Array.from(this._entries.values());
    const expiredCount = entries.filter((e) => e.isExpired()).length;
    const totalAccess = entries.reduce((sum, e) => sum + e.accessCount, 0);
    const avgImportance =
      entries.length > 0
        ? entries.reduce((sum, e) => sum + e.importance, 0) / entries.length
        : 0.0;

    const createdTimes = entries.map((e) => e.createdAt);
    const oldest = createdTimes.length > 0 ? new Date(Math.min(...createdTimes.map((d) => d.getTime()))) : null;
    const newest = createdTimes.length > 0 ? new Date(Math.max(...createdTimes.map((d) => d.getTime()))) : null;

    return {
      layerType: this.layerType,
      totalEntries: entries.length,
      expiredEntries: expiredCount,
      totalAccessCount: totalAccess,
      avgImportance,
      oldestEntry: oldest,
      newestEntry: newest,
    };
  }

  async listEntries(
    limit: number = 100,
    includeExpired: boolean = false
  ): Promise<LayerEntry[]> {
    let entries = Array.from(this._entries.values());

    if (!includeExpired) {
      entries = entries.filter((e) => !e.isExpired());
    }

    // Sort by importance (descending), then by createdAt (descending)
    entries.sort((a, b) => {
      if (a.importance !== b.importance) {
        return b.importance - a.importance;
      }
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
    return entries.slice(0, limit);
  }

  async clear(): Promise<number> {
    const count = this._entries.size;
    this._entries.clear();
    console.log(`Cleared ${count} entries from ${this.layerType} layer`);
    return count;
  }

  /** Evict oldest entry to make room. */
  protected async _evictOldest(): Promise<void> {
    if (this._entries.size === 0) {
      return;
    }

    let oldestId = "";
    let oldestTime = Infinity;

    for (const [id, entry] of this._entries) {
      if (entry.createdAt.getTime() < oldestTime) {
        oldestTime = entry.createdAt.getTime();
        oldestId = id;
      }
    }

    if (oldestId) {
      this._entries.delete(oldestId);
    }
  }
}

/**
 * Ephemeral memory layer.
 *
 * Short-lived memories with < 1 hour TTL.
 * Used for temporary context, scratch data, and intermediate results.
 */
export class EphemeralLayer extends BaseMemoryLayer {
  constructor(config?: LayerConfig) {
    super(config ?? LAYER_CONFIGS[LayerType.EPHEMERAL]);
  }

  async store(
    id: string,
    content: string,
    importance: number = 0.5,
    ttlSeconds: number | null = null,
    metadata: Record<string, unknown> | null = null
  ): Promise<LayerEntry> {
    // Ephemeral layer enforces max TTL of 1 hour
    const maxTtl = 3600;
    if (ttlSeconds !== null) {
      ttlSeconds = Math.min(ttlSeconds, maxTtl);
    } else {
      ttlSeconds = this._config.defaultTtlSeconds ?? maxTtl;
    }

    return super.store(id, content, importance, ttlSeconds, metadata);
  }
}

/**
 * Session memory layer.
 *
 * Task-scoped memories that persist for the current session.
 * Used for conversation context, task state, and working memory.
 */
export class SessionLayer extends BaseMemoryLayer {
  sessionId: string | null;

  constructor(sessionId?: string | null, config?: LayerConfig) {
    super(config ?? LAYER_CONFIGS[LayerType.SESSION]);
    this.sessionId = sessionId ?? null;
  }

  async store(
    id: string,
    content: string,
    importance: number = 0.5,
    ttlSeconds: number | null = null,
    metadata: Record<string, unknown> | null = null
  ): Promise<LayerEntry> {
    // Add sessionId to metadata
    const meta = metadata ?? {};
    if (this.sessionId) {
      meta["session_id"] = this.sessionId;
    }

    return super.store(id, content, importance, ttlSeconds, meta);
  }
}

/**
 * User memory layer.
 *
 * Long-term user preferences and learned behaviors.
 * No automatic expiration, persists across sessions.
 */
export class UserLayer extends BaseMemoryLayer {
  userId: string | null;

  constructor(userId?: string | null, config?: LayerConfig) {
    super(config ?? LAYER_CONFIGS[LayerType.USER]);
    this.userId = userId ?? null;
  }

  async store(
    id: string,
    content: string,
    importance: number = 0.5,
    ttlSeconds: number | null = null,
    metadata: Record<string, unknown> | null = null
  ): Promise<LayerEntry> {
    // User layer typically doesn't expire
    if (ttlSeconds === null) {
      ttlSeconds = this._config.defaultTtlSeconds; // null
    }

    const meta = metadata ?? {};
    if (this.userId) {
      meta["user_id"] = this.userId;
    }

    return super.store(id, content, importance, ttlSeconds, meta);
  }
}

/**
 * Project memory layer.
 *
 * Novel-level scope for story-wide information.
 * Characters, world-building, plot structures, etc.
 * No automatic expiration.
 */
export class ProjectLayer extends BaseMemoryLayer {
  projectId: string | null;

  constructor(projectId?: string | null, config?: LayerConfig) {
    super(config ?? LAYER_CONFIGS[LayerType.PROJECT]);
    this.projectId = projectId ?? null;
  }

  async store(
    id: string,
    content: string,
    importance: number = 0.5,
    ttlSeconds: number | null = null,
    metadata: Record<string, unknown> | null = null
  ): Promise<LayerEntry> {
    const meta = metadata ?? {};
    if (this.projectId) {
      meta["project_id"] = this.projectId;
    }

    return super.store(id, content, importance, ttlSeconds, meta);
  }
}

/**
 * Manager for all memory layers.
 *
 * Provides unified access to layer operations.
 */
export class LayerManager {
  private _layers: Map<LayerType, BaseMemoryLayer>;

  constructor(
    sessionId?: string | null,
    userId?: string | null,
    projectId?: string | null
  ) {
    this._layers = new Map([
      [LayerType.EPHEMERAL, new EphemeralLayer()],
      [LayerType.SESSION, new SessionLayer(sessionId ?? null)],
      [LayerType.USER, new UserLayer(userId ?? null)],
      [LayerType.PROJECT, new ProjectLayer(projectId ?? null)],
    ]);
    console.log("LayerManager initialized with all layers");
  }

  /** Get a specific layer. */
  getLayer(layerType: LayerType): BaseMemoryLayer {
    const layer = this._layers.get(layerType);
    if (!layer) {
      throw new Error(`Unknown layer type: ${layerType}`);
    }
    return layer;
  }

  /** Store content in specified layer. */
  async store(
    layerType: LayerType,
    id: string,
    content: string,
    importance: number = 0.5,
    ttlSeconds?: number | null,
    metadata?: Record<string, unknown> | null
  ): Promise<LayerEntry> {
    const layer = this._layers.get(layerType);
    if (!layer) {
      throw new Error(`Unknown layer type: ${layerType}`);
    }
    return layer.store(id, content, importance, ttlSeconds, metadata);
  }

  /**
   * Retrieve entry by ID.
   *
   * If layerType is null, searches all layers.
   */
  async retrieve(
    id: string,
    layerType?: LayerType | null
  ): Promise<LayerEntry | null> {
    if (layerType != null) {
      const layer = this._layers.get(layerType);
      return layer ? layer.retrieve(id) : null;
    }

    // Search all layers (most persistent first)
    const searchOrder = [
      LayerType.PROJECT,
      LayerType.USER,
      LayerType.SESSION,
      LayerType.EPHEMERAL,
    ];
    for (const lt of searchOrder) {
      const layer = this._layers.get(lt);
      if (layer) {
        const entry = await layer.retrieve(id);
        if (entry !== null) {
          return entry;
        }
      }
    }
    return null;
  }

  /** Expire entries in all layers. */
  async expireAllLayers(): Promise<Record<LayerType, number>> {
    const results: Partial<Record<LayerType, number>> = {};
    for (const [lt, layer] of this._layers) {
      results[lt] = await layer.expireAll();
    }
    return results as Record<LayerType, number>;
  }

  /** Get stats for all layers. */
  async statsAll(): Promise<Record<LayerType, LayerStats>> {
    const results: Partial<Record<LayerType, LayerStats>> = {};
    for (const [lt, layer] of this._layers) {
      results[lt] = await layer.stats();
    }
    return results as Record<LayerType, LayerStats>;
  }
}

/** Layer constructor parameters */
type LayerConstructorParams = {
  sessionId?: string;
  userId?: string;
  projectId?: string;
  config?: LayerConfig;
};

/**
 * Factory function to create a memory layer.
 *
 * @param layerType - Type of layer to create.
 * @param kwargs - Additional arguments for the layer.
 * @returns Configured memory layer instance.
 */
export function createLayer(
  layerType: LayerType,
  kwargs: LayerConstructorParams = {}
): BaseMemoryLayer {
  switch (layerType) {
    case LayerType.EPHEMERAL:
      return new EphemeralLayer(kwargs.config);
    case LayerType.SESSION:
      return new SessionLayer(kwargs.sessionId, kwargs.config);
    case LayerType.USER:
      return new UserLayer(kwargs.userId, kwargs.config);
    case LayerType.PROJECT:
      return new ProjectLayer(kwargs.projectId, kwargs.config);
    default:
      throw new Error(`Unknown layer type: ${layerType}`);
  }
}
