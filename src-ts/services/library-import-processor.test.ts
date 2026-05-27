import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LibraryImportProcessor } from './library-import-processor.js';

function createMockService() {
  return {
    status: vi.fn().mockResolvedValue({ connected: true, version: '1.0.0' }),
    searchLibrary: vi.fn().mockResolvedValue([
      { id: 'lib-1', name: 'research.pdf', type: 'file', summary: 'Research paper on ML' },
      { id: 'lib-2', name: 'notes.md', type: 'file', summary: 'Meeting notes' },
    ]),
    importFromLibrary: vi.fn().mockResolvedValue({
      imported: 2,
      skipped: 1,
      errors: [],
      ids: ['mem-a', 'mem-b'],
    }),
  };
}

function createMockAdapter() {
  return {
    add: vi.fn().mockResolvedValue({ id: 'adapter-1' }),
    store: vi.fn().mockResolvedValue(undefined),
    initialize: vi.fn().mockResolvedValue(undefined),
    addToLibrary: vi.fn().mockResolvedValue([]),
    searchLibrary: vi.fn().mockResolvedValue([]),
  };
}

describe('LibraryImportProcessor', () => {
  let processor: LibraryImportProcessor;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    processor = new LibraryImportProcessor(service as unknown as import('../protocols/nowledge-mem').INowledgeMemService);
  });

  describe('initialize', () => {
    it('sets available when connected', async () => {
      await processor.initialize();
      const result = await processor.searchAndImport('test');
      expect(result.total).toBe(2);
    });

    it('sets unavailable when not connected', async () => {
      service.status.mockResolvedValue({ connected: false });
      await processor.initialize();
      const result = await processor.searchAndImport('test');
      expect(result.total).toBe(0);
    });
  });

  describe('searchAndImport', () => {
    it('imports matching artifacts as entities', async () => {
      await processor.initialize();
      const result = await processor.searchAndImport('pdf');
      expect(result.total).toBe(2);
      expect(result.imported).toBe(2);
      expect(result.entities).toHaveLength(2);
      expect(result.entities[0].id).toBe('lib-1');
      expect(result.entities[0].sourceType).toBe('file');
      expect(result.entities[0].tags).toContain('library-import');
    });

    it('persists via adapter when provided', async () => {
      await processor.initialize();
      const adapter = createMockAdapter();
      await processor.searchAndImport('pdf', {}, adapter as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter);
      expect(adapter.add).toHaveBeenCalledTimes(2);
    });

    it('skips all in dry-run mode', async () => {
      await processor.initialize();
      const result = await processor.searchAndImport('pdf', { dryRun: true });
      expect(result.skipped).toBe(2);
      expect(result.imported).toBe(0);
      expect(result.entities).toHaveLength(2);
    });

    it('handles import errors gracefully', async () => {
      await processor.initialize();
      const adapter = createMockAdapter();
      adapter.add.mockRejectedValueOnce(new Error('write failed'));
      const result = await processor.searchAndImport('pdf', {}, adapter as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter);
      expect(result.errors).toHaveLength(1);
      expect(result.skipped).toBe(1);
      expect(result.imported).toBe(1);
    });

    it('handles search failure', async () => {
      await processor.initialize();
      service.searchLibrary.mockRejectedValue(new Error('down'));
      const result = await processor.searchAndImport('pdf');
      expect(result.errors).toHaveLength(1);
      expect(result.imported).toBe(0);
    });
  });

  describe('importFromSource', () => {
    it('imports from source path', async () => {
      await processor.initialize();
      const result = await processor.importFromSource('/path/to/file.pdf');
      expect(result.imported).toBe(2);
      expect(result.entities).toHaveLength(2);
    });

    it('passes options to service', async () => {
      await processor.initialize();
      await processor.importFromSource('/path', {
        maxItems: 10,
        filterLabels: ['research'],
        dryRun: true,
      });
      expect(service.importFromLibrary).toHaveBeenCalledWith('/path', {
        maxItems: 10,
        filterLabels: ['research'],
        dryRun: true,
      });
    });

    it('persists via adapter when not dry-run', async () => {
      await processor.initialize();
      const adapter = createMockAdapter();
      await processor.importFromSource('/path', {}, adapter as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter);
      expect(adapter.add).toHaveBeenCalledTimes(2);
    });

    it('does not persist in dry-run mode', async () => {
      await processor.initialize();
      const adapter = createMockAdapter();
      await processor.importFromSource('/path', { dryRun: true }, adapter as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter);
      expect(adapter.add).not.toHaveBeenCalled();
    });

    it('returns errors on import failure', async () => {
      await processor.initialize();
      service.importFromLibrary.mockRejectedValue(new Error('unreachable'));
      const result = await processor.importFromSource('/path');
      expect(result.errors).toHaveLength(1);
      expect(result.imported).toBe(0);
    });
  });
});