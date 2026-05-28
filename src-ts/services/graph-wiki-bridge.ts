/**
 * GraphWikiLinkBridge — Graph entity ID ↔ Wiki page path bidirectional link resolution
 *
 * Resolves graph entity IDs to wiki page paths and vice versa, maintaining
 * an in-memory bidirectional link index with orphaned link detection.
 *
 * Design:
 * - Bidirectional Map: entityId ↔ wikiPath for O(1) lookups
 * - Fallback resolution: when index miss, try IObsidianService/IGraphEngine
 * - Wiki link parsing: extract [[wiki-links]] from page content and resolve each
 * - Orphan detection: wiki links with no graph entity, graph edges with no wiki page
 * - EventBus integration: incremental index updates on entity/file change events
 * - Individual resolution failures never block other items in batch operations
 */

import { createLogger } from '../logger/index.js';
import type { IGraphEngine, IObsidianService, IEventBus } from '../container/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkIndexEntry {
  entityId: string;
  wikiPath: string;
  lastResolved: number;
  isOrphaned: boolean;
}

export type OrphanType = 'wiki-no-graph' | 'graph-no-wiki' | 'dangling-reference';

export interface OrphanedLink {
  type: OrphanType;
  source: string;
  target?: string;
  detectedAt: number;
}

export interface IntegrityReport {
  totalIndexed: number;
  orphanedCount: number;
  brokenLinks: number;
  details: OrphanedLink[];
}

export interface IGraphWikiLinkBridge {
  resolveGraphToWiki(entityId: string): Promise<string | null>;
  resolveWikiToGraph(wikiPath: string): Promise<string | null>;
  resolveWikiLinks(wikiPath: string): Promise<Array<{ linkText: string; entityId: string | null }>>;
  rebuildIndex(): Promise<number>;
  detectOrphanedLinks(): Promise<OrphanedLink[]>;
  getLinkIndex(): LinkIndexEntry[];
  checkIntegrity(): Promise<IntegrityReport>;
}

// ---------------------------------------------------------------------------
// Internal: extended obsidian service access
// ---------------------------------------------------------------------------

/**
 * ObsidianServiceImpl exposes search/getFiles beyond the IObsidianService
 * container interface. We type-cast at the adapter layer to access these methods
 * — same pattern used by NowledgeGraphSync for KnowledgeEntityReader.
 */
interface ObsidianSearchAccess {
  search(vaultPath: string, query: string, searchContent?: boolean, limit?: number): Array<{ name: string; path: string; relativePath: string }>;
  getFiles(vaultPath: string, pattern?: string): string[];
}

// ---------------------------------------------------------------------------
// Wiki link regex
// ---------------------------------------------------------------------------

const WIKI_LINK_RE = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class GraphWikiLinkBridgeImpl implements IGraphWikiLinkBridge {
  private readonly logger = createLogger('graph-wiki-bridge');

  private readonly obsidianExt: IObsidianService & ObsidianSearchAccess;

  /** entityId → LinkIndexEntry */
  private readonly byEntity = new Map<string, LinkIndexEntry>();
  /** wikiPath → entityId */
  private readonly byWikiPath = new Map<string, string>();

  /** Default vault path — used when no vault is explicitly specified */
  private readonly vaultPath: string;

  constructor(deps: {
    graphEngine: IGraphEngine;
    obsidianService: IObsidianService;
    eventBus: IEventBus;
    vaultPath?: string;
  }) {
    this.graphEngine = deps.graphEngine;
    this.obsidianExt = deps.obsidianService as IObsidianService & ObsidianSearchAccess;
    this.eventBus = deps.eventBus;
    this.vaultPath = deps.vaultPath ?? '.writing/vault';
    this.subscribeToEvents();
  }

  private readonly graphEngine: IGraphEngine;
  private readonly eventBus: IEventBus;

  // ── Resolution ──────────────────────────────────────────────────────

  async resolveGraphToWiki(entityId: string): Promise<string | null> {
    const cached = this.byEntity.get(entityId);
    if (cached) {
      cached.lastResolved = Date.now();
      return cached.wikiPath || null;
    }

    // Fallback: search obsidian vault for a page matching the entity id / label
    try {
      const results = this.obsidianExt.search(this.vaultPath, entityId, false, 1);
      if (results.length > 0) {
        const wikiPath = results[0].path;
        this.upsertIndex(entityId, wikiPath);
        this.publishResolved(entityId, wikiPath);
        return wikiPath;
      }
    } catch (err) {
      this.logger.warn(`Failed to search obsidian for entity ${entityId}: ${err}`);
    }

    return null;
  }

  async resolveWikiToGraph(wikiPath: string): Promise<string | null> {
    const cached = this.byWikiPath.get(wikiPath);
    if (cached) {
      const entry = this.byEntity.get(cached);
      if (entry) entry.lastResolved = Date.now();
      return cached;
    }

    // Fallback: look for a graph node whose id/label matches the wiki page name
    try {
      const pageName = wikiPath.replace(/\.md$/, '').split('/').pop() ?? wikiPath;
      const node = await this.graphEngine.getNode(pageName);
      if (node) {
        const nodeData = node as Record<string, unknown>;
        const entityId = (nodeData?.id as string) ?? pageName;
        this.upsertIndex(entityId, wikiPath);
        this.publishResolved(entityId, wikiPath);
        return entityId;
      }
    } catch (err) {
      this.logger.warn(`Failed to resolve wiki path ${wikiPath} to graph entity: ${err}`);
    }

    return null;
  }

  async resolveWikiLinks(wikiPath: string): Promise<Array<{ linkText: string; entityId: string | null }>> {
    let content: string | null;
    try {
      content = await this.obsidianExt.readNote(this.vaultPath, wikiPath);
    } catch {
      this.logger.warn(`Cannot read note ${wikiPath} for link resolution`);
      return [];
    }

    if (!content) return [];

    const links: Array<{ linkText: string; entityId: string | null }> = [];
    const seen = new Set<string>();
    let match: RegExpExecArray | null;

    WIKI_LINK_RE.lastIndex = 0;
    while ((match = WIKI_LINK_RE.exec(content)) !== null) {
      const linkText = match[1].trim();
      if (seen.has(linkText)) continue;
      seen.add(linkText);

      const entityId = await this.resolveWikiToGraph(`${linkText}.md`);
      links.push({ linkText, entityId });
    }

    return links;
  }

  // ── Index management ────────────────────────────────────────────────

  async rebuildIndex(): Promise<number> {
    this.byEntity.clear();
    this.byWikiPath.clear();

    let count = 0;

    // 1. Scan all graph nodes via traverse
    try {
      const nodes = await this.graphEngine.traverse('__all__', 0);

      for (const node of nodes) {
        const data = node as Record<string, unknown>;
        const entityId = (data?.id as string) ?? (data?.name as string);
        if (!entityId) continue;

        // Try to find matching wiki page by entity id/name
        const label = (data?.name as string) ?? entityId;
        try {
          const candidates = this.obsidianExt.search(this.vaultPath, label, false, 1);
          if (candidates.length > 0) {
            this.upsertIndex(entityId, candidates[0].path);
            count++;
          } else {
            // Index as orphaned — entity exists in graph but no wiki page
            const entry: LinkIndexEntry = {
              entityId,
              wikiPath: '',
              lastResolved: Date.now(),
              isOrphaned: true,
            };
            this.byEntity.set(entityId, entry);
          }
        } catch {
          // Individual search failure must not block other entities
          const entry: LinkIndexEntry = {
            entityId,
            wikiPath: '',
            lastResolved: Date.now(),
            isOrphaned: true,
          };
          this.byEntity.set(entityId, entry);
        }
      }
    } catch (err) {
      this.logger.error(`Failed to scan graph nodes during rebuild: ${err}`);
    }

    // 2. Scan all wiki pages for any not yet indexed
    try {
      const files = this.obsidianExt.getFiles(this.vaultPath, '*.md');
      for (const filePath of files) {
        if (this.byWikiPath.has(filePath)) continue;
        // Wiki page with no graph entity — index as orphaned
        const entityId = `wiki:${filePath}`;
        const entry: LinkIndexEntry = {
          entityId,
          wikiPath: filePath,
          lastResolved: Date.now(),
          isOrphaned: true,
        };
        this.byEntity.set(entityId, entry);
        this.byWikiPath.set(filePath, entityId);
        count++;
      }
    } catch (err) {
      this.logger.error(`Failed to scan wiki pages during rebuild: ${err}`);
    }

    this.logger.info(`Index rebuilt: ${count} entries, ${this.byEntity.size} total`);
    return count;
  }

  async detectOrphanedLinks(): Promise<OrphanedLink[]> {
    const orphans: OrphanedLink[] = [];
    const now = Date.now();

    // 1. Wiki pages that reference entities not in the graph
    try {
      const files = this.obsidianExt.getFiles(this.vaultPath, '*.md');
      for (const filePath of files) {
        try {
          const links = await this.resolveWikiLinks(filePath);
          for (const link of links) {
            if (link.entityId === null) {
              orphans.push({
                type: 'dangling-reference',
                source: filePath,
                target: link.linkText,
                detectedAt: now,
              });
            }
          }
        } catch {
          // Individual file failure must not block other files
        }
      }
    } catch (err) {
      this.logger.error(`Failed to detect dangling references: ${err}`);
    }

    // 2. Check indexed entries for orphan status
    for (const entry of this.byEntity.values()) {
      if (entry.isOrphaned) {
        if (entry.wikiPath === '') {
          // Entity in graph but no wiki page
          orphans.push({
            type: 'graph-no-wiki',
            source: entry.entityId,
            detectedAt: now,
          });
        } else {
          // Wiki page but no graph entity
          orphans.push({
            type: 'wiki-no-graph',
            source: entry.wikiPath,
            target: entry.entityId,
            detectedAt: now,
          });
        }
      }
    }

    // 3. Graph edges referencing entities with no wiki page
    try {
      const traversed = await this.graphEngine.traverse('__all__', 1);

      for (const item of traversed) {
        const data = item as Record<string, unknown>;
        // Skip non-edge items (nodes)
        if (data?.type !== 'edge' && typeof data?.source !== 'string') continue;

        const sourceId = (data?.source as string) ?? (data?.sourceId as string);
        const targetId = (data?.target as string) ?? (data?.targetId as string);
        if (!sourceId || !targetId) continue;

        const targetWiki = await this.resolveGraphToWiki(targetId);
        if (!targetWiki) {
          orphans.push({
            type: 'graph-no-wiki',
            source: sourceId,
            target: targetId,
            detectedAt: now,
          });
        }
      }
    } catch (err) {
      this.logger.error(`Failed to check graph edges for orphaned links: ${err}`);
    }

    // Publish orphan-detected events
    for (const orphan of orphans) {
      this.publishEvent('graph-wiki:orphan-detected', orphan);
    }

    this.logger.info(`Detected ${orphans.length} orphaned links`);
    return orphans;
  }

  getLinkIndex(): LinkIndexEntry[] {
    return Array.from(this.byEntity.values());
  }

  async checkIntegrity(): Promise<IntegrityReport> {
    await this.rebuildIndex();
    const orphans = await this.detectOrphanedLinks();

    const brokenLinks = orphans.filter(
      (o) => o.type === 'dangling-reference' || o.type === 'graph-no-wiki',
    ).length;

    return {
      totalIndexed: this.byEntity.size,
      orphanedCount: orphans.length,
      brokenLinks,
      details: orphans,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────

  private upsertIndex(entityId: string, wikiPath: string): void {
    const existing = this.byEntity.get(entityId);
    const entry: LinkIndexEntry = {
      entityId,
      wikiPath,
      lastResolved: Date.now(),
      isOrphaned: false,
    };

    // Clean up old wiki path mapping if it changed
    if (existing && existing.wikiPath !== wikiPath) {
      this.byWikiPath.delete(existing.wikiPath);
    }

    this.byEntity.set(entityId, entry);
    this.byWikiPath.set(wikiPath, entityId);
  }

  private removeFromIndex(entityId: string, markOrphanedIfReferenced?: string): void {
    const entry = this.byEntity.get(entityId);
    if (!entry) return;

    this.byWikiPath.delete(entry.wikiPath);
    this.byEntity.delete(entityId);

    // If the removed entity is referenced by another entity, record as orphan
    if (markOrphanedIfReferenced) {
      const orphan: OrphanedLink = {
        type: 'graph-no-wiki',
        source: markOrphanedIfReferenced,
        target: entityId,
        detectedAt: Date.now(),
      };
      this.publishEvent('graph-wiki:orphan-detected', orphan);
    }
  }

  /** Publish event via EventBus — failures never block operations */
  private publishEvent(channel: string, payload: unknown): void {
    try {
      this.eventBus.publish(channel, payload);
    } catch {
      // Event publishing failure must never block bridge operations
    }
  }

  private publishResolved(entityId: string, wikiPath: string): void {
    this.publishEvent('graph-wiki:link-resolved', { entityId, wikiPath });
  }

  private subscribeToEvents(): void {
    this.eventBus.subscribe('knowledge:entity-created', (payload: unknown) => {
      const data = payload as { id: string; label?: string };
      this.logger.debug(`Entity created: ${data.id}, updating index`);
      // Attempt to resolve to a wiki page; if not found, index as orphaned
      const label = data.label ?? data.id;
      try {
        const results = this.obsidianExt.search(this.vaultPath, label, false, 1);
        if (results.length > 0) {
          this.upsertIndex(data.id, results[0].path);
          this.publishResolved(data.id, results[0].path);
        } else {
          const entry: LinkIndexEntry = {
            entityId: data.id,
            wikiPath: '',
            lastResolved: Date.now(),
            isOrphaned: true,
          };
          this.byEntity.set(data.id, entry);
        }
      } catch (err) {
        this.logger.error(`Failed to update index for entity-created ${data.id}: ${err}`);
      }
    });

    this.eventBus.subscribe('knowledge:entity-updated', (payload: unknown) => {
      const data = payload as { id: string; label?: string };
      this.logger.debug(`Entity updated: ${data.id}, refreshing index`);
      const label = data.label ?? data.id;
      try {
        const results = this.obsidianExt.search(this.vaultPath, label, false, 1);
        if (results.length > 0) {
          this.upsertIndex(data.id, results[0].path);
        }
      } catch (err) {
        this.logger.error(`Failed to update index for entity-updated ${data.id}: ${err}`);
      }
    });

    this.eventBus.subscribe('knowledge:entity-deleted', (payload: unknown) => {
      const data = payload as { id: string };
      this.logger.debug(`Entity deleted: ${data.id}, removing from index`);
      this.removeFromIndex(data.id);
    });

    this.eventBus.subscribe('obsidian:file-changed', (payload: unknown) => {
      const data = payload as { path: string };
      this.logger.debug(`Obsidian file changed: ${data.path}, updating wiki mapping`);
      const existingEntityId = this.byWikiPath.get(data.path);
      if (existingEntityId) {
        // Refresh the entry timestamp
        const entry = this.byEntity.get(existingEntityId);
        if (entry) {
          entry.lastResolved = Date.now();
        }
      } else {
        // New file — try to resolve to a graph entity
        const pageName = data.path.replace(/\.md$/, '').split('/').pop() ?? data.path;
        this.graphEngine.getNode(pageName).then((node) => {
          if (node) {
            const nodeData = node as Record<string, unknown>;
            const entityId = (nodeData?.id as string) ?? pageName;
            this.upsertIndex(entityId, data.path);
            this.publishResolved(entityId, data.path);
          }
        }).catch((err) => {
          this.logger.error(`Failed to resolve changed file ${data.path}: ${err}`);
        });
      }
    });
  }
}
