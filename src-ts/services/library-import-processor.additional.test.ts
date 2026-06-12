import { beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('LibraryImportProcessor additional coverage', () => {
  let processor: LibraryImportProcessor;
  let service: ReturnType<typeof createMockService>;

  beforeEach(() => {
    service = createMockService();
    processor = new LibraryImportProcessor(
      service as unknown as import('../protocols/nowledge-mem').INowledgeMemService,
    );
  });

  it('marks the processor unavailable when status checks throw', async () => {
    service.status.mockRejectedValue(new Error('status down'));

    await processor.initialize();
    const result = await processor.importFromSource('/unavailable-source');

    expect(result).toEqual({
      total: 0,
      imported: 0,
      skipped: 0,
      errors: [],
      entities: [],
    });
  });

  it('falls back to an empty artifact summary during dry-run imports', async () => {
    await processor.initialize();
    service.searchLibrary.mockResolvedValue([
      { id: 'lib-3', name: 'untitled.md', type: 'note' },
    ]);

    const result = await processor.searchAndImport('note', { dryRun: true });

    expect(result.entities).toEqual([
      expect.objectContaining({
        id: 'lib-3',
        name: 'untitled.md',
        sourceType: 'note',
        summary: '',
        tags: ['note', 'library-import'],
      }),
    ]);
  });

  it('swallows per-entity persistence failures during importFromSource', async () => {
    await processor.initialize();
    const adapter = createMockAdapter();
    adapter.add.mockRejectedValueOnce(new Error('persist failed'));

    const result = await processor.importFromSource(
      '/path',
      {},
      adapter as unknown as import('../protocols/knowledge').KnowledgeMemoryEngineAdapter,
    );

    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(1);
    expect(adapter.add).toHaveBeenCalledTimes(2);
    expect(result.entities).toHaveLength(2);
  });
});
