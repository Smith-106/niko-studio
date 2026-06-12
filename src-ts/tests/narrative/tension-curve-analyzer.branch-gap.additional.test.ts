import { describe, expect, it, vi } from 'vitest';

import {
  TensionCurveAnalyzer,
  TensionLevel,
  TensionPoint,
} from '../../narrative/analyzers/tension-curve-analyzer';

describe('narrative/tension-curve-analyzer branch-gap coverage', () => {
  it('falls back to default llm fields and builds an empty curve when llm omits points entirely', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({}),
    };
    const analyzer = new TensionCurveAnalyzer(llmClient as never);

    const result = await analyzer.analyze('');

    expect(llmClient.generateJson).toHaveBeenCalledTimes(1);
    expect(result.metadata['analysis_source']).toBe('llm');
    expect(result.metadata['overall_pattern']).toBe('unknown');
    expect(result.summary).toContain('未检测到');
    expect(result.items[0]?.points).toEqual([]);
    expect(result.items[0]?.climaxPosition).toBeNull();
  });

  it('uses llm fallbacks for missing point fields and skips blank quick-analyze segments', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        points: [
          {},
          { level: 4, description: undefined },
          { position: 7, point_type: undefined, level: 2 },
        ],
        summary: undefined,
        overall_pattern: undefined,
      }),
    };
    const analyzer = new TensionCurveAnalyzer(llmClient as never);

    const result = await analyzer.analyze('first。\n\n   \n\nsecond');

    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.metadata['overall_pattern']).toBe('unknown');
    expect(result.items[0]?.points[0]).toMatchObject({
      position: 0,
      score: 0.6,
    });
    expect(result.items[0]?.points[1]).toMatchObject({
      position: 1,
      score: 0.8,
    });
    expect(result.items[0]?.points[2]).toMatchObject({
      position: 7,
      score: 0.4,
    });
  });

  it('returns unknown tension pattern when quickAnalyze produces no items', () => {
    const analyzer = new TensionCurveAnalyzer();
    vi.spyOn(analyzer, 'quickAnalyze').mockReturnValue({
      items: [],
    } as never);

    expect(analyzer.getTensionPattern('ignored')).toBe('unknown');
  });

  it('serializes empty point content as an empty string', () => {
    const point = new TensionPoint(0, TensionLevel.MEDIUM, undefined, '');

    expect(point.toDict()).toMatchObject({
      content: '',
    });
  });
});
