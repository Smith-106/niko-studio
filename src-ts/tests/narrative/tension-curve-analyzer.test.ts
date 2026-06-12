import { describe, expect, it, vi } from 'vitest';

import {
  PointType,
  TensionCurveAnalyzer,
  TensionLevel,
} from '../../narrative/analyzers/tension-curve-analyzer';

describe('TensionCurveAnalyzer', () => {
  it('quickAnalyze builds a curve with peaks, valleys, and turning points', () => {
    const analyzer = new TensionCurveAnalyzer();

    const result = analyzer.quickAnalyze(
      '一切平静如常。\\n\\n突然敌人闯入，局势变得紧张。\\n\\n她短暂喘息，气氛又回落。\\n\\n然而真相揭开，最终冲突爆发到高潮。',
    );

    expect(result.count).toBe(1);
    const curve = result.items[0];
    expect(curve.points.length).toBeGreaterThanOrEqual(3);
    expect(curve.turningPoints.length).toBeGreaterThanOrEqual(1);
    expect(curve.climaxPosition).not.toBeNull();
    expect(curve.points.some(point => point.pointType === PointType.CLIMAX)).toBe(true);
  });

  it('detects tension pattern from the rule-based curve', () => {
    const analyzer = new TensionCurveAnalyzer();

    const pattern = analyzer.getTensionPattern(
      '平静的开端。\\n\\n紧张升级。\\n\\n更加危险。\\n\\n最终高潮爆发。',
    );

    expect(['building', 'rising', 'oscillating', 'flat']).toContain(pattern);
  });

  it('falls back to quickAnalyze when llm analysis fails', async () => {
    const llmClient = {
      generateJson: vi.fn().mockRejectedValue(new Error('llm unavailable')),
    };
    const analyzer = new TensionCurveAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '平静之后，危机骤然逼近，随后冲突爆发。',
    );

    expect(llmClient.generateJson).toHaveBeenCalled();
    expect(result.count).toBe(1);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it('routes analyze directly to quickAnalyze when no llm client is configured', async () => {
    const analyzer = new TensionCurveAnalyzer();

    const result = await analyzer.analyze(
      '平静之后，危机骤然逼近，随后冲突爆发。',
    );

    expect(result.count).toBe(1);
    expect(result.items[0]?.points.length).toBeGreaterThan(0);
  });

  it('uses llm curve data and enriches with rule fallback when sparse', async () => {
    const llmClient = {
      generateJson: vi.fn().mockResolvedValue({
        points: [
          { position: 0, level: 2, point_type: 'normal', description: '平静开场' },
          { position: 1, level: 5, point_type: 'climax', description: '最终高潮' },
        ],
        climax_position: 1,
        overall_pattern: 'building',
        summary: 'LLM tension summary',
      }),
    };
    const analyzer = new TensionCurveAnalyzer(llmClient as never);

    const result = await analyzer.analyze(
      '平静的开端。\\n\\n突然敌人闯入，局势变得紧张。\\n\\n最终高潮爆发。',
    );

    expect(result.count).toBe(1);
    expect(result.summary).toBe('LLM tension summary');
    expect(result.metadata['analysis_source']).toBe('llm');
    expect(result.items[0].points.length).toBeGreaterThanOrEqual(2);
    expect(result.items[0].climaxPosition).toBe(1);
  });
});
