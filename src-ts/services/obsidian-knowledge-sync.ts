/**
 * ObsidianKnowledgeSync — Obsidian ↔ Knowledge bidirectional real-time sync
 *
 * Coordinates bidirectional synchronization between Obsidian vault notes
 * and the KnowledgeService entity store, leveraging IObsidianService,
 * IKnowledgeService, and IEventBus.
 *
 * Design:
 * - Vault→Knowledge: listen to obsidian:file-changed events, parse markdown
 *   → extract entity, sync to IKnowledgeService
 * - Knowledge→Vault: subscribe to knowledge:entity-updated/created/deleted
 *   events, write/read/delete corresponding .md files via IObsidianService
 * - Conflict detection: when both sides change within debounceMs, queue
 *   for resolution based on ConflictStrategy
 * - Debounced batch sync: accumulate changes and process in batches
 * - Individual sync failures never block other items in batch operations
 */

import { createLogger } from '../logger/index.js';
import type { IEventBus, IObsidianService, IKnowledgeService } from '../container/types';
import type { KnowledgeEntity } from '../protocols/knowledge';

const log = createLogger('obsidian-knowledge-sync');

// ---------------------------------------------------------------------------
// Enums & Types
// ---------------------------------------------------------------------------

export enum ConflictStrategy {
  LAST_WRITE_WINS = 'LAST_WRITE_WINS',
  MERGE = 'MERGE',
  HUMAN_QUEUE = 'HUMAN_QUEUE',
}

export interface ObsidianSyncConfig {
  conflictStrategy: ConflictStrategy;
  debounceMs: number;
  watchEnabled: boolean;
}

export interface SyncDirectionResult {
  direction: 'vault-to-knowledge' | 'knowledge-to-vault';
  syncedCount: number;
  conflictedCount: number;
  errors: Array<{ item: string; error: string }>;
}

export interface SyncConflict {
  id: string;
  vaultPath: string;
  entityId: string;
  vaultTimestamp: number;
  knowledgeTimestamp: number;
  vaultContent: unknown;
  knowledgeContent: unknown;
}

export interface IObsidianKnowledgeSync {
  startSync(): Promise<void>;
  stopSync(): void;
  syncVaultToKnowledge(vaultPath: string): Promise<SyncDirectionResult>;
  syncKnowledgeToVault(entityId: string): Promise<SyncDirectionResult>;
  getSyncStatus(): {
    running: boolean;
    lastVaultSync: number | null;
    lastKnowledgeSync: number | null;
    pendingConflicts: number;
  };
  resolveConflict(
    conflictId: string,
    resolution: 'vault' | 'knowledge' | 'merge',
  ): Promise<void>;
}

// ---------------------------------------------------------------------------
// Internal: extended knowledge service access
// ---------------------------------------------------------------------------

/**
 * KnowledgeServiceImpl exposes getEntity/addEntity/listEntities beyond the
 * IKnowledgeService container interface. We type-cast at the adapter layer
 * to access these methods — same pattern used by NowledgeGraphSync.
 */
interface KnowledgeEntityReader {
  getEntity(entityId: string): KnowledgeEntity | undefined;
  addEntity(entity: KnowledgeEntity): Promise<void>;
  deleteEntity(entityId: string): Promise<void>;
  listEntities(): KnowledgeEntity[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ObsidianSyncConfig = {
  conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
  debounceMs: 500,
  watchEnabled: true,
};

function generateConflictId(): string {
  return `conflict-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Extract a knowledge entity id from a vault markdown path.
 * Convention: the file name (without .md extension) is the entity id.
 */
function entityIdFromNotePath(notePath: string): string {
  const segments = notePath.replace(/\\/g, '/').split('/');
  const fileName = segments[segments.length - 1];
  return fileName.replace(/\.md$/i, '');
}

/**
 * Build a vault-relative .md path from a knowledge entity id.
 */
function notePathFromEntityId(entityId: string): string {
  return `${entityId}.md`;
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class ObsidianKnowledgeSyncImpl implements IObsidianKnowledgeSync {
  private readonly obsidian: IObsidianService;
  private readonly knowledgeService: IKnowledgeService & KnowledgeEntityReader;
  private readonly eventBus: IEventBus;
  private readonly config: ObsidianSyncConfig;
  private readonly vaultRoot: string;
  private readonly conflictBridge?: import('../container/types').IConflictNowledgeBridge;

  private running = false;
  private lastVaultSync: number | null = null;
  private lastKnowledgeSync: number | null = null;

  /** Pending conflicts awaiting human resolution (HUMAN_QUEUE strategy). */
  private readonly conflicts = new Map<string, SyncConflict>();

  /** Debounce timers keyed by note path (vault→knowledge direction). */
  private readonly vaultDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Debounce timers keyed by entity id (knowledge→vault direction). */
  private readonly knowledgeDebounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Timestamps of last known change per note path (for conflict detection). */
  private readonly vaultChangeTimestamps = new Map<string, number>();

  /** Timestamps of last known change per entity id (for conflict detection). */
  private readonly knowledgeChangeTimestamps = new Map<string, number>();

  /** Subscription references so we can unsubscribe cleanly. */
  private subscriptions: Array<{ channel: string; handler: (data: unknown) => void }> = [];

  constructor(deps: {
    obsidianService: IObsidianService;
    knowledgeService: IKnowledgeService;
    eventBus: IEventBus;
    conflictBridge?: import('../container/types').IConflictNowledgeBridge;
    config?: Partial<ObsidianSyncConfig> & { vaultRoot?: string };
  }) {
    this.obsidian = deps.obsidianService;
    // Cast to access getEntity/addEntity/deleteEntity/listEntities
    this.knowledgeService = deps.knowledgeService as IKnowledgeService & KnowledgeEntityReader;
    this.eventBus = deps.eventBus;
    this.conflictBridge = deps.conflictBridge;
    this.vaultRoot = deps.config?.vaultRoot ?? process.cwd();
    this.config = { ...DEFAULT_CONFIG, ...deps.config };
  }

  // -----------------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------------

  async startSync(): Promise<void> {
    if (this.running) {
      log.warn('Sync already running — ignoring startSync() call');
      return;
    }

    this.running = true;
    log.info('Starting bidirectional Obsidian↔Knowledge sync', {
      config: this.config,
    });

    // Vault → Knowledge: listen to file-changed events from FileSyncService
    const onFileChanged = (data: unknown) => {
      const payload = data as { path?: string; timestamp?: number };
      if (!payload.path) return;
      this.handleVaultChange(payload.path, payload.timestamp ?? Date.now());
    };
    this.subscriptions.push({ channel: 'obsidian:file-changed', handler: onFileChanged });
    this.eventBus.subscribe('obsidian:file-changed', onFileChanged);

    // Knowledge → Vault: listen to knowledge entity events
    const onEntityUpdated = (data: unknown) => {
      const payload = data as { id?: string; timestamp?: number };
      if (!payload.id) return;
      this.handleKnowledgeChange(payload.id, payload.timestamp ?? Date.now());
    };
    this.subscriptions.push({ channel: 'knowledge:entity-updated', handler: onEntityUpdated });
    this.eventBus.subscribe('knowledge:entity-updated', onEntityUpdated);

    const onEntityCreated = (data: unknown) => {
      const payload = data as { id?: string; timestamp?: number };
      if (!payload.id) return;
      this.handleKnowledgeChange(payload.id, payload.timestamp ?? Date.now());
    };
    this.subscriptions.push({ channel: 'knowledge:entity-created', handler: onEntityCreated });
    this.eventBus.subscribe('knowledge:entity-created', onEntityCreated);

    const onEntityDeleted = (data: unknown) => {
      const payload = data as { id?: string; timestamp?: number };
      if (!payload.id) return;
      this.handleKnowledgeDeletion(payload.id);
    };
    this.subscriptions.push({ channel: 'knowledge:entity-deleted', handler: onEntityDeleted });
    this.eventBus.subscribe('knowledge:entity-deleted', onEntityDeleted);
  }

  stopSync(): void {
    if (!this.running) return;

    this.running = false;
    log.info('Stopping Obsidian↔Knowledge sync');

    // Unsubscribe from events
    for (const { channel, handler } of this.subscriptions) {
      this.eventBus.unsubscribe(channel, handler);
    }
    this.subscriptions = [];

    // Clear pending debounce timers
    for (const timer of this.vaultDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.vaultDebounceTimers.clear();

    for (const timer of this.knowledgeDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.knowledgeDebounceTimers.clear();
  }

  // -----------------------------------------------------------------------
  // Manual Sync: Vault → Knowledge
  // -----------------------------------------------------------------------

  async syncVaultToKnowledge(notePath: string): Promise<SyncDirectionResult> {
    const result: SyncDirectionResult = {
      direction: 'vault-to-knowledge',
      syncedCount: 0,
      conflictedCount: 0,
      errors: [],
    };

    try {
      const content = await this.obsidian.readNote(this.vaultRoot, notePath);
      if (content == null) {
        result.errors.push({ item: notePath, error: 'Note not found in vault' });
        return result;
      }

      const entityId = entityIdFromNotePath(notePath);
      const vaultTimestamp = Date.now();
      const knowledgeTimestamp = this.knowledgeChangeTimestamps.get(entityId) ?? 0;

      // Conflict detection: both sides changed within debounce window
      if (
        knowledgeTimestamp > 0 &&
        Math.abs(vaultTimestamp - knowledgeTimestamp) < this.config.debounceMs
      ) {
        await this.handleDetectedConflict(
          notePath, entityId, vaultTimestamp, knowledgeTimestamp, content,
        );
        result.conflictedCount = 1;
        return result;
      }

      const entity = this.parseMarkdownToEntity(content, entityId);
      await this.knowledgeService.addEntity(entity);
      this.vaultChangeTimestamps.set(notePath, vaultTimestamp);

      result.syncedCount = 1;
      this.lastVaultSync = Date.now();

      this.publishEvent('obsidian-sync:vault-to-knowledge', {
        notePath,
        entityId,
        timestamp: this.lastVaultSync,
      });

      log.debug('Synced vault → knowledge', { notePath, entityId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ item: notePath, error: message });
      log.error('Failed to sync vault → knowledge', { notePath, error: message });
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Manual Sync: Knowledge → Vault
  // -----------------------------------------------------------------------

  async syncKnowledgeToVault(entityId: string): Promise<SyncDirectionResult> {
    const result: SyncDirectionResult = {
      direction: 'knowledge-to-vault',
      syncedCount: 0,
      conflictedCount: 0,
      errors: [],
    };

    try {
      const entity = this.knowledgeService.getEntity(entityId);
      if (!entity) {
        result.errors.push({ item: entityId, error: 'Entity not found in knowledge store' });
        return result;
      }

      const notePath = notePathFromEntityId(entityId);
      const knowledgeTimestamp = Date.now();
      const vaultTimestamp = this.vaultChangeTimestamps.get(notePath) ?? 0;

      // Conflict detection
      if (
        vaultTimestamp > 0 &&
        Math.abs(knowledgeTimestamp - vaultTimestamp) < this.config.debounceMs
      ) {
        const existingContent = await this.obsidian.readNote(this.vaultRoot, notePath);
        await this.handleDetectedConflict(
          notePath, entityId, vaultTimestamp, knowledgeTimestamp, existingContent, entity,
        );
        result.conflictedCount = 1;
        return result;
      }

      const markdown = this.serializeEntityToMarkdown(entity);
      await this.obsidian.writeNote(this.vaultRoot, notePath, markdown);
      this.knowledgeChangeTimestamps.set(entityId, knowledgeTimestamp);

      result.syncedCount = 1;
      this.lastKnowledgeSync = Date.now();

      this.publishEvent('obsidian-sync:knowledge-to-vault', {
        entityId,
        notePath,
        timestamp: this.lastKnowledgeSync,
      });

      log.debug('Synced knowledge → vault', { entityId, notePath });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ item: entityId, error: message });
      log.error('Failed to sync knowledge → vault', { entityId, error: message });
    }

    return result;
  }

  // -----------------------------------------------------------------------
  // Status & Conflict Resolution
  // -----------------------------------------------------------------------

  getSyncStatus(): {
    running: boolean;
    lastVaultSync: number | null;
    lastKnowledgeSync: number | null;
    pendingConflicts: number;
  } {
    return {
      running: this.running,
      lastVaultSync: this.lastVaultSync,
      lastKnowledgeSync: this.lastKnowledgeSync,
      pendingConflicts: this.conflicts.size,
    };
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'vault' | 'knowledge' | 'merge',
  ): Promise<void> {
    const conflict = this.conflicts.get(conflictId);
    if (!conflict) {
      throw new Error(`Conflict not found: ${conflictId}`);
    }

    log.info('Resolving conflict', { conflictId, resolution });

    switch (resolution) {
      case 'vault': {
        const entity = this.parseMarkdownToEntity(
          conflict.vaultContent as string, conflict.entityId,
        );
        await this.knowledgeService.addEntity(entity);
        this.vaultChangeTimestamps.set(conflict.vaultPath, Date.now());
        break;
      }
      case 'knowledge': {
        const markdown = this.serializeEntityToMarkdown(conflict.knowledgeContent);
        await this.obsidian.writeNote(this.vaultRoot, conflict.vaultPath, markdown);
        this.knowledgeChangeTimestamps.set(conflict.entityId, Date.now());
        break;
      }
      case 'merge': {
        const merged = this.mergeContents(conflict.vaultContent, conflict.knowledgeContent);
        const entity = this.parseMarkdownToEntity(merged, conflict.entityId);
        await this.knowledgeService.addEntity(entity);
        const markdown = this.serializeEntityToMarkdown(conflict.knowledgeContent);
        await this.obsidian.writeNote(this.vaultRoot, conflict.vaultPath, markdown);
        const now = Date.now();
        this.vaultChangeTimestamps.set(conflict.vaultPath, now);
        this.knowledgeChangeTimestamps.set(conflict.entityId, now);
        break;
      }
    }

    this.conflicts.delete(conflictId);
    log.info('Conflict resolved', { conflictId, resolution });
  }

  // -----------------------------------------------------------------------
  // Event Handlers (Debounced)
  // -----------------------------------------------------------------------

  private handleVaultChange(notePath: string, timestamp: number): void {
    if (!this.running || !this.config.watchEnabled) return;

    // Only process .md files
    if (!notePath.endsWith('.md')) return;

    this.vaultChangeTimestamps.set(notePath, timestamp);

    // Debounce: accumulate changes, process after debounceMs
    const existing = this.vaultDebounceTimers.get(notePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.vaultDebounceTimers.delete(notePath);
      void this.syncVaultToKnowledge(notePath);
    }, this.config.debounceMs);

    this.vaultDebounceTimers.set(notePath, timer);
  }

  private handleKnowledgeChange(entityId: string, timestamp: number): void {
    if (!this.running || !this.config.watchEnabled) return;

    this.knowledgeChangeTimestamps.set(entityId, timestamp);

    // Debounce
    const existing = this.knowledgeDebounceTimers.get(entityId);
    if (existing) {
      clearTimeout(existing);
    }

    const timer = setTimeout(() => {
      this.knowledgeDebounceTimers.delete(entityId);
      void this.syncKnowledgeToVault(entityId);
    }, this.config.debounceMs);

    this.knowledgeDebounceTimers.set(entityId, timer);
  }

  private handleKnowledgeDeletion(entityId: string): void {
    if (!this.running || !this.config.watchEnabled) return;

    const notePath = notePathFromEntityId(entityId);

    // Delete corresponding vault note
    this.obsidian
      .deleteNote(this.vaultRoot, notePath)
      .then(() => {
        log.debug('Deleted vault note for removed entity', { entityId, notePath });
        this.vaultChangeTimestamps.delete(notePath);
        this.knowledgeChangeTimestamps.delete(entityId);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error('Failed to delete vault note for removed entity', {
          entityId,
          notePath,
          error: message,
        });
      });
  }

  // -----------------------------------------------------------------------
  // Conflict Handling
  // -----------------------------------------------------------------------

  private async handleDetectedConflict(
    notePath: string,
    entityId: string,
    vaultTimestamp: number,
    knowledgeTimestamp: number,
    vaultContent?: unknown,
    knowledgeContent?: unknown,
  ): Promise<void> {
    const conflict: SyncConflict = {
      id: generateConflictId(),
      vaultPath: notePath,
      entityId,
      vaultTimestamp,
      knowledgeTimestamp,
      vaultContent: vaultContent ?? (await this.obsidian.readNote(this.vaultRoot, notePath)),
      knowledgeContent: knowledgeContent ?? this.knowledgeService.getEntity(entityId),
    };

    log.warn('Sync conflict detected', {
      conflictId: conflict.id,
      notePath,
      entityId,
      strategy: this.config.conflictStrategy,
    });

    this.publishEvent('obsidian-sync:conflict-detected', conflict);

    // Bidirectional conflict detection via ConflictNowledgeBridge
    // If the bridge is available, also check Nowledge Mem for reverse conflicts
    // that the primary detection may have missed.
    if (this.conflictBridge) {
      try {
        const reverseConflicts = await this.conflictBridge.detectConflicts(
          notePath,
          entityId,
        );
        if (reverseConflicts.length > 0) {
          log.info('Reverse conflicts detected via ConflictNowledgeBridge', {
            conflictId: conflict.id,
            reverseCount: reverseConflicts.length,
          });
          this.publishEvent('obsidian-sync:reverse-conflict-detected', {
            conflictId: conflict.id,
            reverseConflicts,
          });
        }
      } catch {
        // ConflictBridge check failure is non-critical
      }
    }

    switch (this.config.conflictStrategy) {
      case ConflictStrategy.LAST_WRITE_WINS: {
        if (vaultTimestamp >= knowledgeTimestamp) {
          this.conflicts.set(conflict.id, conflict);
          await this.resolveConflict(conflict.id, 'vault');
        } else {
          this.conflicts.set(conflict.id, conflict);
          await this.resolveConflict(conflict.id, 'knowledge');
        }
        break;
      }
      case ConflictStrategy.MERGE: {
        this.conflicts.set(conflict.id, conflict);
        await this.resolveConflict(conflict.id, 'merge');
        break;
      }
      case ConflictStrategy.HUMAN_QUEUE: {
        this.conflicts.set(conflict.id, conflict);
        log.info('Conflict queued for human resolution', { conflictId: conflict.id });
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Markdown ↔ Entity Conversion
  // -----------------------------------------------------------------------

  /**
   * Parse markdown content into a KnowledgeEntity.
   *
   * Convention:
   *   - First H1 (`# Title`) → entity name
   *   - YAML front-matter `type` field → entity type (default 'note')
   *   - YAML front-matter `description` field → entity description
   *   - Remaining body → entity description (if no front-matter description)
   */
  private parseMarkdownToEntity(content: string, entityId: string): KnowledgeEntity {
    let name = entityId;
    let type = 'note';
    let description: string | undefined;
    let body = content;
    const properties: Record<string, unknown> = {};

    // Extract YAML front-matter
    const frontMatterMatch = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (frontMatterMatch) {
      const yaml = frontMatterMatch[1];
      for (const line of yaml.split('\n')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const key = line.slice(0, colonIdx).trim();
          const value = line.slice(colonIdx + 1).trim();
          switch (key) {
            case 'name':
              name = value;
              break;
            case 'type':
              type = value;
              break;
            case 'description':
              description = value;
              break;
            default:
              properties[key] = value;
              break;
          }
        }
      }
      body = body.slice(frontMatterMatch[0].length);
    }

    // Extract H1 title if not set from front-matter
    const titleMatch = body.match(/^#\s+(.+)$/m);
    if (titleMatch) {
      name = titleMatch[1].trim();
    }

    // Use body as description if not set from front-matter
    if (!description) {
      const trimmedBody = body.replace(/^#\s+.*$/m, '').trim();
      if (trimmedBody.length > 0) {
        description = trimmedBody.slice(0, 500);
      }
    }

    return {
      id: entityId,
      name,
      type,
      description,
      properties,
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Serialize a KnowledgeEntity back to markdown.
   */
  private serializeEntityToMarkdown(entity: unknown): string {
    const record = entity as KnowledgeEntity;
    const lines: string[] = [];

    // YAML front-matter with entity metadata
    lines.push('---');
    lines.push(`name: ${record.name}`);
    lines.push(`type: ${record.type}`);
    if (record.description) {
      lines.push(`description: ${record.description}`);
    }
    if (record.properties) {
      for (const [key, value] of Object.entries(record.properties)) {
        if (typeof value !== 'object') {
          lines.push(`${key}: ${value}`);
        }
      }
    }
    lines.push('---');
    lines.push('');

    // Title
    lines.push(`# ${record.name}`);
    lines.push('');

    // Body content from description
    if (record.description) {
      lines.push(record.description);
    }

    return lines.join('\n');
  }

  /**
   * Naive merge: concatenate vault content and knowledge content with a separator.
   * In practice, a more sophisticated merge strategy (e.g. CRDT, structured diff)
   * should be plugged in.
   */
  private mergeContents(vaultContent: unknown, knowledgeContent: unknown): string {
    const left = typeof vaultContent === 'string'
      ? vaultContent
      : JSON.stringify(vaultContent, null, 2);
    const right = typeof knowledgeContent === 'string'
      ? knowledgeContent
      : JSON.stringify(knowledgeContent, null, 2);

    return [left, '---', right].join('\n\n');
  }

  // -----------------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------------

  /** Publish event via EventBus — errors are caught and logged, never blocking */
  private publishEvent(channel: string, payload: unknown): void {
    try {
      this.eventBus.publish(channel, payload);
    } catch {
      // Event publishing failure must never block sync operations
    }
  }
}