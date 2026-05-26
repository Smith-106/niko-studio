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

export class CompositeKnowledgeMemoryBridge implements KnowledgeMemoryEngineAdapter {
  private primary: KnowledgeMemoryEngineAdapter;
  private secondary?: KnowledgeMemoryEngineAdapter;

  constructor(
    primary: KnowledgeMemoryEngineAdapter,
    secondary?: KnowledgeMemoryEngineAdapter,
  ) {
    this.primary = primary;
    this.secondary = secondary;
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
    const primaryResult = await this.primary.add?.(params) ?? {};

    if (this.secondary?.add) {
      try {
        const secondaryResult = await this.secondary.add(params);
        return { ...primaryResult, ...secondaryResult };
      } catch {
        // secondary failure is non-critical
      }
    }

    return primaryResult;
  }

  async store(key: string, value: unknown): Promise<void> {
    await this.primary.store?.(key, value);

    if (this.secondary?.store) {
      try {
        await this.secondary.store(key, value);
      } catch {
        // secondary failure is non-critical
      }
    }
  }

  async addToLibrary(paths: string[]): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    const primaryResult = await this.primary.addToLibrary?.(paths) ?? [];

    if (this.secondary?.addToLibrary) {
      try {
        const secondaryResult = await this.secondary.addToLibrary(paths);
        const primaryIds = new Set(primaryResult.map((a) => a.id));
        const merged = [...primaryResult, ...secondaryResult.filter((a) => !primaryIds.has(a.id))];
        return merged;
      } catch {
        // secondary failure is non-critical
      }
    }

    return primaryResult;
  }

  async searchLibrary(query: string, options?: { limit?: number }): Promise<Array<{ id: string; name: string; type: string; summary?: string }>> {
    const primaryResult = await this.primary.searchLibrary?.(query, options) ?? [];

    if (this.secondary?.searchLibrary) {
      try {
        const secondaryResult = await this.secondary.searchLibrary(query, options);
        const primaryIds = new Set(primaryResult.map((a) => a.id));
        const merged = [...primaryResult, ...secondaryResult.filter((a) => !primaryIds.has(a.id))];
        return merged;
      } catch {
        // secondary failure is non-critical
      }
    }

    return primaryResult;
  }
}