/**
 * Database module - Async SQLite Connection Pool
 *
 * Uses better-sqlite3 (synchronous) with a worker-like pool pattern.
 * When pool is exhausted, requests are queued instead of creating
 * temporary connections that bypass pool management.
 */

import BetterSqlite3 from 'better-sqlite3';
import { existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';

type DatabaseType = InstanceType<typeof BetterSqlite3>;

/** 队列超时时间（毫秒） */
const QUEUE_TIMEOUT_MS = 30_000;

/**
 * 连接池信号量 — 控制并发获取，池耗尽时排队等待
 */
class PoolSemaphore {
  private _queue: Array<{
    resolve: (conn: DatabaseType) => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];
  private _available: number;

  constructor(max: number) {
    this._available = max;
  }

  /**
   * 获取一个连接。池有空闲时立即返回，否则排队等待。
   * 等待超过 QUEUE_TIMEOUT_MS 后拒绝 Promise。
   */
  acquire(pool: AsyncConnectionPool): Promise<DatabaseType> {
    return new Promise((resolve, reject) => {
      // 池中有空闲连接，直接获取
      if (this._available > 0 && pool['_pool'].length > 0) {
        this._available--;
        resolve(pool['_pool'].pop()!);
        return;
      }

      // 池耗尽，加入等待队列
      const timer = setTimeout(() => {
        const idx = this._queue.findIndex((item) => item.resolve === resolve);
        if (idx !== -1) this._queue.splice(idx, 1);
        reject(new Error('Pool acquire timeout: waited 30s for a connection'));
      }, QUEUE_TIMEOUT_MS);

      this._queue.push({ resolve, timer });
    });
  }

  /**
   * 释放连接。优先分给队列中等待的请求，否则归还可用计数。
   */
  release(conn: DatabaseType, pool: AsyncConnectionPool): void {
    if (this._queue.length > 0) {
      // 有等待中的请求，直接转交连接
      const waiter = this._queue.shift()!;
      clearTimeout(waiter.timer);
      waiter.resolve(conn);
      return;
    }

    // 无等待者，归还到池
    this._available++;
    if (pool['_pool'].length < pool['_poolSize']) {
      pool['_pool'].push(conn);
    } else {
      try { conn.close(); } catch { /* 忽略关闭错误 */ }
    }
  }

  /** 当前等待队列长度 */
  get pendingCount(): number {
    return this._queue.length;
  }

  /** 清空等待队列，拒绝所有等待者 */
  drain(): void {
    for (const item of this._queue) {
      clearTimeout(item.timer);
      item.resolve = () => {}; // 防止悬挂 resolve
    }
    this._queue.length = 0;
  }
}

/**
 * Connection pool for better-sqlite3 databases.
 */
export class AsyncConnectionPool {
  private _dbPath: string;
  private _poolSize: number;
  private _pool: DatabaseType[] = [];
  private _initialized = false;
  private _semaphore: PoolSemaphore;

  constructor(dbPath: string, poolSize: number = 5) {
    this._poolSize = Math.min(Math.max(poolSize, 1), 10);
    this._semaphore = new PoolSemaphore(this._poolSize);
    this._dbPath = dbPath;
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

  /**
   * 获取一个连接。池耗尽时排队等待而非创建临时连接。
   * 调用方必须在使用完毕后调用 release() 归还连接。
   */
  async acquire(): Promise<DatabaseType> {
    if (!this._initialized) this.initialize();
    return this._semaphore.acquire(this);
  }

  /**
   * 释放连接回池。优先转交给等待队列中的请求。
   */
  release(db: DatabaseType): void {
    this._semaphore.release(db, this);
  }

  close(): void {
    this._semaphore.drain();
    for (const db of this._pool) {
      try { db.close(); } catch { /* 忽略关闭错误 */ }
    }
    this._pool = [];
    this._initialized = false;
    // 重建信号量以重置状态
    this._semaphore = new PoolSemaphore(this._poolSize);
  }

  get isInitialized(): boolean { return this._initialized; }
  get availableConnections(): number { return this._pool.length; }
  get pendingCount(): number { return this._semaphore.pendingCount; }
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
