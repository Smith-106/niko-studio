import { describe, expect, it } from 'vitest';

import { CriticEngine } from '../../narrative/evaluators/critic-engine';

describe('narrative/evaluators/critic-engine', () => {
  it('evaluate supports module selection and returns a comprehensive report', async () => {
    const engine = new CriticEngine();

    const report = await engine.evaluate(
      '林岚擅长追踪细节，却又害怕再次判断失误。因为她执意追查，所以真相反而更靠近；她看见钟摆上的冷光，像针尖一样刺进眼底。',
      { premise: '因为执意追查，所以真相更近' },
      ['character', 'premise', 'voice'],
    );

    expect(report.overallScore).toBeGreaterThan(0);
    expect(Object.keys(report.moduleScores)).toEqual(['character', 'premise', 'voice']);
    expect(report.moduleResults['character']).toBeDefined();
    expect(Array.isArray(report.allIssues)).toBe(true);
    expect(Array.isArray(report.recommendedSkills)).toBe(true);
  });

  it('quickScan exposes report export helpers through toDict and toMarkdown', async () => {
    const engine = new CriticEngine();

    const report = await engine.quickScan(
      '林岚擅长追踪细节，却又害怕再次判断失误。因为她执意追查，所以真相反而更靠近；她看见钟摆上的冷光，像针尖一样刺进眼底。',
    );

    expect(report.toDict()).toMatchObject({
      overall_score: report.overallScore,
      overall_level: report.overallLevel,
      module_scores: report.moduleScores,
    });
    expect(report.toMarkdown()).toContain('# 综合评估报告');
    expect(report.toMarkdown()).toContain('模块得分');
  });
});
