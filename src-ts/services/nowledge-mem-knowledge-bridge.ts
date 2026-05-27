/**
 * NowledgeMemKnowledgeBridge
 *
 * Bridges KnowledgeService's memoryEngine adapter interface
 * to NowledgeMemAdapter, allowing KnowledgeService to persist
 * documents through Nowledge Mem when available.
 *
 * Gracefully degrades: if Nowledge Mem is unreachable,
 * KnowledgeService falls back to its built-in JSON snapshot.
 */

import type { KnowledgeMemoryEngineAdapter } from '../protocols/knowledge';
import type { INowledgeMemService } from '../protocols/nowledge-mem';

export class NowledgeMemKnowledgeBridge implements KnowledgeMemoryEngineAdapter {
  private service: INowledgeMemService;
  private _available = false;

  constructor(service: INowledgeMemService) {
    this.service = service;
  }

  async initialize(): Promise<void> {
    try {
      const status = await this.service.status();
      this._available = status.connected;
    } catch {
      this._available = false;
    }
  }

  async add(params: {
    content: string;
    layer?: string;
    dimension?: string | null;
    entityId?: string | null;
    validFrom?: string | null;
    validUntil?: string | null;
    importance?: number;
    tags?: string[];
    userId?: string | null;
    projectId?: string | null;
    sessionId?: string | null;
    source?: string;
    confidence?: number;
  }): Promise<Record<string, unknown>> {
    if (!this._available) return {};

    try {
      const labels = [
        ...(params.tags ?? []),
        ...(params.layer ? [params.layer] : []),
        ...(params.dimension ? [params.dimension] : []),
      ];

      const result = await this.service.addMemory(params.content, {
        labels,
        importance: params.importance,
      });

      return {
        id: result.id,
        source: `nowledge-mem:${result.id}`,
      };
    } catch {
      return {};
    }
  }

  async store(key: string, value: unknown): Promise<void> {
    if (!this._available) return;

    try {
      const content = typeof value === 'string' ? value : JSON.stringify(value);
      await this.service.addMemory(content, {
        labels: ['knowledge-store'],
      });
    } catch {
      // graceful degradation
    }
  }

  async addToLibrary(paths: string[]): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    if (!this._available) return [];

    try {
      const artifacts = await this.service.addToLibrary(paths);
      return artifacts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        summary: a.summary,
      }));
    } catch {
      return [];
    }
  }

  async searchLibrary(query: string, options?: { limit?: number }): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    if (!this._available) return [];

    try {
      const artifacts = await this.service.searchLibrary(query, options);
      return artifacts.map((a) => ({
        id: a.id,
        name: a.name,
        type: a.type,
        summary: a.summary,
      }));
    } catch {
      return [];
    }
  }

  /** Sync temporal state to Nowledge Mem: update current, delete superseded */
  async temporalSync(entityId: string, currentContent: string, supersededIds: string[]): Promise<void> {
    if (!this._available) return;

    try {
      // Update or add the current valid state
      await this.service.addMemory(currentContent, {
        labels: ['temporal-current', entityId],
        importance: 0.7,
      });

      // Delete superseded entries from Nowledge Mem
      for (const id of supersededIds) {
        try {
          await this.service.deleteMemory(id);
        } catch {
          // individual delete failures are non-critical
        }
      }
    } catch {
      // temporal sync failure is non-critical
    }
  }

  /** Filter out superseded memories from Nowledge Mem results */
  filterSuperseded(memories: Array<{ id: string; labels?: string[] }>, supersededIds: Set<string>): Array<{ id: string; labels?: string[] }> {
    return memories.filter((m) => !supersededIds.has(m.id));
  }
}