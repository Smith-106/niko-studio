import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IKnowledgeService } from '../../container/types.js';

vi.mock('../../services/obsidian-service.js', () => ({
  ObsidianService: vi.fn().mockImplementation(() => ({
    getVaultByPath: vi.fn((path: string) => ({ name: 'TestVault', path })),
    getFiles: vi.fn(() => ['/vault/notes/note1.md', '/vault/notes/note2.md']),
    discoverVaults: vi.fn().mockReturnValue([]),
    getNotes: vi.fn().mockReturnValue([]),
    searchNotes: vi.fn().mockReturnValue([]),
    readNote: vi.fn().mockReturnValue(''),
    syncToKnowledgeLayer: vi.fn().mockReturnValue({ syncedCount: 0 }),
  })),
}));

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  return {
    ...actual,
    readFileSync: vi.fn().mockReturnValue('# Stable Note\nSame content every time.'),
    statSync: vi.fn().mockReturnValue({ size: 100, mtimeMs: 5000, birthtimeMs: Date.now() }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock('node:crypto', () => ({
  createHash: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnThis(),
    digest: vi.fn().mockReturnValue('stable-hash'),
  }),
}));

vi.mock('node:path', () => ({
  resolve: vi.fn((...args: string[]) => args.join('/')),
  relative: vi.fn((_from: string, to: string) => to),
  join: vi.fn((...args: string[]) => args.join('/')),
  dirname: vi.fn((p: string) => p.split('/').slice(0, -1).join('/')),
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

describe('ObsidianServiceAdapter branch-gap coverage', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('skips file hashing entirely when mtimes are unchanged across sync runs', async () => {
    const { ObsidianServiceAdapter } = await import('../../container/adapters.js');
    const { readFileSync } = await import('node:fs');
    const adapter = new ObsidianServiceAdapter(mockKnowledgeService);

    await adapter.sync('/vault/test');
    expect(vi.mocked(mockKnowledgeService.addDocument)).toHaveBeenCalledTimes(2);

    const mtimeMap = (adapter as unknown as {
      syncedFileMtimes: Map<string, number>;
    }).syncedFileMtimes;
    mtimeMap.set('obsidian:/vault/test:/vault/notes/note1.md', 5000);
    mtimeMap.set('obsidian:/vault/test:/vault/notes/note2.md', 5000);

    vi.mocked(mockKnowledgeService.addDocument).mockClear();
    vi.mocked(readFileSync).mockClear();

    const result = await adapter.sync('/vault/test');

    expect(result).toEqual({ added: 0, modified: 0, deleted: 0 });
    expect(vi.mocked(mockKnowledgeService.addDocument)).not.toHaveBeenCalled();
    expect(vi.mocked(readFileSync)).not.toHaveBeenCalled();
  });
});
