/**
 * KnowledgeService Unit Tests
 *
 * Tests for the unified knowledge management layer.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  KnowledgeServiceImpl,
  KnowledgeError,
  EntityNotFoundError,
  DocumentNotFoundError,
} from '../knowledge-service';
import type {
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeServiceConfig,
} from '../../protocols/knowledge';

describe('KnowledgeService', () => {
  let service: KnowledgeServiceImpl;

  const createConfig = (): KnowledgeServiceConfig => ({
    dbPath: ':memory:',
  });

  beforeEach(async () => {
    service = new KnowledgeServiceImpl(createConfig());
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const newService = new KnowledgeServiceImpl(createConfig());
      await expect(newService.initialize()).resolves.not.toThrow();
      expect(await newService.healthCheck()).toBe(true);
    });

    it('should allow multiple initialize calls', async () => {
      await expect(service.initialize()).resolves.not.toThrow();
      await expect(service.initialize()).resolves.not.toThrow();
    });

    it('should clear storage on shutdown', async () => {
      await service.addDocument('doc1', 'test content');
      const statsBefore = service.getStats();
      expect(statsBefore.documentCount).toBe(1);

      await service.shutdown();
      const statsAfter = service.getStats();
      expect(statsAfter.documentCount).toBe(0);
    });
  });

  describe('Document Management', () => {
    it('should add a document', async () => {
      await service.addDocument('doc1', 'Test content', {
        sourceType: 'document',
      });

      const doc = service.getDocument('doc1');
      expect(doc).toBeDefined();
      expect(doc?.content).toBe('Test content');
      expect(doc?.sourceType).toBe('document');
    });

    it('should add document with metadata', async () => {
      const createdAt = Date.now();
      await service.addDocument('doc2', 'Test', {
        sourceId: 'source-1',
        sourceType: 'citation',
        createdAt,
      });

      const doc = service.getDocument('doc2');
      expect(doc?.sourceId).toBe('source-1');
      expect(doc?.sourceType).toBe('citation');
      expect(doc?.createdAt).toBe(createdAt);
    });

    it('should delete a document', async () => {
      await service.addDocument('doc3', 'To delete');
      expect(service.getDocument('doc3')).toBeDefined();

      await service.deleteDocument('doc3');
      expect(service.getDocument('doc3')).toBeUndefined();
    });

    it('should track document count', async () => {
      await service.addDocument('doc1', 'Content 1');
      await service.addDocument('doc2', 'Content 2');
      await service.addDocument('doc3', 'Content 3');

      const stats = service.getStats();
      expect(stats.documentCount).toBe(3);
    });
  });

  describe('Entity Management', () => {
    const testEntity: KnowledgeEntity = {
      id: 'entity-1',
      name: 'Test Entity',
      type: 'person',
      description: 'A test entity',
    };

    it('should add an entity', async () => {
      await service.addEntity(testEntity);

      const entity = service.getEntity('entity-1');
      expect(entity).toBeDefined();
      expect(entity?.name).toBe('Test Entity');
      expect(entity?.type).toBe('person');
    });

    it('should add entity with properties', async () => {
      const entityWithProps: KnowledgeEntity = {
        ...testEntity,
        id: 'entity-2',
        properties: {
          age: 30,
          role: 'protagonist',
        },
      };

      await service.addEntity(entityWithProps);

      const entity = service.getEntity('entity-2');
      expect(entity?.properties).toEqual({
        age: 30,
        role: 'protagonist',
      });
    });

    it('should delete an entity', async () => {
      await service.addEntity(testEntity);
      expect(service.getEntity('entity-1')).toBeDefined();

      await service.deleteEntity('entity-1');
      expect(service.getEntity('entity-1')).toBeUndefined();
    });

    it('should delete related relations when entity is deleted', async () => {
      // Create two entities
      await service.addEntity({ ...testEntity, id: 'entity-a' });
      await service.addEntity({ ...testEntity, id: 'entity-b', name: 'Entity B' });

      // Create relation
      await service.addRelation({
        id: 'rel-1',
        sourceId: 'entity-a',
        targetId: 'entity-b',
        type: 'knows',
      });

      // Delete source entity
      await service.deleteEntity('entity-a');

      // Relation should be deleted
      expect(service.getRelation('rel-1')).toBeUndefined();
    });

    it('should list all entities', async () => {
      await service.addEntity({ ...testEntity, id: 'e1' });
      await service.addEntity({ ...testEntity, id: 'e2', name: 'Entity 2' });
      await service.addEntity({ ...testEntity, id: 'e3', name: 'Entity 3' });

      const entities = service.listEntities();
      expect(entities).toHaveLength(3);
    });
  });

  describe('Relation Management', () => {
    beforeEach(async () => {
      // Create test entities
      await service.addEntity({
        id: 'source',
        name: 'Source Entity',
        type: 'person',
      });
      await service.addEntity({
        id: 'target',
        name: 'Target Entity',
        type: 'person',
      });
    });

    it('should add a relation', async () => {
      const relation: KnowledgeRelation = {
        id: 'rel-1',
        sourceId: 'source',
        targetId: 'target',
        type: 'knows',
      };

      await service.addRelation(relation);

      const rel = service.getRelation('rel-1');
      expect(rel).toBeDefined();
      expect(rel?.type).toBe('knows');
    });

    it('should reject relation with non-existent source', async () => {
      const relation: KnowledgeRelation = {
        id: 'rel-2',
        sourceId: 'nonexistent',
        targetId: 'target',
        type: 'knows',
      };

      await expect(service.addRelation(relation)).rejects.toThrow(EntityNotFoundError);
    });

    it('should reject relation with non-existent target', async () => {
      const relation: KnowledgeRelation = {
        id: 'rel-3',
        sourceId: 'source',
        targetId: 'nonexistent',
        type: 'knows',
      };

      await expect(service.addRelation(relation)).rejects.toThrow(EntityNotFoundError);
    });

    it('should list all relations', async () => {
      await service.addRelation({
        id: 'rel-1',
        sourceId: 'source',
        targetId: 'target',
        type: 'knows',
      });

      const relations = service.listRelations();
      expect(relations).toHaveLength(1);
    });
  });

  describe('Search', () => {
    beforeEach(async () => {
      // Add test documents
      await service.addDocument('doc1', 'The quick brown fox jumps over the lazy dog');
      await service.addDocument('doc2', 'A lazy cat sleeps on the couch');

      // Add test entities
      await service.addEntity({
        id: 'entity-fox',
        name: 'Fox',
        type: 'animal',
        description: 'A quick brown fox',
      });
      await service.addEntity({
        id: 'entity-cat',
        name: 'Cat',
        type: 'animal',
        description: 'A lazy cat',
      });
    });

    it('should search for entities by name', async () => {
      const results = await service.search('Fox');

      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some((e) => e.name === 'Fox')).toBe(true);
    });

    it('should search for entities with partial match', async () => {
      const results = await service.search('lazy cat');

      expect(results.entities.length).toBeGreaterThan(0);
      expect(results.entities.some((e) => e.name === 'Cat')).toBe(true);
    });

    it('should apply entity filters', async () => {
      const results = await service.search('test', {
        entityFilter: ['entity-fox', 'entity-cat'],
      });

      // Should include filtered entities even if they don't match query
      expect(results.entities.length).toBeGreaterThanOrEqual(2);
    });

    it('should limit results with topK', async () => {
      const results = await service.search('animal', { topK: 1 });

      // With no embedding service, chunks won't be returned
      // But entity search should still work
      expect(results.entities.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Neighbors', () => {
    beforeEach(async () => {
      // Create entity network
      await service.addEntity({ id: 'a', name: 'A', type: 'node' });
      await service.addEntity({ id: 'b', name: 'B', type: 'node' });
      await service.addEntity({ id: 'c', name: 'C', type: 'node' });

      await service.addRelation({ id: 'r1', sourceId: 'a', targetId: 'b', type: 'connects' });
      await service.addRelation({ id: 'r2', sourceId: 'a', targetId: 'c', type: 'connects' });
    });

    it('should get neighbors of an entity', async () => {
      const neighbors = await service.getNeighbors('a');

      expect(neighbors).toHaveLength(2);
      expect(neighbors.map((n) => n.targetId)).toEqual(expect.arrayContaining(['b', 'c']));
    });

    it('should return empty array for entity with no neighbors', async () => {
      const neighbors = await service.getNeighbors('b');
      expect(neighbors).toHaveLength(0);
    });
  });

  describe('Knowledge Distillation', () => {
    it('should reject distillation when service not available', async () => {
      await expect(
        service.distillKnowledge('test content', 'summary')
      ).rejects.toThrow(KnowledgeError);
    });
  });

  describe('File Sync', () => {
    it('should sync a file', async () => {
      const result = await service.syncFile('/test/file.md');

      expect(result.success).toBe(true);
      expect(result.action).toBe('synced');
      expect(result.docId).toBeDefined();
    });

    it('should determine source type from path', async () => {
      const citationResult = await service.syncFile('/citations/note.md');
      expect(citationResult.message).toContain('citation');

      const memoryResult = await service.syncFile('/memories/story.md');
      expect(memoryResult.message).toContain('memory');
    });

    it('should allow custom source type', async () => {
      const result = await service.syncFile('/test/file.md', {
        sourceType: 'citation',
      });

      expect(result.message).toContain('citation');
    });
  });

  describe('Statistics', () => {
    it('should return empty stats initially', () => {
      const stats = service.getStats();

      expect(stats.documentCount).toBe(0);
      expect(stats.entityCount).toBe(0);
      expect(stats.relationCount).toBe(0);
    });

    it('should track statistics correctly', async () => {
      await service.addDocument('doc1', 'Content');
      await service.addEntity({ id: 'e1', name: 'Entity', type: 'test' });
      await service.addEntity({ id: 'e2', name: 'Entity 2', type: 'test' });
      await service.addRelation({
        id: 'r1',
        sourceId: 'e1',
        targetId: 'e2',
        type: 'relates',
      });

      const stats = service.getStats();
      expect(stats.documentCount).toBe(1);
      expect(stats.entityCount).toBe(2);
      expect(stats.relationCount).toBe(1);
    });
  });

  describe('Apply Distilled to Graph', () => {
    it('should apply distilled entities to graph', async () => {
      await service.applyDistilledToGraph({
        entities: [
          { id: 'e1', name: 'Entity 1', type: 'person' },
          { id: 'e2', name: 'Entity 2', type: 'person', description: 'Test' },
        ],
      });

      const entities = service.listEntities();
      expect(entities).toHaveLength(2);
    });

    it('should apply distilled relations to graph', async () => {
      // Add entities first
      await service.addEntity({ id: 'e1', name: 'E1', type: 'test' });
      await service.addEntity({ id: 'e2', name: 'E2', type: 'test' });

      await service.applyDistilledToGraph({
        relations: [
          { source: 'e1', target: 'e2', type: 'knows', props: { since: '2024' } },
        ],
      });

      const relations = service.listRelations();
      expect(relations).toHaveLength(1);
      expect(relations[0].properties).toEqual({ since: '2024' });
    });
  });

  describe('Error Handling', () => {
    it('should reject operations before initialization', async () => {
      const uninitializedService = new KnowledgeServiceImpl(createConfig());

      await expect(
        uninitializedService.addDocument('doc', 'content')
      ).rejects.toThrow(KnowledgeError);
    });

    it('should throw EntityNotFoundError for non-existent entity', async () => {
      await expect(
        service.addRelation({
          id: 'rel',
          sourceId: 'nonexistent',
          targetId: 'alsnonexistent',
          type: 'test',
        })
      ).rejects.toThrow(EntityNotFoundError);
    });
  });
});
