/**
 * Database Pool Tests
 *
 * Tests AsyncConnectionPool: initialization, acquire/release,
 * connection management, and singleton factory.
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

    it('sets WAL journal mode', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      const conn = pool.acquire();
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
    it('auto-initializes if not initialized', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      const conn = pool.acquire();
      expect(conn).toBeDefined();
      pool.release(conn);
      pool.close();
    });

    it('returns a database connection', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      const conn = pool.acquire();
      // Verify it's a working connection
      const result = conn.prepare('SELECT 1 + 1 AS sum').get() as { sum: number };
      expect(result.sum).toBe(2);
      pool.release(conn);
      pool.close();
    });

    it('reduces available connections', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      expect(pool.availableConnections).toBe(2);
      const conn1 = pool.acquire();
      expect(pool.availableConnections).toBe(1);
      const conn2 = pool.acquire();
      expect(pool.availableConnections).toBe(0);
      pool.release(conn1);
      pool.release(conn2);
      pool.close();
    });

    it('creates new connection when pool exhausted', () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = pool.acquire(); // pool is now empty
      const conn2 = pool.acquire(); // creates new connection
      expect(conn2).toBeDefined();
      // conn2 should still work
      const result = conn2.prepare('SELECT 1').get();
      expect(result).toBeDefined();
      pool.release(conn1);
      pool.release(conn2);
      pool.close();
    });
  });

  describe('release', () => {
    it('returns connection to pool', () => {
      const pool = new AsyncConnectionPool(dbPath, 2);
      pool.initialize();
      const conn = pool.acquire();
      expect(pool.availableConnections).toBe(1);
      pool.release(conn);
      expect(pool.availableConnections).toBe(2);
      pool.close();
    });

    it('closes connection when pool is full', () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn1 = pool.acquire();
      const conn2 = pool.acquire(); // creates overflow
      pool.release(conn1); // returns to pool
      pool.release(conn2); // pool is full, should close
      expect(pool.availableConnections).toBe(1);
      pool.close();
    });

    it('handles close errors gracefully', () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn = pool.acquire();
      const overflow = pool.acquire();
      // Force close the overflow connection to cause error on release
      try { conn.close(); } catch { /* ignore */ }
      // Release overflow - should try to close but not throw
      pool.release(overflow);
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

    it('handles errors when closing individual connections', () => {
      const pool = new AsyncConnectionPool(dbPath, 1);
      pool.initialize();
      const conn = pool.acquire();
      try { conn.close(); } catch { /* already closed */ }
      pool.release(conn); // puts broken conn back in pool
      pool.close(); // should not throw
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
});
