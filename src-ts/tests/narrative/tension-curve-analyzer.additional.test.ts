import { describe, expect, it, vi } from 'vitest';

import {
  PointType,
  TensionCurve,
  TensionCurveAnalyzer,
  TensionLevel,
  TensionPoint,
} from '../../narrative/analyzers/tension-curve-analyzer';

describe('TensionCurveAnalyzer additional coverage', () => {
  it('serializes tension points and curves and exposes the analyzer description', () => {
    const point = new TensionPoint(
      2,
      TensionLevel.HIGH,
      PointType.PEAK,
      'A'.repeat(120),
      ['紧张', '危机'],
      0.8,
    );
    const curve = new TensionCurve([point], [0], [], [0], 0, 0.8, 0.12);
    const analyzer = new TensionCurveAnalyzer();

    expect(point.toDict()).toEqual({
      position: 2,
      level: TensionLevel.HIGH,
      point_type: PointType.PEAK,
      content: 'A'.repeat(100),
      indicators: ['紧张', '危机'],
      score: 0.8,
    });
    expect(curve.toDict()).toEqual({
      point_count: 1,
      peaks: [0],
      valleys: [],
      turning_points: [0],
      climax_position: 0,
      average_tension: 0.8,
      variance: 0.12,
      points: [point.toDict()],
    });
    expect(analyzer.description).toContain('情节张力');
  });

  it('continues past invalid llm points and falls back to rule-based points when sparse', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        points: [
          { position: 0, level: 9, point_type: 'normal', description: 'invalid level' },
          { position: 1, level: 3, point_type: 'mystery', description: 'invalid type' },
          { position: 2, level: 4, point_type: 'peak', description: 'valid point' },
        ],
        climax_position: 2,
        overall_pattern: 'building',
        summary: 'LLM mixed summary',
      }),
    };
    const analyzer = new TensionCurveAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '平静的开端。\n\n紧张升级。\n\n危险逼近。\n\n最终高潮爆发。',
    );

    expect(llmClient.generateJson).toHaveBeenCalledTimes(1);
    expect(result.summary).toBe('LLM mixed summary');
    expect(result.metadata['analysis_source']).toBe('llm');
    expect(result.items[0].points.length).toBeGreaterThanOrEqual(4);
    expect(result.items[0].climaxPosition).toBe(2);
  });

  it('segments paragraph-heavy text in quickAnalyze', () => {
    const analyzer = new TensionCurveAnalyzer();

    const result = analyzer.quickAnalyze(
      '第一段很平静。\n\n第二段开始紧张。\n\n第三段突然转折。\n\n第四段进入高潮。',
    );

    expect(result.metadata['segment_count']).toBe(4);
    expect(result.items[0].points.length).toBe(4);
  });

  it('delegates analyze to quickAnalyze when no llm client is configured', async () => {
    const analyzer = new TensionCurveAnalyzer();
    const quickResult = analyzer.quickAnalyze('平静。危机升级。最终高潮爆发。');
    const quickSpy = vi.spyOn(analyzer, 'quickAnalyze').mockReturnValue(quickResult);

    const result = await analyzer.analyze('平静。危机升级。最终高潮爆发。');

    expect(quickSpy).toHaveBeenCalledWith('平静。危机升级。最终高潮爆发。');
    expect(result).toBe(quickResult);
  });

  it('covers all tension pattern branches', () => {
    const analyzer = new TensionCurveAnalyzer();
    const quickAnalyzeSpy = vi.spyOn(analyzer, 'quickAnalyze');

    quickAnalyzeSpy.mockReturnValueOnce({
      items: [new TensionCurve([], [0, 1, 2], [], [], null, 0.4, 0.2)],
    } as never);
    expect(analyzer.getTensionPattern('ignored')).toBe('rising');

    quickAnalyzeSpy.mockReturnValueOnce({
      items: [new TensionCurve([], [], [0, 1, 2], [], null, 0.4, 0.2)],
    } as never);
    expect(analyzer.getTensionPattern('ignored')).toBe('falling');

    quickAnalyzeSpy.mockReturnValueOnce({
      items: [
        new TensionCurve(
          [
            new TensionPoint(0, TensionLevel.LOW, PointType.NORMAL, 'a', [], 0.2),
            new TensionPoint(1, TensionLevel.MEDIUM, PointType.NORMAL, 'b', [], 0.4),
            new TensionPoint(2, TensionLevel.HIGH, PointType.CLIMAX, 'c', [], 0.8),
            new TensionPoint(3, TensionLevel.VERY_HIGH, PointType.NORMAL, 'd', [], 1),
          ],
          [],
          [],
          [],
          3,
          0.6,
          0.2,
        ),
      ],
    } as never);
    expect(analyzer.getTensionPattern('ignored')).toBe('building');

    quickAnalyzeSpy.mockReturnValueOnce({
      items: [
        new TensionCurve(
          [
            new TensionPoint(0, TensionLevel.LOW, PointType.NORMAL, 'a', [], 0.2),
            new TensionPoint(1, TensionLevel.HIGH, PointType.PEAK, 'b', [], 0.8),
            new TensionPoint(2, TensionLevel.LOW, PointType.VALLEY, 'c', [], 0.2),
          ],
          [1],
          [2],
          [],
          1,
          0.4,
          0.2,
        ),
      ],
    } as never);
    expect(analyzer.getTensionPattern('ignored')).toBe('oscillating');
  });
});
