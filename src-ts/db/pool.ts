/**
 * Database module - Async SQLite Connection Pool
 *
 * Uses better-sqlite3 (synchronous) with a worker-like pool pattern.
 */

import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

type DatabaseType = InstanceType<typeof BetterSqlite3>;

/**
 * Connection pool for better-sqlite3 databases.
 */
export class AsyncConnectionPool {
  private _dbPath: string;
  private _poolSize: number;
  private _pool: DatabaseType[] = [];
  private _initialized = false;

  constructor(dbPath: string, poolSize: number = 5) {
    this._dbPath = dbPath;
    this._poolSize = Math.min(Math.max(poolSize, 1), 10);
  }

  initialize(): void {
    if (this._initialized) return;

    const dir = dirname(this._dbPath);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    for (let i = 0; i < this._poolSize; i++) {
      const db = new BetterSqlite3(this._dbPath);
      db.pragma('journal_mode = WAL');
      db.pragma('synchronous = NORMAL');
      db.pragma('cache_size = -64000');
      this._pool.push(db);
    }

    this._initialized = true;
  }

  acquire(): DatabaseType {
    if (!this._initialized) this.initialize();
    if (this._pool.length > 0) return this._pool.pop()!;
    return new BetterSqlite3(this._dbPath);
  }

  release(db: DatabaseType): void {
    if (this._pool.length < this._poolSize) {
      this._pool.push(db);
    } else {
      try { db.close(); } catch { /* ignore */ }
    }
  }

  close(): void {
    for (const db of this._pool) {
      try { db.close(); } catch { /* ignore */ }
    }
    this._pool = [];
    this._initialized = false;
  }

  get isInitialized(): boolean { return this._initialized; }
  get availableConnections(): number { return this._pool.length; }
}

const _globalPools = new Map<string, AsyncConnectionPool>();

export function getPool(dbPath: string, poolSize: number = 5): AsyncConnectionPool {
  const resolvedPath = resolve(dbPath);
  if (!_globalPools.has(resolvedPath)) {
    const pool = new AsyncConnectionPool(resolvedPath, poolSize);
    pool.initialize();
    _globalPools.set(resolvedPath, pool);
  }
  return _globalPools.get(resolvedPath)!;
}

export function closeAllPools(): void {
  for (const pool of _globalPools.values()) pool.close();
  _globalPools.clear();
}
