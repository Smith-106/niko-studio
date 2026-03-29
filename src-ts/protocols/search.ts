/**
 * Search Interface Protocol
 * 
 * Defines the core capabilities of search services, including search,
 * index, and delete operations.
 */
export interface SearchInterface {
  /**
   * Execute search
   */
  search(
    query: string,
    options?: {
      topK?: number;
      typeFilter?: string;
      minScore?: number;
    }
  ): Promise<Record<string, unknown>[]>;

  /**
   * Index document
   */
  index(
    id: string,
    content: string,
    options?: {
      metadata?: Record<string, unknown>;
      type?: string;
    }
  ): Promise<void>;

  /**
   * Delete document
   */
  delete(id: string): Promise<boolean>;
}

/**
 * Memory Interface Protocol
 * Abstract layer for memory operations.
 */
export interface MemoryInterface {
  store(key: string, value: unknown): Promise<void>;
  retrieve(key: string): Promise<unknown>;
  search(query: string, limit?: number): Promise<unknown[]>;
  clear(): Promise<void>;
}

/**
 * Graph Interface Protocol
 * Abstract layer for graph operations.
 */
export interface GraphInterface {
  addNode(id: string, data: unknown): Promise<void>;
  addEdge(from: string, to: string, relationship: string): Promise<void>;
  getNode(id: string): Promise<unknown>;
  traverse(startId: string, depth?: number): Promise<unknown[]>;
}
