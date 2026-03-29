/**
 * Pyramid Evaluator
 *
 * Evaluates logical structure based on Barbara Minto's Pyramid Principle:
 * 1. Conclusion first
 * 2. Vertical structure (question-answer relationship)
 * 3. Horizontal structure (logical arrangement)
 * 4. MECE principle
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
  ScoreLevel,
} from './base';

export class PyramidEvaluator extends BaseEvaluator {
  get name(): string {
    return 'pyramid_evaluator';
  }

  get description(): string {
    return 'Evaluates logical structure against the four rules of the Pyramid Principle';
  }

  get relatedSkill(): string {
    return 'pyramid-structure';
  }

  private static readonly CONCLUSION_SIGNALS: readonly string[] = [
    '\u56e0\u6b64',
    '\u6240\u4ee5',
    '\u7efc\u4e0a\u6240\u8ff0',
    '\u603b\u4e4b',
    '\u7ed3\u8bba\u662f',
    '\u6211\u4eec\u8ba4\u4e3a',
    '\u5efa\u8bae',
    '\u5e94\u8be5',
    '\u5fc5\u987b',
    '\u6838\u5fc3\u89c2\u70b9\u662f',
    '\u5173\u952e\u662f',
    '\u91cd\u70b9\u662f',
    '\u672c\u6587\u4e3b\u5f20',
    '\u6211\u4eec\u7684\u7ed3\u8bba',
    '\u7b54\u6848\u662f',
    '\u89e3\u51b3\u65b9\u6848\u662f',
  ];

  private static readonly BURIED_CONCLUSION_SIGNALS: readonly string[] = [
    '\u9996\u5148\u8ba9\u6211\u4eec\u770b\u770b',
    '\u5728\u8ba8\u8bba\u4e4b\u524d',
    '\u8981\u7406\u89e3\u8fd9\u4e2a\u95ee\u9898',
    '\u80cc\u666f\u662f',
    '\u5386\u53f2\u4e0a',
    '\u4f17\u6240\u5468\u77e5',
    '\u4e00\u822c\u6765\u8bf4',
  ];

  private static readonly LOGICAL_CONNECTORS: Readonly<
    Record<string, readonly string[]>
  > = {
    progressive: [
      '\u6b64\u5916',
      '\u800c\u4e14',
      '\u66f4\u91cd\u8981\u7684\u662f',
      '\u8fdb\u4e00\u6b65',
      '\u4e0d\u4ec5\u5982\u6b64',
    ],
    causal: [
      '\u56e0\u4e3a',
      '\u7531\u4e8e',
      '\u6240\u4ee5',
      '\u56e0\u6b64',
      '\u5bfc\u81f4',
      '\u4f7f\u5f97',
    ],
    transition: [
      '\u4f46\u662f',
      '\u7136\u800c',
      '\u4e0d\u8fc7',
      '\u5c3d\u7ba1\u5982\u6b64',
      '\u76f8\u53cd',
    ],
    parallel: [
      '\u540c\u65f6',
      '\u53e6\u5916',
      '\u4e00\u65b9\u9762...\u53e6\u4e00\u65b9\u9762',
      '\u65e2...\u53c8',
    ],
    summary: [
      '\u603b\u4e4b',
      '\u7efc\u4e0a',
      '\u6982\u62ec\u6765\u8bf4',
      '\u7b80\u8a00\u4e4b',
    ],
  };

  private static readonly STRUCTURE_MARKERS: readonly string[] = [
    '\u7b2c\u4e00',
    '\u7b2c\u4e8c',
    '\u7b2c\u4e09',
    '\u9996\u5148',
    '\u5176\u6b21',
    '\u6700\u540e',
    '\u4e00\u662f',
    '\u4e8c\u662f',
    '\u4e09\u662f',
    '1.',
    '2.',
    '3.',
    '\u4e00\u3001',
    '\u4e8c\u3001',
    '\u4e09\u3001',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const issues: Issue[] = [];
    const metrics: Record<string, number> = {};

    const paragraphs = content
      .split('\n\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const sentences = this.splitSentences(content);

    const [conclusionScore, conclusionIssues] =
      this.evaluateConclusionFirst(content, paragraphs, sentences);
    metrics['conclusion_first'] = conclusionScore;
    issues.push(...conclusionIssues);

    const [verticalScore, verticalIssues] = this.evaluateVerticalStructure(
      content,
      paragraphs,
    );
    metrics['vertical_structure'] = verticalScore;
    issues.push(...verticalIssues);

    const [horizontalScore, horizontalIssues] =
      this.evaluateHorizontalStructure(content, paragraphs);
    metrics['horizontal_structure'] = horizontalScore;
    issues.push(...horizontalIssues);

    const [meceScore, meceIssues] = this.evaluateMece(content, paragraphs);
    metrics['mece_compliance'] = meceScore;
    issues.push(...meceIssues);

    const weights: Record<string, number> = {
      conclusion_first: 0.3,
      vertical_structure: 0.25,
      horizontal_structure: 0.25,
      mece_compliance: 0.2,
    };

    const totalScore = Object.entries(weights).reduce(
      (sum, [k, w]) => sum + (metrics[k] ?? 0) * w,
      0,
    );

    const summary = this.generateSummary(totalScore, metrics, issues);

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      metrics,
      summary,
    );
  }

  private evaluateConclusionFirst(
    content: string,
    paragraphs: string[],
    sentences: string[],
  ): [number, Issue[]] {
    const issues: Issue[] = [];
    let score = 50;

    if (paragraphs.length === 0 || sentences.length === 0) {
      return [score, issues];
    }

    const firstSentences = sentences.slice(0, Math.min(3, sentences.length));
    const firstText = firstSentences.join(' ');

    const hasConclusionSignal = PyramidEvaluator.CONCLUSION_SIGNALS.some(
      (s) => firstText.includes(s),
    );

    if (hasConclusionSignal) {
      score += 30;
    } else {
      issues.push({
        code: 'PYRAMID_NO_CONCLUSION_FIRST',
        message:
          '\u5f00\u7bc7\u672a\u660e\u786e\u9648\u8ff0\u6838\u5fc3\u7ed3\u8bba\uff0c\u8bfb\u8005\u53ef\u80fd\u9700\u8981\u9605\u8bfb\u5168\u6587\u624d\u80fd\u7406\u89e3\u91cd\u70b9',
        severity: Severity.MAJOR,
        location: '\u5f00\u5934\u6bb5\u843d',
        suggestion:
          '\u5728\u6587\u7ae0\u5f00\u5934\u660e\u786e\u9648\u8ff0\u4f60\u7684\u6838\u5fc3\u89c2\u70b9\u6216\u7ed3\u8bba',
        relatedSkill: this.relatedSkill,
      });
    }

    const firstPara = paragraphs[0];
    const hasBuriedSignal = PyramidEvaluator.BURIED_CONCLUSION_SIGNALS.some(
      (s) => firstPara.slice(0, 100).includes(s),
    );

    if (hasBuriedSignal) {
      score -= 15;
      issues.push({
        code: 'PYRAMID_BURIED_CONCLUSION',
        message:
          '\u5f00\u7bc7\u4f7f\u7528\u4e86\u80cc\u666f\u94fa\u57ab\u5f0f\u5199\u6cd5\uff0c\u7ed3\u8bba\u53ef\u80fd\u88ab\u57cb\u6ca1',
        severity: Severity.MINOR,
        location: '\u5f00\u5934\u6bb5\u843d',
        suggestion:
          '\u8003\u8651\u5c06\u7ed3\u8bba\u524d\u7f6e\uff0c\u80cc\u666f\u4fe1\u606f\u53ef\u4ee5\u4f5c\u4e3a\u652f\u6491\u653e\u5728\u540e\u9762',
        relatedSkill: this.relatedSkill,
      });
    }

    const structurePreviewWords = [
      '\u4e09\u4e2a',
      '\u51e0\u4e2a\u65b9\u9762',
      '\u4ee5\u4e0b',
      '\u5c06\u4ece',
    ];
    if (structurePreviewWords.some((w) => firstPara.includes(w))) {
      score += 20;
    }

    return [Math.min(100, Math.max(0, score)), issues];
  }

  private evaluateVerticalStructure(
    content: string,
    paragraphs: string[],
  ): [number, Issue[]] {
    const issues: Issue[] = [];
    let score = 60;

    const causalConnectors = PyramidEvaluator.LOGICAL_CONNECTORS['causal'];
    const causalCount = causalConnectors.reduce(
      (sum, conn) => sum + content.split(conn).length - 1,
      0,
    );

    if (causalCount >= 3) {
      score += 20;
    } else if (causalCount >= 1) {
      score += 10;
    } else {
      issues.push({
        code: 'PYRAMID_WEAK_CAUSAL_CHAIN',
        message:
          '\u8bba\u8bc1\u7f3a\u4e4f\u660e\u786e\u7684\u56e0\u679c\u94fe\u6761\uff0c\u8bba\u70b9\u4e4b\u95f4\u7684\u903b\u8f91\u5173\u7cfb\u4e0d\u591f\u6e05\u6670',
        severity: Severity.MINOR,
        location: '\u5168\u6587',
        suggestion:
          "\u4f7f\u7528'\u56e0\u4e3a...\u6240\u4ee5...'\u7b49\u8fde\u63a5\u8bcd\u660e\u786e\u8bba\u70b9\u95f4\u7684\u903b\u8f91\u5173\u7cfb",
        relatedSkill: this.relatedSkill,
      });
    }

    const whyResponses = [
      '\u539f\u56e0\u662f',
      '\u8fd9\u662f\u56e0\u4e3a',
      '\u4e4b\u6240\u4ee5',
      '\u7406\u7531\u662f',
    ];
    if (whyResponses.some((r) => content.includes(r))) {
      score += 15;
    }

    const progressiveConnectors =
      PyramidEvaluator.LOGICAL_CONNECTORS['progressive'];
    const progressiveCount = progressiveConnectors.reduce(
      (sum, conn) => sum + content.split(conn).length - 1,
      0,
    );

    if (progressiveCount >= 2) {
      score += 5;
    }

    return [Math.min(100, Math.max(0, score)), issues];
  }

  private evaluateHorizontalStructure(
    content: string,
    paragraphs: string[],
  ): [number, Issue[]] {
    const issues: Issue[] = [];
    let score = 60;

    const markerCount = PyramidEvaluator.STRUCTURE_MARKERS.filter((m) =>
      content.includes(m),
    ).length;

    if (markerCount >= 3) {
      score += 25;
    } else if (markerCount >= 2) {
      score += 15;
    } else if (markerCount === 0) {
      issues.push({
        code: 'PYRAMID_NO_STRUCTURE_MARKERS',
        message:
          '\u7f3a\u4e4f\u6e05\u6670\u7684\u7ed3\u6784\u6807\u8bb0\uff0c\u540c\u7ea7\u8bba\u70b9\u7684\u6392\u5217\u987a\u5e8f\u4e0d\u660e\u786e',
        severity: Severity.MINOR,
        location: '\u5168\u6587',
        suggestion:
          "\u4f7f\u7528'\u7b2c\u4e00\u3001\u7b2c\u4e8c\u3001\u7b2c\u4e09'\u6216'\u9996\u5148\u3001\u5176\u6b21\u3001\u6700\u540e'\u7b49\u6807\u8bb0\u7ec4\u7ec7\u8bba\u70b9",
        relatedSkill: this.relatedSkill,
      });
    }

    const parallelMarkers = [
      '\u4e00\u65b9\u9762',
      '\u53e6\u4e00\u65b9\u9762',
      '\u540c\u65f6',
      '\u6b64\u5916',
    ];
    const parallelCount = parallelMarkers.reduce(
      (sum, m) => sum + content.split(m).length - 1,
      0,
    );

    if (parallelCount >= 2) {
      score += 10;
    }

    const summaryMarkers = PyramidEvaluator.LOGICAL_CONNECTORS['summary'];
    if (summaryMarkers.some((m) => content.includes(m))) {
      score += 5;
    }

    return [Math.min(100, Math.max(0, score)), issues];
  }

  private evaluateMece(
    content: string,
    paragraphs: string[],
  ): [number, Issue[]] {
    const issues: Issue[] = [];
    let score = 70;

    const frameworkSignals = [
      '\u4ece...\u89d2\u5ea6',
      '\u5206\u4e3a...\u7c7b',
      '\u5305\u62ec\u4ee5\u4e0b\u51e0\u4e2a\u65b9\u9762',
      '\u53ef\u4ee5\u5206\u4e3a',
      '\u4e3b\u8981\u6709',
      '\u4e09\u4e2a\u7ef4\u5ea6',
      '\u56db\u4e2a\u5c42\u9762',
    ];

    const hasFramework = frameworkSignals.some((s) => content.includes(s));

    if (hasFramework) {
      score += 15;
    } else {
      issues.push({
        code: 'PYRAMID_NO_CLEAR_FRAMEWORK',
        message:
          '\u672a\u4f7f\u7528\u660e\u786e\u7684\u5206\u7c7b\u6846\u67b6\uff0c\u53ef\u80fd\u5b58\u5728\u8bba\u70b9\u91cd\u53e0\u6216\u9057\u6f0f',
        severity: Severity.INFO,
        location: '\u5168\u6587',
        suggestion:
          '\u8003\u8651\u4f7f\u7528MECE\u6846\u67b6\uff08\u59823C\u30014P\u3001What/Why/How\uff09\u7ec4\u7ec7\u8bba\u70b9',
        relatedSkill: this.relatedSkill,
      });
    }

    const words = content.replace(/\n/g, ' ').split(/\s+/);
    if (words.length > 50) {
      const wordFreq: Record<string, number> = {};
      for (const word of words) {
        if (word.length > 2) {
          wordFreq[word] = (wordFreq[word] ?? 0) + 1;
        }
      }

      const highFreqWords = Object.entries(wordFreq).filter(
        ([, f]) => f > words.length * 0.05,
      );
      if (highFreqWords.length > 3) {
        score -= 10;
        issues.push({
          code: 'PYRAMID_POSSIBLE_OVERLAP',
          message:
            '\u90e8\u5206\u6982\u5ff5\u91cd\u590d\u51fa\u73b0\u9891\u7387\u8f83\u9ad8\uff0c\u53ef\u80fd\u5b58\u5728\u8bba\u70b9\u91cd\u53e0',
          severity: Severity.INFO,
          location: '\u5168\u6587',
          suggestion:
            '\u68c0\u67e5\u5404\u8bba\u70b9\u662f\u5426\u771f\u6b63\u72ec\u7acb\uff0c\u907f\u514d\u91cd\u590d\u8bba\u8ff0\u76f8\u540c\u5185\u5bb9',
          relatedSkill: this.relatedSkill,
        });
      }
    }

    return [Math.min(100, Math.max(0, score)), issues];
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/[。！？.!?]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private generateSummary(
    score: number,
    metrics: Record<string, number>,
    issues: Issue[],
  ): string {
    const dimensionNames: Record<string, string> = {
      conclusion_first: '\u7ed3\u8bba\u5148\u884c',
      vertical_structure: '\u7eb5\u5411\u903b\u8f91',
      horizontal_structure: '\u6a2a\u5411\u7ed3\u6784',
      mece_compliance: 'MECE\u539f\u5219',
    };

    const entries = Object.entries(metrics);
    const weakest = entries.reduce((a, b) => (b[1] < a[1] ? b : a), entries[0]);
    const strongest = entries.reduce(
      (a, b) => (b[1] > a[1] ? b : a),
      entries[0],
    );

    let summary = `\u903b\u8f91\u7ed3\u6784\u5f97\u5206\uff1a${score.toFixed(1)}/100\u3002`;
    summary += `\u6700\u5f3a\uff1a${dimensionNames[strongest[0]] ?? strongest[0]}\uff0c`;
    summary += `\u6700\u5f31\uff1a${dimensionNames[weakest[0]] ?? weakest[0]}\u3002`;

    const criticalCount = issues.filter(
      (i) => i.severity === Severity.CRITICAL,
    ).length;
    const majorCount = issues.filter(
      (i) => i.severity === Severity.MAJOR,
    ).length;

    if (criticalCount > 0) {
      summary += `\u53d1\u73b0${criticalCount}\u4e2a\u4e25\u91cd\u7ed3\u6784\u95ee\u9898\u9700\u8981\u4fee\u590d\u3002`;
    } else if (majorCount > 0) {
      summary += `\u53d1\u73b0${majorCount}\u4e2a\u4e3b\u8981\u7ed3\u6784\u95ee\u9898\u5efa\u8bae\u4f18\u5316\u3002`;
    }

    return summary;
  }

  override quickScan(content: string): EvaluationResult {
    const issues: Issue[] = [];

    const first200 =
      content.length > 200 ? content.slice(0, 200) : content;
    const hasConclusion = PyramidEvaluator.CONCLUSION_SIGNALS.some((s) =>
      first200.includes(s),
    );

    const hasStructure = PyramidEvaluator.STRUCTURE_MARKERS.some((m) =>
      content.includes(m),
    );

    let score = 50;
    if (hasConclusion) {
      score += 25;
    } else {
      issues.push({
        code: 'PYRAMID_NO_CONCLUSION_FIRST',
        message: '\u5f00\u7bc7\u53ef\u80fd\u672a\u660e\u786e\u9648\u8ff0\u7ed3\u8bba',
        severity: Severity.MAJOR,
        relatedSkill: this.relatedSkill,
      });
    }

    if (hasStructure) {
      score += 25;
    } else {
      issues.push({
        code: 'PYRAMID_NO_STRUCTURE_MARKERS',
        message: '\u7f3a\u4e4f\u7ed3\u6784\u6807\u8bb0',
        severity: Severity.MINOR,
        relatedSkill: this.relatedSkill,
      });
    }

    return new EvaluationResult(
      this.name,
      score,
      this.scoreToLevel(score),
      issues,
      {},
      `\u5feb\u901f\u626b\u63cf\uff1a\u903b\u8f91\u7ed3\u6784\u5f97\u5206${score}/100`,
    );
  }
}
