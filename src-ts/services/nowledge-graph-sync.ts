/**
 * NowledgeGraphSync — Knowledge <-> Graph bidirectional sync (P1 bridge)
 *
 * Coordinates bidirectional synchronization between the KnowledgeService
 * entity/relation store and the GraphEngine node/edge store.
 *
 * Design:
 * - Push: knowledge entities → graph nodes, knowledge relations → graph edges
 * - Pull: graph nodes → knowledge entities
 * - Bidirectional: both directions with conflict detection
 * - EventBus integration is optional — events published only when bus is available
 * - ConflictBridge integration is optional — conflicts checked only when bridge is available
 * - Individual sync failures never block other items in batch operations
 */

import type { IKnowledgeService, IGraphEngine, IEventBus, IConflictNowledgeBridge } from '../container/types';
import type { KnowledgeEntity, KnowledgeRelation } from '../protocols/knowledge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  success: boolean;
  entityId: string;
  direction: 'to-graph' | 'to-knowledge';
  syncedAt: string;
  error?: string;
}

export interface BatchSyncResult {
  total: number;
  synced: number;
  failed: number;
  results: SyncResult[];
}

export interface SyncStatus {
  entityId: string;
  lastSyncAt: string | null;
  direction: 'to-graph' | 'to-knowledge' | 'bidirectional' | null;
  status: 'synced' | 'pending' | 'conflict' | 'error';
}

// ---------------------------------------------------------------------------
// Interface
// ---------------------------------------------------------------------------

export interface INowledgeGraphSync {
  /** Push a knowledge entity to the graph */
  syncEntityToGraph(entityId: string): Promise<SyncResult>;

  /** Push a knowledge relation to the graph */
  syncRelationToGraph(relationId: string): Promise<SyncResult>;

  /** Pull graph node data back to knowledge store */
  syncGraphToKnowledge(graphNodeId: string): Promise<SyncResult>;

  /** Bulk sync in a given direction */
  syncAll(direction: 'to-graph' | 'to-knowledge' | 'bidirectional'): Promise<BatchSyncResult>;

  /** Check sync state of an entity */
  getSyncStatus(entityId: string): Promise<SyncStatus>;
}

// ---------------------------------------------------------------------------
// Internal: extended knowledge service access
// ---------------------------------------------------------------------------

/**
 * KnowledgeServiceImpl exposes getEntity/getRelation/listEntities/listRelations
 * beyond the IKnowledgeService container interface. We type-cast at the adapter
 * layer to access these methods — same pattern used by other bridges.
 */
interface KnowledgeEntityReader {
  getEntity(entityId: string): KnowledgeEntity | undefined;
  getRelation(relationId: string): KnowledgeRelation | undefined;
  listEntities(): KnowledgeEntity[];
  listRelations(): KnowledgeRelation[];
}

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class NowledgeGraphSync implements INowledgeGraphSync {
  private readonly knowledgeService: IKnowledgeService & KnowledgeEntityReader;
  private readonly graphEngine: IGraphEngine;
  private readonly eventBus?: IEventBus;
  private readonly conflictBridge?: IConflictNowledgeBridge;

  /** Track last sync timestamps per entity */
  private readonly syncTimestamps = new Map<string, { at: string; direction: 'to-graph' | 'to-knowledge' | 'bidirectional' }>();

  constructor(deps: {
    knowledgeService: IKnowledgeService;
    graphEngine: IGraphEngine;
    eventBus?: IEventBus;
    conflictBridge?: IConflictNowledgeBridge;
  }) {
    // Cast to access getEntity/getRelation/listEntities/listRelations
    this.knowledgeService = deps.knowledgeService as IKnowledgeService & KnowledgeEntityReader;
    this.graphEngine = deps.graphEngine;
    this.eventBus = deps.eventBus;
    this.conflictBridge = deps.conflictBridge;
  }

  // ─── Push: Knowledge → Graph ──────────────────────────────────────

  async syncEntityToGraph(entityId: string): Promise<SyncResult> {
    const now = new Date().toISOString();

    try {
      // 1. Read entity from KnowledgeService
      const entity = this.knowledgeService.getEntity(entityId);
      if (!entity) {
        return {
          success: false,
          entityId,
          direction: 'to-graph',
          syncedAt: now,
          error: `Entity not found: ${entityId}`,
        };
      }

      // 2. Convert to graph node format
      const nodeData = this.entityToGraphNode(entity);

      // 3. Write to GraphEngine
      await this.graphEngine.addNode(entity.id, nodeData);

      // 4. Check for conflicts if conflictBridge available
      if (this.conflictBridge) {
        try {
          const conflicts = await this.conflictBridge.detectConflicts(entity.id);
          if (conflicts.length > 0) {
            // Conflict detected — still mark as synced but note in event
            this.publishEvent('knowledge:entity-synced', {
              entityId,
              direction: 'to-graph',
              conflicts: conflicts.length,
            });
            this.recordSync(entityId, now, 'to-graph');
            return {
              success: true,
              entityId,
              direction: 'to-graph',
              syncedAt: now,
            };
          }
        } catch {
          // Conflict check failure is non-critical
        }
      }

      // 5. Publish event
      this.publishEvent('knowledge:entity-synced', {
        entityId,
        direction: 'to-graph',
      });

      this.recordSync(entityId, now, 'to-graph');

      return {
        success: true,
        entityId,
        direction: 'to-graph',
        syncedAt: now,
      };
    } catch (error) {
      return {
        success: false,
        entityId,
        direction: 'to-graph',
        syncedAt: now,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async syncRelationToGraph(relationId: string): Promise<SyncResult> {
    const now = new Date().toISOString();

    try {
      // 1. Read relation from KnowledgeService
      const relation = this.knowledgeService.getRelation(relationId);
      if (!relation) {
        return {
          success: false,
          entityId: relationId,
          direction: 'to-graph',
          syncedAt: now,
          error: `Relation not found: ${relationId}`,
        };
      }

      // 2. Convert to graph edge format — already matches IGraphEngine.addEdge
      // 3. Write to GraphEngine
      await this.graphEngine.addEdge(relation.sourceId, relation.targetId, relation.type);

      // 4. Publish event
      this.publishEvent('knowledge:relation-synced', {
        relationId,
        sourceId: relation.sourceId,
        targetId: relation.targetId,
        type: relation.type,
        direction: 'to-graph',
      });

      this.recordSync(relationId, now, 'to-graph');

      return {
        success: true,
        entityId: relationId,
        direction: 'to-graph',
        syncedAt: now,
      };
    } catch (error) {
      return {
        success: false,
        entityId: relationId,
        direction: 'to-graph',
        syncedAt: now,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ─── Pull: Graph → Knowledge ──────────────────────────────────────

  async syncGraphToKnowledge(graphNodeId: string): Promise<SyncResult> {
    const now = new Date().toISOString();

    try {
      // 1. Read node from GraphEngine
      const graphNode = await this.graphEngine.getNode(graphNodeId);
      if (!graphNode) {
        return {
          success: false,
          entityId: graphNodeId,
          direction: 'to-knowledge',
          syncedAt: now,
          error: `Graph node not found: ${graphNodeId}`,
        };
      }

      // 2. Convert to knowledge entity format
      const entity = this.graphNodeToEntity(graphNodeId, graphNode);

      // 3. Write to KnowledgeService
      await this.knowledgeService.addEntity(entity);

      // 4. Check for conflicts if conflictBridge available
      if (this.conflictBridge) {
        try {
          const conflicts = await this.conflictBridge.detectConflicts(graphNodeId);
          if (conflicts.length > 0) {
            this.publishEvent('knowledge:graph-synced', {
              entityId: graphNodeId,
              direction: 'to-knowledge',
              conflicts: conflicts.length,
            });
            this.recordSync(graphNodeId, now, 'to-knowledge');
            return {
              success: true,
              entityId: graphNodeId,
              direction: 'to-knowledge',
              syncedAt: now,
            };
          }
        } catch {
          // Conflict check failure is non-critical
        }
      }

      // 5. Publish event
      this.publishEvent('knowledge:graph-synced', {
        entityId: graphNodeId,
        direction: 'to-knowledge',
      });

      this.recordSync(graphNodeId, now, 'to-knowledge');

      return {
        success: true,
        entityId: graphNodeId,
        direction: 'to-knowledge',
        syncedAt: now,
      };
    } catch (error) {
      return {
        success: false,
        entityId: graphNodeId,
        direction: 'to-knowledge',
        syncedAt: now,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // ─── Bulk sync ────────────────────────────────────────────────────

  async syncAll(direction: 'to-graph' | 'to-knowledge' | 'bidirectional'): Promise<BatchSyncResult> {
    const results: SyncResult[] = [];

    if (direction === 'to-graph' || direction === 'bidirectional') {
      // Sync all knowledge entities → graph
      const entities = this.knowledgeService.listEntities();
      for (const entity of entities) {
        try {
          const result = await this.syncEntityToGraph(entity.id);
          results.push(result);
        } catch (error) {
          // Individual failure must not block other entities
          results.push({
            success: false,
            entityId: entity.id,
            direction: 'to-graph',
            syncedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sync all knowledge relations → graph
      const relations = this.knowledgeService.listRelations();
      for (const relation of relations) {
        try {
          const result = await this.syncRelationToGraph(relation.id);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            entityId: relation.id,
            direction: 'to-graph',
            syncedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    if (direction === 'to-knowledge' || direction === 'bidirectional') {
      // For to-knowledge direction, we need to enumerate graph nodes.
      // IGraphEngine doesn't expose a listNodes() method, so we use
      // traverse from a known root or rely on the knowledge entity IDs
      // we already know about. For P1, we iterate known entity IDs
      // and attempt to pull their graph counterparts.
      const knownEntityIds = this.knowledgeService.listEntities().map(e => e.id);
      for (const entityId of knownEntityIds) {
        try {
          const result = await this.syncGraphToKnowledge(entityId);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            entityId,
            direction: 'to-knowledge',
            syncedAt: new Date().toISOString(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const synced = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    // For bidirectional, update sync records with bidirectional direction
    if (direction === 'bidirectional') {
      const now = new Date().toISOString();
      for (const result of results) {
        if (result.success) {
          this.recordSync(result.entityId, now, 'bidirectional');
        }
      }
    }

    return {
      total: results.length,
      synced,
      failed,
      results,
    };
  }

  // ─── Sync status ──────────────────────────────────────────────────

  async getSyncStatus(entityId: string): Promise<SyncStatus> {
    const record = this.syncTimestamps.get(entityId);

    // Check if entity exists in knowledge store
    const knowledgeEntity = this.knowledgeService.getEntity(entityId);

    // Check if node exists in graph store
    let graphNode: unknown = null;
    try {
      graphNode = await this.graphEngine.getNode(entityId);
    } catch {
      // getNode failure means graph doesn't have this node
    }

    const inKnowledge = knowledgeEntity !== undefined;
    const inGraph = graphNode !== null && graphNode !== undefined;

    // Determine status
    let status: SyncStatus['status'];

    if (!inKnowledge && !inGraph) {
      // Exists in neither — error
      status = 'error';
    } else if (inKnowledge && !inGraph) {
      // Only in knowledge — pending push to graph
      status = 'pending';
    } else if (!inKnowledge && inGraph) {
      // Only in graph — pending pull to knowledge
      status = 'pending';
    } else {
      // In both stores
      if (record) {
        // Has been synced before — check for conflicts
        if (this.conflictBridge) {
          try {
            const conflicts = await this.conflictBridge.detectConflicts(entityId);
            status = conflicts.length > 0 ? 'conflict' : 'synced';
          } catch {
            status = 'synced';
          }
        } else {
          status = 'synced';
        }
      } else {
        // In both stores but never explicitly synced — pending
        status = 'pending';
      }
    }

    return {
      entityId,
      lastSyncAt: record?.at ?? null,
      direction: record?.direction ?? null,
      status,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  /** Convert KnowledgeEntity to graph node data format */
  private entityToGraphNode(entity: KnowledgeEntity): Record<string, unknown> {
    return {
      type: entity.type,
      name: entity.name,
      description: entity.description ?? '',
      properties: entity.properties ?? {},
      createdAt: entity.createdAt ?? new Date().toISOString(),
    };
  }

  /** Convert graph node data to KnowledgeEntity format */
  private graphNodeToEntity(nodeId: string, graphNode: unknown): KnowledgeEntity {
    const data = graphNode as Record<string, unknown>;
    return {
      id: nodeId,
      name: (data?.name as string) ?? nodeId,
      type: (data?.type as string) ?? 'unknown',
      description: typeof data?.description === 'string' ? data.description : undefined,
      properties: (data?.properties as Record<string, unknown>) ?? {},
      createdAt: typeof data?.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
    };
  }

  /** Publish event via EventBus if available */
  private publishEvent(channel: string, payload: unknown): void {
    if (!this.eventBus) return;
    try {
      this.eventBus.publish(channel, payload);
    } catch {
      // Event publishing failure must never block sync operations
    }
  }

  /** Record sync timestamp for an entity */
  private recordSync(entityId: string, timestamp: string, direction: 'to-graph' | 'to-knowledge' | 'bidirectional'): void {
    this.syncTimestamps.set(entityId, { at: timestamp, direction });
  }
}
