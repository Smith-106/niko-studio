/**
 * Four Selves Evaluator
 *
 * Evaluates the depth of character self-revelation across four layers:
 * Social Self, Personal Self, Private Self, and Hidden Self.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';

export class FourSelvesEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u56db\u4e2a\u81ea\u6211\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u89d2\u8272\u56db\u4e2a\u81ea\u6211\u5c42\u6b21\u7684\u63ed\u793a\uff1a\u793e\u4f1a/\u4e2a\u4eba/\u79c1\u5bc6/\u9690\u85cf\u81ea\u6211';
  }

  get relatedSkill(): string {
    return 'four-selves';
  }

  private static readonly SOCIAL_SELF_MARKERS: readonly string[] = [
    '\u540c\u4e8b',
    '\u5ba2\u6237',
    '\u516c\u4f17',
    '\u5a92\u4f53',
    '\u4f1a\u8bae',
    '\u6f14\u8bb2',
    '\u804c\u4e1a',
    '\u8eab\u4efd',
    '\u5f62\u8c61',
    '\u8868\u73b0',
    '\u88c5\u4f5c',
    '\u5047\u88c5',
    '\u897f\u88c5',
    '\u5236\u670d',
    '\u540d\u7247',
    '\u5934\u8854',
  ];

  private static readonly PERSONAL_SELF_MARKERS: readonly string[] = [
    '\u5bb6\u4eba',
    '\u670b\u53cb',
    '\u7231\u4eba',
    '\u5b69\u5b50',
    '\u7236\u6bcd',
    '\u56de\u5bb6',
    '\u653e\u677e',
    '\u5378\u4e0b',
    '\u79c1\u4e0b',
    '\u5176\u5b9e',
    '\u771f\u5b9e\u7684',
    '\u5e73\u65f6',
  ];

  private static readonly PRIVATE_SELF_MARKERS: readonly string[] = [
    '\u72ec\u81ea',
    '\u4e00\u4e2a\u4eba',
    '\u6df1\u591c',
    '\u51cc\u6668',
    '\u955c\u5b50',
    '\u5185\u5fc3',
    '\u4e0d\u613f\u8ba9\u4eba\u77e5\u9053',
    '\u79d8\u5bc6',
    '\u65e5\u8bb0',
    '\u6ca1\u4eba\u7684\u65f6\u5019',
    '\u5173\u4e0a\u95e8',
  ];

  private static readonly HIDDEN_SELF_MARKERS: readonly string[] = [
    '\u538b\u6291',
    '\u57cb\u85cf',
    '\u4ece\u672a\u544a\u8bc9',
    '\u4e0d\u6562\u9762\u5bf9',
    '\u5669\u68a6',
    '\u95ea\u56de',
    '\u521b\u4f24',
    '\u591a\u5e74\u524d',
    '\u771f\u76f8\u662f',
    '\u5176\u5b9e\u4e00\u76f4',
    '\u4ece\u6765\u6ca1\u6709\u627f\u8ba4',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const socialScore = this.evaluateLayer(
      content,
      FourSelvesEvaluator.SOCIAL_SELF_MARKERS,
    );
    const personalScore = this.evaluateLayer(
      content,
      FourSelvesEvaluator.PERSONAL_SELF_MARKERS,
    );
    const privateScore = this.evaluateLayer(
      content,
      FourSelvesEvaluator.PRIVATE_SELF_MARKERS,
    );
    const hiddenScore = this.evaluateLayer(
      content,
      FourSelvesEvaluator.HIDDEN_SELF_MARKERS,
    );

    const layersPresent =
      (socialScore > 30 ? 1 : 0) +
      (personalScore > 30 ? 1 : 0) +
      (privateScore > 30 ? 1 : 0) +
      (hiddenScore > 30 ? 1 : 0);

    const layerAverage =
      (socialScore + personalScore + privateScore + hiddenScore) / 4;
    const depthBonus = layersPresent * 10;

    const totalScore = Math.min(100, layerAverage * 0.6 + depthBonus);

    const issues: Issue[] = [];

    if (layersPresent < 2) {
      issues.push({
        code: 'CHARACTER_SHALLOW',
        message: '\u89d2\u8272\u5c42\u6b21\u5355\u4e00\uff0c\u7f3a\u4e4f\u6df1\u5ea6',
        severity: Severity.MAJOR,
        suggestion:
          '\u63ed\u793a\u89d2\u8272\u5728\u4e0d\u540c\u573a\u5408\u7684\u4e0d\u540c\u9762\u8c8c',
        relatedSkill: 'four-selves',
      });
    }

    if (privateScore < 30 && hiddenScore < 30) {
      issues.push({
        code: 'CHARACTER_NO_INNER_WORLD',
        message:
          '\u89d2\u8272\u7f3a\u4e4f\u79c1\u5bc6\u81ea\u6211\u548c\u9690\u85cf\u81ea\u6211\u7684\u63ed\u793a',
        severity: Severity.MAJOR,
        suggestion:
          '\u6dfb\u52a0\u89d2\u8272\u72ec\u5904\u65f6\u7684\u771f\u5b9e\u72b6\u6001\u6216\u538b\u6291\u7684\u79d8\u5bc6',
        relatedSkill: 'four-selves',
      });
    }

    if (socialScore > 70 && personalScore < 30) {
      issues.push({
        code: 'CHARACTER_ALL_MASK',
        message:
          '\u89d2\u8272\u53ea\u5c55\u793a\u793e\u4f1a\u9762\u5177\uff0c\u7f3a\u4e4f\u771f\u5b9e\u7684\u4e2a\u4eba\u5c42\u9762',
        severity: Severity.MINOR,
        suggestion:
          '\u5c55\u793a\u89d2\u8272\u5728\u4eb2\u5bc6\u5173\u7cfb\u4e2d\u7684\u4e0d\u540c\u8868\u73b0',
        relatedSkill: 'four-selves',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        social_self: socialScore,
        personal_self: personalScore,
        private_self: privateScore,
        hidden_self: hiddenScore,
        layers_present: layersPresent,
      },
      `\u89d2\u8272\u6df1\u5ea6\uff1a${layersPresent}/4\u5c42\uff0c${this.scoreToLevel(totalScore)}`,
    );
  }

  private evaluateLayer(content: string, markers: readonly string[]): number {
    let score = 20;
    for (const marker of markers) {
      if (content.includes(marker)) {
        score += 15;
      }
    }
    return Math.min(100, score);
  }
}
