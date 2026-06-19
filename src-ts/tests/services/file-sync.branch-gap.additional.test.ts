import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

type FsModule = typeof import('node:fs');

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-file-sync-branch-gap-'));
}

async function flushAsyncWork(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 25));
}

class FakeWatcher extends EventEmitter {
  close = vi.fn();
}

async function importFileSyncModule(
  fsOverrides: Partial<FsModule> = {},
): Promise<typeof import('../../services/file-sync')> {
  vi.resetModules();
  vi.doUnmock('node:fs');
  vi.doUnmock('node:fs/promises');

  if (Object.keys(fsOverrides).length > 0) {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<FsModule>('node:fs');
      return { ...actual, ...fsOverrides };
    });
  }

  return import('../../services/file-sync');
}

describe('services/file-sync branch-gap coverage', () => {
  let tempDir: string;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
    }
    vi.doUnmock('node:fs');
    vi.doUnmock('node:fs/promises');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('debounces repeated relevant watcher events before notification', async () => {
    tempDir = createTempDir();
    const watchDir = join(tempDir, 'watch');
    mkdirSync(watchDir, { recursive: true });
    writeFileSync(join(watchDir, 'story.md'), 'once upon a time', 'utf8');

    let capturedCallback: ((eventType: string, filename?: string) => void) | undefined;
    const fakeWatcher = new FakeWatcher();
    const { FileWatcher } = await importFileSyncModule({
      watch: ((directory, _options, callback) => {
        expect(String(directory)).toContain('watch');
        capturedCallback = callback as (eventType: string, filename?: string) => void;
        return fakeWatcher as unknown as ReturnType<FsModule['watch']>;
      }) as FsModule['watch'],
    });

    const watcher = new FileWatcher(['*.md'], 60);
    const delivered: Array<{ path: string; eventType: string }> = [];
    watcher.onChange((event) => {
      delivered.push({
        path: event.path,
        eventType: event.eventType,
      });
    });

    expect(watcher.watch(watchDir)).toBe(true);

    capturedCallback?.('change', 'story.md');
    capturedCallback?.('change', 'story.md');
    await flushAsyncWork();

    expect(delivered).toEqual([
      {
        path: join(watchDir, 'story.md'),
        eventType: 'modified',
      },
    ]);

    watcher.stop();
    expect(fakeWatcher.close).toHaveBeenCalled();
  });

  it('stores an empty hash string when forced sync cannot compute a hash', async () => {
    tempDir = createTempDir();
    const filePath = join(tempDir, 'null-hash.md');
    writeFileSync(filePath, 'hash me maybe', 'utf8');

    const { FileSyncService } = await importFileSyncModule();
    const service = new FileSyncService({ addDocument: vi.fn() }, [], tempDir);
    const computeHashSpy = vi
      .spyOn(service as never, '_computeFileHash' as never)
      .mockResolvedValue(null);

    const result = await service.syncFile(filePath, true);

    expect(result.success).toBe(true);
    expect(result.action).toBe('indexed');
    expect(result.contentHash).toBeNull();
    expect(service.getIndexedFiles()[filePath]).toBe('');

    computeHashSpy.mockRestore();
  });
});
