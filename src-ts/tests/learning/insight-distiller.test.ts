import { describe, expect, it } from 'vitest';

import { distillInsights } from '../../learning/insight-distiller';
import type { Insight } from '../../learning/learning-types';

function makeInsight(overrides: Partial<Insight> = {}): Insight {
  return {
    content: '剑道在于心中对正义的执着',
    source: 'test-book',
    tags: ['philosophy', 'sword'],
    confidence: 0.85,
    ...overrides,
  };
}

describe('insight-distiller', () => {
  it('produces 6 stages per insight', () => {
    const insights = [makeInsight()];
    const distilled = distillInsights(insights);
    expect(distilled.length).toBe(6);

    const stages = distilled.map(d => d.stage);
    expect(stages).toEqual(['capture', 'annotate', 'connect', 'question', 'synthesize', 'distill']);
  });

  it('capture stage preserves original content', () => {
    const distilled = distillInsights([makeInsight()]);
    expect(distilled[0].stage).toBe('capture');
    expect(distilled[0].content).toBe('剑道在于心中对正义的执着');
  });

  it('annotate stage includes tags', () => {
    const distilled = distillInsights([makeInsight({ tags: ['philosophy'] })]);
    expect(distilled[1].content).toContain('philosophy');
  });

  it('connect stage includes chapter when present', () => {
    const distilled = distillInsights([makeInsight({ chapter: 'ch3' })]);
    expect(distilled[2].content).toContain('ch3');
  });

  it('connect stage falls back to source without chapter', () => {
    const distilled = distillInsights([makeInsight({ chapter: undefined })]);
    expect(distilled[2].content).toContain('test-book');
  });

  it('question stage poses reflection prompt', () => {
    const distilled = distillInsights([makeInsight()]);
    expect(distilled[3].content).toContain('值得思考');
  });

  it('distill stage truncates long content', () => {
    const longContent = 'A'.repeat(300);
    const distilled = distillInsights([makeInsight({ content: longContent })]);
    const distillResult = distilled[5];
    expect(distillResult.content.length).toBeLessThanOrEqual(203);
  });

  it('handles multiple insights', () => {
    const insights = [makeInsight(), makeInsight({ content: '第二条见解' })];
    const distilled = distillInsights(insights);
    expect(distilled.length).toBe(12);
  });

  it('handles empty insights', () => {
    expect(distillInsights([])).toEqual([]);
  });
});
