import { EventEmitter } from 'node:events';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

type FsModule = typeof import('node:fs');

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-file-sync-additional-'));
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

describe('services/file-sync additional coverage', () => {
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

  it('covers FileWatcher helper branches for pattern matching, debounce, and callback failures', async () => {
    tempDir = createTempDir();
    const { FileWatcher } = await importFileSyncModule();
    const watcher = new FileWatcher(['*.md', 'notes.txt'], 60);
    const delivered = vi.fn();

    watcher.onChange(() => {
      throw new Error('callback exploded');
    });
    watcher.onChange(delivered);

    expect((watcher as any)._isRelevant(join(tempDir, 'story.md'))).toBe(true);
    expect((watcher as any)._isRelevant(join(tempDir, 'notes.txt'))).toBe(true);
    expect((watcher as any)._isRelevant(join(tempDir, 'story.json'))).toBe(false);

    expect((watcher as any)._shouldDebounce('same-path')).toBe(false);
    expect((watcher as any)._shouldDebounce('same-path')).toBe(true);

    (watcher as any)._notify({ path: 'story.md' });
    expect(delivered).toHaveBeenCalledWith({ path: 'story.md' });
  });

  it('emits modified and created events, ignores empty and irrelevant filenames, and tolerates watcher errors', async () => {
    tempDir = createTempDir();
    const watchDir = join(tempDir, 'watch');
    mkdirSync(watchDir, { recursive: true });
    writeFileSync(join(watchDir, 'note.md'), 'hello md', 'utf8');
    writeFileSync(join(watchDir, 'rename.md'), 'rename me', 'utf8');
    writeFileSync(join(watchDir, 'note.txt'), 'not relevant', 'utf8');

    let capturedCallback: ((eventType: string, filename?: string) => void) | undefined;
    const fakeWatcher = new FakeWatcher();
    const { FileWatcher } = await importFileSyncModule({
      watch: ((directory, _options, callback) => {
        expect(String(directory)).toContain('watch');
        capturedCallback = callback as (eventType: string, filename?: string) => void;
        return fakeWatcher as unknown as ReturnType<FsModule['watch']>;
      }) as FsModule['watch'],
    });

    const fileWatcher = new FileWatcher(['*.md'], 0);
    const received: Array<{ path: string; eventType: string; contentHash: string | null }> = [];
    fileWatcher.onChange((event) => {
      received.push({
        path: event.path,
        eventType: event.eventType,
        contentHash: event.contentHash,
      });
    });

    expect(fileWatcher.watch(watchDir)).toBe(true);
    capturedCallback?.('change', undefined);
    capturedCallback?.('change', 'note.txt');
    capturedCallback?.('change', 'note.md');
    capturedCallback?.('rename', 'rename.md');
    fakeWatcher.emit('error', new Error('watch failed'));

    await flushAsyncWork();

    expect(received).toHaveLength(2);
    const noteEvent = received.find(
      (event) => event.path === join(watchDir, 'note.md'),
    );
    const renameEvent = received.find(
      (event) => event.path === join(watchDir, 'rename.md'),
    );

    expect(noteEvent).toMatchObject({
      path: join(watchDir, 'note.md'),
      eventType: 'modified',
    });
    expect(noteEvent?.contentHash).toHaveLength(64);
    expect(renameEvent).toMatchObject({
      path: join(watchDir, 'rename.md'),
      eventType: 'created',
    });
    expect(renameEvent?.contentHash).toHaveLength(64);

    fileWatcher.stop();
    expect(fakeWatcher.close).toHaveBeenCalled();
  });

  it('returns false when fs.watch throws during FileWatcher setup', async () => {
    tempDir = createTempDir();
    const watchDir = join(tempDir, 'throw-watch');
    mkdirSync(watchDir, { recursive: true });

    const { FileWatcher } = await importFileSyncModule({
      watch: (() => {
        throw new Error('cannot watch');
      }) as FsModule['watch'],
    });
    const watcher = new FileWatcher(['*.md']);
    expect(watcher.watch(watchDir)).toBe(false);
    expect(watcher.isRunning()).toBe(false);
  });

  it('loads persisted hash indexes, ignores malformed ones, and covers directory classification helpers', async () => {
    tempDir = createTempDir();
    const okIndexDir = join(tempDir, '.ok', 'index');
    mkdirSync(okIndexDir, { recursive: true });
    writeFileSync(
      join(okIndexDir, 'file_hashes.json'),
      JSON.stringify({
        '/tmp/citations/a.md': 'hash-a',
        '/tmp/memories/b.md': 'hash-b',
      }),
      'utf8',
    );

    const { FileSyncService } = await importFileSyncModule();
    const loaded = new FileSyncService({}, [], tempDir);
    expect(loaded.getIndexedFiles()).toEqual({
      '/tmp/citations/a.md': 'hash-a',
      '/tmp/memories/b.md': 'hash-b',
    });
    expect((loaded as any)._determineTargetDir('/root/citations/item.md')).toBe('citations');
    expect((loaded as any)._determineTargetDir('/root/memories/item.md')).toBe('memories');
    expect((loaded as any)._determineTargetDir('/root/misc/item.md')).toBe('store');

    const malformedRoot = createTempDir();
    try {
      mkdirSync(join(malformedRoot, '.ok', 'index'), { recursive: true });
      writeFileSync(join(malformedRoot, '.ok', 'index', 'file_hashes.json'), '{bad-json', 'utf8');

      const { FileSyncService: MalformedFileSyncService } = await importFileSyncModule();
      const malformed = new MalformedFileSyncService({}, [], malformedRoot);
      expect(malformed.getIndexedFiles()).toEqual({});
    } finally {
      rmSync(malformedRoot, { recursive: true, force: true });
    }

    expect(await (loaded as any)._computeFileHash(join(tempDir, 'missing.md'))).toBeNull();
    expect(await (loaded as any)._hasFileChanged(join(tempDir, 'missing.md'))).toBe(false);
  });

  it('covers save failures, syncFile error handling, exact-pattern directory sync, and start callback branches', async () => {
    tempDir = createTempDir();
    const rootDir = join(tempDir, 'root');
    const nestedDir = join(rootDir, 'nested');
    const watchDir = join(tempDir, 'watch-callback');
    const throwingDir = join(tempDir, 'watch-throw');
    mkdirSync(nestedDir, { recursive: true });
    mkdirSync(watchDir, { recursive: true });
    mkdirSync(throwingDir, { recursive: true });

    const exactTarget = join(nestedDir, 'note.md');
    writeFileSync(exactTarget, 'exact target', 'utf8');
    writeFileSync(join(rootDir, 'skip.txt'), 'skip me', 'utf8');
    writeFileSync(join(watchDir, 'event.md'), 'watch me', 'utf8');

    const actualFs = await vi.importActual<FsModule>('node:fs');
    let failSaveOnce = true;
    let startCallback: ((eventType: string, filename?: string) => void) | undefined;
    const callbackWatcher = new FakeWatcher();
    const { FileSyncService, SyncResult } = await importFileSyncModule({
      watch: ((directory, _options, callback) => {
        if (String(directory).includes('watch-throw')) {
          throw new Error('watch unavailable');
        }
        startCallback = callback as (eventType: string, filename?: string) => void;
        return callbackWatcher as unknown as ReturnType<FsModule['watch']>;
      }) as FsModule['watch'],
      writeFileSync: ((filePath, data, options) => {
        if (failSaveOnce && String(filePath).endsWith('file_hashes.json')) {
          failSaveOnce = false;
          throw new Error('disk full');
        }
        return actualFs.writeFileSync(filePath, data as never, options as never);
      }) as FsModule['writeFileSync'],
    });

    const service = new FileSyncService({ addDocument: vi.fn() }, [watchDir, throwingDir], tempDir);
    expect(() => (service as any)._saveHashIndex()).not.toThrow();

    const directorySync = await service.syncFile(rootDir, true);
    expect(directorySync.success).toBe(false);
    expect(directorySync.action).toBe('error');
    expect(directorySync.message).toContain('EISDIR');

    const exactResults = await service.syncDirectory(rootDir, ['note.md'], true);
    expect(exactResults).toHaveLength(1);
    expect(exactResults[0]?.path).toBe(exactTarget);
    expect(exactResults[0]?.action).toBe('indexed');

    const syncSpy = vi.spyOn(service, 'syncFile').mockResolvedValue(
      new SyncResult(join(watchDir, 'event.md'), true, 'indexed'),
    );

    service.start();
    startCallback?.('change', undefined);
    startCallback?.('change', 'event.md');
    await flushAsyncWork();

    expect(syncSpy).toHaveBeenCalledTimes(1);
    expect(syncSpy).toHaveBeenCalledWith(join(watchDir, 'event.md'));

    service.stop();
    expect(callbackWatcher.close).toHaveBeenCalled();
  });
});
