import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AsyncConnectionPool, closeAllPools } from '../../db/pool';

function createTempDbPath(): string {
  const tempDir = mkdtempSync(join(tmpdir(), 'niko-pool-additional-'));
  return join(tempDir, 'test.db');
}

describe('db/pool additional coverage', () => {
  const dbPaths: string[] = [];

  afterEach(() => {
    closeAllPools();
    while (dbPaths.length > 0) {
      const dbPath = dbPaths.pop();
      if (dbPath) {
        try {
          rmSync(dbPath, { recursive: true, force: true });
        } catch {
          // ignore cleanup failures
        }
      }
    }
    vi.restoreAllMocks();
  });

  it('ignores close errors when releasing an overflow connection', () => {
    const dbPath = createTempDbPath();
    dbPaths.push(dbPath);

    const pool = new AsyncConnectionPool(dbPath, 1);
    pool.initialize();

    const fakeConnection = {
      close: vi.fn(() => {
        throw new Error('close failed');
      }),
    } as unknown as Parameters<AsyncConnectionPool['release']>[0];

    expect(() => pool.release(fakeConnection)).not.toThrow();
    expect((fakeConnection as { close: ReturnType<typeof vi.fn> }).close).toHaveBeenCalledTimes(1);
  });

  it('swallows close errors when shutting down pooled connections', () => {
    const dbPath = createTempDbPath();
    dbPaths.push(dbPath);

    const pool = new AsyncConnectionPool(dbPath, 1);
    pool.initialize();

    const fakeConnection = {
      close: vi.fn(() => {
        throw new Error('close failed');
      }),
    } as unknown as { close: ReturnType<typeof vi.fn> };

    (pool.connections as unknown as Array<unknown>).push(fakeConnection);

    expect(() => pool.close()).not.toThrow();
    expect(fakeConnection.close).toHaveBeenCalledTimes(1);
    expect(pool.isInitialized).toBe(false);
  });
});
