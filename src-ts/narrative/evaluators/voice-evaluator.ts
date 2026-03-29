/**
 * Voice Evaluator
 *
 * Evaluates the strength and consistency of narrative voice.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';

export class VoiceEvaluator extends BaseEvaluator {
  get name(): string {
    return '\u53d9\u4e8b\u8bed\u6c14\u8bc4\u4f30\u5668';
  }

  get description(): string {
    return '\u8bc4\u4f30\u53d9\u8ff0\u8bed\u6c14\u7684\u5f3a\u5ea6\u3001\u5177\u4f53\u6027\u548c\u4e00\u81f4\u6027';
  }

  get relatedSkill(): string {
    return 'voice-workshop';
  }

  private static readonly VAGUE_WORDS: readonly string[] = [
    '\u5f88',
    '\u975e\u5e38',
    '\u7279\u522b',
    '\u5341\u5206',
    '\u6781\u5176',
    '\u597d',
    '\u574f',
    '\u5927',
    '\u5c0f',
    '\u591a',
    '\u5c11',
    '\u7f8e\u4e3d',
    '\u6f02\u4eae',
    '\u82f1\u4fca',
    '\u4e11\u964b',
    '\u597d\u4eba',
    '\u574f\u4eba',
    '\u597d\u4e8b',
    '\u574f\u4e8b',
  ];

  private static readonly SPECIFIC_MARKERS: readonly string[] = [
    '[A-Z][a-z]+',
    '\\d+(?:\u7c73|\u5398\u7c73|\u516c\u65a4|\u5757\u94b1|\u5c81|\u5e74|\u6708|\u65e5|\u70b9|\u5206)',
    '(?:\u6df1|\u6d45|\u6697|\u4eae)?(?:\u7ea2|\u6a59|\u9ec4|\u7eff|\u84dd|\u7d2b|\u9ed1|\u767d|\u7070|\u68d5)\u8272?',
  ];

  private static readonly NARRATOR_ATTITUDE_MARKERS: readonly string[] = [
    '\u663e\u7136',
    '\u6beb\u65e0\u7591\u95ee',
    '\u4e0d\u5f97\u4e0d\u8bf4',
    '\u8bf4\u5b9e\u8bdd',
    '\u8bbd\u523a\u7684\u662f',
    '\u6709\u8da3\u7684\u662f',
    '\u53ef\u7b11\u7684\u662f',
    '\u4ee4\u4eba\u60ca\u8bb6\u7684\u662f',
    '\u4e0d\u5e78\u7684\u662f',
    '\u5e78\u8fd0\u7684\u662f',
  ];

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const specificity = this.evaluateSpecificity(content);
    const vaguenessPenalty = this.evaluateVagueness(content);
    const narratorPresence = this.evaluateNarratorPresence(content);

    const totalScore =
      specificity * 0.4 +
      (100 - vaguenessPenalty) * 0.3 +
      narratorPresence * 0.3;

    const issues: Issue[] = [];

    if (specificity < 60) {
      issues.push({
        code: 'VOICE_LACKS_DETAIL',
        message:
          '\u5177\u4f53\u7ec6\u8282\u4e0d\u8db3\uff0c\u8bed\u6c14\u663e\u5f97\u865a\u5f31',
        severity: Severity.MAJOR,
        suggestion:
          '\u7528\u5177\u4f53\u7ec6\u8282\u66ff\u6362\u7a7a\u6cdb\u63cf\u8ff0',
        relatedSkill: 'voice-workshop',
      });
    }

    if (vaguenessPenalty > 40) {
      issues.push({
        code: 'VOICE_TOO_VAGUE',
        message: '\u7a7a\u6cdb\u8bcd\u6c47\u8fc7\u591a',
        severity: Severity.MAJOR,
        suggestion:
          "\u51cf\u5c11'\u5f88/\u975e\u5e38/\u7279\u522b'\u7b49\u7a7a\u6cdb\u4fee\u9970\u8bcd",
        relatedSkill: 'voice-workshop',
      });
    }

    if (narratorPresence < 40) {
      issues.push({
        code: 'VOICE_INVISIBLE',
        message:
          '\u53d9\u8ff0\u8005\u8fc7\u4e8e\u9690\u8eab\uff0c\u7f3a\u4e4f\u4e2a\u6027',
        severity: Severity.MINOR,
        suggestion:
          '\u5141\u8bb8\u53d9\u8ff0\u8005\u8868\u8fbe\u89c2\u70b9\u548c\u6001\u5ea6',
        relatedSkill: 'voice-workshop',
      });
    }

    return new EvaluationResult(
      this.name,
      totalScore,
      this.scoreToLevel(totalScore),
      issues,
      {
        specificity,
        vagueness_penalty: vaguenessPenalty,
        narrator_presence: narratorPresence,
      },
      `\u8bed\u6c14\u5f3a\u5ea6\uff1a${this.scoreToLevel(totalScore)}`,
    );
  }

  private evaluateSpecificity(content: string): number {
    let score = 50;
    for (const pattern of VoiceEvaluator.SPECIFIC_MARKERS) {
      const re = new RegExp(pattern, 'g');
      const matches = content.match(re);
      score += (matches?.length ?? 0) * 3;
    }
    return Math.min(100, score);
  }

  private evaluateVagueness(content: string): number {
    let vagueCount = 0;
    for (const word of VoiceEvaluator.VAGUE_WORDS) {
      vagueCount += content.split(word).length - 1;
    }

    if (content.length === 0) return 0;
    const density = (vagueCount / content.length) * 1000;
    return Math.min(100, density * 10);
  }

  private evaluateNarratorPresence(content: string): number {
    let score = 30;
    for (const marker of VoiceEvaluator.NARRATOR_ATTITUDE_MARKERS) {
      if (content.includes(marker)) {
        score += 12;
      }
    }
    return Math.min(100, score);
  }
}
