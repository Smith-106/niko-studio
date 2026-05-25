/**
 * Memory store interface — abstracts storage backend for memory operations.
 *
 * Dual-backend pattern learned from maestro-flow's DelegateBrokerApi:
 * - SqliteMemoryStore (preferred, WAL mode, indexed queries)
 * - FsMemoryStore (fallback, file-based, synchronous)
 *
 * Auto-selection: createMemoryStore() detects SQLite availability
 * and returns the best backend for the current environment.
 */

import type { MemoryEntry } from './memory-manager.js';

export interface MemorySearchQuery {
  query?: string;
  topics?: string[];
  entityId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface MemorySearchResult {
  memories: MemoryEntry[];
  total: number;
}

export interface IMemoryStore {
  /** Add a memory and return its ID. */
  add(entry: Omit<MemoryEntry, 'id'>): Promise<string>;

  /** Get a single memory by ID. */
  get(id: string): Promise<MemoryEntry | null>;

  /** Get multiple memories by ID. */
  getBatch(ids: string[]): Promise<MemoryEntry[]>;

  /** Search memories with filtering. */
  search(query: MemorySearchQuery): Promise<MemorySearchResult>;

  /** Update a memory by ID. */
  update(id: string, updates: Partial<MemoryEntry>): Promise<void>;

  /** Delete a memory by ID. */
  delete(id: string): Promise<void>;

  /** Rebuild the internal index from stored data. */
  rebuildIndex(): Promise<void>;

  /** Get total memory count. */
  count(): Promise<number>;

  /** Close the store and release resources. */
  close(): Promise<void>;
}
