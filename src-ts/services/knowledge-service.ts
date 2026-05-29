/**
 * KnowledgeService - Unified Knowledge Management Layer
 *
 * TypeScript implementation of KnowledgeService interface.
 * Migrated from src/services/knowledge_layer.py.
 *
 * Features:
 * - Vector-based semantic search via EmbeddingService
 * - Graph-based entity/relation storage
 * - Knowledge distillation integration with DistillationService
 * - Hybrid search capabilities (vector + graph)
 * - File synchronization and document indexing
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import type {
  KnowledgeService,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeSearchResult,
  DocumentMetadata,
  KnowledgeServiceConfig,
  KnowledgeGraphEngineAdapter,
  KnowledgeMemoryEngineAdapter,
} from '../protocols/knowledge';
import type { LLMService } from '../protocols/llm';
import type { EmbeddingService } from '../protocols/embedding';
import type { IEventBus } from '../container/types';
import { DistillationService, DistillationTemplate } from './distill-service';

import { createLogger } from "../logger/index.js";
const _log = createLogger("svc-knowledge");

/**
 * Knowledge error types
 */
export class KnowledgeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KnowledgeError';
  }
}

export class EntityNotFoundError extends KnowledgeError {
  constructor(entityId: string) {
    super(`Entity not found: ${entityId}`);
    this.name = 'EntityNotFoundError';
  }
}

export class DocumentNotFoundError extends KnowledgeError {
  constructor(docId: string) {
    super(`Document not found: ${docId}`);
    this.name = 'DocumentNotFoundError';
  }
}

/**
 * Document chunk stored in vector store
 */
interface DocumentChunk {
  id: string;
  sourceId?: string;
  sourceType: string;
  content: string;
  embedding?: number[];
  createdAt: number;
}

interface DurableKnowledgeSnapshot {
  documents: Array<{
    id: string;
    sourceId?: string;
    sourceType: string;
    content: string;
    embedding?: number[];
    createdAt: number;
  }>;
  entities: KnowledgeEntity[];
  relations: KnowledgeRelation[];
  sourceIndex: Array<[string, string]>;
}

const EMPTY_SNAPSHOT: DurableKnowledgeSnapshot = {
  documents: [],
  entities: [],
  relations: [],
  sourceIndex: [],
};

/**
 * KnowledgeService Implementation
 *
 * Implements KnowledgeService protocol with vector and graph capabilities.
 */
export class KnowledgeServiceImpl implements KnowledgeService {
  private readonly dbPath: string;
  private readonly llmService?: LLMService;
  private readonly embeddingService?: EmbeddingService;
  private readonly distillationService?: DistillationService;
  private readonly enableDistillation: boolean;
  private readonly embeddingModel?: string;
  private readonly memoryEngine?: KnowledgeMemoryEngineAdapter;
  private readonly graphEngine?: KnowledgeGraphEngineAdapter;
  private readonly snapshotPath: string;
  private readonly eventBus?: IEventBus;

  private documentChunks: Map<string, DocumentChunk> = new Map();
  private entities: Map<string, KnowledgeEntity> = new Map();
  private relations: Map<string, KnowledgeRelation> = new Map();
  private entityFTSIndex: Map<string, Set<string>> = new Map();
  private sourceIndex: Map<string, string> = new Map();
  private initialized = false;

  constructor(config: KnowledgeServiceConfig) {
    this.dbPath = config.dbPath;
    this.llmService = config.llmService;
    this.embeddingService = config.embeddingService;
    this.distillationService = this.llmService
      ? new DistillationService(this.llmService)
      : undefined;
    this.enableDistillation = config.enableDistillation ?? false;
    this.embeddingModel = config.embeddingModel;
    this.memoryEngine = config.memoryEngine;
    this.graphEngine = config.graphEngine;
    this.snapshotPath = this.resolveSnapshotPath(config.dbPath);
    this.eventBus = config.eventBus;
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.memoryEngine?.initialize();
    await this.graphEngine?.initialize();

    const snapshot = this.loadSnapshot();
    this.documentChunks = new Map(
      snapshot.documents.map((document) => [document.id, { ...document }]),
    );
    this.entities = new Map(
      snapshot.entities.map((entity) => [entity.id, { ...entity }]),
    );
    this.relations = new Map(
      snapshot.relations.map((relation) => [relation.id, { ...relation }]),
    );
    this.sourceIndex = new Map(snapshot.sourceIndex);
    this.rebuildEntityFTSIndex();

    this.initialized = true;
  }

  async addDocument(
    docId: string,
    content: string,
    metadata?: Partial<DocumentMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    let embedding: number[] | undefined;
    if (this.embeddingService) {
      try {
        embedding = await this.embeddingService.embed(content, {
          model: this.embeddingModel,
        });
      } catch (error) {
        _log.error('Failed to generate embedding', { error });
      }
    }

    const chunk: DocumentChunk = {
      id: docId,
      sourceId: metadata?.sourceId,
      sourceType: metadata?.sourceType ?? 'document',
      content,
      embedding,
      createdAt: metadata?.createdAt ?? Date.now(),
    };

    this.documentChunks.set(docId, chunk);
    if (metadata?.sourceId) {
      this.sourceIndex.set(docId, metadata.sourceId);
    }

    await this.persistDocument(docId, chunk);
    await this.persistSnapshot();

    this.eventBus?.publish('knowledge:document-added', {
      id: docId,
      sourceId: metadata?.sourceId,
      sourceType: metadata?.sourceType ?? 'document',
    });
  }

  async addEntity(entity: KnowledgeEntity): Promise<void> {
    this.ensureInitialized();

    const isUpdate = this.entities.has(entity.id);

    const entityWithTimestamp: KnowledgeEntity = {
      ...entity,
      createdAt: entity.createdAt ?? new Date().toISOString(),
    };

    this.entities.set(entity.id, entityWithTimestamp);
    this.rebuildEntityFTSIndex();

    await this.persistEntity(entityWithTimestamp);
    await this.persistSnapshot();

    this.eventBus?.publish(
      isUpdate ? 'knowledge:entity-updated' : 'knowledge:entity-created',
      { id: entity.id, label: entity.name, type: entity.type },
    );
  }

  async addRelation(relation: KnowledgeRelation): Promise<void> {
    this.ensureInitialized();

    if (!this.entities.has(relation.sourceId)) {
      throw new EntityNotFoundError(relation.sourceId);
    }
    if (!this.entities.has(relation.targetId)) {
      throw new EntityNotFoundError(relation.targetId);
    }

    const relationWithTimestamp: KnowledgeRelation = {
      ...relation,
      createdAt: relation.createdAt ?? new Date().toISOString(),
    };

    this.relations.set(relation.id, relationWithTimestamp);

    await this.persistRelation(relationWithTimestamp);
    await this.persistSnapshot();
  }

  async search(
    query: string,
    options?: {
      topK?: number;
      entityFilter?: string[];
    }
  ): Promise<KnowledgeSearchResult> {
    this.ensureInitialized();

    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return {
        chunks: [],
        entities: [],
      };
    }

    const topK = options?.topK ?? 5;
    const result: KnowledgeSearchResult = {
      chunks: [],
      entities: [],
    };

    if (this.embeddingService) {
      try {
        const queryEmbedding = await this.embeddingService.embed(normalizedQuery, {
          model: this.embeddingModel,
        });

        const scored = Array.from(this.documentChunks.values())
          .filter((chunk) => chunk.embedding)
          .map((chunk) => ({
            chunk,
            score: this.embeddingService!.similarity(queryEmbedding, chunk.embedding!),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, topK);

        result.chunks = scored.map(({ chunk, score }) => ({
          id: chunk.id,
          content: chunk.content,
          score,
          metadata: {
            sourceId: chunk.sourceId,
            sourceType: chunk.sourceType,
            createdAt: chunk.createdAt,
          },
        }));
      } catch (error) {
        _log.error('Vector search failed', { error });
      }
    }

    const queryTokens = this.tokenize(normalizedQuery);
    const candidateIds = new Set<string>();

    for (const token of queryTokens) {
      const ids = this.entityFTSIndex.get(token);
      if (ids) {
        ids.forEach((id) => candidateIds.add(id));
      }
    }

    const queryLower = normalizedQuery.toLowerCase();
    for (const entityId of candidateIds) {
      const entity = this.entities.get(entityId);
      if (!entity) {
        continue;
      }

      const nameTokens = this.tokenize(entity.name);
      const hasMatch = queryTokens.some((qt) => nameTokens.includes(qt))
        || nameTokens.some((nt) => queryLower.includes(nt))
        || entity.name.toLowerCase().includes(queryLower);

      if (hasMatch) {
        result.entities.push(entity);
      }
    }

    if (options?.entityFilter) {
      for (const filterId of options.entityFilter) {
        if (!result.entities.some((entity) => entity.id === filterId)) {
          const entity = this.entities.get(filterId);
          if (entity) {
            result.entities.push(entity);
          }
        }
      }
    }

    return result;
  }

  async getNeighbors(entityId: string): Promise<KnowledgeRelation[]> {
    this.ensureInitialized();

    const neighbors: KnowledgeRelation[] = [];
    for (const relation of this.relations.values()) {
      if (relation.sourceId === entityId) {
        neighbors.push(relation);
      }
    }

    return neighbors;
  }

  async distillKnowledge(
    content: string,
    template: string,
    metadata?: Record<string, unknown>
  ): Promise<unknown> {
    this.ensureInitialized();

    if (!this.distillationService) {
      throw new KnowledgeError('Distillation service not available');
    }

    const templateEnum =
      Object.values(DistillationTemplate).find((t) => t === template) ??
      DistillationTemplate.SUMMARY;

    return this.distillationService.distill(
      [content],
      templateEnum,
      [],
      metadata
    );
  }

  async syncFile(
    filePath: string,
    options?: {
      force?: boolean;
      sourceType?: 'citation' | 'memory' | 'document';
    }
  ): Promise<{
    success: boolean;
    action: string;
    message: string;
    docId?: string;
    contentHash?: string;
  }> {
    this.ensureInitialized();

    const resolvedPath = resolve(filePath);
    if (!existsSync(resolvedPath)) {
      return {
        success: false,
        action: 'error',
        message: 'File not found',
      };
    }

    try {
      const content = readFileSync(resolvedPath, 'utf-8');
      const contentHash = createHash('sha256').update(content, 'utf-8').digest('hex');
      const docId = this.hashPath(resolvedPath);
      const sourceType = options?.sourceType ?? this.determineSourceType(resolvedPath);

      const existing = this.documentChunks.get(docId);
      if (
        !options?.force &&
        existing &&
        existing.content === content &&
        existing.sourceType === sourceType
      ) {
        return {
          success: true,
          action: 'skipped',
          message: `File unchanged (${sourceType})`,
          docId,
          contentHash,
        };
      }

      await this.addDocument(docId, content, {
        sourceId: resolvedPath,
        sourceType,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      });

      return {
        success: true,
        action: 'synced',
        message: `Synced as ${sourceType}`,
        docId,
        contentHash,
      };
    } catch (error) {
      return {
        success: false,
        action: 'error',
        message: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
    this.documentChunks.clear();
    this.entities.clear();
    this.relations.clear();
    this.entityFTSIndex.clear();
  }

  async addToLibrary(paths: string[]): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    return this.memoryEngine?.addToLibrary?.(paths) ?? [];
  }

  async searchLibrary(query: string, options?: { limit?: number }): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    return this.memoryEngine?.searchLibrary?.(query, options) ?? [];
  }

  getEntity(entityId: string): KnowledgeEntity | undefined {
    return this.entities.get(entityId);
  }

  getRelation(relationId: string): KnowledgeRelation | undefined {
    return this.relations.get(relationId);
  }

  getDocument(docId: string): DocumentChunk | undefined {
    return this.documentChunks.get(docId);
  }

  listEntities(): KnowledgeEntity[] {
    return Array.from(this.entities.values());
  }

  listRelations(): KnowledgeRelation[] {
    return Array.from(this.relations.values());
  }

  async deleteEntity(entityId: string): Promise<void> {
    const entity = this.entities.get(entityId);
    if (!entity) {
      return;
    }

    for (const token of this.tokenize(entity.name)) {
      this.entityFTSIndex.get(token)?.delete(entityId);
    }

    this.entities.delete(entityId);

    for (const [relationId, relation] of this.relations.entries()) {
      if (relation.sourceId === entityId || relation.targetId === entityId) {
        this.relations.delete(relationId);
      }
    }

    await this.persistSnapshot();

    this.eventBus?.publish('knowledge:entity-deleted', { id: entityId });
  }

  async deleteDocument(docId: string): Promise<void> {
    this.documentChunks.delete(docId);
    await this.persistSnapshot();
  }

  getStats(): {
    documentCount: number;
    entityCount: number;
    relationCount: number;
  } {
    return {
      documentCount: this.documentChunks.size,
      entityCount: this.entities.size,
      relationCount: this.relations.size,
    };
  }

  async applyDistilledToGraph(distilledData: {
    entities?: Array<{
      id: string;
      name: string;
      type: string;
      description?: string;
    }>;
    relations?: Array<{
      source: string;
      target: string;
      type: string;
      props?: Record<string, unknown>;
    }>;
  }): Promise<void> {
    for (const ent of distilledData.entities || []) {
      await this.addEntity({
        id: ent.id,
        name: ent.name,
        type: ent.type,
        description: ent.description,
      });
    }

    for (const rel of distilledData.relations || []) {
      const relationId = `${rel.source}-${rel.type}-${rel.target}`;
      await this.addRelation({
        id: relationId,
        sourceId: rel.source,
        targetId: rel.target,
        type: rel.type,
        properties: rel.props,
      });
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new KnowledgeError('Knowledge service not initialized');
    }
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  private rebuildEntityFTSIndex(): void {
    this.entityFTSIndex = new Map();
    for (const entity of this.entities.values()) {
      for (const token of this.tokenize(entity.name)) {
        if (!this.entityFTSIndex.has(token)) {
          this.entityFTSIndex.set(token, new Set());
        }
        this.entityFTSIndex.get(token)!.add(entity.id);
      }
    }
  }

  private async persistDocument(docId: string, chunk: DocumentChunk): Promise<void> {
    if (this.memoryEngine?.add) {
      await this.memoryEngine.add({
        content: chunk.content,
        layer: 'knowledge-document',
        dimension: chunk.sourceType,
        entityId: docId,
        source: chunk.sourceId ?? chunk.sourceType,
      });
      return;
    }

    if (this.memoryEngine?.store) {
      await this.memoryEngine.store(`knowledge-document:${docId}`, {
        ...chunk,
      });
    }
  }

  private async persistEntity(entity: KnowledgeEntity): Promise<void> {
    const properties = {
      ...(entity.properties ?? {}),
      id: entity.id,
      description: entity.description ?? null,
      createdAt: entity.createdAt ?? null,
    };

    if (this.graphEngine?.createEntity) {
      await this.graphEngine.createEntity(
        this.normalizeGraphEntityType(entity.type),
        entity.name,
        properties,
      );
      return;
    }

    if (this.graphEngine?.addNode) {
      await this.graphEngine.addNode(entity.id, entity);
    }
  }

  private async persistRelation(relation: KnowledgeRelation): Promise<void> {
    const sourceEntity = this.entities.get(relation.sourceId);
    const targetEntity = this.entities.get(relation.targetId);
    if (!sourceEntity || !targetEntity) {
      return;
    }

    const properties = {
      ...(relation.properties ?? {}),
      id: relation.id,
      createdAt: relation.createdAt ?? null,
    };

    if (this.graphEngine?.createRelation) {
      await this.graphEngine.createRelation(
        sourceEntity.name,
        targetEntity.name,
        relation.type,
        properties,
      );
      return;
    }

    if (this.graphEngine?.addEdge) {
      await this.graphEngine.addEdge(relation.sourceId, relation.targetId, relation.type);
    }
  }

  private normalizeGraphEntityType(type: string): string {
    const normalized = type.trim();
    const candidate = normalized.length > 0
      ? normalized[0].toUpperCase() + normalized.slice(1)
      : 'Item';
    const allowed = new Set(['Character', 'Location', 'Event', 'Item', 'Foreshadow', 'Chapter', 'Scene']);
    return allowed.has(candidate) ? candidate : 'Item';
  }

  private resolveSnapshotPath(dbPath: string): string {
    if (dbPath === ':memory:') {
      return ':memory:';
    }
    if (/\.json$/i.test(dbPath)) {
      return dbPath;
    }
    return `${dbPath}.json`;
  }

  private loadSnapshot(): DurableKnowledgeSnapshot {
    if (this.snapshotPath === ':memory:' || !existsSync(this.snapshotPath)) {
      return EMPTY_SNAPSHOT;
    }

    try {
      const raw = readFileSync(this.snapshotPath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<DurableKnowledgeSnapshot>;
      return {
        documents: Array.isArray(parsed.documents)
          ? parsed.documents.filter((value): value is DurableKnowledgeSnapshot['documents'][number] => typeof value === 'object' && value !== null)
          : [],
        entities: Array.isArray(parsed.entities)
          ? parsed.entities.filter((value): value is KnowledgeEntity => typeof value === 'object' && value !== null)
          : [],
        relations: Array.isArray(parsed.relations)
          ? parsed.relations.filter((value): value is KnowledgeRelation => typeof value === 'object' && value !== null)
          : [],
        sourceIndex: Array.isArray(parsed.sourceIndex)
          ? parsed.sourceIndex.filter((entry): entry is [string, string] => Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'string' && typeof entry[1] === 'string')
          : [],
      };
    } catch (error) {
      _log.warn('Failed to load knowledge snapshot', { error });
      return EMPTY_SNAPSHOT;
    }
  }

  private async persistSnapshot(): Promise<void> {
    if (this.snapshotPath === ':memory:') {
      return;
    }

    mkdirSync(dirname(this.snapshotPath), { recursive: true });
    const snapshot: DurableKnowledgeSnapshot = {
      documents: Array.from(this.documentChunks.values()).map((chunk) => ({ ...chunk })),
      entities: this.listEntities().map((entity) => ({ ...entity })),
      relations: this.listRelations().map((relation) => ({ ...relation })),
      sourceIndex: Array.from(this.sourceIndex.entries()),
    };
    writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
  }

  private hashPath(filePath: string): string {
    return createHash('sha256').update(filePath, 'utf-8').digest('hex');
  }

  private determineSourceType(filePath: string): 'citation' | 'memory' | 'document' {
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');

    if (normalizedPath.includes('citation')) {
      return 'citation';
    }
    if (normalizedPath.includes('memor')) {
      return 'memory';
    }
    return 'document';
  }
}
