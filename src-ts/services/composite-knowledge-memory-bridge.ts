/**
 * CompositeKnowledgeMemoryBridge
 *
 * Composites two KnowledgeMemoryEngineAdapter instances:
 * - primary: always active (e.g., UnifiedMemoryEngine adapter)
 * - secondary: optional bridge (e.g., Nowledge Mem)
 *
 * Both engines receive add/store calls. If secondary is unavailable,
 * it silently degrades — primary always persists.
 */

import type { KnowledgeMemoryEngineAdapter } from '../protocols/knowledge';
import type { NowledgeMemKnowledgeBridge } from './nowledge-mem-knowledge-bridge.js';

export interface BridgeComponentHealth {
  available: boolean;
  latencyMs?: number;
  error?: string;
}

export interface BridgeHealth {
  status: 'healthy' | 'degraded' | 'down';
  primary: BridgeComponentHealth;
  secondary: BridgeComponentHealth;
  lastCheck: string;
}

export interface BridgeMetrics {
  writes: { primary: number; secondary: number; failures: number };
  reads: { primary: number; secondary: number; fallbacks: number };
  latency: { primaryMs: number; secondaryMs: number };
}

export class CompositeKnowledgeMemoryBridge implements KnowledgeMemoryEngineAdapter {
  private primary: KnowledgeMemoryEngineAdapter;
  private secondary?: KnowledgeMemoryEngineAdapter;
  private _metrics: BridgeMetrics;

  constructor(
    primary: KnowledgeMemoryEngineAdapter,
    secondary?: KnowledgeMemoryEngineAdapter,
  ) {
    this.primary = primary;
    this.secondary = secondary;
    this._metrics = {
      writes: { primary: 0, secondary: 0, failures: 0 },
      reads: { primary: 0, secondary: 0, fallbacks: 0 },
      latency: { primaryMs: 0, secondaryMs: 0 },
    };
  }

  async initialize(): Promise<void> {
    await this.primary.initialize();
    if (this.secondary) {
      try {
        await this.secondary.initialize();
      } catch {
        // secondary unavailability is non-critical
      }
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
    this._metrics.writes.primary++;
    const primaryResult = await this.primary.add?.(params) ?? {};

    if (this.secondary?.add) {
      try {
        this._metrics.writes.secondary++;
        const secondaryResult = await this.secondary.add(params);
        return { ...primaryResult, ...secondaryResult };
      } catch {
        this._metrics.writes.failures++;
      }
    }

    return primaryResult;
  }

  async store(key: string, value: unknown): Promise<void> {
    this._metrics.writes.primary++;
    await this.primary.store?.(key, value);

    if (this.secondary?.store) {
      try {
        this._metrics.writes.secondary++;
        await this.secondary.store(key, value);
      } catch {
        this._metrics.writes.failures++;
      }
    }
  }

  async addToLibrary(paths: string[]): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    this._metrics.writes.primary++;
    const primaryResult = await this.primary.addToLibrary?.(paths) ?? [];

    if (this.secondary?.addToLibrary) {
      try {
        this._metrics.writes.secondary++;
        const secondaryResult = await this.secondary.addToLibrary(paths);
        const primaryIds = new Set(primaryResult.map((a) => a.id));
        const merged = [...primaryResult, ...secondaryResult.filter((a) => !primaryIds.has(a.id))];
        return merged;
      } catch {
        this._metrics.writes.failures++;
      }
    }

    return primaryResult;
  }

  async searchLibrary(query: string, options?: { limit?: number }): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    this._metrics.reads.primary++;
    const primaryResult = await this.primary.searchLibrary?.(query, options) ?? [];

    if (this.secondary?.searchLibrary) {
      try {
        this._metrics.reads.secondary++;
        const secondaryResult = await this.secondary.searchLibrary(query, options);
        const primaryIds = new Set(primaryResult.map((a) => a.id));
        const merged = [...primaryResult, ...secondaryResult.filter((a) => !primaryIds.has(a.id))];
        return merged;
      } catch {
        this._metrics.reads.fallbacks++;
      }
    }

    return primaryResult;
  }

  async healthCheck(): Promise<BridgeHealth> {
    const now = new Date().toISOString();
    const primaryStart = Date.now();
    let primaryAvailable = false;
    let primaryError: string | undefined;
    try {
      await this.primary.initialize();
      primaryAvailable = true;
    } catch (e: unknown) {
      primaryError = (e as Error).message;
    }
    const primaryLatency = Date.now() - primaryStart;

    const secondaryStart = Date.now();
    let secondaryAvailable = false;
    let secondaryError: string | undefined;
    if (this.secondary) {
      try {
        await this.secondary.initialize();
        secondaryAvailable = true;
      } catch (e: unknown) {
        secondaryError = (e as Error).message;
      }
    }
    const secondaryLatency = Date.now() - secondaryStart;

    const status: BridgeHealth['status'] = primaryAvailable && (secondaryAvailable || !this.secondary)
      ? 'healthy'
      : primaryAvailable && this.secondary && !secondaryAvailable
        ? 'degraded'
        : 'down';

    return {
      status,
      primary: { available: primaryAvailable, latencyMs: primaryLatency, error: primaryError },
      secondary: { available: secondaryAvailable, latencyMs: secondaryLatency, error: secondaryError },
      lastCheck: now,
    };
  }

  getMetrics(): BridgeMetrics {
    const m = this._metrics;
    return {
      writes: { ...m.writes },
      reads: { ...m.reads },
      latency: { ...m.latency },
    };
  }

  resetMetrics(): void {
    this._metrics = {
      writes: { primary: 0, secondary: 0, failures: 0 },
      reads: { primary: 0, secondary: 0, fallbacks: 0 },
      latency: { primaryMs: 0, secondaryMs: 0 },
    };
  }
}