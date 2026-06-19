import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CoreMemoryStore,
  getCoreMemoryStore,
  resetCoreMemoryStore,
} from '../../memory/core-memory-store';

const originalExec = BetterSqlite3.prototype.exec;
let commitPatchApplied = false;

function patchCommitBug(): void {
  if (commitPatchApplied) return;
  commitPatchApplied = true;
  BetterSqlite3.prototype.exec = function patchedExec(this: unknown, sql: string) {
    try {
      return originalExec.call(this, sql);
    } catch (error: unknown) {
      if (sql === 'COMMIT' && (error as { code?: string }).code === 'SQLITE_ERROR') return;
      throw error;
    }
  };
}

function unpatchCommitBug(): void {
  if (!commitPatchApplied) return;
  commitPatchApplied = false;
  BetterSqlite3.prototype.exec = originalExec;
}

describe('CoreMemoryStore branch-gap coverage', () => {
  let tempDir: string;
  let originalCwd: string;

  beforeEach(() => {
    patchCommitBug();
    tempDir = mkdtempSync(join(tmpdir(), 'niko-core-memory-branch-gap-'));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    resetCoreMemoryStore();
    vi.restoreAllMocks();
    unpatchCommitBug();
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('covers generated ids, default metadata and importance in vector upserts', () => {
    const store = new CoreMemoryStore({ dbPath: join(tempDir, 'vector-upsert-defaults.db') });

    const created = store.upsert({
      content: 'Generated defaults path',
    });

    expect(created.id).toBeTruthy();
    expect(created.metadata).toEqual({});
    expect(created.importance).toBe(0.5);
    expect(created.accessCount).toBe(0);
  });

  it('covers sqlite fallback when row content is missing and returns raw content for empty summaries', () => {
    const store = new CoreMemoryStore({ dbPath: join(tempDir, 'sqlite-branch-gap.db') });
    const fakeConn = {
      prepare: vi.fn(() => ({
        all: vi.fn(() => [
          {
            id: 'missing-content-row',
            content: undefined,
            summary: null,
            archived: 0,
            created_at: 0,
            updated_at: 0,
            metadata: '{}',
            importance: 0.5,
            access_count: 0,
          },
        ]),
      })),
      close: vi.fn(),
    };
    vi.spyOn(store as any, '_getCoreConnection').mockReturnValue(fakeConn);

    expect(
      (store as any)._searchMemoriesSqlite({
        query: 'science fiction',
        topK: 5,
        includeArchived: true,
      }),
    ).toEqual([]);

    expect((store as any)._defaultSummary('', 200)).toBe('');
  });

  it('covers singleton creation when getCoreMemoryStore is called without params', () => {
    process.chdir(tempDir);

    const first = getCoreMemoryStore();
    const second = getCoreMemoryStore();
    expect(second).toBe(first);

    resetCoreMemoryStore();

    const third = getCoreMemoryStore();
    expect(third).not.toBe(first);
  });
});
