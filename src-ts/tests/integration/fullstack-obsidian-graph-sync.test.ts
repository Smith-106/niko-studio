import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ObsidianKnowledgeSyncImpl, ConflictStrategy } from '../../services/obsidian-knowledge-sync.js';
import type { ObsidianSyncConfig } from '../../services/obsidian-knowledge-sync.js';
import { GraphWikiLinkBridgeImpl } from '../../services/graph-wiki-bridge.js';
import type { LinkIndexEntry, OrphanedLink, IntegrityReport } from '../../services/graph-wiki-bridge.js';
import { TypedEventBus } from '../../services/event-bus.js';
import { EventLogImpl } from '../../services/event-log.js';
import type { IEventBus } from '../../services/event-bus.js';
import type { IGraphEngine } from '../../container/types.js';
import type { KnowledgeEntity } from '../../protocols/knowledge.js';

// ---------------------------------------------------------------------------
// Mock implementations
// ---------------------------------------------------------------------------

/**
 * Mock IObsidianService that satisfies the container interface
 * AND exposes the extended methods needed by GraphWikiLinkBridgeImpl
 * (search, getFiles).
 */
class MockObsidianService {
  private notes = new Map<string, string>();
  private writtenNotes = new Map<string, string>();
  private searchResults: Array<{ name: string; path: string; relativePath: string }> = [];

  // Core IObsidianService methods
  async readNote(vaultPath: string, notePath: string): Promise<string | null> {
    return this.notes.get(notePath) ?? null;
  }

  async writeNote(vaultPath: string, notePath: string, content: string): Promise<void> {
    this.notes.set(notePath, content);
    this.writtenNotes.set(notePath, content);
  }

  async deleteNote(vaultPath: string, notePath: string): Promise<void> {
    this.notes.delete(notePath);
  }

  // Extended methods needed by GraphWikiLinkBridgeImpl (ObsidianSearchAccess)
  search(vaultPath: string, query: string, searchContent?: boolean, limit?: number): Array<{ name: string; path: string; relativePath: string }> {
    return this.searchResults.filter((r) =>
      r.name.toLowerCase().includes(query.toLowerCase()) ||
      r.path.toLowerCase().includes(query.toLowerCase()),
    ).slice(0, limit ?? 50);
  }

  getFiles(vaultPath: string, pattern?: string): string[] {
    return Array.from(this.notes.keys());
  }

  // Test helpers
  addNote(notePath: string, content: string): void {
    this.notes.set(notePath, content);
    this.searchResults.push({
      name: notePath.replace(/\.md$/, '').split('/').pop() ?? notePath,
      path: notePath,
      relativePath: notePath,
    });
  }

  getWrittenNotes(): Map<string, string> {
    return this.writtenNotes;
  }
}

/**
 * Mock IKnowledgeService that satisfies the container interface
 * AND exposes the extended methods needed by ObsidianKnowledgeSyncImpl
 * (getEntity, addEntity, deleteEntity, listEntities).
 */
class MockKnowledgeService {
  private entities = new Map<string, KnowledgeEntity>();

  // IKnowledgeService container interface methods
  async addDocument(docId: string, content: string, metadata?: any): Promise<void> {}
  async addEntity(entity: unknown): Promise<void> {
    const e = entity as KnowledgeEntity;
    this.entities.set(e.id, e);
  }
  async addRelation(relation: unknown): Promise<void> {}
  async search(query: string, options?: any): Promise<unknown> { return []; }
  async getNeighbors(entityId: string): Promise<unknown[]> { return []; }
  async distillKnowledge(content: string, template: string, metadata?: any): Promise<unknown> { return {}; }
  async initialize(): Promise<void> {}

  // Extended KnowledgeEntityReader methods needed by ObsidianKnowledgeSyncImpl
  getEntity(entityId: string): KnowledgeEntity | undefined {
    return this.entities.get(entityId);
  }

  listEntities(): KnowledgeEntity[] {
    return Array.from(this.entities.values());
  }

  async deleteEntity(entityId: string): Promise<void> {
    this.entities.delete(entityId);
  }
}

/**
 * Mock IGraphEngine for the graph-wiki bridge tests.
 */
class MockGraphEngine implements IGraphEngine {
  private nodes = new Map<string, any>();
  private edges: Array<{ from: string; to: string; relationship: string }> = [];

  async initialize(): Promise<void> {}
  async addNode(id: string, data: unknown): Promise<void> {
    this.nodes.set(id, { id, ...data as object });
  }
  async addEdge(from: string, to: string, relationship: string): Promise<void> {
    this.edges.push({ from, to, relationship });
  }
  async getNode(id: string): Promise<unknown> {
    return this.nodes.get(id) ?? null;
  }
  async traverse(startId: string, depth?: number): Promise<unknown[]> {
    // Return all nodes for '__all__' startId
    if (startId === '__all__') {
      const allNodes = Array.from(this.nodes.values());
      if ((depth ?? 0) >= 1) {
        // Include edges as items with type='edge', source, target fields
        const edgeItems = this.edges.map((e) => ({
          type: 'edge',
          source: e.from,
          target: e.to,
          sourceId: e.from,
          targetId: e.to,
          ...e,
        }));
        return [...allNodes, ...edgeItems];
      }
      return allNodes;
    }
    // Traverse from specific node
    const result: unknown[] = [];
    if (this.nodes.has(startId)) {
      result.push(this.nodes.get(startId));
    }
    const connectedEdges = this.edges.filter((e) => e.from === startId || e.to === startId);
    for (const edge of connectedEdges) {
      const targetId = edge.from === startId ? edge.to : edge.from;
      if (this.nodes.has(targetId)) {
        result.push(this.nodes.get(targetId));
      }
    }
    return result;
  }
}

// ---------------------------------------------------------------------------
// Test Suite: Obsidian↔Knowledge Sync + Graph↔Wiki Bridge
// ---------------------------------------------------------------------------

describe('Integration: Obsidian↔Knowledge sync + Graph↔Wiki bridge', () => {
  let eventBus: TypedEventBus;
  let eventLog: EventLogImpl;
  let obsidianService: MockObsidianService;
  let knowledgeService: MockKnowledgeService;
  let graphEngine: MockGraphEngine;

  beforeEach(() => {
    eventLog = new EventLogImpl({ maxRetention: 200 });
    eventBus = new TypedEventBus(undefined, { eventLog });
    obsidianService = new MockObsidianService();
    knowledgeService = new MockKnowledgeService();
    graphEngine = new MockGraphEngine();
  });

  afterEach(() => {
    eventLog.clear();
  });

  // -------------------------------------------------------------------------
  // Obsidian ↔ Knowledge sync
  // -------------------------------------------------------------------------

  it('publish obsidian:file-changed event → verify knowledge entity created', async () => {
    // Pre-populate vault with a file
    obsidianService.addNote('typescript-patterns.md', '# TypeScript Patterns\n\nContent about TS patterns.');

    const sync = new ObsidianKnowledgeSyncImpl({
      obsidianService: obsidianService as any,
      knowledgeService: knowledgeService as any,
      eventBus: eventBus as IEventBus,
      config: {
        conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
        debounceMs: 50, // Short debounce for testing
        watchEnabled: true,
        vaultRoot: '/test/vault',
      },
    });

    // Start sync (subscribes to events)
    await sync.startSync();

    // Publish obsidian file change event
    eventBus.publish('obsidian:file-changed', {
      path: 'typescript-patterns.md',
      timestamp: Date.now(),
    });

    // Wait for debounce + processing
    await new Promise((r) => setTimeout(r, 150));

    // Verify knowledge entity was created
    const entities = knowledgeService.listEntities();
    expect(entities.length).toBeGreaterThanOrEqual(1);

    // Verify sync event was published
    const syncEvents = eventLog.getEvents({ channel: 'obsidian-sync:vault-to-knowledge' });
    expect(syncEvents.length).toBeGreaterThanOrEqual(1);

    sync.stopSync();
  });

  it('publish knowledge:entity-created event → verify vault write triggered', async () => {
    const sync = new ObsidianKnowledgeSyncImpl({
      obsidianService: obsidianService as any,
      knowledgeService: knowledgeService as any,
      eventBus: eventBus as IEventBus,
      config: {
        conflictStrategy: ConflictStrategy.LAST_WRITE_WINS,
        debounceMs: 50,
        watchEnabled: true,
        vaultRoot: '/test/vault',
      },
    });

    await sync.startSync();

    // Pre-populate knowledge with an entity
    await knowledgeService.addEntity({
      id: 'new-entity-1',
      name: 'New Concept',
      type: 'concept',
      description: 'Details about the new concept',
    });

    // Publish knowledge entity creation event
    eventBus.publish('knowledge:entity-created', {
      id: 'new-entity-1',
      timestamp: Date.now(),
    });

    // Wait for debounce + processing
    await new Promise((r) => setTimeout(r, 150));

    // Verify vault file was written
    const written = obsidianService.getWrittenNotes();
    expect(written.size).toBeGreaterThanOrEqual(1);

    // Verify sync event was published
    const syncEvents = eventLog.getEvents({ channel: 'obsidian-sync:knowledge-to-vault' });
    expect(syncEvents.length).toBeGreaterThanOrEqual(1);

    sync.stopSync();
  });

  // -------------------------------------------------------------------------
  // Graph ↔ Wiki bridge
  // -------------------------------------------------------------------------

  it('build link index → resolve graph entity to wiki path → verify correct mapping', async () => {
    // Add graph nodes with matching names
    await graphEngine.addNode('design-patterns', { name: 'Design Patterns' });
    await graphEngine.addNode('architecture', { name: 'Architecture' });

    // Pre-populate obsidian with matching notes
    obsidianService.addNote('Design Patterns.md', '# Design Patterns\n\nContent about patterns.');
    obsidianService.addNote('Architecture.md', '# Architecture\n\nContent about architecture.');

    const bridge = new GraphWikiLinkBridgeImpl({
      graphEngine: graphEngine as IGraphEngine,
      obsidianService: obsidianService as any,
      eventBus: eventBus as IEventBus,
      vaultPath: '/test/vault',
    });

    // Rebuild the link index
    const count = await bridge.rebuildIndex();
    expect(count).toBeGreaterThanOrEqual(2);

    // Resolve graph entity to wiki path
    const wikiPath1 = await bridge.resolveGraphToWiki('design-patterns');
    expect(wikiPath1).toContain('Design Patterns');

    const wikiPath2 = await bridge.resolveGraphToWiki('architecture');
    expect(wikiPath2).toContain('Architecture');
  });

  it('resolve wiki link → verify graph entity found', async () => {
    // Add a graph node
    await graphEngine.addNode('test-concept', { name: 'Test Concept' });

    // Add a matching obsidian note
    obsidianService.addNote('Test Concept.md', '# Test Concept\n\nContent.');

    const bridge = new GraphWikiLinkBridgeImpl({
      graphEngine: graphEngine as IGraphEngine,
      obsidianService: obsidianService as any,
      eventBus: eventBus as IEventBus,
      vaultPath: '/test/vault',
    });

    // Rebuild index
    await bridge.rebuildIndex();

    // Resolve wiki path to graph entity
    const graphId = await bridge.resolveWikiToGraph('Test Concept.md');
    expect(graphId).toBe('test-concept');
  });

  it('detect orphaned links → verify wiki-no-graph and graph-no-wiki reported', async () => {
    // Add a graph node with no matching wiki page
    await graphEngine.addNode('orphaned-graph-node', { name: 'Orphaned Graph Node' });

    // Add a wiki page with no matching graph node
    obsidianService.addNote('Unlinked Wiki Page.md', '# Unlinked Wiki Page\n\nNo graph entity.');

    const bridge = new GraphWikiLinkBridgeImpl({
      graphEngine: graphEngine as IGraphEngine,
      obsidianService: obsidianService as any,
      eventBus: eventBus as IEventBus,
      vaultPath: '/test/vault',
    });

    // Rebuild index first
    await bridge.rebuildIndex();

    // Detect orphaned links
    const orphans = await bridge.detectOrphanedLinks();

    // Should find graph-no-wiki entries (graph entities without wiki pages)
    const graphNoWiki = orphans.filter((o) => o.type === 'graph-no-wiki');
    expect(graphNoWiki.length).toBeGreaterThanOrEqual(1);

    // Should find wiki-no-graph entries (wiki pages without graph entities)
    const wikiNoGraph = orphans.filter((o) => o.type === 'wiki-no-graph');
    expect(wikiNoGraph.length).toBeGreaterThanOrEqual(1);

    // Verify orphan detection events published
    const orphanEvents = eventLog.getEvents({ channel: 'graph-wiki:orphan-detected' });
    expect(orphanEvents.length).toBeGreaterThanOrEqual(2);
  });
});