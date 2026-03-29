/**
 * ObsidianService - Obsidian Vault integration
 *
 * Migrated from src/services/obsidian_service.py.
 * Provides vault discovery, file traversal, and note reading.
 */

import { resolve, join, basename, dirname, extname, relative } from 'node:path';
import { homedir } from 'node:os';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  readFileSync,
} from 'node:fs';
import { platform } from 'node:os';

// ---------------------------------------------------------------------------
// Data types
// ---------------------------------------------------------------------------

export interface VaultInfo {
  name: string;
  path: string;
  lastModified: Date;
  fileCount: number;
  folderCount: number;
  totalSizeBytes: number;
  metadata: Record<string, unknown>;
}

export interface NoteInfo {
  name: string;
  path: string;
  relativePath: string;
  sizeBytes: number;
  createdAt?: Date | null;
  modifiedAt?: Date | null;
  tags: string[];
  links: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getObsidianConfigPath(): string | null {
  const plat = platform();

  if (plat === 'win32') {
    const appdata = process.env.APPDATA ?? '';
    if (appdata) return join(appdata, 'obsidian');
    return null;
  }

  if (plat === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'obsidian');
  }

  // Linux and others
  return join(homedir(), '.config', 'obsidian');
}

function minimatch(name: string, pattern: string): boolean {
  // Simple glob matching: supports *.md, *.txt, etc.
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(name);
}

// ---------------------------------------------------------------------------
// ObsidianService
// ---------------------------------------------------------------------------

export class ObsidianService {
  private readonly _configPath: string | null;
  private readonly _vaultCache = new Map<string, VaultInfo>();

  constructor(_config?: unknown) {
    this._configPath = getObsidianConfigPath();
  }

  // -----------------------------------------------------------------
  // Vault discovery
  // -----------------------------------------------------------------

  discoverVaults(refresh = false): VaultInfo[] {
    if (this._vaultCache.size > 0 && !refresh) {
      return [...this._vaultCache.values()];
    }

    const vaults: VaultInfo[] = [];

    // Method 1: From Obsidian config file
    const configVaults = this._discoverFromConfig();
    vaults.push(...configVaults);

    // Method 2: Scan common locations
    const commonVaults = this._discoverFromCommonPaths();
    const existingPaths = new Set(vaults.map((v) => v.path));
    for (const vault of commonVaults) {
      if (!existingPaths.has(vault.path)) {
        vaults.push(vault);
      }
    }

    // Update cache
    this._vaultCache.clear();
    for (const v of vaults) {
      this._vaultCache.set(v.path, v);
    }

    return vaults;
  }

  getVaultByName(name: string): VaultInfo | null {
    const vaults = this.discoverVaults();
    return vaults.find((v) => v.name.toLowerCase() === name.toLowerCase()) ?? null;
  }

  getVaultByPath(path: string): VaultInfo | null {
    const resolved = resolve(path);
    if (this._vaultCache.has(resolved)) {
      return this._vaultCache.get(resolved)!;
    }

    const info = this._getVaultInfo(resolved);
    if (info) {
      this._vaultCache.set(resolved, info);
    }
    return info;
  }

  // -----------------------------------------------------------------
  // File operations
  // -----------------------------------------------------------------

  getVaultStructure(vaultPath: string, maxDepth = 3): Record<string, unknown> {
    const path = resolve(vaultPath);
    if (!existsSync(path)) {
      return { error: `Vault not found: ${vaultPath}` };
    }

    const buildTree = (currentPath: string, depth: number): Record<string, unknown> => {
      if (depth > maxDepth) {
        return { truncated: true };
      }

      const stat = statSync(currentPath);
      const node: Record<string, unknown> = {
        name: basename(currentPath),
        type: stat.isFile() ? 'file' : 'directory',
      };

      if (stat.isFile()) {
        node.size = stat.size;
        node.extension = extname(currentPath);
        return node;
      }

      // Directory
      const children: Record<string, unknown>[] = [];
      for (const entry of readdirSync(currentPath, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.')) continue;
        children.push(buildTree(join(currentPath, entry.name), depth + 1));
      }

      node.children = children;
      node.fileCount = children.filter((c) => c.type === 'file').length;
      node.folderCount = children.filter((c) => c.type === 'directory').length;

      return node;
    };

    return buildTree(path, 0);
  }

  getFiles(vaultPath: string, pattern = '*.md', recursive = true): string[] {
    const path = resolve(vaultPath);
    if (!existsSync(path)) return [];

    const files: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.name === '.obsidian') continue;

        if (entry.isFile() && minimatch(entry.name, pattern)) {
          // Skip .obsidian directory contents
          if (!full.includes('.obsidian')) {
            files.push(full);
          }
        } else if (entry.isDirectory() && recursive) {
          walk(full);
        }
      }
    };

    walk(path);
    return files.sort();
  }

  getNotes(vaultPath: string, folder?: string, limit = 100): NoteInfo[] {
    let searchPath = resolve(vaultPath);
    if (folder) {
      searchPath = join(searchPath, folder);
    }
    if (!existsSync(searchPath)) return [];

    const notes: NoteInfo[] = [];
    const files = this.getFiles(searchPath, '*.md');

    for (const file of files) {
      try {
        const stat = statSync(file);
        const relPath = relative(resolve(vaultPath), file);

        let tags: string[] = [];
        let links: string[] = [];
        try {
          const content = readFileSync(file, 'utf-8');
          tags = extractTags(content);
          links = extractLinks(content);
        } catch { /* skip parsing */ }

        notes.push({
          name: basename(file, extname(file)),
          path: file,
          relativePath: relPath,
          sizeBytes: stat.size,
          createdAt: new Date(stat.birthtimeMs),
          modifiedAt: new Date(stat.mtimeMs),
          tags,
          links,
        });

        if (notes.length >= limit) break;
      } catch {
        // Skip problematic files
      }
    }

    return notes;
  }

  readNote(vaultPath: string, notePath: string): string {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    if (!existsSync(fullPath)) {
      throw new Error(`Note not found: ${notePath}`);
    }
    return readFileSync(fullPath, 'utf-8');
  }

  searchNotes(
    vaultPath: string,
    query: string,
    searchContent = true,
    limit = 50,
  ): NoteInfo[] {
    const queryLower = query.toLowerCase();
    const results: NoteInfo[] = [];

    for (const file of this.getFiles(vaultPath, '*.md')) {
      try {
        const name = basename(file, extname(file));

        // Filename match
        if (name.toLowerCase().includes(queryLower)) {
          const stat = statSync(file);
          results.push({
            name,
            path: file,
            relativePath: relative(resolve(vaultPath), file),
            sizeBytes: stat.size,
            modifiedAt: new Date(stat.mtimeMs),
            tags: [],
            links: [],
          });
          continue;
        }

        // Content match
        if (searchContent) {
          const content = readFileSync(file, 'utf-8');
          if (content.toLowerCase().includes(queryLower)) {
            const stat = statSync(file);
            results.push({
              name,
              path: file,
              relativePath: relative(resolve(vaultPath), file),
              sizeBytes: stat.size,
              modifiedAt: new Date(stat.mtimeMs),
              tags: extractTags(content),
              links: [],
            });
          }
        }

        if (results.length >= limit) break;
      } catch {
        // Skip problematic files
      }
    }

    return results;
  }

  // -----------------------------------------------------------------
  // Integration
  // -----------------------------------------------------------------

  syncToKnowledgeLayer(
    vaultPath: string,
    knowledgeLayer: {
      syncFile?: (path: string) => { success: boolean; error?: string };
      addDocument?: (content: string, metadata: Record<string, unknown>) => void;
    },
    folder?: string,
    fileTypes: string[] = ['*.md'],
  ): Record<string, unknown> {
    let searchPath = resolve(vaultPath);
    if (folder) {
      searchPath = join(searchPath, folder);
    }

    const syncedFiles: string[] = [];
    const failedFiles: Array<{ file: string; error: string }> = [];

    for (const pattern of fileTypes) {
      for (const file of this.getFiles(searchPath, pattern)) {
        try {
          if (knowledgeLayer.syncFile) {
            const result = knowledgeLayer.syncFile(file);
            if (result.success) {
              syncedFiles.push(file);
            } else {
              failedFiles.push({ file, error: result.error ?? 'Unknown error' });
            }
          } else if (knowledgeLayer.addDocument) {
            const content = readFileSync(file, 'utf-8');
            knowledgeLayer.addDocument(content, {
              source: 'obsidian',
              vault: vaultPath,
              file: relative(resolve(vaultPath), file),
            });
            syncedFiles.push(file);
          }
        } catch (err) {
          failedFiles.push({ file, error: (err as Error).message });
        }
      }
    }

    return {
      success: failedFiles.length === 0,
      syncedCount: syncedFiles.length,
      failedCount: failedFiles.length,
      syncedFiles: syncedFiles.slice(0, 10),
      failedFiles,
    };
  }

  // -----------------------------------------------------------------
  // Lifecycle
  // -----------------------------------------------------------------

  close(): void {
    this._vaultCache.clear();
  }

  // -----------------------------------------------------------------
  // Private helpers
  // -----------------------------------------------------------------

  private _discoverFromConfig(): VaultInfo[] {
    const vaults: VaultInfo[] = [];
    if (!this._configPath || !existsSync(this._configPath)) return vaults;

    const obsidianJsonPath = join(this._configPath, 'obsidian.json');
    if (!existsSync(obsidianJsonPath)) return vaults;

    try {
      const data = JSON.parse(readFileSync(obsidianJsonPath, 'utf-8'));
      const vaultList = data.vaults ?? {};

      for (const [vaultId, vaultData] of Object.entries(vaultList) as Array<[string, { path?: string }]>) {
        const vaultPath = vaultData.path ?? '';
        if (vaultPath && existsSync(vaultPath)) {
          const info = this._getVaultInfo(vaultPath);
          if (info) {
            info.metadata['vaultId'] = vaultId;
            vaults.push(info);
          }
        }
      }
    } catch {
      // Ignore config read errors
    }

    return vaults;
  }

  private _discoverFromCommonPaths(): VaultInfo[] {
    const vaults: VaultInfo[] = [];
    const home = homedir();

    const commonPaths = [
      join(home, 'Documents', 'Obsidian'),
      join(home, 'Documents', 'obsidian'),
      join(home, 'Obsidian'),
      join(home, 'obsidian'),
      join(home, 'Notes'),
      join(home, 'notes'),
    ];

    if (platform() === 'win32') {
      commonPaths.push(
        join(home, 'OneDrive', 'Documents', 'Obsidian'),
        'D:/Obsidian',
        'D:/Notes',
      );
    }

    for (const path of commonPaths) {
      if (!existsSync(path)) continue;

      // Check if it's a vault (contains .obsidian dir)
      if (existsSync(join(path, '.obsidian'))) {
        const info = this._getVaultInfo(path);
        if (info) vaults.push(info);
      } else {
        // Check subdirectories
        try {
          for (const entry of readdirSync(path, { withFileTypes: true })) {
            if (entry.isDirectory() && existsSync(join(path, entry.name, '.obsidian'))) {
              const info = this._getVaultInfo(join(path, entry.name));
              if (info) vaults.push(info);
            }
          }
        } catch { /* skip */ }
      }
    }

    return vaults;
  }

  private _getVaultInfo(vaultPath: string): VaultInfo | null {
    if (!existsSync(vaultPath)) return null;

    try {
      let fileCount = 0;
      let folderCount = 0;
      let totalSize = 0;
      let latestModified = new Date(0);

      const walk = (dir: string): void => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name === '.obsidian') continue;

          const full = join(dir, entry.name);
          if (entry.isFile()) {
            fileCount++;
            const stat = statSync(full);
            totalSize += stat.size;
            const modTime = new Date(stat.mtimeMs);
            if (modTime > latestModified) latestModified = modTime;
          } else if (entry.isDirectory()) {
            folderCount++;
            walk(full);
          }
        }
      };

      walk(vaultPath);

      return {
        name: basename(vaultPath),
        path: resolve(vaultPath),
        lastModified: latestModified.getTime() > 0 ? latestModified : new Date(),
        fileCount,
        folderCount,
        totalSizeBytes: totalSize,
        metadata: {},
      };
    } catch {
      return null;
    }
  }
}

// ---------------------------------------------------------------------------
// Tag and link extraction
// ---------------------------------------------------------------------------

function extractTags(content: string): string[] {
  const tags = new Set<string>();

  // YAML frontmatter tags
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const fm = fmMatch[1];
    // Inline tags: tags: [tag1, tag2]
    const inlineMatch = fm.match(/tags:\s*\[([^\]]+)\]/);
    if (inlineMatch) {
      for (const tag of inlineMatch[1].split(',')) {
        const trimmed = tag.trim().replace(/^["']|["']$/g, '');
        if (trimmed) tags.add(trimmed);
      }
    } else {
      // Block tags: tags:\n  - tag1\n  - tag2
      const blockMatch = fm.match(/tags:\s*\n((?:\s*-\s*.+\n?)+)/);
      if (blockMatch) {
        for (const line of blockMatch[1].split('\n')) {
          const trimmed = line.trim();
          if (trimmed.startsWith('-')) {
            const tag = trimmed.slice(1).trim().replace(/^["']|["']$/g, '');
            if (tag) tags.add(tag);
          }
        }
      }
    }
  }

  // Inline tags (#tag)
  const inlineTags = content.matchAll(/(?<!\w)#([a-zA-Z\u4e00-\u9fff][a-zA-Z0-9\u4e00-\u9fff_/-]*)/g);
  for (const match of inlineTags) {
    tags.add(match[1]);
  }

  return [...tags];
}

function extractLinks(content: string): string[] {
  const links = new Set<string>();

  // Wiki links [[link]] or [[link|display]]
  const wikiLinks = content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g);
  for (const match of wikiLinks) {
    links.add(match[1]);
  }

  return [...links];
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _instance: ObsidianService | null = null;

export function getObsidianService(config?: unknown): ObsidianService {
  if (!_instance) {
    _instance = new ObsidianService(config);
  }
  return _instance;
}

export function resetObsidianService(): void {
  if (_instance) {
    _instance.close();
  }
  _instance = null;
}
