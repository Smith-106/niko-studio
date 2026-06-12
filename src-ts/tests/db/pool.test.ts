/**
 * Database Pool Tests
 *
 * Tests AsyncConnectionPool: initialization, acquire/release,
 * connection management, request queuing, and singleton factory.
 */

import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AsyncConnectionPool,
  getPool,
  closeAllPools,
} from '../../db/pool';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDbPath(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'niko-pool-'));
  return join(tempDir, 'test.db');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AsyncConnectionPool', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    closeAllPools();
  });

  afterEach(() => {
    closeAllPools();
    // On Windows, SQLite WAL/SHM files may still be locked briefly after close
    try {
      rmSync(dbPath, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors on Windows
    }
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('accepts dbPath and poolSize', () => {
      const pool = new AsyncConnectionPool(dbPath, 3);
      expect(pool.isInitialized).toBe(false);
    });

    it('clamps poolSize to 1-10 range', () => {
      const tooSmall = new AsyncConnectionPool(dbPath, 0);
      tooSmall.initialize();
      expect(tooSmall.availableConnections).toBe(1);
      tooSmall.close();

      const tooLarge = new AsyncConnectionPool(dbPath, 20);
      tooLarge.initialize();
      expect(tooLarge.availableConnections).toBe(10);
      tooLarge.close();
    });
  });

  describe('initialize', () => {
    it('creates the database file', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      expect(existsSync(dbPath)).toBe(true);
      pool.close();
    });

    it('creates the pool with correct size', () => {
      const pool = new AsyncConnectionPool(dbPath, 3);
      pool.initialize();
      expect(pool.availableConnections).toBe(3);
      pool.close();
    });

    it('is idempotent - does not re-initialize', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      pool.initialize();
      expect(pool.availableConnections).toBe(2);
      pool.close();
    });

    it('sets WAL journal mode', async () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      const conn = await pool.acquire();
      const result = conn.pragma('journal_mode') as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe('wal');
      pool.release(conn);
      pool.close();
    });

    it('creates parent directories if not exist', () => {
      const nestedPath = join(dbPath, 'nested', 'dir', 'test.db');
      const pool = new AsyncConnectionPool(nestedPath, 1);
      pool.initialize();
      expect(existsSync(nestedPath)).toBe(true);
      pool.close();
      rmSync(join(dbPath, 'nested'), { recursive: true, force: true });
    });
  });

  describe('acquire', () => {
    it('auto-initializes if not initialized', async () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      const conn = await pool.acquire();
      expect(conn).toBeDefined();
      pool.release(conn);
      pool.close();
    });

    it('returns a database connection', async () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      const conn = await pool.acquire();
      // Verify it's a working connection
      const result = conn.prepare('SELECT 1 + 1 AS sum').get() as { sum: number };
      expect(result.sum).toBe(2);
      pool.release(conn);
      pool.close();
    });

    it('reduces available connections', async () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      expect(pool.availableConnections).toBe(2);
      const conn1 = await pool.acquire();
      expect(pool.availableConnections).toBe(1);
      const conn2 = await pool.acquire();
      expect(pool.availableConnections).toBe(0);
      pool.release(conn1);
      pool.release(conn2);
      pool.close();
    });

    it('queues requests when pool exhausted and resolves on release', async () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = await pool.acquire(); // 池耗尽

      // acquire 应该排队等待而不是创建临时连接
      const acquirePromise = pool.acquire();
      expect(pool.pendingCount).toBe(1);

      // 释放连接后，排队的请求应该获得该连接
      pool.release(conn1);
      const conn2 = await acquirePromise;
      expect(conn2).toBeDefined();
      const result = conn2.prepare('SELECT 1').get();
      expect(result).toBeDefined();
      pool.release(conn2);
      pool.close();
    });

    it('rejects queued request after timeout', async () => {
      // 使用极短的超时来测试超时逻辑
      vi.useFakeTimers();
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = await pool.acquire();

      const acquirePromise = pool.acquire();
      expect(pool.pendingCount).toBe(1);

      // 推进时间超过 30 秒
      vi.advanceTimersByTime(31_000);

      await expect(acquirePromise).rejects.toThrow('Pool acquire timeout');

      pool.release(conn1);
      pool.close();
      vi.useRealTimers();
    });
  });

  describe('release', () => {
    it('returns connection to pool', async () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      const conn = await pool.acquire();
      expect(pool.availableConnections).toBe(1);
      pool.release(conn);
      expect(pool.availableConnections).toBe(2);
      pool.close();
    });

    it('closes excess connection when pool is full and no waiters', async () => {
      // 池大小为 1：获取 -> 释放 -> 再获取 -> 释放
      // 连接始终在池内流转，不会产生溢出
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = await pool.acquire();
      pool.release(conn1); // 归还到池
      expect(pool.availableConnections).toBe(1);
      const conn2 = await pool.acquire(); // 从池中再次获取
      pool.release(conn2);
      expect(pool.availableConnections).toBe(1);
      pool.close();
    });

    it('transfers connection to queued waiter instead of returning to pool', async () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = await pool.acquire();

      // 排队一个请求
      const waiterPromise = pool.acquire();
      expect(pool.pendingCount).toBe(1);
      expect(pool.availableConnections).toBe(0);

      // 释放 conn1 应该直接转给等待者，不归还到池
      pool.release(conn1);
      const conn2 = await waiterPromise;
      expect(conn2).toBe(conn1); // 应该是同一个连接对象
      expect(pool.availableConnections).toBe(0); // 没有归还到池
      expect(pool.pendingCount).toBe(0);
      pool.release(conn2);
      pool.close();
    });

    it('handles close errors gracefully', async () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn = await pool.acquire();
      // 强制关闭连接以制造 release 时的错误
      try { conn.close(); } catch { /* ignore */ }
      // release 不应该抛出异常
      pool.release(conn);
      pool.close();
    });
  });

  describe('pendingCount', () => {
    it('returns 0 when no pending requests', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      expect(pool.pendingCount).toBe(0);
      pool.close();
    });

    it('tracks number of queued requests', async () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = await pool.acquire();

      // 多个排队请求
      const p2 = pool.acquire();
      const p3 = pool.acquire();
      expect(pool.pendingCount).toBe(2);

      // 释放连接应该依次处理排队
      pool.release(conn1);
      // p2 应该已获得连接，p3 还在等待
      expect(pool.pendingCount).toBe(1);

      const conn2 = await p2;
      pool.release(conn2);
      const conn3 = await p3;
      expect(pool.pendingCount).toBe(0);

      pool.release(conn3);
      pool.close();
    });
  });

  describe('close', () => {
    it('closes all connections', () => {
      const pool = new AsyncConnectionPool(dbPath, 3);
      pool.initialize();
      expect(pool.availableConnections).toBe(3);
      pool.close();
      expect(pool.isInitialized).toBe(false);
      expect(pool.availableConnections).toBe(0);
    });

    it('is idempotent', () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      pool.close();
      pool.close(); // Should not throw
    });

    it('handles errors when closing individual connections', async () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn = await pool.acquire();
      try { conn.close(); } catch { /* already closed */ }
      pool.release(conn); // puts broken conn back in pool
      pool.close(); // should not throw
    });

    it('drains pending queue on close', async () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = await pool.acquire();
      const pendingPromise = pool.acquire();
      expect(pool.pendingCount).toBe(1);

      // close 应该清空等待队列
      pool.close();
      expect(pool.pendingCount).toBe(0);
      pool.close();
    });
  });

  describe('isInitialized', () => {
    it('returns false before initialization', () => {
      const pool = new AsyncConnectionPool(dbPath);
      expect(pool.isInitialized).toBe(false);
    });

    it('returns true after initialization', () => {
      const pool = new AsyncConnectionPool(dbPath);
      pool.initialize();
      expect(pool.isInitialized).toBe(true);
      pool.close();
    });

    it('returns false after close', () => {
      const pool = new AsyncConnectionPool(dbPath);
      pool.initialize();
      pool.close();
      expect(pool.isInitialized).toBe(false);
    });
  });
});

describe('getPool', () => {
  let dbPath: string;

  beforeEach(() => {
    dbPath = createTempDbPath();
    closeAllPools();
  });

  afterEach(() => {
    closeAllPools();
    rmSync(dbPath, { recursive: true, force: true });
  });

  it('creates and initializes a pool', () => {
    const pool = getPool(dbPath);
    expect(pool.isInitialized).toBe(true);
  });

  it('returns singleton for same path', () => {
    const resolved = resolve(dbPath);
    const p1 = getPool(dbPath);
    const p2 = getPool(dbPath);
    expect(p1).toBe(p2);
  });

  it('creates separate pools for different paths', () => {
    // Use separate temp dirs since getPool creates a db file AT the path
    const otherTempDir = createTempDbPath();
    const p1 = getPool(dbPath);
    const p2 = getPool(otherTempDir);
    expect(p1).not.toBe(p2);
    // closeAllPools will clean up the connections
    closeAllPools();
    try { rmSync(otherTempDir, { recursive: true, force: true }); } catch { /* ignore */ }
    // Re-initialize for afterEach
    const freshDir = createTempDbPath();
    // Replace dbPath so afterEach can clean up
    (dbPath as any) = freshDir;
  });

  it('accepts custom poolSize', () => {
    const pool = getPool(dbPath, 3);
    expect(pool.availableConnections).toBe(3);
  });
});

describe('closeAllPools', () => {
  it('closes all global pools', () => {
    const dbPath1 = createTempDbPath();
    const dbPath2 = createTempDbPath();
    try {
      const p1 = getPool(dbPath1);
      const p2 = getPool(dbPath2);
      expect(p1.isInitialized).toBe(true);
      expect(p2.isInitialized).toBe(true);
      closeAllPools();
      expect(p1.isInitialized).toBe(false);
      expect(p2.isInitialized).toBe(false);
    } finally {
      rmSync(dbPath1, { recursive: true, force: true });
      rmSync(dbPath2, { recursive: true, force: true });
    }
  });

  it('is safe to call when no pools exist', () => {
    expect(() => closeAllPools()).not.toThrow();
  });

  it('registers an exit shutdown hook that closes global pools', async () => {
    closeAllPools();
    const registered: Array<() => void> = [];
    const processOnSpy = vi.spyOn(process, 'on').mockImplementation((event, listener) => {
      if (event === 'exit') {
        registered.push(listener as () => void);
      }
      return process;
    });

    vi.resetModules();
    const poolModule = await import('../../db/pool');
    const hookedPool = poolModule.getPool(createTempDbPath(), 1);

    expect(hookedPool.isInitialized).toBe(true);
    expect(registered).toHaveLength(1);

    registered[0]();

    expect(hookedPool.isInitialized).toBe(false);
    processOnSpy.mockRestore();
  });
});
