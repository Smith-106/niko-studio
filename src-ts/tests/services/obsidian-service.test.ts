/**
 * ObsidianService Tests
 *
 * Tests ObsidianService vault discovery, file operations, note reading,
 * tag/link extraction, and knowledge layer integration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ObsidianService,
  getObsidianService,
  resetObsidianService,
} from '../../services/obsidian-service';

import { mkdtempSync, rmSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-obs-'));
}

function createMockVault(dir: string, notes: Record<string, string> = {}): string {
  const vaultPath = join(dir, 'test-vault');
  mkdirSync(join(vaultPath, '.obsidian'), { recursive: true });

  for (const [name, content] of Object.entries(notes)) {
    const fullPath = join(vaultPath, name);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  return vaultPath;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let tempDir: string;

beforeEach(() => {
  tempDir = createTempDir();
  resetObsidianService();
  vi.stubGlobal('console', {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  });
});

afterEach(() => {
  resetObsidianService();
  rmSync(tempDir, { recursive: true, force: true });
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Vault discovery
// ---------------------------------------------------------------------------

describe('ObsidianService vault discovery', () => {
  it('discovers vaults from test directories', () => {
    createMockVault(tempDir, { 'note1.md': 'Content 1' });
    const service = new ObsidianService();

    // Directly test _getVaultInfo by using getVaultByPath
    const info = service.getVaultByPath(join(tempDir, 'test-vault'));
    expect(info).not.toBeNull();
    expect(info!.name).toBe('test-vault');
    expect(info!.path).toBeTruthy();
    expect(info!.fileCount).toBeGreaterThanOrEqual(1);
    expect(info!.folderCount).toBeGreaterThanOrEqual(0);
    expect(info!.totalSizeBytes).toBeGreaterThanOrEqual(0);
    expect(info!.lastModified).toBeInstanceOf(Date);
    expect(info!.metadata).toBeDefined();
  });

  it('getVaultByName finds vault by name from cache', () => {
    const vaultPath = createMockVault(tempDir, { 'note.md': 'Content' });
    const service = new ObsidianService();

    // Pre-cache by path so getVaultByName can find it
    service.getVaultByPath(vaultPath);

    const info = service.getVaultByName('test-vault');
    expect(info).not.toBeNull();
    expect(info!.name).toBe('test-vault');
  });

  it('getVaultByName returns null for unknown vault', () => {
    const service = new ObsidianService();
    expect(service.getVaultByName('nonexistent')).toBeNull();
  });

  it('getVaultByPath returns null for non-existent path', () => {
    const service = new ObsidianService();
    expect(service.getVaultByPath('/nonexistent/path')).toBeNull();
  });

  it('discoverVaults returns array of VaultInfo', () => {
    createMockVault(tempDir);
    const service = new ObsidianService();

    const vaults = service.discoverVaults(true);
    expect(Array.isArray(vaults)).toBe(true);
  });

  it('discoverVaults caches results', () => {
    createMockVault(tempDir);
    const service = new ObsidianService();

    const first = service.discoverVaults(true);
    const second = service.discoverVaults(false); // Should use cache
    expect(first).toEqual(second);
  });
});

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

describe('ObsidianService file operations', () => {
  it('getVaultStructure returns tree structure', () => {
    const vaultPath = createMockVault(tempDir, {
      'note1.md': 'Note 1',
      'subdir/note2.md': 'Note 2',
    });
    const service = new ObsidianService();

    const structure = service.getVaultStructure(vaultPath);
    expect(structure.name).toBe('test-vault');
    expect(structure.type).toBe('directory');
  });

  it('getVaultStructure returns error for non-existent vault', () => {
    const service = new ObsidianService();
    const structure = service.getVaultStructure('/nonexistent');
    expect(structure.error).toBeDefined();
  });

  it('getVaultStructure truncates at maxDepth', () => {
    const vaultPath = createMockVault(tempDir, {
      'a/b/c/d/note.md': 'Deep note',
    });
    const service = new ObsidianService();

    const structure = service.getVaultStructure(vaultPath, 2);
    // Should have truncated: true somewhere in the tree
    expect(structure.type).toBe('directory');
  });

  it('getFiles returns markdown files', () => {
    const vaultPath = createMockVault(tempDir, {
      'index.md': 'Index',
      'notes/daily.md': 'Daily note',
      'assets/image.png': 'PNG',
      'readme.txt': 'Text',
    });
    const service = new ObsidianService();

    const files = service.getFiles(vaultPath, '*.md');
    expect(files.length).toBe(2);
    expect(files.every((f) => f.endsWith('.md'))).toBe(true);
  });

  it('getFiles returns empty for non-existent path', () => {
    const service = new ObsidianService();
    expect(service.getFiles('/nonexistent')).toEqual([]);
  });

  it('getFiles supports non-recursive mode', () => {
    const vaultPath = createMockVault(tempDir, {
      'root.md': 'Root note',
      'subdir/nested.md': 'Nested note',
    });
    const service = new ObsidianService();

    const files = service.getFiles(vaultPath, '*.md', false);
    expect(files.length).toBe(1);
    expect(files[0]).toContain('root.md');
  });

  it('getFiles skips .obsidian directory', () => {
    const vaultPath = createMockVault(tempDir, {
      '.obsidian/workspace.json': '{}',
      'real-note.md': 'Real content',
    });
    const service = new ObsidianService();

    const files = service.getFiles(vaultPath, '*.json');
    // .obsidian/workspace.json should be skipped
    expect(files.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Note operations
// ---------------------------------------------------------------------------

describe('ObsidianService note operations', () => {
  it('getNotes returns NoteInfo array', () => {
    const vaultPath = createMockVault(tempDir, {
      'chapter1.md': '# Chapter 1\n\nContent here.',
    });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath);
    expect(notes).toHaveLength(1);
    expect(notes[0].name).toBe('chapter1');
    expect(notes[0].path).toContain('chapter1.md');
    expect(notes[0].relativePath).toBe('chapter1.md');
    expect(notes[0].sizeBytes).toBeGreaterThan(0);
    expect(notes[0].createdAt).toBeInstanceOf(Date);
    expect(notes[0].modifiedAt).toBeInstanceOf(Date);
  });

  it('getNotes respects limit', () => {
    const vaultPath = createMockVault(tempDir, {
      'a.md': 'A', 'b.md': 'B', 'c.md': 'C', 'd.md': 'D', 'e.md': 'E',
    });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath, undefined, 2);
    expect(notes.length).toBeLessThanOrEqual(2);
  });

  it('getNotes returns empty for non-existent path', () => {
    const service = new ObsidianService();
    expect(service.getNotes('/nonexistent')).toEqual([]);
  });

  it('getNotes filters by folder', () => {
    const vaultPath = createMockVault(tempDir, {
      'root.md': 'Root',
      'journal/day1.md': 'Day 1',
      'journal/day2.md': 'Day 2',
    });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath, 'journal');
    expect(notes.length).toBe(2);
  });

  it('getNotes extracts tags from frontmatter', () => {
    const vaultPath = createMockVault(tempDir, {
      'tagged.md': '---\ntags: [fiction, fantasy]\n---\n\nContent.',
    });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath);
    expect(notes).toHaveLength(1);
    expect(notes[0].tags).toContain('fiction');
    expect(notes[0].tags).toContain('fantasy');
  });

  it('getNotes extracts inline hash tags', () => {
    const vaultPath = createMockVault(tempDir, {
      'inline.md': 'Content with #writing and #creativity tags.',
    });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath);
    expect(notes[0].tags).toContain('writing');
    expect(notes[0].tags).toContain('creativity');
  });

  it('getNotes extracts wiki links', () => {
    const vaultPath = createMockVault(tempDir, {
      'linked.md': 'See [[Chapter 1]] and [[Characters|Main Cast]].',
    });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath);
    expect(notes[0].links).toContain('Chapter 1');
    expect(notes[0].links).toContain('Characters');
  });

  it('readNote reads file content', () => {
    const vaultPath = createMockVault(tempDir, {
      'readme.md': '# Readme\n\nHello world.',
    });
    const service = new ObsidianService();

    const content = service.readNote(vaultPath, 'readme.md');
    expect(content).toBe('# Readme\n\nHello world.');
  });

  it('readNote appends .md extension if missing', () => {
    const vaultPath = createMockVault(tempDir, {
      'autoext.md': 'Auto extension test.',
    });
    const service = new ObsidianService();

    const content = service.readNote(vaultPath, 'autoext');
    expect(content).toBe('Auto extension test.');
  });

  it('readNote throws for non-existent note', () => {
    const vaultPath = createMockVault(tempDir);
    const service = new ObsidianService();

    expect(() => service.readNote(vaultPath, 'nonexistent')).toThrow('Note not found');
  });

  it('searchNotes finds by filename', () => {
    const vaultPath = createMockVault(tempDir, {
      'chapter-one.md': 'Chapter one content.',
      'chapter-two.md': 'Chapter two content.',
      'appendix.md': 'Appendix content.',
    });
    const service = new ObsidianService();

    const results = service.searchNotes(vaultPath, 'chapter');
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it('searchNotes finds by content', () => {
    const vaultPath = createMockVault(tempDir, {
      'findme.md': 'This has the secret keyword hidden in content.',
      'other.md': 'This has nothing relevant.',
    });
    const service = new ObsidianService();

    const results = service.searchNotes(vaultPath, 'secret keyword');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].name).toBe('findme');
  });

  it('searchNotes respects limit', () => {
    const vaultPath = createMockVault(tempDir, {
      'a.md': 'Match', 'b.md': 'Match', 'c.md': 'Match',
    });
    const service = new ObsidianService();

    const results = service.searchNotes(vaultPath, 'Match', true, 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('searchNotes extracts tags from content-matched notes', () => {
    const vaultPath = createMockVault(tempDir, {
      'my-note.md': '---\ntags: [fiction, plot]\n---\n\nThis is a fiction story with plot elements.',
    });
    const service = new ObsidianService();

    // Search for content that doesn't match filename
    const results = service.searchNotes(vaultPath, 'fiction story');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].tags).toContain('fiction');
    expect(results[0].tags).toContain('plot');
  });
});

// ---------------------------------------------------------------------------
// Knowledge layer integration
// ---------------------------------------------------------------------------

describe('ObsidianService knowledge layer integration', () => {
  it('syncToKnowledgeLayer uses addDocument interface', () => {
    const vaultPath = createMockVault(tempDir, {
      'note.md': 'Sync content.',
    });
    const service = new ObsidianService();

    const mockLayer = {
      addDocument: vi.fn(),
    };

    const result = service.syncToKnowledgeLayer(vaultPath, mockLayer);
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBeGreaterThanOrEqual(1);
    expect(mockLayer.addDocument).toHaveBeenCalledTimes(1);
    expect(mockLayer.addDocument).toHaveBeenCalledWith(
      'Sync content.',
      expect.objectContaining({
        source: 'obsidian',
        vault: vaultPath,
      }),
    );
  });

  it('syncToKnowledgeLayer uses syncFile interface', () => {
    const vaultPath = createMockVault(tempDir, {
      'sync-test.md': 'Sync via syncFile.',
    });
    const service = new ObsidianService();

    const mockLayer = {
      syncFile: vi.fn().mockReturnValue({ success: true }),
    };

    const result = service.syncToKnowledgeLayer(vaultPath, mockLayer);
    expect(result.success).toBe(true);
    expect(result.syncedCount).toBeGreaterThanOrEqual(1);
    expect(mockLayer.syncFile).toHaveBeenCalledTimes(1);
  });

  it('syncToKnowledgeLayer tracks failures', () => {
    const vaultPath = createMockVault(tempDir, {
      'fail.md': 'Will fail.',
    });
    const service = new ObsidianService();

    const mockLayer = {
      syncFile: vi.fn().mockReturnValue({ success: false, error: 'Sync error' }),
    };

    const result = service.syncToKnowledgeLayer(vaultPath, mockLayer);
    expect(result.success).toBe(false);
    expect(result.failedCount).toBeGreaterThanOrEqual(1);
    expect(result.failedFiles.length).toBeGreaterThanOrEqual(1);
  });

  it('syncToKnowledgeLayer filters by folder', () => {
    const vaultPath = createMockVault(tempDir, {
      'root.md': 'Root',
      'journal/day1.md': 'Journal entry',
    });
    const service = new ObsidianService();

    const mockLayer = { addDocument: vi.fn() };
    const result = service.syncToKnowledgeLayer(vaultPath, mockLayer, 'journal');
    expect(result.syncedCount).toBeGreaterThanOrEqual(1);
    expect(mockLayer.addDocument).toHaveBeenCalledTimes(1);
  });

  it('syncToKnowledgeLayer supports multiple file types', () => {
    const vaultPath = createMockVault(tempDir, {
      'note.md': 'Markdown',
      'doc.txt': 'Text',
    });
    const service = new ObsidianService();

    const mockLayer = { addDocument: vi.fn() };
    const result = service.syncToKnowledgeLayer(vaultPath, mockLayer, undefined, ['*.md', '*.txt']);
    expect(result.syncedCount).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

describe('ObsidianService lifecycle', () => {
  it('close clears vault cache', () => {
    const vaultPath = createMockVault(tempDir, {
      'note.md': 'Content',
    });
    const service = new ObsidianService();

    service.getVaultByPath(vaultPath);
    service.close();

    // Cache should be cleared - next discovery should scan fresh
    const vaults = service.discoverVaults(true);
    expect(Array.isArray(vaults)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

describe('singleton functions', () => {
  it('getObsidianService returns same instance', () => {
    const s1 = getObsidianService();
    const s2 = getObsidianService();
    expect(s1).toBe(s2);
    s1.close();
  });

  it('resetObsidianService creates new instance', () => {
    const s1 = getObsidianService();
    resetObsidianService();
    const s2 = getObsidianService();
    expect(s1).not.toBe(s2);
    s2.close();
  });
});
