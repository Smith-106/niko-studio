import { describe, expect, it } from 'vitest';

import { CriticEngine } from '../../narrative/evaluators/critic-engine';

describe('CriticEngine quickScan', () => {
  it('uses evaluator-specific quick scans instead of base 0-score placeholders', async () => {
    const engine = new CriticEngine();

    const report = await engine.quickScan(
      '林岚擅长追踪细节，却又害怕再次判断失误。因为她执意追查，所以真相反而更靠近；讽刺的是，她最信任的人偏偏在误导她。',
    );

    expect(report.moduleScores['character']).toBeGreaterThan(0);
    expect(report.moduleScores['premise']).toBeGreaterThan(0);
    expect(report.moduleScores['voice']).toBeGreaterThan(0);
    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.summary).toContain('总分');
  });
});
