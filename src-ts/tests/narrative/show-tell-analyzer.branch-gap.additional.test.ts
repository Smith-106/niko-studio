import { afterEach, describe, expect, it, vi } from 'vitest';

describe('Show vs Tell Analyzer branch-gap coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('falls back to zero sensory coverage when density inputs are non-finite', async () => {
    const finiteSpy = vi.spyOn(Number, 'isFinite').mockReturnValue(false);
    const { analyzeShowTell } = await import('../../narrative/show-tell-analyzer');

    const result = analyzeShowTell('看到了明亮的火光，也听到低语。');

    expect(finiteSpy).toHaveBeenCalled();
    expect(result.sensoryCoverage).toMatchObject({
      visual: 0,
      auditory: 0,
      tactile: 0,
      olfactory: 0,
      gustatory: 0,
      overall: 0,
    });
  });

  it('uses zero fallbacks when sensory score entries are missing', async () => {
    const originalMap = Array.prototype.map;
    vi.spyOn(Array.prototype, 'map').mockImplementation(function (callback, thisArg) {
      if (
        Array.isArray(this) &&
        this.length === 5 &&
        this[0] === 'visual' &&
        this[1] === 'auditory' &&
        this[2] === 'tactile' &&
        this[3] === 'olfactory' &&
        this[4] === 'gustatory'
      ) {
        return [];
      }
      return originalMap.call(this, callback as never, thisArg);
    });

    const { analyzeShowTell } = await import('../../narrative/show-tell-analyzer');
    const result = analyzeShowTell('任意文本');

    expect(result.sensoryCoverage).toEqual({
      visual: 0,
      auditory: 0,
      tactile: 0,
      olfactory: 0,
      gustatory: 0,
      overall: 0,
    });
  });

  it('emits the medium show-ratio guidance when show beats tell but remains below half', async () => {
    const { analyzeShowTell } = await import('../../narrative/show-tell-analyzer');
    const result = analyzeShowTell('紧握拳头。很生气。很难过。');

    expect(result.showTellRatio).toBeGreaterThanOrEqual(0.3);
    expect(result.showTellRatio).toBeLessThan(0.5);
    expect(result.suggestions.some((entry) => entry.includes('展示比例偏低'))).toBe(true);
  });
});
