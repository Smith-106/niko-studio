/**
 * ConflictNowledgeBridge
 *
 * Syncs conflict resolution results bidirectionally:
 * - Forward: When ConflictResolver marks memories obsolete, delete them from Nowledge Mem
 * - Reverse: Detect conflicts from Nowledge Mem search results that primary missed
 *
 * Gracefully degrades when Nowledge Mem is unavailable.
 */

import type { INowledgeMemService } from '../protocols/nowledge-mem';
import type { ResolutionResult } from '../memory/conflict-resolver.js';

export class ConflictNowledgeBridge {
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

  /** Forward sync: propagate resolution result to Nowledge Mem */
  async syncResolution(result: ResolutionResult): Promise<void> {
    if (!this._available) return;

    try {
      // Delete obsolete memories from Nowledge Mem
      for (const id of result.obsoleteIds) {
        try {
          await this.service.deleteMemory(id);
        } catch {
          // individual delete failures are non-critical
        }
      }

      // If merge produced new content, add it to Nowledge Mem
      if (result.action === 'merge' && result.mergedContent) {
        try {
          await this.service.addMemory(result.mergedContent, {
            labels: ['conflict-merge'],
            importance: 0.7,
          });
        } catch {
          // non-critical
        }
      }
    } catch {
      // overall sync failure is non-critical
    }
  }

  /** Reverse sync: detect conflicts from Nowledge Mem that primary may have missed */
  async detectReverseConflicts(
    primaryContent: string,
    entityId: string,
  ): Promise<Array<{ id: string; content: string; similarityScore: number }>> {
    if (!this._available) return [];

    try {
      const searchResult = await this.service.searchMemories(primaryContent, {
        labels: ['conflict-merge', entityId],
        limit: 10,
      });

      return searchResult.memories.map((m) => ({
        id: m.id,
        content: m.content,
        similarityScore: 0.5,
      }));
    } catch {
      return [];
    }
  }
}