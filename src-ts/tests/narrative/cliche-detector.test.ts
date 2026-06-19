import { describe, expect, it } from 'vitest';

import { ClicheDetector } from '../../narrative/evaluators/cliche-detector';
import { WebNovelGenre } from '../../narrative/writing-craft/genre-templates';

describe('narrative/evaluators/cliche-detector', () => {
  it('exposes public metadata getters', () => {
    const detector = new ClicheDetector();

    expect(detector.name).toContain('陈词滥调');
    expect(detector.description).toContain('检测文本中的陈词滥调');
    expect(detector.relatedSkill).toBe('script-doctor');
  });

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

  it('returns an empty genre result when the genre template is unknown', () => {
    const detector = new ClicheDetector();

    const result = detector.detectGenreCliches(
      '这是一段正常文本，没有任何类型套板。',
      'unknown-genre' as WebNovelGenre,
    );

    expect(result).toEqual({
      genre: 'unknown-genre',
      foundCliches: [],
      genreScore: 100,
    });
  });
});
