/**
 * Subtext Evaluator
 *
 * Evaluates dialogue subtext density, detecting on-the-nose dialogue issues.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';

// McKee three functions: each dialogue line should serve >=2 of these
const MCKEE_FUNCTIONS = {
  plot: ['推动', '导致', '改变', '触发', '引起', '因为', '所以', '于是', '结果', '决定'],
  character: ['性格', '习惯', '过去', '秘密', '恐惧', '渴望', '矛盾', '弱点', '固执', '骄傲'],
  theme: ['命运', '选择', '正义', '自由', '牺牲', '信念', '价值', '意义', '到底', '本质'],
  conflict: ['你凭什么', '不行', '不可能', '我不答应', '反对', '拒绝', '偏要', '绝不会'],
} as const;

export interface McKeeDialogueResult {
  dialogueCount: number;
  averageFunctions: number;
  weakDialogues: number;
  functionDistribution: Record<keyof typeof MCKEE_FUNCTIONS, number>;
  suggestions: string[];
}

export class SubtextEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u6f5c\u53f0\u8bcd\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u5bf9\u8bdd\u7684\u6f5c\u53f0\u8bcd\u6d53\u5ea6\uff0c\u68c0\u6d4b\u76f4\u767d\u5bf9\u767d(On-The-Nose)\u95ee\u9898';
  }

  get relatedSkill(): string {
    return 'subtext-dialogue';
  }

  private static readonly ON_THE_NOSE_MARKERS: readonly string[] = [
    '\u6211\u5f88\u751f\u6c14',
    '\u6211\u5f88\u96be\u8fc7',
    '\u6211\u5f88\u5f00\u5fc3',
    '\u6211\u5f88\u5bb3\u6015',
    '\u6211\u611f\u5230',
    '\u6211\u89c9\u5f97\u4f60',
    '\u6211\u73b0\u5728\u975e\u5e38',
    '\u56e0\u4e3a\u6211\u7231\u4f60',
    '\u56e0\u4e3a\u6211\u5728\u4e4e',
    '\u8fd9\u662f\u56e0\u4e3a',
    '\u6211\u8fd9\u4e48\u505a\u662f\u4e3a\u4e86',
    '\u6211\u4e4b\u6240\u4ee5',
    '\u4f60\u662f\u6211\u7684',
    '\u6211\u4eec\u662f',
    '\u4f5c\u4e3a\u4f60\u7684\u670b\u53cb',
    '\u4f5c\u4e3a\u4f60\u7684',
    '\u6211\u4eec\u4e4b\u95f4',
    '\u4f60\u660e\u767d\u5417',
    '\u6211\u7684\u610f\u601d\u662f',
    '\u8ba9\u6211\u89e3\u91ca',
    '\u6362\u53e5\u8bdd\u8bf4',
    '\u4e5f\u5c31\u662f\u8bf4',
    '\u4f60\u8fd9\u662f\u5728',
    '\u4f60\u5185\u5fc3\u5176\u5b9e',
    '\u4f60\u6f5c\u610f\u8bc6\u91cc',
    '\u4f60\u4e0d\u613f\u610f\u627f\u8ba4',
  ];

  private static readonly SUBTEXT_POSITIVE_MARKERS: readonly string[] = [
    '\u4e0d\u8fc7',
    '\u8bdd\u8bf4\u56de\u6765',
    '\u5bf9\u4e86',
    '\u4ed6\u770b\u7740',
    '\u5979\u8f6c\u8fc7\u5934',
    '\u505c\u987f\u4e86\u4e00\u4e0b',
    '\u6c89\u9ed8',
    '\u6ca1\u6709\u56de\u7b54',
    '\u5c94\u5f00\u8bdd\u9898',
    '\u7a97\u5916',
    '\u676f\u5b50',
    '\u624b\u673a',
    '\u770b\u5411\u522b\u5904',
  ];

  private static readonly DIALOGUE_LENGTH_THRESHOLD = 100;

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const dialogues = this.extractDialogues(content);

    if (dialogues.length === 0) {
      return new EvaluationResult(
        this.name,
        50,
        this.scoreToLevel(50),
        [],
        { dialogue_count: 0 },
        '\u672a\u68c0\u6d4b\u5230\u5bf9\u8bdd\u5185\u5bb9',
      );
    }

    const onTheNoseScore = this.evaluateOnTheNose(dialogues);
    const subtextDensity = this.evaluateSubtextDensity(content, dialogues);
    const dialogueLengthScore = this.evaluateDialogueLength(dialogues);

    const totalScore =
      onTheNoseScore * 0.4 +
      subtextDensity * 0.4 +
      dialogueLengthScore * 0.2;

    const issues: Issue[] = [];

    if (onTheNoseScore < 60) {
      issues.push({
        code: 'DIALOGUE_ON_THE_NOSE',
        message:
          '\u68c0\u6d4b\u5230\u76f4\u767d\u5bf9\u767d\uff0c\u89d2\u8272\u76f4\u63a5\u9648\u8ff0\u60c5\u611f\u6216\u610f\u56fe',
        severity: Severity.MAJOR,
        suggestion:
          '\u4f7f\u7528\u884c\u52a8\u3001\u7269\u54c1\u6216\u95f4\u63a5\u8868\u8fbe\u66ff\u4ee3\u76f4\u63a5\u9648\u8ff0',
        relatedSkill: 'on-the-nose-fix',
      });
    }

    if (subtextDensity < 50) {
      issues.push({
        code: 'DIALOGUE_LACKS_SUBTEXT',
        message:
          '\u5bf9\u8bdd\u7f3a\u4e4f\u6f5c\u53f0\u8bcd\uff0c\u8868\u9762\u4e0e\u6df1\u5c42\u542b\u4e49\u4e00\u81f4',
        severity: Severity.MAJOR,
        suggestion:
          "\u8bbe\u8ba1\u89d2\u8272'\u60f3\u8bf4\u7684'\u4e0e'\u8bf4\u51fa\u7684'\u4e4b\u95f4\u7684\u88c2\u75d5",
        relatedSkill: 'subtext-dialogue',
      });
    }

    if (dialogueLengthScore < 60) {
      issues.push({
        code: 'DIALOGUE_TOO_LONG',
        message: '\u5b58\u5728\u8fc7\u957f\u7684\u5bf9\u8bdd\u6bb5\u843d',
        severity: Severity.MINOR,
        suggestion:
          '\u62c6\u5206\u957f\u5bf9\u8bdd\uff0c\u7a7f\u63d2\u52a8\u4f5c\u548c\u53cd\u5e94\u63cf\u5199',
        relatedSkill: 'subtext-dialogue',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        dialogue_count: dialogues.length,
        on_the_nose_score: onTheNoseScore,
        subtext_density: subtextDensity,
        dialogue_length_score: dialogueLengthScore,
      },
      `\u6f5c\u53f0\u8bcd\u6d53\u5ea6\uff1a${this.scoreToLevel(totalScore)}`,
    );
  }

  private extractDialogues(content: string): string[] {
    const patterns = [
      /\u300c([^\u300d]+)\u300d/g,
      /\u201c([^\u201d]+)\u201d/g,
      /"([^"]+)"/g,
      /\u300e([^\u300f]+)\u300f/g,
    ];

    const dialogues: string[] = [];
    for (const pattern of patterns) {
      let match: RegExpExecArray | null;
      const re = new RegExp(pattern.source, pattern.flags);
      while ((match = re.exec(content)) !== null) {
        dialogues.push(match[1]);
      }
    }

    return dialogues;
  }

  private evaluateOnTheNose(dialogues: string[]): number {
    /* v8 ignore next -- defensive empty-array guard is exercised by white-box tests but not attributed reliably */
    if (dialogues.length === 0) return 100;

    let violations = 0;
    for (const dialogue of dialogues) {
      for (const marker of SubtextEvaluator.ON_THE_NOSE_MARKERS) {
        if (dialogue.includes(marker)) {
          violations += 1;
          break;
        }
      }
    }

    const violationRate = violations / dialogues.length;
    return Math.max(0, 100 - violationRate * 150);
  }

  private evaluateSubtextDensity(
    content: string,
    dialogues: string[],
  ): number {
    /* v8 ignore next -- defensive empty-array guard is exercised by white-box tests but not attributed reliably */
    if (dialogues.length === 0) return 50;

    let positiveCount = 0;
    for (const marker of SubtextEvaluator.SUBTEXT_POSITIVE_MARKERS) {
      positiveCount += content.split(marker).length - 1;
    }

    const idealRatio = dialogues.length / 3;
    /* v8 ignore next -- only reachable through synthetic white-box inputs */
    if (idealRatio === 0) return 50;

    return Math.min(100, (positiveCount / Math.max(1, idealRatio)) * 70 + 30);
  }

  private evaluateDialogueLength(dialogues: string[]): number {
    /* v8 ignore next -- defensive empty-array guard is exercised by white-box tests but not attributed reliably */
    if (dialogues.length === 0) return 100;

    const longDialogues = dialogues.filter(
      (d) => d.length > SubtextEvaluator.DIALOGUE_LENGTH_THRESHOLD,
    ).length;
    const longRatio = longDialogues / dialogues.length;

    return Math.max(0, 100 - longRatio * 100);
  }

  evaluateMcKeeFunctions(content: string): McKeeDialogueResult {
    const dialogues = this.extractDialogues(content);
    if (dialogues.length === 0) {
      return { dialogueCount: 0, averageFunctions: 0, weakDialogues: 0, functionDistribution: { plot: 0, character: 0, theme: 0, conflict: 0 }, suggestions: ['未检测到对话内容'] };
    }

    const distribution: Record<keyof typeof MCKEE_FUNCTIONS, number> = { plot: 0, character: 0, theme: 0, conflict: 0 };
    let totalFunctions = 0;
    let weakCount = 0;
    const suggestions: string[] = [];

    for (const d of dialogues) {
      const matched: string[] = [];
      for (const [fn, keywords] of Object.entries(MCKEE_FUNCTIONS)) {
        const hit = keywords.some((kw) => d.includes(kw));
        if (hit) {
          distribution[fn as keyof typeof distribution]++;
          matched.push(fn);
        }
      }
      totalFunctions += matched.length;
      if (matched.length < 2) weakCount++;
    }

    const avg = totalFunctions / dialogues.length;

    if (weakCount > dialogues.length * 0.5) {
      suggestions.push('超过50%的对话仅满足一个McKee功能，建议让每句对话至少满足两个功能（推动情节/揭示角色/表达主题/制造冲突）');
    }
    if (distribution.theme < dialogues.length * 0.1) {
      suggestions.push('对话中主题表达不足，可以通过角色的价值观冲突来体现主题');
    }
    if (distribution.conflict < dialogues.length * 0.15) {
      suggestions.push('对话中冲突密度较低，增加角色间的立场对立');
    }
    if (suggestions.length === 0) {
      suggestions.push('对话的McKee三功能表现良好');
    }

    return { dialogueCount: dialogues.length, averageFunctions: Math.round(avg * 100) / 100, weakDialogues: weakCount, functionDistribution: distribution, suggestions };
  }
}
