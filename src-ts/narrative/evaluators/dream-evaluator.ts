/**
 * Dream Evaluator
 *
 * Evaluates emotional immersion effects, detecting completion of
 * the four-layer emotional progression.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
  ScoreLevel,
} from './base';

export class DreamEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u865a\u6784\u68a6\u5883\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u6587\u672c\u7684\u60c5\u611f\u6c89\u6d78\u6548\u679c\uff0c\u68c0\u6d4b\u56db\u5c42\u60c5\u611f\u9012\u8fdb\uff08\u540c\u60c5\u2192\u8ba4\u540c\u2192\u79fb\u60c5\u2192\u6c89\u6d78\uff09\u7684\u5b8c\u6210\u5ea6';
  }

  get relatedSkill(): string {
    return 'fictional-dream';
  }

  private static readonly SYMPATHY_TRIGGERS: Readonly<
    Record<string, readonly string[]>
  > = {
    danger: [
      '\u5371\u9669',
      '\u5a01\u80c1',
      '\u6b7b\u4ea1',
      '\u6740',
      '\u4f24\u5bb3',
      '\u6050\u60e7',
      '\u5bb3\u6015',
    ],
    poverty: [
      '\u8d2b\u7a77',
      '\u8d2b\u56f0',
      '\u9965\u997f',
      '\u7834\u65e7',
      '\u7a77',
      '\u6b20\u503a',
      '\u843d\u9b44',
    ],
    humiliation: [
      '\u7f9e\u8fb1',
      '\u5632\u7b11',
      '\u8bbd\u523a',
      '\u8511\u89c6',
      '\u8f7b\u89c6',
      '\u6b67\u89c6',
      '\u6392\u6324',
    ],
    loneliness: [
      '\u5b64\u72ec',
      '\u5b64\u5355',
      '\u5bc2\u5bde',
      '\u72ec\u81ea',
      '\u65e0\u4eba',
      '\u9057\u5f03',
      '\u629b\u5f03',
    ],
    helplessness: [
      '\u65e0\u52a9',
      '\u7edd\u671b',
      '\u65e0\u529b',
      '\u65e0\u5948',
      '\u675f\u624b\u65e0\u7b56',
      '\u8d70\u6295\u65e0\u8def',
    ],
  };

  private static readonly SENSORY_PATTERNS: Readonly<
    Record<string, readonly string[]>
  > = {
    visual: [
      '\u770b\u5230',
      '\u671b\u89c1',
      '\u7786\u89c1',
      '\u773c\u524d',
      '\u6620\u5165',
      '\u76ee\u5149',
      '\u989c\u8272',
      '\u5149',
    ],
    auditory: [
      '\u542c\u5230',
      '\u58f0\u97f3',
      '\u54cd\u8d77',
      '\u56de\u8361',
      '\u55e1\u55e1',
      '\u6c99\u6c99',
      '\u5636\u6742',
    ],
    tactile: [
      '\u89e6\u6478',
      '\u611f\u89c9',
      '\u51b0\u51b7',
      '\u6e29\u70ed',
      '\u7c97\u7cd9',
      '\u5149\u6ed1',
      '\u523a\u75db',
    ],
    olfactory: [
      '\u95fb\u5230',
      '\u6c14\u5473',
      '\u82b3\u9999',
      '\u6076\u81ed',
      '\u5f25\u6f2b',
      '\u6251\u9f3b',
    ],
    gustatory: [
      '\u5c1d\u5230',
      '\u5473\u9053',
      '\u82e6\u6da9',
      '\u7518\u751c',
      '\u9178',
      '\u8fa3',
    ],
    kinesthetic: [
      '\u5fc3\u8df3',
      '\u98a4\u6296',
      '\u50f5\u786c',
      '\u653e\u677e',
      '\u7d27\u7ef7',
      '\u547c\u5438',
    ],
  };

  private static readonly CONFLICT_MARKERS: readonly string[] = [
    '\u4f46\u662f',
    '\u7136\u800c',
    '\u53ef\u662f',
    '\u5374',
    '\u867d\u7136',
    '\u5c3d\u7ba1',
    '\u4e00\u65b9\u9762',
    '\u53e6\u4e00\u65b9\u9762',
    '\u65e2\u60f3',
    '\u53c8\u6015',
    '\u72b9\u8c6b',
    '\u6323\u624e',
    '\u7ea0\u7ed3',
    '\u77db\u76fe',
    '\u4e24\u96be',
    '\u5e94\u8be5',
    '\u4e0d\u5e94\u8be5',
    '\u80fd',
    '\u4e0d\u80fd',
    '\u60f3\u8981',
    '\u4e0d\u6562',
    '\u6e34\u671b',
    '\u6050\u60e7',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const sympathyScore = this.evaluateSympathy(content);
    const identificationScore = this.evaluateIdentification(content, context);
    const empathyScore = this.evaluateEmpathy(content);
    const immersionScore = this.evaluateImmersion(content);

    const totalScore =
      sympathyScore * 0.2 +
      identificationScore * 0.25 +
      empathyScore * 0.3 +
      immersionScore * 0.25;

    const issues: Issue[] = [];

    if (sympathyScore < 60) {
      issues.push({
        code: 'DREAM_SYMPATHY_WEAK',
        message:
          '\u540c\u60c5\u5c42\u8584\u5f31\uff1a\u8bfb\u8005\u96be\u4ee5\u5bf9\u89d2\u8272\u4ea7\u751f\u601c\u60af\u4e4b\u5fc3',
        severity: Severity.MAJOR,
        suggestion:
          '\u5c55\u793a\u89d2\u8272\u7684\u666e\u904d\u6027\u56f0\u5883\uff08\u5371\u9669/\u8d2b\u7a77/\u5b64\u72ec/\u65e0\u52a9\uff09',
        relatedSkill: 'fictional-dream',
      });
    }

    if (identificationScore < 60) {
      issues.push({
        code: 'DREAM_IDENTIFICATION_WEAK',
        message:
          '\u8ba4\u540c\u5c42\u8584\u5f31\uff1a\u8bfb\u8005\u4e0d\u652f\u6301\u89d2\u8272\u7684\u76ee\u6807',
        severity: Severity.MAJOR,
        suggestion:
          '\u660e\u786e\u89d2\u8272\u76ee\u6807\u5e76\u4e0e\u5d07\u9ad8\u4ef7\u503c\u7ed1\u5b9a',
        relatedSkill: 'fictional-dream',
      });
    }

    if (empathyScore < 60) {
      issues.push({
        code: 'DREAM_EMPATHY_WEAK',
        message:
          '\u79fb\u60c5\u5c42\u8584\u5f31\uff1a\u8bfb\u8005\u65e0\u6cd5\u611f\u53d7\u89d2\u8272\u7684\u611f\u53d7',
        severity: Severity.CRITICAL,
        suggestion:
          '\u589e\u52a0\u6fc0\u53d1\u60c5\u611f\u7684\u611f\u5b98\u7ec6\u8282\u63cf\u5199',
        relatedSkill: 'fictional-dream',
      });
    }

    if (immersionScore < 60) {
      issues.push({
        code: 'DREAM_IMMERSION_WEAK',
        message:
          '\u6c89\u6d78\u5c42\u8584\u5f31\uff1a\u8bfb\u8005\u65e0\u6cd5\u5b8c\u5168\u8fdb\u5165\u6545\u4e8b',
        severity: Severity.MAJOR,
        suggestion:
          '\u589e\u52a0\u89d2\u8272\u7684\u5185\u5fc3\u51b2\u7a81\u548c\u9053\u5fb7\u6289\u62e9',
        relatedSkill: 'fictional-dream',
      });
    }

    const layerScores: Record<string, number> = {
      sympathy: sympathyScore,
      identification: identificationScore,
      empathy: empathyScore,
      immersion: immersionScore,
    };

    const entries = Object.entries(layerScores);
    const weakestLayer = entries.reduce((a, b) => (b[1] < a[1] ? b : a), entries[0])[0];

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      layerScores,
      `\u68a6\u5883\u5f3a\u5ea6\uff1a${this.scoreToLevel(totalScore)}\uff0c\u6700\u8584\u5f31\u5c42\u7ea7\uff1a${weakestLayer}`,
      { weakestLayer, layerScores },
    );
  }

  override quickScan(content: string): EvaluationResult {
    const sympathy = this.evaluateSympathy(content);
    const empathy = this.evaluateEmpathy(content);
    const immersion = this.evaluateImmersion(content);

    const avgScore = (sympathy + empathy + immersion) / 3;

    const issues: Issue[] = [];
    if (empathy < 50) {
      issues.push({
        code: 'DREAM_SENSORY_LACKING',
        message: '\u611f\u5b98\u7ec6\u8282\u4e0d\u8db3',
        severity: Severity.MAJOR,
        relatedSkill: 'fictional-dream',
      });
    }

    return new EvaluationResult(
      this.name,
      avgScore,
      this.scoreToLevel(avgScore),
      issues,
      {},
      `\u5feb\u901f\u626b\u63cf\u5b8c\u6210\uff0c\u5f97\u5206\uff1a${avgScore.toFixed(1)}`,
    );
  }

  private evaluateSympathy(content: string): number {
    let score = 50;

    for (const keywords of Object.values(
      DreamEvaluator.SYMPATHY_TRIGGERS,
    )) {
      for (const keyword of keywords) {
        if (content.includes(keyword)) {
          score += 5;
          break;
        }
      }
    }

    return Math.min(100, score);
  }

  private evaluateIdentification(
    content: string,
    context?: Record<string, unknown>,
  ): number {
    let score = 50;

    const goalWords = [
      '\u76ee\u6807',
      '\u68a6\u60f3',
      '\u4f7f\u547d',
      '\u8d23\u4efb',
      '\u4fdd\u62a4',
      '\u62ef\u6551',
      '\u8ffd\u6c42',
    ];
    for (const word of goalWords) {
      if (content.includes(word)) {
        score += 8;
      }
    }

    if (context?.['character_goal']) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private evaluateEmpathy(content: string): number {
    let totalSensory = 0;

    for (const patterns of Object.values(
      DreamEvaluator.SENSORY_PATTERNS,
    )) {
      for (const pattern of patterns) {
        totalSensory += content.split(pattern).length - 1;
      }
    }

    const textLength = content.length;
    if (textLength === 0) return 0;

    const density = (totalSensory / textLength) * 1000;

    if (density >= 10) return 100;
    if (density >= 5) return 80;
    if (density >= 2) return 60;
    return 40;
  }

  private evaluateImmersion(content: string): number {
    let conflictCount = 0;

    for (const marker of DreamEvaluator.CONFLICT_MARKERS) {
      conflictCount += content.split(marker).length - 1;
    }

    const textLength = content.length;
    if (textLength === 0) return 0;

    const density = (conflictCount / textLength) * 1000;

    if (density >= 8) return 100;
    if (density >= 4) return 80;
    if (density >= 2) return 60;
    return 40;
  }
}
