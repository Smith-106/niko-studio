/**
 * File-system backed memory store — async I/O fallback.
 *
 * Wraps the file-based memory storage with async fs operations
 * to avoid blocking the event loop.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { IMemoryStore, MemorySearchQuery, MemorySearchResult } from './imemory-store.js';
import { MemoryEntry } from './memory-manager.js';
import { atomicWriteFile } from '../utils/atomic-write.js';

export class FsMemoryStore implements IMemoryStore {
  private basePath: string;
  private _cache = new Map<string, MemoryEntry>();
  private _loaded = false;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  private _entryPath(id: string): string {
    return path.join(this.basePath, `${id}.json`);
  }

  private async _ensureLoaded(): Promise<void> {
    if (this._loaded) return;
    await this._loadAll();
    this._loaded = true;
  }

  private async _loadAll(): Promise<void> {
    try {
      const files = await fs.readdir(this.basePath);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        try {
          const content = await fs.readFile(path.join(this.basePath, file), 'utf-8');
          const entry = JSON.parse(content) as MemoryEntry;
          this._cache.set(entry.id, entry);
        } catch {
          // skip corrupted files
        }
      }
    } catch {
      // directory doesn't exist yet
    }
  }

  async add(entry: Omit<MemoryEntry, 'id'>): Promise<string> {
    await fs.mkdir(this.basePath, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const fullEntry = new MemoryEntry({
      id,
      content: entry.content,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
      topics: entry.topics,
      entityId: entry.entityId,
      validFrom: entry.validFrom,
      validUntil: entry.validUntil,
      supersedes: entry.supersedes,
      supersededBy: entry.supersededBy,
      importance: entry.importance,
      source: entry.source,
      metadata: entry.metadata,
    });
    this._cache.set(id, fullEntry);
    await atomicWriteFile(this._entryPath(id), JSON.stringify(fullEntry, null, 2));
    return id;
  }

  async get(id: string): Promise<MemoryEntry | null> {
    await this._ensureLoaded();
    return this._cache.get(id) ?? null;
  }

  async getBatch(ids: string[]): Promise<MemoryEntry[]> {
    await this._ensureLoaded();
    return ids.map((id) => this._cache.get(id)).filter((e): e is MemoryEntry => e != null);
  }

  async search(query: MemorySearchQuery): Promise<MemorySearchResult> {
    await this._ensureLoaded();
    let results = Array.from(this._cache.values());

    if (query.entityId) {
      results = results.filter((e) => e.entityId === query.entityId);
    }

    if (query.topics && query.topics.length > 0) {
      results = results.filter((e) =>
        query.topics!.some((t) => e.topics?.includes(t)),
      );
    }

    if (query.startDate) {
      results = results.filter((e) => e.createdAt >= query.startDate!);
    }

    if (query.endDate) {
      results = results.filter((e) => e.createdAt <= query.endDate!);
    }

    if (query.query) {
      const q = query.query.toLowerCase();
      results = results.filter((e) => e.content.toLowerCase().includes(q));
    }

    results.sort((a, b) => (b.importance ?? 0) - (a.importance ?? 0));

    if (query.limit) {
      results = results.slice(0, query.limit);
    }

    return { memories: results, total: results.length };
  }

  async update(id: string, updates: Partial<MemoryEntry>): Promise<void> {
    const existing = this._cache.get(id);
    if (!existing) return;
    const updated = new MemoryEntry({
      ...existing,
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    });
    this._cache.set(id, updated);
    await atomicWriteFile(this._entryPath(id), JSON.stringify(updated, null, 2));
  }

  async delete(id: string): Promise<void> {
    this._cache.delete(id);
    try {
      await fs.unlink(this._entryPath(id));
    } catch {
      // file may not exist
    }
  }

  async rebuildIndex(): Promise<void> {
    this._cache.clear();
    this._loaded = false;
    await this._ensureLoaded();
  }

  async count(): Promise<number> {
    await this._ensureLoaded();
    return this._cache.size;
  }

  async close(): Promise<void> {
    this._cache.clear();
    this._loaded = false;
  }
}