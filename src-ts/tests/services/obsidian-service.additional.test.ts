import { afterEach, describe, expect, it, vi } from 'vitest';

import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const tempPaths: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-obs-additional-'));
  tempPaths.push(dir);
  return dir;
}

function createVault(root: string, name = 'vault', notes: Record<string, string> = {}): string {
  const vaultPath = join(root, name);
  mkdirSync(join(vaultPath, '.obsidian'), { recursive: true });

  for (const [relativePath, content] of Object.entries(notes)) {
    const fullPath = join(vaultPath, relativePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  return vaultPath;
}

async function loadObsidianModule(
  osOverrides: Partial<typeof import('node:os')> = {},
  fsOverrides: Partial<typeof import('node:fs')> = {},
) {
  vi.resetModules();
  vi.doMock('node:os', async () => {
    const actual = await vi.importActual<typeof import('node:os')>('node:os');
    return {
      ...actual,
      ...osOverrides,
    };
  });
  if (Object.keys(fsOverrides).length > 0) {
    vi.doMock('node:fs', async () => {
      const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
      return {
        ...actual,
        ...fsOverrides,
      };
    });
  }
  return import('../../services/obsidian-service');
}

afterEach(() => {
  vi.doUnmock('node:os');
  vi.doUnmock('node:fs');
  vi.restoreAllMocks();
  vi.resetModules();

  while (tempPaths.length > 0) {
    const dir = tempPaths.pop();
    if (dir && existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('ObsidianService additional coverage', () => {
  it('resolves platform-specific config paths', async () => {
    const originalAppData = process.env.APPDATA;

    try {
      process.env.APPDATA = 'C:\\Users\\niko\\AppData\\Roaming';
      let mod = await loadObsidianModule({
        homedir: () => 'C:\\Users\\niko',
        platform: () => 'win32',
      });
      expect((new mod.ObsidianService() as any)._configPath).toBe(
        join('C:\\Users\\niko\\AppData\\Roaming', 'obsidian'),
      );

      delete process.env.APPDATA;
      mod = await loadObsidianModule({
        homedir: () => 'C:\\Users\\niko',
        platform: () => 'win32',
      });
      expect((new mod.ObsidianService() as any)._configPath).toBeNull();

      process.env.APPDATA = '';
      mod = await loadObsidianModule({
        homedir: () => 'C:\\Users\\niko',
        platform: () => 'win32',
      });
      expect((new mod.ObsidianService() as any)._configPath).toBeNull();

      mod = await loadObsidianModule({
        homedir: () => '/Users/niko',
        platform: () => 'darwin',
      });
      expect((new mod.ObsidianService() as any)._configPath).toBe(
        join('/Users/niko', 'Library', 'Application Support', 'obsidian'),
      );

      mod = await loadObsidianModule({
        homedir: () => '/home/niko',
        platform: () => 'linux',
      });
      expect((new mod.ObsidianService() as any)._configPath).toBe(
        join('/home/niko', '.config', 'obsidian'),
      );
    } finally {
      process.env.APPDATA = originalAppData;
    }
  });

  it('discovers vaults from config files and ignores malformed config', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const configDir = createTempDir();
    const vaultRoot = createTempDir();
    const vaultPath = createVault(vaultRoot, 'story-vault', {
      'note.md': 'content',
    });
    const service = new ObsidianService();

    writeFileSync(
      join(configDir, 'obsidian.json'),
      JSON.stringify({
        vaults: {
          'vault-1': { path: vaultPath },
          'vault-2': { path: join(configDir, 'missing-vault') },
        },
      }),
      'utf-8',
    );

    (service as any)._configPath = configDir;
    const vaults = (service as any)._discoverFromConfig() as Array<Record<string, unknown>>;
    expect(vaults).toHaveLength(1);
    expect(vaults[0]).toMatchObject({
      name: 'story-vault',
      metadata: { vaultId: 'vault-1' },
    });

    writeFileSync(join(configDir, 'obsidian.json'), '{"vaults":', 'utf-8');
    expect((service as any)._discoverFromConfig()).toEqual([]);

    writeFileSync(join(configDir, 'obsidian.json'), '{}', 'utf-8');
    expect((service as any)._discoverFromConfig()).toEqual([]);
  });

  it('returns empty config discovery results for missing paths and vault path defaults', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const configDir = createTempDir();
    const service = new ObsidianService();

    (service as any)._configPath = null;
    expect((service as any)._discoverFromConfig()).toEqual([]);

    (service as any)._configPath = configDir;
    expect((service as any)._discoverFromConfig()).toEqual([]);

    writeFileSync(
      join(configDir, 'obsidian.json'),
      JSON.stringify({ vaults: { missingPath: {}, emptyPath: { path: '' } } }),
      'utf-8',
    );
    expect((service as any)._discoverFromConfig()).toEqual([]);
  });

  it('merges discovered config and common-path vaults, then serves cached discovery results', async () => {
    const homeDir = createTempDir();
    const configDir = createTempDir();
    const configVault = createVault(join(homeDir, 'Documents'), 'Obsidian', {
      'config-note.md': 'from config',
    });
    const commonVault = createVault(join(homeDir, 'Notes'), 'nested-vault', {
      'common-note.md': 'from common path',
    });

    writeFileSync(
      join(configDir, 'obsidian.json'),
      JSON.stringify({
        vaults: {
          config: { path: configVault },
        },
      }),
      'utf-8',
    );

    const { ObsidianService } = await loadObsidianModule({
      homedir: () => homeDir,
      platform: () => 'win32',
    });
    const service = new ObsidianService();
    (service as any)._configPath = configDir;
    const configSpy = vi.spyOn(service as any, '_discoverFromConfig');

    const first = service.discoverVaults(true);
    const second = service.discoverVaults(false);

    expect(first.map((vault) => vault.path)).toEqual(expect.arrayContaining([
      resolve(configVault),
      resolve(commonVault),
    ]));
    expect(first.filter((vault) => vault.path === resolve(configVault))).toHaveLength(1);
    expect(second).toEqual(first);
    expect(configSpy).toHaveBeenCalledTimes(1);
  });

  it('discovers direct and nested vaults from common paths under a mocked home directory', async () => {
    const homeDir = createTempDir();
    createVault(join(homeDir, 'Documents'), 'Obsidian', {
      'drafts/chapter.md': 'nested content',
    });
    createVault(join(homeDir, 'Notes'), 'nested-vault');
    createVault(join(homeDir, 'OneDrive', 'Documents'), 'Obsidian');
    writeFileSync(join(homeDir, 'obsidian'), 'not a directory', 'utf-8');

    const { ObsidianService } = await loadObsidianModule({
      homedir: () => homeDir,
      platform: () => 'win32',
    });
    const service = new ObsidianService();

    const vaults = (service as any)._discoverFromCommonPaths() as Array<Record<string, unknown>>;
    const paths = vaults.map((vault) => String(vault.path));

    expect(paths).toEqual(expect.arrayContaining([
      resolve(join(homeDir, 'Documents', 'Obsidian')),
      resolve(join(homeDir, 'Notes', 'nested-vault')),
      resolve(join(homeDir, 'OneDrive', 'Documents', 'Obsidian')),
    ]));
    expect(vaults.some((vault) => Number(vault.fileCount) === 0)).toBe(true);
  });

  it('returns cached vault info for repeated path lookups', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const root = createTempDir();
    const vaultPath = createVault(root, 'cached-vault', {
      'note.md': 'cache me',
    });
    const service = new ObsidianService();
    const infoSpy = vi.spyOn(service as any, '_getVaultInfo');

    const first = service.getVaultByPath(vaultPath);
    const second = service.getVaultByPath(vaultPath);

    expect(first).not.toBeNull();
    expect(second).toBe(first);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it('skips problematic note searches and returns null for invalid vault info reads', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'ok.md': 'safe note',
    });
    const service = new ObsidianService();
    const missingPath = join(vaultPath, 'missing.md');

    vi.spyOn(service, 'getFiles').mockReturnValue([missingPath]);
    expect(service.getNotes(vaultPath)).toEqual([]);
    expect(service.searchNotes(vaultPath, 'anything')).toEqual([]);

    const filePath = join(root, 'not-a-vault');
    writeFileSync(filePath, 'plain file', 'utf-8');
    expect((service as any)._getVaultInfo(filePath)).toBeNull();
  });

  it('skips note parsing and backlink reads when file content cannot be read', async () => {
    const realFs = await vi.importActual<typeof import('node:fs')>('node:fs');
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'target.md': 'Target body',
      'source.md': '[[target]] #tag',
    });
    const failingSource = join(vaultPath, 'source.md');
    const readFileSyncMock = vi.fn((path: Parameters<typeof realFs.readFileSync>[0], ...args: unknown[]) => {
      if (String(path) === failingSource) {
        throw new Error('read blocked');
      }
      return (realFs.readFileSync as (...params: unknown[]) => unknown)(path, ...args);
    }) as typeof realFs.readFileSync;

    const { ObsidianService } = await loadObsidianModule({}, { readFileSync: readFileSyncMock });
    const service = new ObsidianService();

    const notes = service.getNotes(vaultPath);
    const source = notes.find((note) => note.name === 'source');
    expect(source).toMatchObject({ tags: [], links: [] });
    expect(service.getBacklinks(vaultPath, 'target')).toEqual([]);
  });

  it('falls back from malformed daily note config to community plugin defaults', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root);

    writeFileSync(join(vaultPath, '.obsidian', 'daily-notes.json'), '{bad json', 'utf-8');
    writeFileSync(
      join(vaultPath, '.obsidian', 'community-plugins.json'),
      JSON.stringify(['daily-notes']),
      'utf-8',
    );

    expect(service.resolveDailyNotesConfig(vaultPath)).toEqual({
      folder: '',
      template: '',
      format: 'YYYY-MM-DD',
    });

    writeFileSync(join(vaultPath, '.obsidian', 'community-plugins.json'), '{broken json', 'utf-8');
    expect(service.resolveDailyNotesConfig(vaultPath)).toEqual({
      folder: '',
      template: '',
      format: 'YYYY-MM-DD',
    });

    writeFileSync(join(vaultPath, '.obsidian', 'daily-notes.json'), '{}', 'utf-8');
    expect(service.resolveDailyNotesConfig(vaultPath)).toEqual({
      folder: '',
      template: '',
      format: 'YYYY-MM-DD',
    });
  });

  it('serializes complex frontmatter and appends to daily notes without a trailing newline', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root);

    service.createNote(vaultPath, 'complex.md', 'Body', {
      tags: [],
      meta: { state: 'draft' },
      title: "Line: #1\nNext",
      priority: 2,
    });

    const complexContent = readFileSync(join(vaultPath, 'complex.md'), 'utf-8');
    expect(complexContent).toContain('tags: []');
    expect(complexContent).toContain('meta: {"state":"draft"}');
    expect(complexContent).toContain('title: "Line: #1\\nNext"');
    expect(complexContent).toContain('priority: 2');

    const withTemplate = service.createDailyNote(
      vaultPath,
      new Date(2026, 4, 28, 9, 7),
      '# {{date}} {{time}}',
    );
    expect(readFileSync(withTemplate, 'utf-8')).toContain('HH:09:07');

    const manualDaily = join(vaultPath, '2026-05-29.md');
    writeFileSync(manualDaily, 'Existing without newline', 'utf-8');
    service.appendToDailyNote(vaultPath, new Date(2026, 4, 29), '- appended');
    expect(readFileSync(manualDaily, 'utf-8')).toBe('Existing without newline\n- appended');
  });

  it('handles extensionless write, update, delete, wiki link and backlink flows', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'target.md': 'Target body',
      'source.md': 'Links to [[target]] #linked',
    });

    service.createNote(vaultPath, 'plain', 'Plain body');
    expect(readFileSync(join(vaultPath, 'plain.md'), 'utf-8')).toBe('Plain body');

    expect(service.readNote(vaultPath, 'plain')).toBe('Plain body');
    service.updateNote(vaultPath, 'plain', 'Updated body');
    expect(service.readNote(vaultPath, 'plain')).toBe('Updated body');

    service.writeNote(vaultPath, 'folder/generated', 'Generated body');
    expect(readFileSync(join(vaultPath, 'folder', 'generated.md'), 'utf-8')).toBe('Generated body');

    writeFileSync(join(vaultPath, 'raw-note'), 'raw extensionless', 'utf-8');
    expect(service.resolveWikiLink(vaultPath, 'raw-note')).toBe(resolve(join(vaultPath, 'raw-note')));

    const backlinks = service.getBacklinks(vaultPath, 'target');
    expect(backlinks).toHaveLength(1);
    expect(backlinks[0]).toMatchObject({
      name: 'source',
      tags: ['linked'],
      links: ['target'],
    });

    service.deleteNote(vaultPath, 'plain');
    expect(existsSync(join(vaultPath, 'plain.md'))).toBe(false);
  });

  it('updates and deeply merges extensionless frontmatter files', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault');

    service.createNote(vaultPath, 'meta', 'Body');
    service.updateFrontmatter(vaultPath, 'meta', { status: 'draft' });
    expect(service.readFrontmatter(vaultPath, 'meta')).toEqual({ status: 'draft' });
    expect(() => service.updateFrontmatter(vaultPath, 'missing-meta', { status: 'draft' })).toThrow(
      'Note not found',
    );

    service.createNote(vaultPath, 'nested', 'Nested body', {
      meta: { count: 1, keep: true },
      tags: ['old'],
    });
    service.mergeFrontmatter(vaultPath, 'nested', {
      meta: { count: 2, next: 'chapter' },
      tags: ['new'],
    });

    expect(service.readFrontmatter(vaultPath, 'nested')).toEqual({
      meta: { count: 2, keep: true, next: 'chapter' },
      tags: ['new'],
    });
    expect(() => service.mergeFrontmatter(vaultPath, 'missing-nested', { status: 'draft' })).toThrow(
      'Note not found',
    );
  });

  it('parses a trailing block-array frontmatter entry and clears unknown template variables', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'block-only.md': [
        '---',
        '',
        'tags:',
        '  - alpha',
        '  - beta',
        '---',
        'Body',
      ].join('\n'),
    });

    expect(service.readFrontmatter(vaultPath, 'block-only.md')).toEqual({
      tags: ['alpha', 'beta'],
    });

    const dailyPath = service.createDailyNote(
      vaultPath,
      new Date(2026, 4, 30, 8, 5),
      '{{date}} {{missing}}',
    );
    expect(readFileSync(dailyPath, 'utf-8')).toBe('2026-05-30 ');
  });

  it('uses daily note config folders, templates, default dates and append newline behavior', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 4, 31, 7, 6));

    try {
      const { ObsidianService } = await loadObsidianModule();
      const service = new ObsidianService();
      const root = createTempDir();
      const vaultPath = createVault(root, 'vault');

      writeFileSync(
        join(vaultPath, '.obsidian', 'daily-notes.json'),
        JSON.stringify({
          folder: 'journal',
          template: 'Configured {{title}} {{time}}',
          format: 'YYYY-MM-DD',
        }),
        'utf-8',
      );

      const created = service.createDailyNote(vaultPath);
      expect(readFileSync(created, 'utf-8')).toBe('Configured 2026-05-31 HH:07:06');
      expect(service.getDailyNote(vaultPath)).toBe('Configured 2026-05-31 HH:07:06');
      expect(service.getDailyNote(vaultPath, new Date(2026, 4, 31))).toBe('Configured 2026-05-31 HH:07:06');

      const appended = service.appendToDailyNote(vaultPath, new Date(2026, 4, 31), 'second line');
      expect(readFileSync(appended, 'utf-8')).toBe('Configured 2026-05-31 HH:07:06\nsecond line');

      service.appendToDailyNote(vaultPath, undefined, 'third line');
      expect(readFileSync(appended, 'utf-8')).toContain('third line');

      const emptyTemplate = service.createDailyNote(vaultPath, new Date(2026, 5, 1), '');
      expect(readFileSync(emptyTemplate, 'utf-8')).toBe('# 2026-06-01\n');

      vi.spyOn(service, 'resolveDailyNotesConfig').mockReturnValue({
        folder: '',
        template: undefined as unknown as string,
        format: 'YYYY-MM-DD',
      });
      const missingTemplate = service.createDailyNote(vaultPath, new Date(2026, 5, 2));
      expect(readFileSync(missingTemplate, 'utf-8')).toBe('# 2026-06-02\n');
    } finally {
      vi.useRealTimers();
    }
  });

  it('parses block arrays, empty arrays and JSON values from frontmatter', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'frontmatter.md': [
        '---',
        'tags:',
        '  - alpha',
        '  - "beta"',
        'queue:',
        'empty: []',
        'meta: {"score":1}',
        'flag: true',
        'plain: hello',
        '---',
        'Body',
      ].join('\n'),
    });

    expect(service.readFrontmatter(vaultPath, 'frontmatter.md')).toEqual({
      tags: ['alpha', 'beta'],
      queue: [],
      empty: [],
      meta: { score: 1 },
      flag: true,
      plain: 'hello',
    });
  });

  it('extracts block tags and records addDocument failures during sync', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'tagged.md': '---\ntags:\n  - mystery\n  - "investigation"\n---\nBody',
      'sync.md': 'Sync me',
    });

    const notes = service.getNotes(vaultPath);
    const tagged = notes.find((note) => note.name === 'tagged');
    expect(tagged?.tags).toEqual(expect.arrayContaining(['mystery', 'investigation']));

    const result = service.syncToKnowledgeLayer(vaultPath, {
      addDocument: vi.fn().mockImplementation(() => {
        throw new Error('add document failed');
      }),
    });

    expect(result).toMatchObject({
      success: false,
      failedCount: 2,
    });
    expect((result.failedFiles as Array<{ error: string }>).every((item) => item.error === 'add document failed')).toBe(true);
  });

  it('records default sync errors and skips nullish frontmatter values while dumping YAML', async () => {
    const { ObsidianService } = await loadObsidianModule();
    const service = new ObsidianService();
    const root = createTempDir();
    const vaultPath = createVault(root, 'vault', {
      'sync.md': 'Sync me',
    });

    const result = service.syncToKnowledgeLayer(vaultPath, {
      syncFile: vi.fn().mockReturnValue({ success: false }),
    });
    expect(result.failedFiles).toEqual([
      expect.objectContaining({ error: 'Unknown error' }),
    ]);

    service.createNote(vaultPath, 'nullish.md', 'Body', {
      keep: 'value',
      skipUndefined: undefined,
      skipNull: null,
    });
    const content = readFileSync(join(vaultPath, 'nullish.md'), 'utf-8');
    expect(content).toContain('keep: value');
    expect(content).not.toContain('skipUndefined');
    expect(content).not.toContain('skipNull');
  });
});
