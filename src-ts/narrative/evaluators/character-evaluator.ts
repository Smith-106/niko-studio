/**
 * Character Evaluator
 *
 * Evaluates the depth and effectiveness of character portrayal.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';

export class CharacterEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u4eba\u7269\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u4eba\u7269\u5851\u9020\u6df1\u5ea6\uff0c\u68c0\u6d4b\u80fd\u529b/\u53e4\u602a/\u5bf9\u6bd4/\u4e3b\u5bfc\u60c5\u611f/\u53cc\u91cd\u4eba\u683c\u7b49\u7ef4\u5ea6';
  }

  get relatedSkill(): string {
    return 'character-forge';
  }

  private static readonly COMPETENCE_MARKERS: readonly string[] = [
    '\u64c5\u957f',
    '\u7cbe\u901a',
    '\u9ad8\u8d85',
    '\u5a34\u719f',
    '\u4e13\u4e1a',
    '\u6280\u827a',
    '\u8f7b\u800c\u6613\u4e3e',
    '\u6e38\u5203\u6709\u4f59',
    '\u5f97\u5fc3\u5e94\u624b',
  ];

  private static readonly ECCENTRICITY_MARKERS: readonly string[] = [
    '\u5947\u602a',
    '\u53e4\u602a',
    '\u7279\u522b',
    '\u4e0e\u4f17\u4e0d\u540c',
    '\u602a\u7656',
    '\u603b\u662f',
    '\u4ece\u4e0d',
    '\u5fc5\u987b',
    '\u4e60\u60ef',
  ];

  private static readonly INNER_CONFLICT_MARKERS: readonly string[] = [
    '\u4e00\u65b9\u9762',
    '\u53e6\u4e00\u65b9\u9762',
    '\u65e2\u60f3',
    '\u53c8\u6015',
    '\u5185\u5fc3',
    '\u6323\u624e',
    '\u77db\u76fe',
    '\u4e24\u4e2a\u81ea\u5df1',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const competence = this.evaluateCompetence(content);
    const eccentricity = this.evaluateEccentricity(content);
    const innerConflict = this.evaluateInnerConflict(content);

    const totalScore = (competence + eccentricity + innerConflict) / 3;

    const issues: Issue[] = [];

    if (competence < 50) {
      issues.push({
        code: 'CHAR_COMPETENCE_WEAK',
        message: '\u89d2\u8272\u80fd\u529b\u5c55\u793a\u4e0d\u8db3',
        severity: Severity.MINOR,
        suggestion: '\u5c55\u793a\u89d2\u8272\u64c5\u957f\u7684\u6280\u80fd',
        relatedSkill: 'character-forge',
      });
    }

    if (eccentricity < 50) {
      issues.push({
        code: 'CHAR_BLAND',
        message: '\u89d2\u8272\u7f3a\u4e4f\u72ec\u7279\u6027/\u53e4\u602a\u7279\u8d28',
        severity: Severity.MAJOR,
        suggestion:
          '\u6dfb\u52a0\u8ba9\u89d2\u8272\u96be\u5fd8\u7684\u53e4\u602a\u7279\u8d28',
        relatedSkill: 'character-forge',
      });
    }

    if (innerConflict < 50) {
      issues.push({
        code: 'CHAR_STATIC',
        message: '\u89d2\u8272\u7f3a\u4e4f\u5185\u5fc3\u51b2\u7a81',
        severity: Severity.MAJOR,
        suggestion: '\u8bbe\u8ba1\u53cc\u91cd\u4eba\u683c\u6216\u5185\u5fc3\u77db\u76fe',
        relatedSkill: 'character-forge',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        competence,
        eccentricity,
        inner_conflict: innerConflict,
      },
      `\u4eba\u7269\u6df1\u5ea6\uff1a${this.scoreToLevel(totalScore)}`,
    );
  }

  override quickScan(content: string): EvaluationResult {
    const competence = this.evaluateCompetence(content);
    const eccentricity = this.evaluateEccentricity(content);
    const innerConflict = this.evaluateInnerConflict(content);
    const totalScore = (competence + eccentricity + innerConflict) / 3;

    const issues: Issue[] = [];
    if (eccentricity < 50) {
      issues.push({
        code: 'CHAR_QUICK_BLAND',
        message: '快速扫描发现角色辨识度偏低',
        severity: Severity.MINOR,
        relatedSkill: 'character-forge',
      });
    }
    if (innerConflict < 50) {
      issues.push({
        code: 'CHAR_QUICK_STATIC',
        message: '快速扫描发现角色内在冲突不足',
        severity: Severity.MINOR,
        relatedSkill: 'character-forge',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        competence,
        eccentricity,
        inner_conflict: innerConflict,
      },
      `人物快速扫描：${this.scoreToLevel(totalScore)}`,
    );
  }

  private evaluateCompetence(content: string): number {
    let score = 40;
    for (const m of CharacterEvaluator.COMPETENCE_MARKERS) {
      if (content.includes(m)) {
        score += 10;
      }
    }
    return Math.min(100, score);
  }

  private evaluateEccentricity(content: string): number {
    let score = 40;
    for (const m of CharacterEvaluator.ECCENTRICITY_MARKERS) {
      if (content.includes(m)) {
        score += 10;
      }
    }
    return Math.min(100, score);
  }

  private evaluateInnerConflict(content: string): number {
    let score = 40;
    for (const m of CharacterEvaluator.INNER_CONFLICT_MARKERS) {
      if (content.includes(m)) {
        score += 10;
      }
    }
    return Math.min(100, score);
  }
}
