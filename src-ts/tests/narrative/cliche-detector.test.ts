import { describe, expect, it } from 'vitest';

import { ClicheDetector } from '../../narrative/evaluators/cliche-detector';

describe('narrative/evaluators/cliche-detector', () => {
  it('quickScan returns a stable cliche score envelope', () => {
    const detector = new ClicheDetector();

    const result = detector.quickScan('闹钟响起，她从梦中醒来。突然，一切都变了。');

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.level).toBeTruthy();
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.summary).toContain('快速');
  });

  it('evaluate returns issue and metrics envelopes for bounded cliche-heavy inputs', async () => {
    const detector = new ClicheDetector();

    const result = await detector.evaluate(
      '闹钟响起，她从梦中醒来。又是新的一天。后来因为误会分手，还遭遇车祸。她说：“我们需要谈谈。”',
      { is_opening: true },
    );

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.issues)).toBe(true);
    expect(result.metrics).toMatchObject({
      cliche_count: expect.any(Number),
      total_cliche_occurrences: expect.any(Number),
    });
    expect(result.summary).toContain('陈词滥调');
  });
});
