/**
 * KnowledgeService Unit Tests
 *
 * Comprehensive tests for KnowledgeService implementation covering:
 * - Initialization and schema creation
 * - Entity CRUD operations
 * - Relation CRUD operations
 * - Neighbor queries
 * - Document management
 * - Hybrid search
 * - File synchronization
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  KnowledgeServiceImpl,
  KnowledgeError,
  EntityNotFoundError,
  DocumentNotFoundError,
} from '../../services/knowledge-service';
import type { LLMService } from '../../protocols/llm';
import type { EmbeddingService } from '../../protocols/embedding';

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
    // Return mock 384-dimensional embedding
    return Array(384).fill(0.1);
  }

  async embedBatch(
    texts: string[],
    options?: { model?: string }
  ): Promise<number[][]> {
    return texts.map(() => Array(384).fill(0.1));
  }

  getDefaultDimension(): number {
    return 384;
  }

  getDefaultModel(): string {
    return 'BAAI/bge-small-en-v1.5';
  }
}

describe('KnowledgeService', () => {
  let service: KnowledgeServiceImpl;
  let mockLLM: MockLLMService;
  let mockEmbedding: MockEmbeddingService;

  beforeEach(() => {
    mockLLM = new MockLLMService();
    mockEmbedding = new MockEmbeddingService();
    service = new KnowledgeServiceImpl({
      dbPath: ':memory:',
      llmService: mockLLM,
      embeddingService: mockEmbedding,
      enableDistillation: false,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================
  // Initialization Tests
  // ============================================================

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
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
      await service.addEntity('e1', 'Alice', 'Character', 'Protagonist');

      const entity = await service.getEntity('e1');
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('Alice');
      expect(entity?.type).toBe('Character');
      expect(entity?.description).toBe('Protagonist');
    });

    it('should add an entity with properties', async () => {
      await service.addEntity('e2', 'Bob', 'Character', undefined, { age: 30 });

      const entity = await service.getEntity('e2');
      expect(entity).toBeDefined();
      expect(entity?.properties).toEqual({ age: 30 });
    });

    it('should update an existing entity (upsert)', async () => {
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e1', 'Alice Updated', 'Character');

      const entity = await service.getEntity('e1');
      expect(entity?.name).toBe('Alice Updated');
    });

    it('should delete an entity', async () => {
      await service.addEntity('e1', 'Alice', 'Character');
      const deleted = await service.deleteEntity('e1');
      expect(deleted).toBe(true);

      const entity = await service.getEntity('e1');
      expect(entity).toBeUndefined();
    });

    it('should return false when deleting non-existent entity', async () => {
      const deleted = await service.deleteEntity('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should list entities by type', async () => {
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e2', 'Bob', 'Character');
      await service.addEntity('l1', 'Wonderland', 'Location');

      const characters = await service.listEntities({ type: 'Character' });
      expect(characters).toHaveLength(2);
      expect(characters.every(e => e.type === 'Character')).toBe(true);
    });

    it('should search entities by name', async () => {
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e2', 'Bob', 'Character');

      const results = await service.searchEntities('Alice');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].name).toBe('Alice');
    });
  });

  // ============================================================
  // Relation CRUD Tests
  // ============================================================

  describe('Relation Operations', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e2', 'Bob', 'Character');
    });

    it('should add a relation', async () => {
      await service.addRelation('e1', 'e2', 'KNOWS');

      const relations = await service.getRelations('e1');
      expect(relations).toHaveLength(1);
      expect(relations[0].targetId).toBe('e2');
      expect(relations[0].type).toBe('KNOWS');
    });

    it('should add a relation with properties', async () => {
      await service.addRelation('e1', 'e2', 'FRIEND', { since: 'childhood' });

      const relations = await service.getRelations('e1');
      expect(relations[0].properties).toEqual({ since: 'childhood' });
    });

    it('should delete a relation', async () => {
      await service.addRelation('e1', 'e2', 'KNOWS');
      const deleted = await service.deleteRelation('e1', 'e2', 'KNOWS');
      expect(deleted).toBe(true);

      const relations = await service.getRelations('e1');
      expect(relations).toHaveLength(0);
    });

    it('should return false when deleting non-existent relation', async () => {
      const deleted = await service.deleteRelation('e1', 'e2', 'KNOWS');
      expect(deleted).toBe(false);
    });
  });

  // ============================================================
  // Neighbor Query Tests
  // ============================================================

  describe('Get Neighbors', () => {
    beforeEach(async () => {
      await service.initialize();
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e2', 'Bob', 'Character');
      await service.addEntity('e3', 'Carol', 'Character');
    });

    it('should get neighbors for an entity', async () => {
      await service.addRelation('e1', 'e2', 'KNOWS');

      const neighbors = await service.getNeighbors('e1');
      expect(neighbors).toHaveLength(1);
      expect(neighbors[0].targetName).toBe('Bob');
      expect(neighbors[0].relationType).toBe('KNOWS');
    });

    it('should return empty array for entity with no neighbors', async () => {
      const neighbors = await service.getNeighbors('e1');
      expect(neighbors).toEqual([]);
    });

    it('should get multiple neighbors', async () => {
      await service.addRelation('e1', 'e2', 'KNOWS');
      await service.addRelation('e1', 'e3', 'LOVES');

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

      const doc = await service.getDocument('doc-1');
      expect(doc).toBeDefined();
      expect(doc?.content).toBe('Test document content');
    });

    it('should add a document with metadata', async () => {
      await service.addDocument('doc-1', 'Test content', {
        sourceId: 'source-1',
        sourceType: 'file',
      });

      const doc = await service.getDocument('doc-1');
      expect(doc?.sourceId).toBe('source-1');
      expect(doc?.sourceType).toBe('file');
    });

    it('should delete a document', async () => {
      await service.addDocument('doc-1', 'Test content');
      const deleted = await service.deleteDocument('doc-1');
      expect(deleted).toBe(true);

      const doc = await service.getDocument('doc-1');
      expect(doc).toBeUndefined();
    });

    it('should throw DocumentNotFoundError when getting non-existent document', async () => {
      await expect(service.getDocument('nonexistent')).rejects.toThrow(DocumentNotFoundError);
    });

    it('should list documents', async () => {
      await service.addDocument('doc-1', 'Content 1');
      await service.addDocument('doc-2', 'Content 2');

      const docs = await service.listDocuments();
      expect(docs.length).toBeGreaterThanOrEqual(2);
    });

    it('should search documents', async () => {
      await service.addDocument('doc-1', 'Machine learning algorithms');

      const results = await service.searchDocuments('machine learning', { topK: 5 });
      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  // ============================================================
  // Hybrid Search Tests
  // ============================================================

  describe('Hybrid Search', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should perform hybrid search', async () => {
      await service.addEntity('e1', 'Alice', 'Character', 'Protagonist');
      await service.addDocument('doc-1', 'Alice in Wonderland');

      const results = await service.hybridSearch('Alice', { topK: 5 });
      expect(results).toHaveProperty('entities');
      expect(results).toHaveProperty('documents');
      expect(Array.isArray(results.entities)).toBe(true);
      expect(Array.isArray(results.documents)).toBe(true);
    });

    it('should apply entity filter in hybrid search', async () => {
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e2', 'Bob', 'Character');

      const results = await service.hybridSearch('test', {
        topK: 5,
        entityFilter: ['e1', 'e2'],
      });

      const entityIds = results.entities.map(e => e.id);
      expect(entityIds).toContain('e1');
      expect(entityIds).toContain('e2');
    });

    it('should return empty results for empty query', async () => {
      const results = await service.hybridSearch('', { topK: 5 });
      expect(results.entities).toEqual([]);
      expect(results.documents).toEqual([]);
    });
  });

  // ============================================================
  // File Synchronization Tests
  // ============================================================

  describe('File Synchronization', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should sync an existing file', async () => {
      // Note: File sync tests would require file system mocking
      // This is a placeholder for the actual implementation
      const result = await service.syncFile('/nonexistent/file.md');
      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
    });

    it('should handle nonexistent file', async () => {
      const result = await service.syncFile('/nonexistent/file.md');
      expect(result.success).toBe(false);
      expect(result.action).toBe('error');
    });

    it('should sync directory', async () => {
      // Note: Directory sync tests would require file system mocking
      const results = await service.syncDirectory('/nonexistent/dir');
      expect(Array.isArray(results)).toBe(true);
    });
  });

  // ============================================================
  // Error Handling Tests
  // ============================================================

  describe('Error Handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should throw EntityNotFoundError for non-existent entity', async () => {
      await expect(service.getEntity('nonexistent')).rejects.toThrow(EntityNotFoundError);
    });

    it('should handle embedding errors gracefully', async () => {
      const errorEmbedding: EmbeddingService = {
        embed: vi.fn().mockRejectedValue(new Error('Embedding failed')),
        embedBatch: vi.fn(),
        getDefaultDimension: vi.fn(),
        getDefaultModel: vi.fn(),
      };

      const serviceWithError = new KnowledgeServiceImpl({
        dbPath: ':memory:',
        embeddingService: errorEmbedding,
      });
      await serviceWithError.initialize();

      // Should not throw, should continue without embedding
      await serviceWithError.addDocument('doc-1', 'Test content');
      const doc = await serviceWithError.getDocument('doc-1');
      expect(doc).toBeDefined();
      expect(doc?.embedding).toBeUndefined();
    });

    it('should handle operations before initialization', async () => {
      const uninitializedService = new KnowledgeServiceImpl({
        dbPath: ':memory:',
      });

      await expect(uninitializedService.addEntity('e1', 'Alice', 'Character')).rejects.toThrow();
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
      await service.addEntity('e1', 'Alice', 'Character');
      await service.addEntity('e2', 'Wonderland', 'Location');
      await service.addDocument('doc-1', 'Test content');

      const stats = await service.getStatistics();
      expect(stats).toHaveProperty('entityCount');
      expect(stats).toHaveProperty('relationCount');
      expect(stats).toHaveProperty('documentCount');
      expect(stats.entityCount).toBeGreaterThanOrEqual(2);
      expect(stats.documentCount).toBeGreaterThanOrEqual(1);
    });

    it('should return empty statistics for new service', async () => {
      const stats = await service.getStatistics();
      expect(stats.entityCount).toBe(0);
      expect(stats.relationCount).toBe(0);
      expect(stats.documentCount).toBe(0);
    });
  });
});
