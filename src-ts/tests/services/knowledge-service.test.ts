/**
 * KnowledgeService Unit Tests
 *
 * Tests for KnowledgeServiceImpl covering:
 * - Initialization
 * - Entity CRUD operations
 * - Relation CRUD operations
 * - Neighbor queries
 * - Document management
 * - Search operations
 * - File synchronization
 * - Statistics
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KnowledgeServiceImpl,
  KnowledgeError,
  EntityNotFoundError,
  DocumentNotFoundError,
} from '../../services/knowledge-service';
import type { LLMService } from '../../protocols/llm';
import type { EmbeddingService } from '../../protocols/embedding';
import type { KnowledgeEntity, KnowledgeRelation } from '../../protocols/knowledge';

/**
 * Mock LLM Service for testing
 */
class MockLLMService implements LLMService {
  async generate(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
      stopSequences?: string[];
    }
  ): Promise<string> {
    return 'Mocked LLM response';
  }

  async generateWithMetadata(): Promise<{ content: string; metadata: Record<string, unknown> }> {
    return { content: 'Mocked response', metadata: {} };
  }

  async generateJson(): Promise<Record<string, unknown>> {
    return { result: 'mocked' };
  }

  async *stream(): AsyncIterableIterator<{ content: string; isFinished: boolean; metadata?: Record<string, unknown> }> {
    yield { content: 'Mocked', isFinished: false };
    yield { content: ' stream', isFinished: true };
  }

  async batchGenerate(prompts: string[]): Promise<string[]> {
    return prompts.map(() => 'Mocked batch response');
  }
}

/**
 * Mock Embedding Service for testing
 */
class MockEmbeddingService implements EmbeddingService {
  async embed(
    text: string,
    options?: { model?: string }
  ): Promise<number[]> {
    return Array(384).fill(0.1);
  }

  async embedBatch(
    texts: string[],
    options?: { model?: string }
  ): Promise<number[][]> {
    return texts.map(() => Array(384).fill(0.1));
  }

  embedWithMetadata(request: unknown): Promise<unknown> {
    return Promise.resolve({ embedding: Array(384).fill(0.1) });
  }

  similarity(embedding1: number[], embedding2: number[]): number {
    return 0.95;
  }

  getDimensions(model?: string): number {
    return 384;
  }
}

describe('KnowledgeService', () => {
  let service: KnowledgeServiceImpl;
  let mockLLM: MockLLMService;
  let mockEmbedding: MockEmbeddingService;
  let tempRoot: string;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    mockEmbedding = new MockEmbeddingService();
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-knowledge-service-'));
    service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      llmService: mockLLM,
      embeddingService: mockEmbedding,
      enableDistillation: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  // ============================================================
  // Initialization Tests
  // ============================================================

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      const health = await service.healthCheck();
      expect(health).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await service.initialize();
      await service.initialize();
      // Should not throw
    });

    it('should initialize without LLM service', () => {
      const serviceNoLLM = new KnowledgeServiceImpl({
        dbPath: ':memory:',
        embeddingService: mockEmbedding,
      });
      expect(serviceNoLLM).toBeDefined();
    });

    it('should initialize without embedding service', () => {
      const serviceNoEmbed = new KnowledgeServiceImpl({
        dbPath: ':memory:',
        llmService: mockLLM,
      });
      expect(serviceNoEmbed).toBeDefined();
    });

    it('should initialize without optional services', () => {
      const serviceMinimal = new KnowledgeServiceImpl({
        dbPath: ':memory:',
      });
      expect(serviceMinimal).toBeDefined();
    });
  });

  // ============================================================
  // Entity CRUD Tests
  // ============================================================

  describe('Entity Operations', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add an entity', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character', description: 'Protagonist' });

      const entity = service.getEntity('e1');
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('Alice');
      expect(entity?.type).toBe('Character');
      expect(entity?.description).toBe('Protagonist');
    });

    it('should add an entity with properties', async () => {
      await service.addEntity({ id: 'e2', name: 'Bob', type: 'Character', properties: { age: 30 } });

      const entity = service.getEntity('e2');
      expect(entity).toBeDefined();
      expect(entity?.properties).toEqual({ age: 30 });
    });

    it('should update an existing entity (upsert)', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.addEntity({ id: 'e1', name: 'Alice Updated', type: 'Character' });

      const entity = service.getEntity('e1');
      expect(entity?.name).toBe('Alice Updated');
    });

    it('should delete an entity', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.deleteEntity('e1');

      const entity = service.getEntity('e1');
      expect(entity).toBeUndefined();
    });

    it('should handle deleting non-existent entity gracefully', async () => {
      // deleteEntity returns void, doesn't throw for non-existent
      await expect(service.deleteEntity('nonexistent')).resolves.toBeUndefined();
    });

    it('should list all entities', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.addEntity({ id: 'e2', name: 'Bob', type: 'Character' });
      await service.addEntity({ id: 'l1', name: 'Wonderland', type: 'Location' });

      const entities = service.listEntities();
      expect(entities).toHaveLength(3);
    });

    it('should return undefined for non-existent entity', () => {
      const entity = service.getEntity('nonexistent');
      expect(entity).toBeUndefined();
    });
  });

  // ============================================================
  // Relation CRUD Tests
  // ============================================================

  describe('Relation Operations', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.addEntity({ id: 'e2', name: 'Bob', type: 'Character' });
    });

    it('should add a relation', async () => {
      await service.addRelation({ id: 'r1', sourceId: 'e1', targetId: 'e2', type: 'KNOWS' });

      const relation = service.getRelation('r1');
      expect(relation).toBeDefined();
      expect(relation?.targetId).toBe('e2');
      expect(relation?.type).toBe('KNOWS');
    });

    it('should add a relation with properties', async () => {
      await service.addRelation({ id: 'r1', sourceId: 'e1', targetId: 'e2', type: 'FRIEND', properties: { since: 'childhood' } });

      const relation = service.getRelation('r1');
      expect(relation?.properties).toEqual({ since: 'childhood' });
    });

    it('should throw EntityNotFoundError when adding relation with non-existent source', async () => {
      await expect(
        service.addRelation({ id: 'r1', sourceId: 'nonexistent', targetId: 'e2', type: 'KNOWS' })
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('should throw EntityNotFoundError when adding relation with non-existent target', async () => {
      await expect(
        service.addRelation({ id: 'r1', sourceId: 'e1', targetId: 'nonexistent', type: 'KNOWS' })
      ).rejects.toThrow(EntityNotFoundError);
    });

    it('should list all relations', async () => {
      await service.addRelation({ id: 'r1', sourceId: 'e1', targetId: 'e2', type: 'KNOWS' });

      const relations = service.listRelations();
      expect(relations).toHaveLength(1);
    });
  });

  // ============================================================
  // Neighbor Query Tests
  // ============================================================

  describe('Get Neighbors', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.addEntity({ id: 'e2', name: 'Bob', type: 'Character' });
      await service.addEntity({ id: 'e3', name: 'Carol', type: 'Character' });
    });

    it('should get neighbors for an entity', async () => {
      await service.addRelation({ id: 'r1', sourceId: 'e1', targetId: 'e2', type: 'KNOWS' });

      const neighbors = await service.getNeighbors('e1');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].targetId).toBe('e2');
      expect(neighbors[0].type).toBe('KNOWS');
    });

    it('should return empty array for entity with no neighbors', async () => {
      const neighbors = await service.getNeighbors('e1');
      expect(neighbors).toEqual([]);
    });

    it('should get multiple neighbors', async () => {
      await service.addRelation({ id: 'r1', sourceId: 'e1', targetId: 'e2', type: 'KNOWS' });
      await service.addRelation({ id: 'r2', sourceId: 'e1', targetId: 'e3', type: 'LOVES' });

      const neighbors = await service.getNeighbors('e1');
      expect(neighbors).toHaveLength(2);
    });
  });

  // ============================================================
  // Document Management Tests
  // ============================================================

  describe('Document Operations', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should add a document', async () => {
      await service.addDocument('doc-1', 'Test document content');

      const doc = service.getDocument('doc-1');
      expect(doc).toBeDefined();
      expect(doc?.content).toBe('Test document content');
    });

    it('should add a document with metadata', async () => {
      await service.addDocument('doc-1', 'Test content', {
        sourceId: 'source-1',
        sourceType: 'file',
      });

      const doc = service.getDocument('doc-1');
      expect(doc?.sourceId).toBe('source-1');
      expect(doc?.sourceType).toBe('file');
    });

    it('should delete a document', async () => {
      await service.addDocument('doc-1', 'Test content');
      await service.deleteDocument('doc-1');

      const doc = service.getDocument('doc-1');
      expect(doc).toBeUndefined();
    });

    it('should return undefined for non-existent document', () => {
      const doc = service.getDocument('nonexistent');
      expect(doc).toBeUndefined();
    });
  });

  // ============================================================
  // Search Tests
  // ============================================================

  describe('Search', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should perform search returning entities and chunks', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character', description: 'Protagonist' });
      await service.addDocument('doc-1', 'Alice in Wonderland');

      const results = await service.search('Alice', { topK: 5 });
      expect(results).toHaveProperty('chunks');
      expect(results).toHaveProperty('entities');
      expect(Array.isArray(results.chunks)).toBe(true);
      expect(Array.isArray(results.entities)).toBe(true);
    });

    it('should apply entity filter in search', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.addEntity({ id: 'e2', name: 'Bob', type: 'Character' });

      const results = await service.search('test', {
        topK: 5,
        entityFilter: ['e1', 'e2'],
      });

      const entityIds = results.entities.map(e => e.id);
      expect(entityIds).toContain('e1');
      expect(entityIds).toContain('e2');
    });

    it('should return empty results for empty query', async () => {
      const results = await service.search('', { topK: 5 });
      expect(results.chunks).toEqual([]);
      expect(results.entities).toEqual([]);
    });
  });

  // ============================================================
  // File Synchronization Tests
  // ============================================================

  describe('File Synchronization', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('returns a bounded error when the source file is missing', async () => {
      const result = await service.syncFile(join(tempRoot, 'missing.md'));
      expect(result).toEqual({
        success: false,
        action: 'error',
        message: 'File not found',
      });
    });

    it('syncs a real file and stores the content in the document index', async () => {
      const filePath = join(tempRoot, 'notes.md');
      writeFileSync(filePath, 'Scene content for sync.', 'utf-8');

      const result = await service.syncFile(filePath);

      expect(result.success).toBe(true);
      expect(result.action).toBe('synced');
      expect(result.docId).toBeDefined();
      expect(result.contentHash).toBeDefined();

      const document = service.getDocument(String(result.docId));
      expect(document?.content).toBe('Scene content for sync.');
      expect(document?.sourceId).toBe(filePath);
      expect(document?.sourceType).toBe('document');
    });

    it('detects source type and skips unchanged files unless forced', async () => {
      const filePath = join(tempRoot, 'citations', 'note.md');
      mkdirSync(join(tempRoot, 'citations'), { recursive: true });
      writeFileSync(filePath, 'Citation content.', 'utf-8');

      const first = await service.syncFile(filePath);
      const second = await service.syncFile(filePath);
      const forced = await service.syncFile(filePath, { force: true });

      expect(first.message).toContain('citation');
      expect(second).toMatchObject({
        success: true,
        action: 'skipped',
        docId: first.docId,
        contentHash: first.contentHash,
      });
      expect(forced).toMatchObject({
        success: true,
        action: 'synced',
        docId: first.docId,
      });
    });
  });

  // ============================================================
  // Error Handling Tests
  // ============================================================

  describe('Error Handling', () => {
    it('should throw KnowledgeError for operations before initialization', async () => {
      const uninitializedService = new KnowledgeServiceImpl({
        dbPath: ':memory:',
      });

      await expect(
        uninitializedService.addEntity({ id: 'e1', name: 'Alice', type: 'Character' })
      ).rejects.toThrow(KnowledgeError);
    });

    it('should handle embedding errors gracefully', async () => {
      const errorEmbedding: EmbeddingService = {
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        embedBatch: vi.fn(),
        embedWithMetadata: vi.fn(),
        similarity: vi.fn(),
        getDimensions: vi.fn(),
      };

      const serviceWithError = new KnowledgeServiceImpl({
        dbPath: ':memory:',
        embeddingService: errorEmbedding,
      });
      await serviceWithError.initialize();

      // Should not throw, should continue without embedding
      await serviceWithError.addDocument('doc-1', 'Test content');
      const doc = serviceWithError.getDocument('doc-1');
      expect(doc).toBeDefined();
    });
  });

  // ============================================================
  // Statistics Tests
  // ============================================================

  describe('Statistics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should return statistics', async () => {
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });
      await service.addEntity({ id: 'e2', name: 'Wonderland', type: 'Location' });
      await service.addDocument('doc-1', 'Test content');

      const stats = service.getStats();
      expect(stats).toHaveProperty('entityCount');
      expect(stats).toHaveProperty('relationCount');
      expect(stats).toHaveProperty('documentCount');
      expect(stats.entityCount).toBe(2);
      expect(stats.documentCount).toBe(1);
    });

    it('should return empty statistics for new service', () => {
      const stats = service.getStats();
      expect(stats.entityCount).toBe(0);
      expect(stats.relationCount).toBe(0);
      expect(stats.documentCount).toBe(0);
    });
  });

  // ============================================================
  // Lifecycle Tests
  // ============================================================

  describe('Lifecycle', () => {
    it('should shutdown gracefully', async () => {
      await service.initialize();
      await service.addEntity({ id: 'e1', name: 'Alice', type: 'Character' });

      await service.shutdown();
      const health = await service.healthCheck();
      expect(health).toBe(false);
    });
  });
});
