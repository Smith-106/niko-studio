/**
 * Suspense Evaluator
 *
 * Evaluates suspense construction effects, detecting use of
 * the three pillars of suspense.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';

export class SuspenseEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u60ac\u5ff5\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u60ac\u5ff5\u6784\u5efa\u6548\u679c\uff0c\u68c0\u6d4b\u4e09\u5927\u652f\u67f1\uff08\u6545\u4e8b\u95ee\u9898/\u5a01\u80c1\u60c5\u5883/\u5bfc\u706b\u7d22\uff09\u7684\u8fd0\u7528';
  }

  get relatedSkill(): string {
    return 'suspense-craft';
  }

  private static readonly QUESTION_MARKERS: readonly string[] = [
    '\u8c01',
    '\u4ec0\u4e48',
    '\u4e3a\u4ec0\u4e48',
    '\u600e\u4e48',
    '\u5982\u4f55',
    '\u54ea\u91cc',
    '\u4f55\u65f6',
    '\u662f\u5426',
    '\u80fd\u5426',
    '\u4f1a\u4e0d\u4f1a',
    '\u96be\u9053',
    '\u7a76\u7adf',
    '\u5230\u5e95',
    '\uff1f',
    '\u5417',
    '\u5462',
  ];

  private static readonly THREAT_MARKERS: readonly string[] = [
    '\u5371\u9669',
    '\u5a01\u80c1',
    '\u6b7b\u4ea1',
    '\u6740',
    '\u6bc1\u706d',
    '\u707e\u96be',
    '\u5982\u679c\u4e0d',
    '\u5426\u5219',
    '\u5fc5\u987b',
    '\u4e00\u5b9a\u8981',
    '\u6765\u4e0d\u53ca',
    '\u6050\u60e7',
    '\u5bb3\u6015',
    '\u62c5\u5fc3',
    '\u5fe7\u8651',
  ];

  private static readonly TIME_PRESSURE_MARKERS: readonly string[] = [
    '\u8fd8\u6709',
    '\u53ea\u5269',
    '\u5012\u8ba1\u65f6',
    '\u6700\u540e',
    '\u622a\u6b62',
    '\u660e\u5929',
    '\u4eca\u665a',
    '\u9a6c\u4e0a',
    '\u7acb\u523b',
    '\u5373\u5c06',
    '\u6765\u4e0d\u53ca',
    '\u8d76\u4e0d\u4e0a',
    '\u65f6\u95f4\u4e0d\u591a',
    '\u5c0f\u65f6',
    '\u5206\u949f',
    '\u79d2',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const questionScore = this.evaluateStoryQuestions(content);
    const threatScore = this.evaluateThreat(content);
    const fuseScore = this.evaluateFuse(content);

    const totalScore =
      questionScore * 0.3 + threatScore * 0.35 + fuseScore * 0.35;

    const issues: Issue[] = [];

    if (questionScore < 60) {
      issues.push({
        code: 'SUSPENSE_QUESTION_WEAK',
        message:
          '\u6545\u4e8b\u95ee\u9898\u4e0d\u8db3\uff1a\u8bfb\u8005\u7f3a\u4e4f\u597d\u5947\u5fc3\u9a71\u52a8',
        severity: Severity.MAJOR,
        suggestion:
          '\u5728\u5f00\u7bc7\u62db\u51fa\u5f15\u4eba\u5165\u80dc\u7684\u95ee\u9898',
        relatedSkill: 'suspense-craft',
      });
    }

    if (threatScore < 60) {
      issues.push({
        code: 'SUSPENSE_THREAT_WEAK',
        message:
          '\u5a01\u80c1\u60c5\u5883\u4e0d\u8db3\uff1a\u89d2\u8272\u672a\u5904\u4e8e\u660e\u786e\u5a01\u80c1\u4e4b\u4e0b',
        severity: Severity.CRITICAL,
        suggestion:
          '\u8ba9\u89d2\u8272\u9677\u5165\u2018\u8981\u547d\u7684\u9ebb\u70e6\u2019\u4e4b\u4e2d',
        relatedSkill: 'suspense-craft',
      });
    }

    if (fuseScore < 60) {
      issues.push({
        code: 'SUSPENSE_FUSE_WEAK',
        message:
          '\u5bfc\u706b\u7d22\u6548\u5e94\u5f31\uff1a\u7f3a\u4e4f\u65f6\u95f4\u538b\u529b',
        severity: Severity.MAJOR,
        suggestion:
          '\u589e\u52a0\u65f6\u95f4\u9650\u5236\uff0c\u521b\u9020\u7d27\u8feb\u611f',
        relatedSkill: 'suspense-craft',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        story_questions: questionScore,
        threat_situation: threatScore,
        fuse_effect: fuseScore,
      },
      `\u60ac\u5ff5\u5f3a\u5ea6\uff1a${this.scoreToLevel(totalScore)}`,
    );
  }

  override quickScan(content: string): EvaluationResult {
    const threat = this.evaluateThreat(content);
    const fuse = this.evaluateFuse(content);
    const avg = (threat + fuse) / 2;

    return new EvaluationResult(
      this.name,
      avg,
      this.scoreToLevel(avg),
      [],
      {},
      `\u60ac\u5ff5\u5feb\u626b\uff1a${avg.toFixed(1)}\u5206`,
    );
  }

  private evaluateStoryQuestions(content: string): number {
    let score = 40;
    for (const marker of SuspenseEvaluator.QUESTION_MARKERS) {
      if (content.includes(marker)) {
        score += 5;
      }
    }
    return Math.min(100, score);
  }

  private evaluateThreat(content: string): number {
    let score = 30;
    for (const marker of SuspenseEvaluator.THREAT_MARKERS) {
      const count = content.split(marker).length - 1;
      score += count * 5;
    }
    return Math.min(100, score);
  }

  private evaluateFuse(content: string): number {
    let score = 30;
    for (const marker of SuspenseEvaluator.TIME_PRESSURE_MARKERS) {
      if (content.includes(marker)) {
        score += 8;
      }
    }
    return Math.min(100, score);
  }
}
