import { describe, expect, it } from 'vitest';

import {
  BaseEvaluator,
  EvaluationResult,
  ScoreLevel,
  Severity,
} from '../../narrative/evaluators/base';

class TestEvaluator extends BaseEvaluator {
  get name(): string {
    return 'test-evaluator';
  }

  get description(): string {
    return 'test description';
  }

  override get relatedSkill(): string {
    return 'test-skill';
  }

  async evaluate(content: string): Promise<EvaluationResult> {
    return new EvaluationResult(
      this.name,
      88,
      ScoreLevel.GOOD,
      [
        {
          code: 'TEST',
          message: content,
          severity: Severity.MINOR,
          suggestion: 'revise',
          relatedSkill: this.relatedSkill,
        },
      ],
      { signal: 1 },
      'ok',
    );
  }
}

class DefaultSkillEvaluator extends BaseEvaluator {
  get name(): string {
    return 'default-skill-evaluator';
  }

  get description(): string {
    return 'default skill description';
  }

  async evaluate(): Promise<EvaluationResult> {
    return new EvaluationResult(this.name, 0, ScoreLevel.FAIR);
  }
}

describe('narrative/evaluators/base', () => {
  it('exposes evaluation-result helpers and dictionary conversion', () => {
    const result = new EvaluationResult(
      'demo',
      72,
      ScoreLevel.GOOD,
      [
        { code: 'I1', message: 'major', severity: Severity.MAJOR },
        { code: 'I2', message: 'critical', severity: Severity.CRITICAL },
        { code: 'I3', message: 'minor', severity: Severity.MINOR },
      ],
      { score: 72 },
      'summary',
    );

    expect(result.criticalIssues).toHaveLength(1);
    expect(result.majorIssues).toHaveLength(1);
    expect(result.hasCriticalIssues).toBe(true);
    expect(result.topIssues(2).map(item => item.code)).toEqual(['I2', 'I1']);
    expect(result.toDict()).toMatchObject({
      evaluator: 'demo',
      score: 72,
      level: 'good',
      metrics: { score: 72 },
      summary: 'summary',
    });
  });

  it('uses the base quickScan fallback through a minimal concrete evaluator', async () => {
    const evaluator = new TestEvaluator();

    const quick = evaluator.quickScan('sample content');
    const full = await evaluator.evaluate('sample content');

    expect(quick).toMatchObject({
      evaluatorName: 'test-evaluator',
      score: 0,
      level: ScoreLevel.FAIR,
      summary: '快速扫描未实现',
    });
    expect(full).toMatchObject({
      evaluatorName: 'test-evaluator',
      score: 88,
      level: ScoreLevel.GOOD,
      metrics: { signal: 1 },
    });
    expect(full.issues[0]).toMatchObject({
      code: 'TEST',
      relatedSkill: 'test-skill',
    });
  });

  it('defaults relatedSkill to null when subclasses do not override it', () => {
    const evaluator = new DefaultSkillEvaluator();

    expect(evaluator.relatedSkill).toBeNull();
  });
});
