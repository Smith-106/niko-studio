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
  writeFileSync,
  unlinkSync,
} from 'node:fs';
import { platform } from 'node:os';
import type { IConflictNowledgeBridge } from '../container/types';

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
  private readonly _conflictBridge?: IConflictNowledgeBridge;

  constructor(_config?: unknown, conflictBridge?: IConflictNowledgeBridge) {
    this._configPath = getObsidianConfigPath();
    this._conflictBridge = conflictBridge;
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

  // -----------------------------------------------------------------
  // Write operations (reverse write to vault)
  // -----------------------------------------------------------------

  writeNote(vaultPath: string, notePath: string, content: string): void {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }

  updateNote(vaultPath: string, notePath: string, content: string): void {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    if (!existsSync(fullPath)) {
      throw new Error(`Note not found: ${notePath}`);
    }
    writeFileSync(fullPath, content, 'utf-8');
  }

  createNote(
    vaultPath: string,
    notePath: string,
    content: string,
    frontmatter?: Record<string, unknown>,
  ): void {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    if (existsSync(fullPath)) {
      throw new Error(`Note already exists: ${notePath}`);
    }
    mkdirSync(dirname(fullPath), { recursive: true });

    const body = frontmatter
      ? `---\n${yamlDump(frontmatter)}\n---\n${content}`
      : content;
    writeFileSync(fullPath, body, 'utf-8');
  }

  deleteNote(vaultPath: string, notePath: string): void {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    if (!existsSync(fullPath)) {
      throw new Error(`Note not found: ${notePath}`);
    }
    unlinkSync(fullPath);
  }

  // -----------------------------------------------------------------
  // Frontmatter operations
  // -----------------------------------------------------------------

  readFrontmatter(vaultPath: string, notePath: string): Record<string, unknown> | null {
    const content = this.readNote(vaultPath, notePath);
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (!fmMatch) return null;
    return yamlSafeLoad(fmMatch[1]);
  }

  updateFrontmatter(
    vaultPath: string,
    notePath: string,
    updates: Record<string, unknown>,
  ): void {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    if (!existsSync(fullPath)) {
      throw new Error(`Note not found: ${notePath}`);
    }

    const content = readFileSync(fullPath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    let existingFm: Record<string, unknown> = {};
    let body = content;

    if (fmMatch) {
      existingFm = yamlSafeLoad(fmMatch[1]);
      body = content.slice(fmMatch[0].length);
    }

    const merged = { ...existingFm, ...updates };
    const newContent = `---\n${yamlDump(merged)}\n---\n${body}`;
    writeFileSync(fullPath, newContent, 'utf-8');
  }

  mergeFrontmatter(
    vaultPath: string,
    notePath: string,
    data: Record<string, unknown>,
  ): void {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    if (!existsSync(fullPath)) {
      throw new Error(`Note not found: ${notePath}`);
    }

    const content = readFileSync(fullPath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---\n?/);
    let existingFm: Record<string, unknown> = {};
    let body = content;

    if (fmMatch) {
      existingFm = yamlSafeLoad(fmMatch[1]);
      body = content.slice(fmMatch[0].length);
    }

    const merged = deepMerge(existingFm, data);
    const newContent = `---\n${yamlDump(merged)}\n---\n${body}`;
    writeFileSync(fullPath, newContent, 'utf-8');
  }

  // -----------------------------------------------------------------
  // Wiki-link operations (dual-link bridge)
  // -----------------------------------------------------------------

  resolveWikiLink(vaultPath: string, link: string): string | null {
    const resolved = resolve(vaultPath, link);
    if (existsSync(resolved + '.md')) return resolved + '.md';
    if (existsSync(resolved)) return resolved;

    // Search vault for matching note name
    const linkBasename = basename(link);
    for (const file of this.getFiles(vaultPath, '*.md')) {
      if (basename(file, '.md').toLowerCase() === linkBasename.toLowerCase()) {
        return file;
      }
    }
    return null;
  }

  getBacklinks(vaultPath: string, notePath: string): NoteInfo[] {
    let fullPath = resolve(vaultPath, notePath);
    if (!extname(fullPath)) {
      fullPath += '.md';
    }
    const noteName = basename(fullPath, extname(fullPath));
    const backlinks: NoteInfo[] = [];

    for (const file of this.getFiles(vaultPath, '*.md')) {
      if (file === fullPath) continue;
      try {
        const content = readFileSync(file, 'utf-8');
        const links = extractLinks(content);
        if (links.some((l) => l.toLowerCase() === noteName.toLowerCase())) {
          const stat = statSync(file);
          backlinks.push({
            name: basename(file, '.md'),
            path: file,
            relativePath: relative(resolve(vaultPath), file),
            sizeBytes: stat.size,
            modifiedAt: new Date(stat.mtimeMs),
            tags: extractTags(content),
            links,
          });
        }
      } catch { /* skip */ }
    }

    return backlinks;
  }

  // -----------------------------------------------------------------
  // Daily Notes / Templates
  // -----------------------------------------------------------------

  resolveDailyNotesConfig(vaultPath: string): DailyNotesConfig {
    const obsidianDir = join(resolve(vaultPath), '.obsidian');
    const configPath = join(obsidianDir, 'daily-notes.json');

    if (existsSync(configPath)) {
      try {
        const data = JSON.parse(readFileSync(configPath, 'utf-8'));
        return {
          folder: data.folder ?? '',
          template: data.template ?? '',
          format: data.format ?? 'YYYY-MM-DD',
        };
      } catch { /* fallback to defaults */ }
    }

    // Check community plugin config
    const communityPlugins = join(obsidianDir, 'community-plugins.json');
    if (existsSync(communityPlugins)) {
      try {
        const plugins: string[] = JSON.parse(readFileSync(communityPlugins, 'utf-8'));
        if (plugins.includes('daily-notes')) {
          return { folder: '', template: '', format: 'YYYY-MM-DD' };
        }
      } catch { /* fallback */ }
    }

    return { folder: '', template: '', format: 'YYYY-MM-DD' };
  }

  createDailyNote(
    vaultPath: string,
    date?: Date,
    template?: string,
  ): string {
    const d = date ?? new Date();
    const config = this.resolveDailyNotesConfig(vaultPath);
    const dateStr = formatDate(d, config.format);
    const folder = config.folder || '';
    const notePath = folder ? join(folder, `${dateStr}.md`) : `${dateStr}.md`;
    const fullPath = resolve(vaultPath, notePath);

    if (existsSync(fullPath)) {
      throw new Error(`Daily note already exists: ${notePath}`);
    }

    const templateContent = template ?? config.template ?? '';
    const content = templateContent
      ? applyTemplate(templateContent, { date: dateStr, time: formatTime(d), title: dateStr })
      : `# ${dateStr}\n`;

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
    return fullPath;
  }

  getDailyNote(vaultPath: string, date?: Date): string | null {
    const d = date ?? new Date();
    const config = this.resolveDailyNotesConfig(vaultPath);
    const dateStr = formatDate(d, config.format);
    const folder = config.folder || '';
    const notePath = folder ? join(folder, `${dateStr}.md`) : `${dateStr}.md`;
    const fullPath = resolve(vaultPath, notePath);

    if (!existsSync(fullPath)) return null;
    return readFileSync(fullPath, 'utf-8');
  }

  appendToDailyNote(
    vaultPath: string,
    date: Date | undefined,
    content: string,
  ): string {
    const d = date ?? new Date();
    const config = this.resolveDailyNotesConfig(vaultPath);
    const dateStr = formatDate(d, config.format);
    const folder = config.folder || '';
    const notePath = folder ? join(folder, `${dateStr}.md`) : `${dateStr}.md`;
    let fullPath = resolve(vaultPath, notePath);

    if (!existsSync(fullPath)) {
      this.createDailyNote(vaultPath, d);
    }

    const existing = readFileSync(fullPath, 'utf-8');
    const updated = existing.endsWith('\n')
      ? `${existing}${content}`
      : `${existing}\n${content}`;
    writeFileSync(fullPath, updated, 'utf-8');
    return fullPath;
  }
}

// ---------------------------------------------------------------------------
// YAML frontmatter utilities (minimal, no external dependency)
// ---------------------------------------------------------------------------

function yamlDump(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${key}: []`);
      } else {
        lines.push(`${key}:`);
        for (const item of value) {
          lines.push(`  - ${JSON.stringify(item)}`);
        }
      }
    } else if (typeof value === 'object') {
      lines.push(`${key}: ${JSON.stringify(value)}`);
    } else if (typeof value === 'string') {
      if (value.includes(':') || value.includes('#') || value.includes("'") || value.includes('\n')) {
        lines.push(`${key}: ${JSON.stringify(value)}`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  return lines.join('\n');
}

function yamlSafeLoad(text: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = text.split('\n');
  let currentKey: string | null = null;
  let currentArray: unknown[] | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    const arrayMatch = line.match(/^(\s*)- (.*)$/);
    if (arrayMatch && currentArray !== null) {
      let val: unknown = arrayMatch[2].trim();
      try { val = JSON.parse(val as string); } catch { /* keep raw string */ }
      currentArray.push(val);
      continue;
    }

    const kvMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*):\s*(.*)$/);
    if (kvMatch) {
      if (currentKey && currentArray !== null) {
        result[currentKey] = currentArray;
      }

      currentKey = kvMatch[1];
      const rawVal = kvMatch[2].trim();

      if (rawVal === '' || rawVal === '[]') {
        if (rawVal === '[]') {
          result[currentKey] = [];
          currentArray = null;
        } else {
          currentArray = [];
        }
      } else {
        let parsed: unknown = rawVal;
        try { parsed = JSON.parse(rawVal); } catch { /* keep raw string */ }
        result[currentKey] = parsed;
        currentArray = null;
      }
    }
  }

  if (currentKey && currentArray !== null) {
    result[currentKey] = currentArray;
  }

  return result;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      result[key] !== null &&
      typeof result[key] === 'object' &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Daily Notes types and helpers
// ---------------------------------------------------------------------------

export interface DailyNotesConfig {
  folder: string;
  template: string;
  format: string;
}

function formatDate(date: Date, format: string): string {
  const y = date.getFullYear().toString();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return format
    .replace('YYYY', y)
    .replace('MM', m)
    .replace('DD', d);
}

function formatTime(date: Date): string {
  const h = date.getHours().toString().padStart(2, '0');
  const m = date.getMinutes().toString().padStart(2, '0');
  return `HH:${h}:${m}`;
}

function applyTemplate(
  template: string,
  variables: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
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
