import { describe, expect, it, vi } from 'vitest';

import {
  CharacterStateAnalyzer,
} from '../../narrative/analyzers/character-state-analyzer';

describe('CharacterStateAnalyzer branch-gap coverage', () => {
  it('falls back to quick analysis when the llm payload omits states entirely', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        summary: 'llm omitted states',
      }),
    };
    const analyzer = new CharacterStateAnalyzer(llmClient as never);

    const result = await analyzer.analyze('她决定行动，但是仍然担心后果。');

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.metadata['analysis_source']).toBeUndefined();
    expect(result.metadata['segment_count']).toBeGreaterThan(0);
  });

  it('fills missing llm state fields with safe defaults and builds a fallback summary', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        states: [{}],
      }),
    };
    const analyzer = new CharacterStateAnalyzer(llmClient as never);

    const result = await analyzer.analyze('plain input still accepts llm output');

    expect(result.metadata['analysis_source']).toBe('llm');
    expect(result.count).toBe(1);
    expect(result.items[0]?.position).toBe(0);
    expect(result.items[0]?.content).toBe('');
    expect(result.items[0]?.emotions).toEqual([]);
    expect(result.items[0]?.goals).toEqual([]);
    expect(result.items[0]?.conflicts).toEqual([]);
    expect(result.items[0]?.agencyScore).toBe(0);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('returns no dominant emotions when quick analysis metadata omits the distribution map', () => {
    const analyzer = new CharacterStateAnalyzer();
    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValue({
      metadata: {},
    } as never);

    expect(analyzer.getDominantEmotions('unused')).toEqual([]);
  });

  it('returns no dominant emotions when every distribution bucket is zero', () => {
    const analyzer = new CharacterStateAnalyzer();
    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValue({
      metadata: {
        emotion_distribution: {
          positive: 0,
          negative: 0,
          neutral: 0,
        },
      },
    } as never);

    expect(analyzer.getDominantEmotions('unused')).toEqual([]);
  });

  it('segments multi-paragraph content before falling back to sentence splitting', () => {
    const analyzer = new CharacterStateAnalyzer();

    const result = analyzer.quickAnalyze([
      '她害怕失败，但是决定继续行动。',
      '她平静观察四周，准备下一步计划。',
    ].join('\n\n'));

    expect(result.metadata['segment_count']).toBe(2);
    expect(result.count).toBe(2);
  });
});
