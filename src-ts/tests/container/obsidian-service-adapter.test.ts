import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObsidianServiceAdapter } from '../../container/adapters.js';
import type { IKnowledgeService } from '../../container/types.js';

vi.mock('../../services/obsidian-service.js', () => {
  return {
    ObsidianService: vi.fn().mockImplementation(() => ({
      getVaultByPath: vi.fn((path: string) => {
        if (path.includes('nonexistent')) return null;
        return { name: 'TestVault', path };
      }),
      getFiles: vi.fn((_dir: string, _pattern: string) => [
        '/vault/notes/note1.md',
        '/vault/notes/note2.md',
      ]),
      discoverVaults: vi.fn().mockReturnValue([]),
      getNotes: vi.fn().mockReturnValue([]),
      searchNotes: vi.fn().mockReturnValue([]),
      readNote: vi.fn().mockReturnValue(''),
      syncToKnowledgeLayer: vi.fn().mockReturnValue({ syncedCount: 0 }),
    })),
  };
});

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  let mtimeCounter = 1000;
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readFileSync: vi.fn().mockReturnValue('# Test Note\nSome content.'),
    statSync: vi.fn().mockReturnValue({ size: 100, mtimeMs: ++mtimeCounter, birthtimeMs: Date.now() }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('node:crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('sha256hash'),
  }),
}));

vi.mock('node:path', () => ({
  resolve: vi.fn((...args: string[]) => args.join('/')),
  relative: vi.fn((_from: string, to: string) => to),
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
  basename: vi.fn((p: string) => p.split('/').pop() ?? ''),
  extname: vi.fn((p: string) => {
    const dot = p.lastIndexOf('.');
    return dot >= 0 ? p.slice(dot) : '';
  }),
}));

const mockKnowledgeService: IKnowledgeService = {
  initialize: vi.fn().mockResolvedValue(undefined),
  addDocument: vi.fn().mockResolvedValue(undefined),
  addEntity: vi.fn().mockResolvedValue(undefined),
  addRelation: vi.fn().mockResolvedValue(undefined),
  search: vi.fn().mockResolvedValue({ chunks: [], entities: [] }),
  getNeighbors: vi.fn().mockResolvedValue([]),
  distillKnowledge: vi.fn().mockResolvedValue(undefined),
  syncFile: vi.fn().mockResolvedValue({ success: true, action: 'synced', message: '' }),
  healthCheck: vi.fn().mockResolvedValue(true),
  shutdown: vi.fn().mockResolvedValue(undefined),
};

describe('ObsidianServiceAdapter', () => {
  beforeEach(() => {
    // Reset mockKnowledgeService calls only
    vi.mocked(mockKnowledgeService.addDocument).mockClear();
  });

  describe('sync without KnowledgeService', () => {
    it('returns empty result when no knowledgeService injected', async () => {
      const adapter = new ObsidianServiceAdapter(undefined);
      const result = await adapter.sync('/vault/test');
      expect(result).toEqual({ added: 0, modified: 0, deleted: 0 });
    });
  });

  describe('sync with KnowledgeService', () => {
    it('calls addDocument for each vault file', async () => {
      vi.mocked(mockKnowledgeService.addDocument).mockResolvedValue(undefined);
      const adapter = new ObsidianServiceAdapter(mockKnowledgeService);
      const result = await adapter.sync('/vault/test');

      expect(mockKnowledgeService.addDocument).toHaveBeenCalledTimes(2);
      expect(result.added).toBe(2);
      expect(result.modified).toBe(0);

      const firstCall = vi.mocked(mockKnowledgeService.addDocument).mock.calls[0];
      expect(firstCall[0]).toMatch(/^obsidian:/);
      expect(firstCall[1]).toBe('# Test Note\nSome content.');
    });

    it('skips unchanged files on second sync', async () => {
      const adapter = new ObsidianServiceAdapter(mockKnowledgeService);

      await adapter.sync('/vault/test');
      expect(mockKnowledgeService.addDocument).toHaveBeenCalledTimes(2);

      vi.clearAllMocks();
      await adapter.sync('/vault/test');

      // Same hash — should skip all files
      expect(mockKnowledgeService.addDocument).not.toHaveBeenCalled();
    });

    it('marks files as modified when content changes', async () => {
      const adapter = new ObsidianServiceAdapter(mockKnowledgeService);

      await adapter.sync('/vault/test');
      expect(mockKnowledgeService.addDocument).toHaveBeenCalledTimes(2);

      // Manually change the tracked hash to simulate content change
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const internalMap = (adapter as any).syncedFileHashes as Map<string, string>;
      for (const [key] of internalMap) {
        internalMap.set(key, 'old-hash');
      }

      vi.clearAllMocks();
      const result = await adapter.sync('/vault/test');

      // Hash mismatch → files treated as modified
      expect(result.modified).toBe(2);
      expect(mockKnowledgeService.addDocument).toHaveBeenCalledTimes(2);
    });

    it('handles file read errors gracefully', async () => {
      const { readFileSync } = await import('node:fs');
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error('Read error');
      });

      const adapter = new ObsidianServiceAdapter(mockKnowledgeService);
      const result = await adapter.sync('/vault/test');

      // All files failed to read — no documents added
      expect(result).toBeDefined();
      expect(typeof result.added).toBe('number');
    });

    it('uses obsidian: prefixed docId for dedup', async () => {
      vi.mocked(mockKnowledgeService.addDocument).mockResolvedValue(undefined);

      // Reset readFileSync to return normal content
      const { readFileSync } = await import('node:fs');
      vi.mocked(readFileSync).mockReturnValue('# Test Note\nSome content.');

      const adapter = new ObsidianServiceAdapter(mockKnowledgeService);
      const result = await adapter.sync('/vault/test');

      // Verify addDocument was called with obsidian:-prefixed docId
      const calls = vi.mocked(mockKnowledgeService.addDocument).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toMatch(/^obsidian:/);
    });

    it('skips files when mtime unchanged (no hash computation)', async () => {
      const adapter = new ObsidianServiceAdapter(mockKnowledgeService);
      const { statSync } = await import('node:fs');

      // First sync — files get indexed
      await adapter.sync('/vault/test');
      expect(mockKnowledgeService.addDocument).toHaveBeenCalledTimes(2);

      // Fix mtime to same value for second sync
      const fixedMtime = 5000;
      vi.mocked(statSync).mockReturnValue({ size: 100, mtimeMs: fixedMtime, birthtimeMs: Date.now() });

      // Manually set the mtime map to match
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mtimeMap = (adapter as any).syncedFileMtimes as Map<string, number>;
      for (const [key] of mtimeMap) {
        mtimeMap.set(key, fixedMtime);
      }

      vi.clearAllMocks();
      await adapter.sync('/vault/test');

      // mtime unchanged — should skip all files without computing hash
      expect(mockKnowledgeService.addDocument).not.toHaveBeenCalled();
    });
  });

  describe('export', () => {
    it('writes file to vault path without error', async () => {
      const adapter = new ObsidianServiceAdapter(undefined);
      await expect(adapter.export('/vault/test', '# Hello')).resolves.toBeUndefined();
    });
  });

  describe('import', () => {
    it('throws when vault not found', async () => {
      const adapter = new ObsidianServiceAdapter(undefined);
      await expect(adapter.import('/nonexistent')).rejects.toThrow('Vault not found');
    });
  });
});