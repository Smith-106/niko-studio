/**
 * Premise Evaluator
 *
 * Evaluates story premise clarity and consistency.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';

export class PremiseEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u9884\u8bbe\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u6545\u4e8b\u9884\u8bbe\u7684\u6e05\u6670\u5ea6\u3001\u56e0\u679c\u5173\u7cfb\u548c\u620f\u5267\u6027';
  }

  get relatedSkill(): string {
    return 'premise-magic';
  }

  private static readonly CAUSALITY_MARKERS: readonly string[] = [
    '\u56e0\u4e3a',
    '\u6240\u4ee5',
    '\u5bfc\u81f4',
    '\u56e0\u6b64',
    '\u4e8e\u662f',
    '\u7ed3\u679c',
    '\u6700\u7ec8',
    '\u7ec8\u4e8e',
    '\u4ece\u800c',
  ];

  private static readonly IRONY_MARKERS: readonly string[] = [
    '\u5374',
    '\u53cd\u800c',
    '\u6ca1\u60f3\u5230',
    '\u610f\u5916',
    '\u8bbd\u523a\u7684\u662f',
    '\u6070\u6070\u76f8\u53cd',
    '\u7adf\u7136',
    '\u504f\u504f',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const premise =
      typeof context?.['premise'] === 'string' ? context['premise'] : '';

    const causality = this.evaluateCausality(content);
    const irony = this.evaluateIrony(content);
    const consistency = this.evaluateConsistency(content, premise);

    const totalScore = causality * 0.4 + irony * 0.3 + consistency * 0.3;

    const issues: Issue[] = [];

    if (causality < 60) {
      issues.push({
        code: 'PREMISE_CAUSALITY_WEAK',
        message: '\u56e0\u679c\u5173\u7cfb\u4e0d\u6e05\u6670',
        severity: Severity.MAJOR,
        suggestion:
          '\u5f3a\u5316\u4e8b\u4ef6\u4e4b\u95f4\u7684\u56e0\u679c\u94fe\u6761',
        relatedSkill: 'premise-magic',
      });
    }

    if (irony < 50) {
      issues.push({
        code: 'PREMISE_NO_IRONY',
        message: '\u7f3a\u4e4f\u8bbd\u523a\u6027\u6216\u610f\u5916\u6027',
        severity: Severity.MINOR,
        suggestion:
          '\u8003\u8651\u4f7f\u7528\u9884\u8bbe\u9b54\u6756\u589e\u52a0\u620f\u5267\u6027',
        relatedSkill: 'premise-magic',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        causality,
        irony,
        consistency,
      },
      `\u9884\u8bbe\u5f3a\u5ea6\uff1a${this.scoreToLevel(totalScore)}`,
    );
  }

  private evaluateCausality(content: string): number {
    let score = 40;
    for (const m of PremiseEvaluator.CAUSALITY_MARKERS) {
      if (content.includes(m)) {
        score += 8;
      }
    }
    return Math.min(100, score);
  }

  private evaluateIrony(content: string): number {
    let score = 30;
    for (const m of PremiseEvaluator.IRONY_MARKERS) {
      if (content.includes(m)) {
        score += 12;
      }
    }
    return Math.min(100, score);
  }

  private evaluateConsistency(content: string, premise: string): number {
    if (!premise) return 60;
    const keywords = premise
      .replace('\u5bfc\u81f4', ' ')
      .replace('\u6700\u7ec8', ' ')
      .split(/\s+/);
    const matches = keywords.filter((k) => k.length > 0 && content.includes(k)).length;
    return Math.min(100, 40 + matches * 15);
  }
}
