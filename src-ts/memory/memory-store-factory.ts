/**
 * Memory store factory — auto-selects best backend.
 *
 * Dual-backend pattern from maestro-flow:
 * - SQLite available → SqliteMemoryStore (WAL, indexed, FTS5)
 * - Fallback → FsMemoryStore (file-based, async)
 *
 * Usage:
 *   const store = await createMemoryStore({ basePath: '.writing/memories' });
 */

import type { IMemoryStore } from './imemory-store.js';
import { SqliteMemoryStore } from './sqlite-memory-store.js';

export interface MemoryStoreOptions {
  basePath: string;
  preferBackend?: 'sqlite' | 'fs';
}

/**
 * Create the best available memory store for the current environment.
 */
export async function createMemoryStore(options: MemoryStoreOptions): Promise<IMemoryStore> {
  const { basePath, preferBackend } = options;

  if (preferBackend !== 'fs') {
    try {
      const path = await import('node:path');
      const fs = await import('node:fs/promises');
      const dbPath = path.join(basePath, 'memories.db');

      // Ensure directory exists
      await fs.mkdir(basePath, { recursive: true });

      return new SqliteMemoryStore(dbPath);
    } catch {
      // better-sqlite3 not available, fall through to fs
    }
  }

  // Fallback: wrap existing MemoryManager as async store
  const { FsMemoryStore } = await import('./fs-memory-store.js');
  return new FsMemoryStore(basePath);
}
