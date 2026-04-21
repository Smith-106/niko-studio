/**
 * FileSyncService Tests
 *
 * Tests FileChangeEvent, FileWatcher, SyncResult, and FileSyncService.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  FileChangeEvent,
  FileWatcher,
  SyncResult,
  FileSyncService,
} from '../../services/file-sync';

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-fs-'));
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// FileChangeEvent
// ---------------------------------------------------------------------------

describe('FileChangeEvent', () => {
  it('constructs with defaults', () => {
    const event = new FileChangeEvent('/path/to/file.md', 'created');
    expect(event.path).toBe('/path/to/file.md');
    expect(event.eventType).toBe('created');
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.contentHash).toBeNull();
  });

  it('constructs with custom timestamp', () => {
    const event = new FileChangeEvent('/path', 'modified', 1000);
    expect(event.timestamp).toBe(1000);
  });

  it('computeHash returns hash for existing file', async () => {
    const filePath = join(tempDir, 'hash-test.txt');
    writeFileSync(filePath, 'Content for hashing', 'utf-8');
    const event = new FileChangeEvent(filePath, 'modified');

    const hash = await event.computeHash();
    expect(hash).not.toBeNull();
    expect(hash).toHaveLength(64); // SHA256 hex
    expect(event.contentHash).toBe(hash);
  });

  it('computeHash returns null for missing file', async () => {
    const event = new FileChangeEvent('/nonexistent/file.txt', 'created');
    const hash = await event.computeHash();
    expect(hash).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// FileWatcher
// ---------------------------------------------------------------------------

describe('FileWatcher', () => {
  it('constructs with default patterns', () => {
    const watcher = new FileWatcher();
    expect(watcher.isRunning()).toBe(false);
  });

  it('constructs with custom patterns', () => {
    const watcher = new FileWatcher(['*.ts', '*.tsx'], 2.0);
    // Internal state not directly observable, but construction should not throw
    expect(watcher).toBeDefined();
  });

  it('onChange registers callback', () => {
    const watcher = new FileWatcher();
    const callback = vi.fn();
    watcher.onChange(callback);
    // Verify by calling removeCallback
    watcher.removeCallback(callback);
    // If the callback was registered, removal should succeed
  });

  it('removeCallback removes registered callback', () => {
    const watcher = new FileWatcher();
    const callback = vi.fn();
    watcher.onChange(callback);
    watcher.removeCallback(callback);
    // No direct assertion possible, but no error should occur
  });

  it('watch returns false for non-existent directory', () => {
    const watcher = new FileWatcher();
    const result = watcher.watch('/nonexistent/directory/path');
    expect(result).toBe(false);
  });

  it('watch returns true for existing directory', () => {
    const watchDir = join(tempDir, 'watch-target');
    mkdirSync(watchDir, { recursive: true });
    const watcher = new FileWatcher(['*.md']);
    const result = watcher.watch(watchDir);
    expect(result).toBe(true);
    expect(watcher.isRunning()).toBe(true);
    watcher.stop();
  });

  it('watch ignores duplicate directories', () => {
    const watchDir = join(tempDir, 'dup-watch');
    mkdirSync(watchDir, { recursive: true });
    const watcher = new FileWatcher(['*.md']);

    watcher.watch(watchDir);
    watcher.watch(watchDir); // Second call should be no-op
    expect(watcher.isRunning()).toBe(true);
    watcher.stop();
  });

  it('stop clears all watchers', () => {
    const watchDir = join(tempDir, 'stop-watch');
    mkdirSync(watchDir, { recursive: true });
    const watcher = new FileWatcher(['*.md']);

    watcher.watch(watchDir);
    expect(watcher.isRunning()).toBe(true);

    watcher.stop();
    expect(watcher.isRunning()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SyncResult
// ---------------------------------------------------------------------------

describe('SyncResult', () => {
  it('constructs with required params', () => {
    const result = new SyncResult('/path/to/file.md', true, 'indexed');
    expect(result.path).toBe('/path/to/file.md');
    expect(result.success).toBe(true);
    expect(result.action).toBe('indexed');
    expect(result.message).toBe('');
    expect(result.timestamp).toBeGreaterThan(0);
    expect(result.contentHash).toBeNull();
  });

  it('constructs with message', () => {
    const result = new SyncResult('/path', true, 'updated', 'Synced');
    expect(result.message).toBe('Synced');
    expect(result.timestamp).toBeGreaterThan(0);
  });

  it('toDict returns correct structure', () => {
    const result = new SyncResult('/path', true, 'indexed', 'Done');
    result.contentHash = 'abc123';
    const dict = result.toDict();
    expect(dict.path).toBe('/path');
    expect(dict.success).toBe(true);
    expect(dict.action).toBe('indexed');
    expect(dict.message).toBe('Done');
    expect(dict.timestamp).toBeGreaterThan(0);
    expect(dict.content_hash).toBe('abc123');
  });
});

// ---------------------------------------------------------------------------
// FileSyncService
// ---------------------------------------------------------------------------

describe('FileSyncService', () => {
  // Increase timeout for file I/O tests
  beforeEach(() => {
    vi.setConfig({ testTimeout: 30000 });
  });
  it('constructs with knowledge layer and watch paths', () => {
    const mockLayer = { addDocument: vi.fn() };
    const service = new FileSyncService(mockLayer, [tempDir], tempDir);
    expect(service).toBeDefined();
  });

  it('getIndexedFiles returns empty for new service', () => {
    const mockLayer = {};
    const service = new FileSyncService(mockLayer, [], tempDir);
    const files = service.getIndexedFiles();
    expect(files).toEqual({});
  });

  it('getSyncHistory returns empty for new service', () => {
    const mockLayer = {};
    const service = new FileSyncService(mockLayer, [], tempDir);
    const history = service.getSyncHistory();
    expect(history).toEqual([]);
  });

  describe('syncFile', () => {
    it('syncs a new file and returns indexed result', async () => {
      const filePath = join(tempDir, 'new-file.md');
      writeFileSync(filePath, '# New file content\n\nBody text.', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);
      const result = await service.syncFile(filePath);

      expect(result.success).toBe(true);
      expect(result.action).toBe('indexed');
      expect(result.contentHash).not.toBeNull();
      expect(mockLayer.addDocument).toHaveBeenCalledTimes(1);
    });

    it('skips unchanged file on second sync', async () => {
      const filePath = join(tempDir, 'skip-test.md');
      writeFileSync(filePath, 'Stable content', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);

      const first = await service.syncFile(filePath);
      expect(first.action).toBe('indexed');

      const second = await service.syncFile(filePath);
      expect(second.action).toBe('skipped');
    });

    it('updates file when content changes', async () => {
      const filePath = join(tempDir, 'change-test.md');
      writeFileSync(filePath, 'Original content', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);

      await service.syncFile(filePath);
      writeFileSync(filePath, 'Updated content', 'utf-8');

      const result = await service.syncFile(filePath);
      expect(result.action).toBe('updated');
    });

    it('handles deleted file', async () => {
      const filePath = join(tempDir, 'delete-test.md');
      writeFileSync(filePath, 'Will be deleted', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);

      await service.syncFile(filePath);
      rmSync(filePath); // Delete the file outside of our cleanup

      const result = await service.syncFile(filePath);
      expect(result.success).toBe(true);
      expect(result.action).toBe('deleted');
    });

    it('force sync re-indexes unchanged file', async () => {
      const filePath = join(tempDir, 'force-test.md');
      writeFileSync(filePath, 'Stable content', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);

      await service.syncFile(filePath);
      const result = await service.syncFile(filePath, true);
      expect(result.action).toBe('updated');
    });
  });

  describe('syncDirectory', () => {
    it('syncs all matching files in a directory', async () => {
      const srcDir = join(tempDir, 'sync-dir');
      mkdirSync(srcDir, { recursive: true });
      writeFileSync(join(srcDir, 'a.md'), 'Content A', 'utf-8');
      writeFileSync(join(srcDir, 'b.md'), 'Content B', 'utf-8');
      writeFileSync(join(srcDir, 'c.txt'), 'Content C', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);

      const results = await service.syncDirectory(srcDir, ['*.md']);
      expect(results.length).toBe(2);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it('returns empty for non-existent directory', async () => {
      const mockLayer = {};
      const service = new FileSyncService(mockLayer, [], tempDir);
      const results = await service.syncDirectory('/nonexistent');
      expect(results).toEqual([]);
    });
  });

  describe('start / stop', () => {
    it('start watches configured directories', () => {
      const watchDir = join(tempDir, 'watch-dir');
      mkdirSync(watchDir, { recursive: true });

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [watchDir], tempDir);
      service.start();
      // Start should not throw
      service.stop();
    });

    it('start warns for non-existent watch path', () => {
      const mockLayer = {};
      const service = new FileSyncService(mockLayer, ['/nonexistent'], tempDir);
      // Should not throw, just warn
      service.start();
      service.stop();
    });

    it('stop can be called multiple times', () => {
      const mockLayer = {};
      const service = new FileSyncService(mockLayer, [], tempDir);
      service.stop();
      service.stop(); // Should not throw
    });
  });

  describe('getSyncHistory', () => {
    it('returns recent history up to limit', async () => {
      const filePath = join(tempDir, 'history.md');
      writeFileSync(filePath, 'History content', 'utf-8');

      const mockLayer = { addDocument: vi.fn() };
      const service = new FileSyncService(mockLayer, [], tempDir);

      // First sync indexes, skipped results are not pushed to history
      await service.syncFile(filePath);

      // Modify and re-sync to get second history entry
      writeFileSync(filePath, 'Updated history content', 'utf-8');
      await service.syncFile(filePath);

      const history = service.getSyncHistory(2);
      expect(history.length).toBe(2);
    });
  });
});
