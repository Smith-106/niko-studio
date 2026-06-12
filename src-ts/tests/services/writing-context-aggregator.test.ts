import { describe, expect, it, vi } from 'vitest';

import { EntityType } from '../../graph/graph-manager.js';
import { DimensionType } from '../../memory/six-dimensional-memory.js';
import { aggregateWritingContext } from '../../services/writing-context-aggregator.js';

describe('services/writing-context-aggregator', () => {
  it('aggregates engine, bridge, quality, and memory-store data when the bridge is online', async () => {
    const engine = {
      queryEntities: vi.fn().mockResolvedValue([
        { id: 'char-1', type: EntityType.CHARACTER, name: 'Alice', description: 'Lead', tags: ['hero'] },
      ]),
      getPendingForeshadows: vi.fn().mockResolvedValue([
        { foreshadowId: 'f-1', hint: 'bell toll', urgency: 'due' },
      ]),
      generateQualityReport: vi.fn().mockResolvedValue({
        overall: 62,
        suggestions: ['tighten pacing'],
      }),
      memoryStore: {
        getRecentMemories: vi.fn().mockResolvedValue([
          { dimension: DimensionType.CHARACTER, content: 'Alice hides the key.', importance: 0.9 },
          { content: 'Default dimension memory' },
        ]),
      },
    };
    const bridge = {
      isOnline: vi.fn().mockReturnValue(true),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: true }),
      pullContradictions: vi.fn().mockResolvedValue([
        { description: 'Two timelines disagree.' },
      ]),
      api: {
        listCrystals: vi.fn().mockResolvedValue([
          { slug: 'atlas', title: 'Atlas', tags: ['world'] },
          { id: 'fallback', name: 'Fallback Crystal' },
        ]),
      },
    };

    const result = await aggregateWritingContext(
      engine as never,
      bridge as never,
      5,
      'x'.repeat(60),
    );

    expect(engine.queryEntities).toHaveBeenCalledWith({});
    expect(engine.getPendingForeshadows).toHaveBeenCalledWith(5);
    expect(bridge.getSyncStatus).toHaveBeenCalledTimes(1);
    expect(bridge.api.listCrystals).toHaveBeenCalledTimes(1);
    expect(bridge.pullContradictions).toHaveBeenCalledTimes(1);
    expect(engine.generateQualityReport).toHaveBeenCalledWith('x'.repeat(60));
    expect(engine.memoryStore.getRecentMemories).toHaveBeenCalledWith({ limit: 15 });
    expect(result).toEqual({
      entities: [
        { id: 'char-1', type: EntityType.CHARACTER, name: 'Alice', description: 'Lead', tags: ['hero'] },
      ],
      recentMemories: [
        { dimension: DimensionType.CHARACTER, content: 'Alice hides the key.', importance: 0.9 },
        { dimension: DimensionType.CONTEXT, content: 'Default dimension memory', importance: 0.5 },
      ],
      pendingForeshadows: [
        { foreshadowId: 'f-1', hint: 'bell toll', urgency: 'due' },
      ],
      crystalPages: [
        { slug: 'atlas', title: 'Atlas', tags: ['world'] },
        { slug: 'fallback', title: 'Fallback Crystal', tags: [] },
      ],
      contradictions: [
        { description: 'Two timelines disagree.' },
      ],
      lastQualityScore: 62,
      suggestions: ['tighten pacing'],
    });
  });

  it('degrades gracefully when engine calls fail, the bridge is offline, or quality analysis is skipped', async () => {
    const engine = {
      queryEntities: vi.fn().mockRejectedValue(new Error('entities unavailable')),
      getPendingForeshadows: vi.fn().mockRejectedValue(new Error('foreshadows unavailable')),
      generateQualityReport: vi.fn(),
    };
    const bridge = {
      isOnline: vi.fn().mockReturnValue(false),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: false }),
      pullContradictions: vi.fn(),
      api: {
        listCrystals: vi.fn(),
      },
    };

    const result = await aggregateWritingContext(
      engine as never,
      bridge as never,
      2,
      'short text',
    );

    expect(bridge.api.listCrystals).not.toHaveBeenCalled();
    expect(bridge.pullContradictions).not.toHaveBeenCalled();
    expect(engine.generateQualityReport).not.toHaveBeenCalled();
    expect(result).toEqual({
      entities: [],
      recentMemories: [],
      pendingForeshadows: [],
      crystalPages: [],
      contradictions: [],
      lastQualityScore: null,
      suggestions: [],
    });
  });

  it('skips quality analysis entirely when lastText is omitted', async () => {
    const engine = {
      queryEntities: vi.fn().mockResolvedValue([]),
      getPendingForeshadows: vi.fn().mockResolvedValue([]),
      generateQualityReport: vi.fn(),
    };
    const bridge = {
      isOnline: vi.fn().mockReturnValue(false),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: false }),
      pullContradictions: vi.fn(),
      api: {
        listCrystals: vi.fn(),
      },
    };

    const result = await aggregateWritingContext(
      engine as never,
      bridge as never,
      4,
    );

    expect(engine.generateQualityReport).not.toHaveBeenCalled();
    expect(result.lastQualityScore).toBeNull();
    expect(result.suggestions).toEqual([]);
  });

  it('falls back when the online bridge has no crystal API and quality analysis fails', async () => {
    const engine = {
      queryEntities: vi.fn().mockResolvedValue([]),
      getPendingForeshadows: vi.fn().mockResolvedValue([]),
      generateQualityReport: vi.fn().mockRejectedValue(new Error('quality unavailable')),
    };
    const bridge = {
      isOnline: vi.fn().mockReturnValue(true),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: true }),
      pullContradictions: vi.fn().mockRejectedValue(new Error('contradictions unavailable')),
    };

    const result = await aggregateWritingContext(
      engine as never,
      bridge as never,
      9,
      'x'.repeat(90),
    );

    expect(engine.generateQualityReport).toHaveBeenCalledWith('x'.repeat(90));
    expect(bridge.pullContradictions).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      entities: [],
      recentMemories: [],
      pendingForeshadows: [],
      crystalPages: [],
      contradictions: [],
      lastQualityScore: null,
      suggestions: [],
    });
  });
});
