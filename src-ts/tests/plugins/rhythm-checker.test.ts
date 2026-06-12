import { describe, expect, it } from 'vitest';

import { rhythmChecker } from '../../plugins/builtins/rhythm-checker.js';

describe('plugins/builtins/rhythm-checker', () => {
  it('returns the empty result for blank text', () => {
    const result = rhythmChecker.detect(' \n\n ');

    expect(result.score).toBe(0);
    expect(result.evidence).toEqual([]);
    expect(result.suggestions.length).toBe(1);
    expect(result.details).toEqual({});
  });

  it('flags low paragraph-length variation', () => {
    const text = [
      'abcdefghij',
      'klmnopqrst',
      'uvwxyz1234',
    ].join('\n');

    const result = rhythmChecker.detect(text);

    expect(result.score).toBeGreaterThan(0);
    expect(result.details).toMatchObject({
      avgLength: 10,
      paragraphCount: 3,
    });
    expect(Number(result.details['variationRatio'])).toBeLessThan(0.3);
    expect(result.evidence.length).toBe(1);
    expect(result.suggestions.length).toBeGreaterThan(0);
  });

  it('flags overly volatile paragraph-length variation and short-paragraph overuse', () => {
    const text = [
      'a',
      'bb',
      'ccc',
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
    ].join('\n');

    const result = rhythmChecker.detect(text);

    expect(Number(result.details['variationRatio'])).toBeGreaterThan(0.8);
    expect(result.evidence.length).toBe(1);
    expect(result.suggestions.length).toBeGreaterThan(1);
  });

  it('warns when most paragraphs are too long even if overall variation remains analyzable', () => {
    const text = [
      'a'.repeat(100),
      'b'.repeat(100),
      'c'.repeat(100),
      'd',
      'e',
    ].join('\n');

    const result = rhythmChecker.detect(text);

    expect(result.suggestions).toContain('长段落过多，适当拆分提升阅读节奏');
  });

  it('treats moderate variation as healthy rhythm without extra warnings', () => {
    const text = [
      'abcdefghij',
      'abcdefghijklmnopq',
      'abcdefghijklmnopqrstuvwxyz',
    ].join('\n');

    const result = rhythmChecker.detect(text);
    const variationRatio = Number(result.details['variationRatio']);

    expect(variationRatio).toBeGreaterThanOrEqual(0.3);
    expect(variationRatio).toBeLessThanOrEqual(0.8);
    expect(result.suggestions).toEqual([]);
    expect(result.maxScore).toBe(10);
  });
});
