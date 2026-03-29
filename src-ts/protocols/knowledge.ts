/**
 * Knowledge Service Protocol
 *
 * Defines the core capabilities of the Knowledge Service layer, including
 * knowledge storage, retrieval, distillation, and graph-based knowledge management.
 */

import type { LLMService } from './llm';
import type { EmbeddingService } from './embedding';

/**
 * Knowledge entity representing a node in the knowledge graph
 */
export interface KnowledgeEntity {
  id: string;
  name: string;
  type: string;
  description?: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
}

/**
 * Knowledge relation representing an edge in the knowledge graph
 */
export interface KnowledgeRelation {
  id: string;
  sourceId: string;
  targetId: string;
  type: string;
  properties?: Record<string, unknown>;
  createdAt?: string;
}

/**
 * Search result from hybrid knowledge search
 */
export interface KnowledgeSearchResult {
  chunks: Array<{
    id: string;
    content: string;
    score: number;
    metadata?: Record<string, unknown>;
  }>;
  entities: KnowledgeEntity[];
}

/**
 * Document metadata
 */
export interface DocumentMetadata {
  sourceId?: string;
  sourceType: 'citation' | 'memory' | 'document';
  createdAt: number;
  updatedAt?: number;
}

/**
 * Knowledge Service Protocol Interface
 *
 * Provides unified knowledge management including:
 * - Vector-based semantic search
 * - Graph-based entity/relation storage
 * - Knowledge distillation from LLM
 * - Hybrid search capabilities
 */
export interface KnowledgeService {
  /**
   * Initialize the knowledge service
   */
  initialize(): Promise<void>;

  /**
   * Add a document to the knowledge base
   */
  addDocument(
    docId: string,
    content: string,
    metadata?: Partial<DocumentMetadata>
  ): Promise<void>;

  /**
   * Add an entity to the knowledge graph
   */
  addEntity(entity: KnowledgeEntity): Promise<void>;

  /**
   * Add a relation to the knowledge graph
   */
  addRelation(relation: KnowledgeRelation): Promise<void>;

  /**
   * Perform hybrid search (vector + graph)
   */
  search(
    query: string,
    options?: {
      topK?: number;
      entityFilter?: string[];
    }
  ): Promise<KnowledgeSearchResult>;

  /**
   * Get neighboring entities in the knowledge graph
   */
  getNeighbors(entityId: string): Promise<KnowledgeRelation[]>;

  /**
   * Distill knowledge from content using LLM
   */
  distillKnowledge(
    content: string,
    template: string,
    metadata?: Record<string, unknown>
  ): Promise<unknown>;

  /**
   * Sync a file to the knowledge base
   */
  syncFile(
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
  }>;

  /**
   * Health check
   */
  healthCheck(): Promise<boolean>;

  /**
   * Shutdown the service
   */
  shutdown(): Promise<void>;
}

/**
 * Knowledge Service Configuration
 */
export interface KnowledgeServiceConfig {
  dbPath: string;
  llmService?: LLMService;
  embeddingService?: EmbeddingService;
  enableDistillation?: boolean;
  embeddingModel?: string;
}
