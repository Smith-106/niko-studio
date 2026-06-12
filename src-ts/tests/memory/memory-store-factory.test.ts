import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

describe('memory/memory-store-factory', () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();

    while (tempDirs.length > 0) {
      const tempDir = tempDirs.pop();
      if (tempDir) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  });

  function createTempDir(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'memory-store-factory-'));
    tempDirs.push(tempDir);
    return tempDir;
  }

  it('returns the fs backend when preferBackend is set to fs', async () => {
    const basePath = createTempDir();
    const { createMemoryStore } = await import('../../memory/memory-store-factory.js');
    const { FsMemoryStore } = await import('../../memory/fs-memory-store.js');

    const store = await createMemoryStore({ basePath, preferBackend: 'fs' });

    expect(store).toBeInstanceOf(FsMemoryStore);
    await store.close();
  });

  it('creates the sqlite backend by default when it is available', async () => {
    const basePath = createTempDir();
    const { createMemoryStore } = await import('../../memory/memory-store-factory.js');
    const { SqliteMemoryStore } = await import('../../memory/sqlite-memory-store.js');

    const store = await createMemoryStore({ basePath });

    expect(store).toBeInstanceOf(SqliteMemoryStore);
    expect(fs.existsSync(path.join(basePath, 'memories.db'))).toBe(true);
    await store.close();
  });

  it('falls back to the fs backend when sqlite initialization throws', async () => {
    const basePath = createTempDir();

    vi.doMock('node:fs/promises', async (importOriginal) => {
      const actual = await importOriginal<typeof import('node:fs/promises')>();
      return {
        ...actual,
        mkdir: vi.fn().mockRejectedValue(new Error('mkdir failed')),
      };
    });

    const { createMemoryStore } = await import('../../memory/memory-store-factory.js');
    const { FsMemoryStore } = await import('../../memory/fs-memory-store.js');

    const store = await createMemoryStore({ basePath });

    expect(store).toBeInstanceOf(FsMemoryStore);
    await store.close();
  });
});
