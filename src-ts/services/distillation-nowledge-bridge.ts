/**
 * DistillationNowledgeBridge
 *
 * Bridges DistillationService results to Nowledge Mem's summarizeMemories.
 * When distillation produces insights, the bridge:
 * 1. Persists the distilled content as a Nowledge Mem memory
 * 2. Optionally calls summarizeMemories to create a higher-order summary
 * 3. Creates graph relations linking the summary to source memories
 *
 * Gracefully degrades when Nowledge Mem is unavailable.
 */

import type { INowledgeMemService, NowledgeMemRelationType, NowledgeMemEvolvesKind } from '../protocols/nowledge-mem';
import type { DistillationResult } from './distill-service';

export interface DistillationNowledgeBridgeConfig {
  /** Auto-summarize after N distillation results accumulate (default: 5) */
  autoSummarizeThreshold?: number;
  /** Create graph relations between summary and sources (default: true) */
  linkToSources?: boolean;
}

export class DistillationNowledgeBridge {
  private service: INowledgeMemService;
  private config: Required<DistillationNowledgeBridgeConfig>;
  private _available = false;
  private _pendingIds: string[] = [];
  private _distilledMemoryIds: string[] = [];

  constructor(service: INowledgeMemService, config?: DistillationNowledgeBridgeConfig) {
    this.service = service;
    this.config = {
      autoSummarizeThreshold: config?.autoSummarizeThreshold ?? 5,
      linkToSources: config?.linkToSources ?? true,
    };
  }

  async initialize(): Promise<void> {
    try {
      const status = await this.service.status();
      this._available = status.connected;
    } catch {
      this._available = false;
    }
  }

  /** Persist a distillation result to Nowledge Mem */
  async persistDistillation(result: DistillationResult): Promise<string | null> {
    if (!this._available) return null;

    try {
      const memory = await this.service.addMemory(result.content, {
        labels: ['distillation', result.template, ...result.sourceIds.map((id) => `source:${id}`)],
        importance: 0.8,
      });

      this._distilledMemoryIds.push(memory.id);
      this._pendingIds.push(memory.id);

      if (this.config.linkToSources && result.sourceIds.length > 0) {
        await this.linkToSourceMemories(memory.id, result.sourceIds);
      }

      if (this._pendingIds.length >= this.config.autoSummarizeThreshold) {
        await this.autoSummarize();
      }

      return memory.id;
    } catch {
      return null;
    }
  }

  /** Create graph relations linking distilled memory to source memories */
  async linkToSourceMemories(distilledMemoryId: string, sourceIds: string[]): Promise<void> {
    if (!this._available) return;

    for (const sourceId of sourceIds) {
      try {
        await this.service.createRelation(distilledMemoryId, sourceId, { type: 'DISTILLED_FROM' as NowledgeMemRelationType });
      } catch {
        // individual relation failures are non-critical
      }
    }
  }

  /** Auto-summarize accumulated distillation memories */
  async autoSummarize(): Promise<string | null> {
    if (!this._available || this._pendingIds.length === 0) return null;

    try {
      const ids = [...this._pendingIds];
      const summaryId = await this.service.summarizeMemories(ids);

      // Create relations from summary to each distilled memory
      if (this.config.linkToSources) {
        for (const id of ids) {
          try {
            await this.service.createRelation(summaryId, id, { type: 'SUMMARIZES' as NowledgeMemRelationType });
          } catch {
            // non-critical
          }
        }
      }

      this._pendingIds = [];
      return summaryId;
    } catch {
      return null;
    }
  }

  /** Get all distilled memory IDs persisted so far */
  getDistilledMemoryIds(): string[] {
    return [...this._distilledMemoryIds];
  }

  /** Get count of pending memories awaiting auto-summarization */
  getPendingCount(): number {
    return this._pendingIds.length;
  }
}