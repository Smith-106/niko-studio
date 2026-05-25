/**
 * FileSyncService - Automatic file system synchronization to AgentKnowledgeLayer
 *
 * Migrated from src/services/file_sync.py.
 *
 * Implements OpenKL's 'File as Truth' philosophy with:
 * - Automatic file watching with debounce
 * - Incremental sync (only changed files)
 * - Hash-based change detection
 * - Sync to memories/citations directories
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, stat, unlink } from 'node:fs/promises';
import { join, dirname, basename, extname, resolve, relative } from 'node:path';
import { watch, FSWatcher } from 'node:fs';
import { EventEmitter } from 'node:events';

import { createLogger } from "../logger/index.js";
const _log = createLogger("svc-file-sync");

/**
 * Represents a file change event with metadata.
 */
export class FileChangeEvent {
  path: string;
  eventType: 'created' | 'modified' | 'deleted';
  timestamp: number;
  contentHash: string | null;

  constructor(path: string, eventType: string, timestamp?: number) {
    this.path = path;
    this.eventType = eventType as 'created' | 'modified' | 'deleted';
    this.timestamp = timestamp ?? Date.now() / 1000;
    this.contentHash = null;
  }

  /**
   * Compute SHA256 hash of file content.
   */
  async computeHash(): Promise<string | null> {
    try {
      const content = await readFile(this.path);
      this.contentHash = createHash('sha256').update(content).digest('hex');
      return this.contentHash;
    } catch {
      return null;
    }
  }
}

type ChangeCallback = (event: FileChangeEvent) => void;

/**
 * Standalone file watcher with callback registration.
 */
export class FileWatcher {
  private patterns: string[];
  private debounceSeconds: number;
  private callbacks: ChangeCallback[] = [];
  private watchers: FSWatcher[] = [];
  private watchedDirs: Set<string> = new Set();
  private lastEvents: Map<string, number> = new Map();
  private running: boolean = false;

  constructor(patterns: string[] = ['*.md', '*.txt', '*.json'], debounceSeconds: number = 1.0) {
    this.patterns = patterns;
    this.debounceSeconds = debounceSeconds;
  }

  /**
   * Register a callback for file changes.
   */
  onChange(callback: ChangeCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Remove a registered callback.
   */
  removeCallback(callback: ChangeCallback): void {
    const index = this.callbacks.indexOf(callback);
    if (index !== -1) {
      this.callbacks.splice(index, 1);
    }
  }

  /**
   * Start watching a directory.
   */
  watch(directory: string): boolean {
    if (!existsSync(directory)) {
      _log.warn(`Directory does not exist: ${directory}`);
      return false;
    }

    const dirResolved = resolve(directory);

    if (this.watchedDirs.has(dirResolved)) {
      return true;
    }

    try {
      const watcher = watch(dirResolved, { recursive: true }, (event, filename) => {
        if (!filename) return;

        const filePath = join(dirResolved, filename);

        if (!this._isRelevant(filePath)) return;
        if (this._shouldDebounce(filePath)) return;

        const eventType = event === 'rename' ? 'created' : 'modified';
        const changeEvent = new FileChangeEvent(filePath, eventType);
        changeEvent.computeHash().then(() => {
          this._notify(changeEvent);
        });
      });

      watcher.on('error', (err) => {
        _log.warn(`FileWatcher error on ${dirResolved}: ${err.message}`);
      });

      this.watchers.push(watcher);
      this.watchedDirs.add(dirResolved);
      this.running = true;

      _log.info(`Started watching directory: ${directory}`);
      return true;
    } catch (e) {
      _log.error(`Failed to watch directory ${directory}: ${e}`);
      return false;
    }
  }

  /**
   * Stop all file watching.
   */
  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this.watchedDirs.clear();
    this.callbacks = [];
    this.lastEvents.clear();
    this.running = false;
    _log.info('FileWatcher stopped');
  }

  /**
   * Check if watcher is running.
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Check if file matches watched patterns.
   */
  private _isRelevant(path: string): boolean {
    const ext = extname(path).toLowerCase();
    for (const pattern of this.patterns) {
      if (pattern.startsWith('*.')) {
        if (ext === pattern.slice(1)) return true;
      } else if (basename(path) === pattern) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if event should be debounced.
   */
  private _shouldDebounce(path: string): boolean {
    const currentTime = Date.now() / 1000;
    const lastTime = this.lastEvents.get(path) ?? 0;
    if (currentTime - lastTime < this.debounceSeconds) {
      return true;
    }
    this.lastEvents.set(path, currentTime);
    return false;
  }

  /**
   * Notify all registered callbacks.
   */
  private _notify(event: FileChangeEvent): void {
    for (const callback of this.callbacks) {
      try {
        callback(event);
      } catch (e) {
        _log.error(`Callback error for ${event.path}: ${e}`);
      }
    }
  }
}

/**
 * Result of a sync operation.
 */
export class SyncResult {
  path: string;
  success: boolean;
  action: string; // "indexed", "updated", "deleted", "skipped"
  message: string;
  timestamp: number;
  contentHash: string | null;

  constructor(path: string, success: boolean, action: string, message: string = '') {
    this.path = path;
    this.success = success;
    this.action = action;
    this.message = message;
    this.timestamp = Date.now() / 1000;
    this.contentHash = null;
  }

  toDict(): Record<string, unknown> {
    return {
      path: this.path,
      success: this.success,
      action: this.action,
      message: this.message,
      timestamp: this.timestamp,
      content_hash: this.contentHash,
    };
  }
}

/**
 * Service to automatically sync file system changes to the AgentKnowledgeLayer.
 * Implements OpenKL's 'File as Truth' philosophy.
 */
export class FileSyncService {
  private knowledgeLayer: unknown;
  private watchPaths: string[];
  private writingRoot: string;
  private fileHashes: Map<string, string> = new Map();
  private syncHistory: SyncResult[] = [];
  private watchers: FSWatcher[] = [];

  constructor(
    knowledgeLayer: unknown,
    watchPaths: string[],
    writingRoot: string = '.writing'
  ) {
    this.knowledgeLayer = knowledgeLayer;
    this.watchPaths = watchPaths;
    this.writingRoot = writingRoot;
    this._loadHashIndex();
  }

  /**
   * Load file hash index from .ok directory.
   */
  private _loadHashIndex(): void {
    const indexPath = join(this.writingRoot, '.ok', 'index', 'file_hashes.json');
    if (existsSync(indexPath)) {
      try {
        const data = readFileSync(indexPath, 'utf-8');
        const parsed = JSON.parse(data) as Record<string, string>;
        this.fileHashes = new Map(Object.entries(parsed));
        _log.info(`Loaded ${this.fileHashes.size} file hashes from index`);
      } catch (e) {
        _log.warn(`Failed to load hash index: ${e}`);
      }
    }
  }

  /**
   * Save file hash index to .ok directory.
   */
  private _saveHashIndex(): void {
    const indexDir = join(this.writingRoot, '.ok', 'index');
    mkdirSync(indexDir, { recursive: true });
    const indexPath = join(indexDir, 'file_hashes.json');
    try {
      const obj: Record<string, string> = {};
      this.fileHashes.forEach((v, k) => { obj[k] = v; });
      writeFileSync(indexPath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
      _log.error(`Failed to save hash index: ${e}`);
    }
  }

  /**
   * Compute SHA256 hash of file content.
   */
  private async _computeFileHash(filePath: string): Promise<string | null> {
    try {
      const content = await readFile(filePath);
      return createHash('sha256').update(content).digest('hex');
    } catch {
      return null;
    }
  }

  /**
   * Check if file has changed since last sync.
   */
  private async _hasFileChanged(filePath: string): Promise<boolean> {
    const currentHash = await this._computeFileHash(filePath);
    if (currentHash === null) return false;
    const storedHash = this.fileHashes.get(filePath);
    return currentHash !== storedHash;
  }

  /**
   * Determine target directory based on file location/type.
   */
  private _determineTargetDir(filePath: string): string {
    const relPath = filePath.toLowerCase();
    if (relPath.includes('citations')) return 'citations';
    if (relPath.includes('memories')) return 'memories';
    return 'store';
  }

  /**
   * Sync a single file to the knowledge layer.
   */
  async syncFile(filePath: string, force: boolean = false): Promise<SyncResult> {
    if (!existsSync(filePath)) {
      // File was deleted - remove from index
      if (this.fileHashes.has(filePath)) {
        this.fileHashes.delete(filePath);
        this._saveHashIndex();
      }
      const result = new SyncResult(filePath, true, 'deleted', 'File removed from index');
      this.syncHistory.push(result);
      return result;
    }

    // Check if file has changed (incremental sync)
    if (!force && !(await this._hasFileChanged(filePath))) {
      return new SyncResult(filePath, true, 'skipped', 'File unchanged');
    }

    try {
      const content = await readFile(filePath, 'utf-8');
      const contentHash = await this._computeFileHash(filePath);
      const docId = createHash('md5').update(filePath).digest('hex').slice(0, 16);

      const targetDir = this._determineTargetDir(filePath);
      const sourceType = `sync-${targetDir}`;

      const isNew = !this.fileHashes.has(filePath);

      // Update knowledge layer
      const layer = this.knowledgeLayer as { addDocument?: (docId: string, content: string, sourceType: string) => void };
      if (layer.addDocument) {
        layer.addDocument(docId, content, sourceType);
      }

      // Update hash index
      this.fileHashes.set(filePath, contentHash ?? '');
      this._saveHashIndex();

      const action = isNew ? 'indexed' : 'updated';
      const result = new SyncResult(filePath, true, action, `Synced to ${targetDir}`);
      result.contentHash = contentHash;
      this.syncHistory.push(result);

      _log.info(`Synced file: ${filePath} -> ${action}`);
      return result;
    } catch (e) {
      const result = new SyncResult(filePath, false, 'error', String(e));
      this.syncHistory.push(result);
      _log.error(`Failed to sync file ${filePath}: ${e}`);
      return result;
    }
  }

  /**
   * Sync all matching files in a directory.
   */
  async syncDirectory(
    directory: string,
    patterns: string[] = ['*.md', '*.txt', '*.json'],
    force: boolean = false
  ): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    if (!existsSync(directory)) {
      _log.warn(`Directory does not exist: ${directory}`);
      return results;
    }

    for (const pattern of patterns) {
      const ext = pattern.startsWith('*.') ? pattern.slice(1) : pattern;
      await this._walkAndSync(directory, ext, force, results);
    }

    _log.info(`Directory sync complete: ${results.length} files processed`);
    return results;
  }

  /**
   * Walk directory and sync matching files
   */
  private async _walkAndSync(
    dir: string,
    ext: string,
    force: boolean,
    results: SyncResult[]
  ): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await this._walkAndSync(fullPath, ext, force, results);
      } else if (entry.name.toLowerCase().endsWith(ext)) {
        const result = await this.syncFile(fullPath, force);
        results.push(result);
      }
    }
  }

  /**
   * Start the background file watcher.
   */
  start(): void {
    for (const path of this.watchPaths) {
      if (existsSync(path)) {
        try {
          const watcher = watch(path, { recursive: true }, (event, filename) => {
            if (filename) {
              this.syncFile(join(path, filename));
            }
          });
          this.watchers.push(watcher);
          _log.info(`Watching directory: ${path}`);
        } catch (e) {
          _log.warn(`Failed to watch ${path}: ${e}`);
        }
      } else {
        _log.warn(`Watch directory does not exist: ${path}`);
      }
    }
    _log.info('FileSyncService started.');
  }

  /**
   * Stop the background watcher.
   */
  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
    this._saveHashIndex();
    _log.info('FileSyncService stopped.');
  }

  /**
   * Get recent sync history.
   */
  getSyncHistory(limit: number = 100): Record<string, unknown>[] {
    return this.syncHistory.slice(-limit).map((r) => r.toDict());
  }

  /**
   * Get all indexed files with their hashes.
   */
  getIndexedFiles(): Record<string, string> {
    const result: Record<string, string> = {};
    this.fileHashes.forEach((v, k) => { result[k] = v; });
    return result;
  }
}
