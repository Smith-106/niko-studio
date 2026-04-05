import { describe, expect, it } from 'vitest';

import * as evaluators from '../../narrative/evaluators';
import {
  BaseEvaluator as DirectBaseEvaluator,
  EvaluationResult as DirectEvaluationResult,
  ScoreLevel as DirectScoreLevel,
  Severity as DirectSeverity,
} from '../../narrative/evaluators/base';
import { CharacterEvaluator } from '../../narrative/evaluators/character-evaluator';
import { CriticEngine } from '../../narrative/evaluators/critic-engine';
import { PremiseEvaluator } from '../../narrative/evaluators/premise-evaluator';
import { VoiceEvaluator } from '../../narrative/evaluators/voice-evaluator';

describe('narrative/evaluators index barrel', () => {
  it('re-exports representative evaluator enums, containers, and classes through the barrel', () => {
    expect(evaluators.Severity).toBe(DirectSeverity);
    expect(evaluators.ScoreLevel).toBe(DirectScoreLevel);
    expect(evaluators.EvaluationResult).toBe(DirectEvaluationResult);
    expect(evaluators.BaseEvaluator).toBe(DirectBaseEvaluator);
    expect(evaluators.CharacterEvaluator).toBe(CharacterEvaluator);
    expect(evaluators.PremiseEvaluator).toBe(PremiseEvaluator);
    expect(evaluators.VoiceEvaluator).toBe(VoiceEvaluator);
    expect(evaluators.CriticEngine).toBe(CriticEngine);

    const result = new evaluators.EvaluationResult(
      'BarrelEvaluator',
      88,
      evaluators.ScoreLevel.GOOD,
      [
        {
          code: 'TEST',
          message: 'minor issue',
          severity: evaluators.Severity.MINOR,
        },
      ],
      { detail: 1 },
      'ok',
    );

    expect(result.topIssues(1)[0]).toMatchObject({
      code: 'TEST',
      severity: evaluators.Severity.MINOR,
    });
    expect(result.toDict()).toMatchObject({
      evaluator: 'BarrelEvaluator',
      level: 'good',
      metrics: { detail: 1 },
    });
  });

  it('provides working evaluator instances and composite engine through the barrel', async () => {
    const character = new evaluators.CharacterEvaluator();
    const premise = new evaluators.PremiseEvaluator();
    const voice = new evaluators.VoiceEvaluator();
    const engine = new evaluators.CriticEngine();

    expect(character.quickScan('她擅长追踪，却害怕再次失败。').score).toBeGreaterThan(0);
    expect(
      premise.quickScan('因为她执意追查，所以真相反而更靠近；讽刺的是，她最信任的人偏偏在误导她。').score,
    ).toBeGreaterThan(0);
    expect(voice.quickScan('她看见钟摆上的冷光，像针尖一样刺进眼底。').score).toBeGreaterThan(0);

    const report = await engine.quickScan(
      '林岚擅长追踪细节，却又害怕再次判断失误。因为她执意追查，所以真相反而更靠近；她看见钟摆上的冷光，像针尖一样刺进眼底。',
    );

    expect(report.overallScore).toBeGreaterThan(0);
    expect(report.toDict()).toMatchObject({
      overall_score: report.overallScore,
    });
  });
});
