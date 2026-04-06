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
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  KnowledgeService,
  KnowledgeEntity,
  KnowledgeRelation,
  KnowledgeSearchResult,
  DocumentMetadata,
  KnowledgeServiceConfig,
} from '../protocols/knowledge';
import type { LLMService } from '../protocols/llm';
import type { EmbeddingService } from '../protocols/embedding';
import { DistillationService, DistillationTemplate } from './distill-service';

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

  // In-memory storage for TypeScript implementation
  // (Would use SQLite in production)
  private documentChunks: Map<string, DocumentChunk> = new Map();
  private entities: Map<string, KnowledgeEntity> = new Map();
  private relations: Map<string, KnowledgeRelation> = new Map();
  private entityFTSIndex: Map<string, Set<string>> = new Map(); // name -> entity ids
  private initialized: boolean = false;

  constructor(config: KnowledgeServiceConfig) {
    this.dbPath = config.dbPath;
    this.llmService = config.llmService;
    this.embeddingService = config.embeddingService;
    this.distillationService = this.llmService
      ? new DistillationService(this.llmService)
      : undefined;
    this.enableDistillation = config.enableDistillation ?? false;
    this.embeddingModel = config.embeddingModel;
  }

  // ============================================================
  // KnowledgeService Interface Implementation
  // ============================================================

  /**
   * Initialize the knowledge service
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize storage structures
    this.documentChunks = new Map();
    this.entities = new Map();
    this.relations = new Map();
    this.entityFTSIndex = new Map();

    this.initialized = true;
  }

  /**
   * Add a document to the knowledge base
   */
  async addDocument(
    docId: string,
    content: string,
    metadata?: Partial<DocumentMetadata>
  ): Promise<void> {
    this.ensureInitialized();

    // Generate embedding if service available
    let embedding: number[] | undefined;
    if (this.embeddingService) {
      try {
        embedding = await this.embeddingService.embed(content, {
          model: this.embeddingModel,
        });
      } catch (error) {
        console.error('Failed to generate embedding:', error);
        // Continue without embedding
      }
    }

    // Store document chunk
    const chunk: DocumentChunk = {
      id: docId,
      sourceId: metadata?.sourceId,
      sourceType: metadata?.sourceType ?? 'document',
      content,
      embedding,
      createdAt: metadata?.createdAt ?? Date.now(),
    };

    this.documentChunks.set(docId, chunk);
  }

  /**
   * Add an entity to the knowledge graph
   */
  async addEntity(entity: KnowledgeEntity): Promise<void> {
    this.ensureInitialized();

    // Store entity
    const entityWithTimestamp: KnowledgeEntity = {
      ...entity,
      createdAt: entity.createdAt ?? new Date().toISOString(),
    };

    this.entities.set(entity.id, entityWithTimestamp);

    // Update FTS index
    const nameTokens = this.tokenize(entity.name);
    for (const token of nameTokens) {
      if (!this.entityFTSIndex.has(token)) {
        this.entityFTSIndex.set(token, new Set());
      }
      this.entityFTSIndex.get(token)!.add(entity.id);
    }
  }

  /**
   * Add a relation to the knowledge graph
   */
  async addRelation(relation: KnowledgeRelation): Promise<void> {
    this.ensureInitialized();

    // Verify source and target entities exist
    if (!this.entities.has(relation.sourceId)) {
      throw new EntityNotFoundError(relation.sourceId);
    }
    if (!this.entities.has(relation.targetId)) {
      throw new EntityNotFoundError(relation.targetId);
    }

    // Store relation
    const relationWithTimestamp: KnowledgeRelation = {
      ...relation,
      createdAt: relation.createdAt ?? new Date().toISOString(),
    };

    this.relations.set(relation.id, relationWithTimestamp);
  }

  /**
   * Perform hybrid search (vector + graph)
   */
  async search(
    query: string,
    options?: {
      topK?: number;
      entityFilter?: string[];
    }
  ): Promise<KnowledgeSearchResult> {
    this.ensureInitialized();

    const topK = options?.topK ?? 5;
    const result: KnowledgeSearchResult = {
      chunks: [],
      entities: [],
    };

    // 1. Vector search (if embedding service available)
    if (this.embeddingService) {
      try {
        const queryEmbedding = await this.embeddingService.embed(query, {
          model: this.embeddingModel,
        });

        // Calculate similarity scores
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
        console.error('Vector search failed:', error);
        // Continue with text-based search
      }
    }

    // 2. Graph search with FTS optimization
    const queryTokens = this.tokenize(query);
    const candidateIds = new Set<string>();

    // Find entities by token matches
    for (const token of queryTokens) {
      const ids = this.entityFTSIndex.get(token);
      if (ids) {
        ids.forEach((id) => candidateIds.add(id));
      }
    }

    // Verify matches - entity name must match at least one query token
    const queryLower = query.toLowerCase();
    for (const entityId of candidateIds) {
      const entity = this.entities.get(entityId);
      if (entity) {
        // Check if entity name contains any query token or vice versa
        const nameTokens = this.tokenize(entity.name);
        const hasMatch = queryTokens.some((qt) => nameTokens.includes(qt)) ||
                         nameTokens.some((nt) => queryLower.includes(nt)) ||
                         entity.name.toLowerCase().includes(queryLower);
        
        if (hasMatch) {
          result.entities.push(entity);
        }
      }
    }

    // 3. Apply entity filters if provided
    if (options?.entityFilter) {
      for (const filterId of options.entityFilter) {
        if (!result.entities.some((e) => e.id === filterId)) {
          const entity = this.entities.get(filterId);
          if (entity) {
            result.entities.push(entity);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get neighboring entities in the knowledge graph
   */
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

  /**
   * Distill knowledge from content using LLM
   */
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

    const result = await this.distillationService.distill(
      [content],
      templateEnum,
      [],
      metadata
    );

    return result;
  }

  /**
   * Sync a file to the knowledge base
   */
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
      const sourceType =
        options?.sourceType ?? this.determineSourceType(resolvedPath);

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

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.initialized;
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    this.initialized = false;
    this.documentChunks.clear();
    this.entities.clear();
    this.relations.clear();
    this.entityFTSIndex.clear();
  }

  // ============================================================
  // Additional Helper Methods
  // ============================================================

  /**
   * Get entity by ID
   */
  getEntity(entityId: string): KnowledgeEntity | undefined {
    return this.entities.get(entityId);
  }

  /**
   * Get relation by ID
   */
  getRelation(relationId: string): KnowledgeRelation | undefined {
    return this.relations.get(relationId);
  }

  /**
   * Get document by ID
   */
  getDocument(docId: string): DocumentChunk | undefined {
    return this.documentChunks.get(docId);
  }

  /**
   * List all entities
   */
  listEntities(): KnowledgeEntity[] {
    return Array.from(this.entities.values());
  }

  /**
   * List all relations
   */
  listRelations(): KnowledgeRelation[] {
    return Array.from(this.relations.values());
  }

  /**
   * Delete entity by ID
   */
  async deleteEntity(entityId: string): Promise<void> {
    const entity = this.entities.get(entityId);
    if (entity) {
      // Remove from FTS index
      const nameTokens = this.tokenize(entity.name);
      for (const token of nameTokens) {
        this.entityFTSIndex.get(token)?.delete(entityId);
      }

      // Remove entity
      this.entities.delete(entityId);

      // Remove related relations
      for (const [relationId, relation] of this.relations.entries()) {
        if (relation.sourceId === entityId || relation.targetId === entityId) {
          this.relations.delete(relationId);
        }
      }
    }
  }

  /**
   * Delete document by ID
   */
  async deleteDocument(docId: string): Promise<void> {
    this.documentChunks.delete(docId);
  }

  /**
   * Get statistics
   */
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

  // ============================================================
  // Private Helper Methods
  // ============================================================

  /**
   * Ensure service is initialized
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new KnowledgeError('Knowledge service not initialized');
    }
  }

  /**
   * Tokenize text for FTS indexing
   */
  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length > 0);
  }

  /**
   * Hash file path to generate doc ID
   */
  private hashPath(filePath: string): string {
    // Simple hash function for demo
    // In production, would use crypto.subtle.digest or similar
    let hash = 0;
    for (let i = 0; i < filePath.length; i++) {
      const char = filePath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16).padStart(16, '0');
  }

  /**
   * Determine source type from file path
   */
  private determineSourceType(filePath: string): 'citation' | 'memory' | 'document' {
    const normalizedPath = filePath.toLowerCase().replace(/\\/g, '/');
    
    if (normalizedPath.includes('citation')) {
      return 'citation';
    } else if (normalizedPath.includes('memor')) {
      return 'memory';
    }
    return 'document';
  }

  /**
   * Apply distilled knowledge to knowledge graph
   * (Legacy compatibility method)
   */
  applyDistilledToGraph(distilledData: {
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
  }): void {
    // Apply entities
    for (const ent of distilledData.entities || []) {
      this.addEntity({
        id: ent.id,
        name: ent.name,
        type: ent.type,
        description: ent.description,
      });
    }

    // Apply relations
    for (const rel of distilledData.relations || []) {
      const relationId = `${rel.source}-${rel.type}-${rel.target}`;
      this.addRelation({
        id: relationId,
        sourceId: rel.source,
        targetId: rel.target,
        type: rel.type,
        properties: rel.props,
      });
    }
  }
}
