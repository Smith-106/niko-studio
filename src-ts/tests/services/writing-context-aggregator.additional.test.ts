import { describe, expect, it, vi } from 'vitest';

import { aggregateWritingContext } from '../../services/writing-context-aggregator.js';

describe('services/writing-context-aggregator additional coverage', () => {
  it('falls back to empty crystal pages when the online bridge returns a non-array crystal payload', async () => {
    const engine = {
      queryEntities: vi.fn().mockResolvedValue([]),
      getPendingForeshadows: vi.fn().mockResolvedValue([]),
      generateQualityReport: vi.fn(),
    };
    const bridge = {
      isOnline: vi.fn().mockReturnValue(true),
      getSyncStatus: vi.fn().mockReturnValue({ knowledgeLayerOnline: true }),
      pullContradictions: vi.fn().mockResolvedValue([]),
      api: {
        listCrystals: vi.fn().mockResolvedValue({ items: [] }),
      },
    };

    const result = await aggregateWritingContext(
      engine as never,
      bridge as never,
      7,
    );

    expect(engine.generateQualityReport).not.toHaveBeenCalled();
    expect(bridge.api.listCrystals).toHaveBeenCalledTimes(1);
    expect(result.crystalPages).toEqual([]);
    expect(result.contradictions).toEqual([]);
  });
});
