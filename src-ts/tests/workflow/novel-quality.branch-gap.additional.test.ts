import { describe, expect, it } from 'vitest';

import { evaluateNovelQuality } from '../../workflow/novel-quality.js';

describe('workflow/novel-quality branch-gap coverage', () => {
  it('treats null content as empty input through the public API', () => {
    const result = evaluateNovelQuality(null as unknown as string, {
      qualityLevel: 'high',
      qualityMode: 'auto',
    });

    expect(result).toMatchObject({
      quality_score: 0,
      publish_recommendation: 'block',
      metrics: {
        quality_level_used: 'high',
        quality_mode_used: 'auto',
      },
    });
  });

  it('handles punctuation-only content by rebuilding sentences and using zero word-count fallback', () => {
    const result = evaluateNovelQuality('...', {
      criticalGateAlwaysOn: false,
    });

    expect(result.metrics).toMatchObject({
      dialogue_ratio: 0,
      conflict_points: 0,
      visual_details: 0,
    });
    expect(result.quality_score).toBeGreaterThanOrEqual(0);
    expect(['pass', 'revise', 'block']).toContain(result.publish_recommendation);
  });
});
