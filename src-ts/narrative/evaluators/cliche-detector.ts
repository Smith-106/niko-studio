/**
 * Cliche Detector
 *
 * Scans text for cliches across opening, character, plot, dialogue,
 * and description dimensions.
 */

import {
  BaseEvaluator,
  EvaluationResult,
  Issue,
  Severity,
} from './base';
import { WebNovelGenre, GENRE_TEMPLATES } from '../writing-craft/genre-templates';

interface ClicheEntry {
  pattern: string;
  label: string;
}

interface FoundCliche {
  pattern: string;
  label: string;
  count: number;
}

export interface GenreClicheMatch {
  pattern: string;
  count: number;
}

export interface GenreClicheResult {
  genre: WebNovelGenre;
  foundCliches: GenreClicheMatch[];
  genreScore: number;
}

export class ClicheDetector extends BaseEvaluator {
  get name(): string {
    return '\u9648\u8bcd\u6ee5\u8c03\u68c0\u6d4b\u5668';
  }

  get description(): string {
    return '\u68c0\u6d4b\u6587\u672c\u4e2d\u7684\u9648\u8bcd\u6ee5\u8c03\uff1a\u5f00\u573a\u3001\u89d2\u8272\u3001\u60c5\u8282\u3001\u5bf9\u8bdd';
  }

  get relatedSkill(): string {
    return 'script-doctor';
  }

  private static readonly OPENING_CLICHES: readonly ClicheEntry[] = [
    { pattern: '\u95f9\u949f\u54cd', label: '\u5f00\u573a-\u95f9\u949f\u54cd\u8d77' },
    { pattern: '\u4ece\u68a6\u4e2d\u9192\u6765', label: '\u5f00\u573a-\u4ece\u68a6\u4e2d\u9192\u6765' },
    { pattern: '\u7741\u5f00\u773c', label: '\u5f00\u573a-\u7741\u5f00\u773c\u775b' },
    { pattern: '\u53c8\u662f\u65b0\u7684\u4e00\u5929', label: '\u5f00\u573a-\u65b0\u7684\u4e00\u5929' },
    { pattern: '\u9633\u5149\u900f\u8fc7\u7a97\u5e18', label: '\u5f00\u573a-\u9633\u5149\u63cf\u5199' },
    { pattern: '\u7167\u955c\u5b50', label: '\u5f00\u573a-\u5bf9\u955c\u63cf\u5199\u5916\u8c8c' },
  ];

  private static readonly CHARACTER_CLICHES: readonly ClicheEntry[] = [
    { pattern: '\u5931\u5fc6', label: '\u89d2\u8272-\u5931\u5fc6\u8bbe\u5b9a' },
    { pattern: '\u88ab\u9009\u4e2d', label: '\u89d2\u8272-\u88ab\u9009\u4e2d\u7684\u4eba' },
    { pattern: '\u5b64\u513f', label: '\u89d2\u8272-\u5b64\u513f\u8bbe\u5b9a' },
    { pattern: '\u51b7\u9177\u9738\u603b', label: '\u89d2\u8272-\u9738\u603b' },
    { pattern: '\u9ad8\u51b7', label: '\u89d2\u8272-\u9ad8\u51b7\u4eba\u8bbe' },
    { pattern: '\u8179\u9ed1', label: '\u89d2\u8272-\u8179\u9ed1' },
    { pattern: '\u50b2\u5a07', label: '\u89d2\u8272-\u50b2\u5a07' },
    { pattern: '\u767d\u6708\u5149', label: '\u89d2\u8272-\u767d\u6708\u5149' },
    { pattern: '\u5929\u624d', label: '\u89d2\u8272-\u5929\u624d\u8bbe\u5b9a' },
  ];

  private static readonly PLOT_CLICHES: readonly ClicheEntry[] = [
    { pattern: '\u8bef\u4f1a\u5206\u624b', label: '\u60c5\u8282-\u8bef\u4f1a\u5bfc\u81f4\u5206\u624b' },
    { pattern: '\u8f66\u7978', label: '\u60c5\u8282-\u8f66\u7978' },
    { pattern: '\u7edd\u75c7', label: '\u60c5\u8282-\u7edd\u75c7' },
    { pattern: '\u5931\u8840\u8fc7\u591a', label: '\u60c5\u8282-\u5931\u8840\u8fc7\u591a' },
    { pattern: '\u5815\u80ce', label: '\u60c5\u8282-\u5815\u80ce' },
    { pattern: '\u7b2c\u4e09\u8005', label: '\u60c5\u8282-\u7b2c\u4e09\u8005' },
    { pattern: '\u72d7\u8840', label: '\u60c5\u8282-\u72d7\u8840' },
    { pattern: '\u5de7\u5408', label: '\u60c5\u8282-\u5de7\u5408' },
    { pattern: '\u6b63\u597d', label: '\u60c5\u8282-\u6b63\u597d' },
  ];

  private static readonly DIALOGUE_CLICHES: readonly ClicheEntry[] = [
    { pattern: '\u6211\u4eec\u9700\u8981\u8c08\u8c08', label: '\u5bf9\u8bdd-\u6211\u4eec\u9700\u8981\u8c08\u8c08' },
    { pattern: '\u4f60\u6839\u672c\u4e0d\u4e86\u89e3\u6211', label: '\u5bf9\u8bdd-\u4f60\u4e0d\u4e86\u89e3\u6211' },
    { pattern: '\u76f8\u4fe1\u6211', label: '\u5bf9\u8bdd-\u76f8\u4fe1\u6211' },
    { pattern: '\u6211\u6709\u4e2a\u8ba1\u5212', label: '\u5bf9\u8bdd-\u6211\u6709\u4e2a\u8ba1\u5212' },
    { pattern: '\u8fd9\u4e0d\u662f\u4f60\u7684\u9519', label: '\u5bf9\u8bdd-\u8fd9\u4e0d\u662f\u4f60\u7684\u9519' },
    { pattern: '\u4ece\u4eca\u4ee5\u540e', label: '\u5bf9\u8bdd-\u4ece\u4eca\u4ee5\u540e' },
    { pattern: '\u4e00\u5207\u90fd\u4f1a\u4e0d\u540c', label: '\u5bf9\u8bdd-\u4e00\u5207\u90fd\u4f1a\u4e0d\u540c' },
    { pattern: '\u4f60\u53d8\u4e86', label: '\u5bf9\u8bdd-\u4f60\u53d8\u4e86' },
  ];

  private static readonly DESCRIPTION_CLICHES: readonly ClicheEntry[] = [
    { pattern: '\u4e0d\u7981', label: '\u63cf\u5199-\u4e0d\u7981' },
    { pattern: '\u5fcd\u4e0d\u4f4f', label: '\u63cf\u5199-\u5fcd\u4e0d\u4f4f' },
    { pattern: '\u7a81\u7136', label: '\u63cf\u5199-\u7a81\u7136' },
    { pattern: '\u7adf\u7136', label: '\u63cf\u5199-\u7adf\u7136' },
    { pattern: '\u5c45\u7136', label: '\u63cf\u5199-\u5c45\u7136' },
    { pattern: '\u77ac\u95f4', label: '\u63cf\u5199-\u77ac\u95f4' },
    { pattern: '\u773c\u7736\u6e7f\u6da6', label: '\u63cf\u5199-\u773c\u7736\u6e7f\u6da6' },
    { pattern: '\u6cea\u5982\u96e8\u4e0b', label: '\u63cf\u5199-\u6cea\u5982\u96e8\u4e0b' },
    { pattern: '\u5fc3\u5982\u5200\u5272', label: '\u63cf\u5199-\u5fc3\u5982\u5200\u5272' },
  ];

  private static readonly ALL_CLICHES: readonly ClicheEntry[] = [
    ...ClicheDetector.OPENING_CLICHES,
    ...ClicheDetector.CHARACTER_CLICHES,
    ...ClicheDetector.PLOT_CLICHES,
    ...ClicheDetector.DIALOGUE_CLICHES,
    ...ClicheDetector.DESCRIPTION_CLICHES,
  ];

  detectGenreCliches(text: string, genre: WebNovelGenre): GenreClicheResult {
    const template = GENRE_TEMPLATES[genre];
    if (!template) {
      return { genre, foundCliches: [], genreScore: 100 };
    }

    const foundCliches: GenreClicheMatch[] = [];
    for (const pattern of template.cliches) {
      const count = text.split(pattern).length - 1;
      if (count > 0) {
        foundCliches.push({ pattern, count });
      }
    }

    const deduction = foundCliches.reduce((sum, c) => sum + c.count * 10, 0);
    const genreScore = Math.max(0, 100 - deduction);

    return { genre, foundCliches, genreScore };
  }

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult> {
    const foundCliches: FoundCliche[] = [];

    for (const { pattern, label } of ClicheDetector.ALL_CLICHES) {
      const count = content.split(pattern).length - 1;
      if (count > 0) {
        foundCliches.push({ pattern, label, count });
      }
    }

    const baseScore = 100;
    const deductionPerCliche = 8;
    const totalDeduction = foundCliches.reduce(
      (sum, c) => sum + c.count * deductionPerCliche,
      0,
    );

    const finalScore = Math.max(0, baseScore - totalDeduction);

    const issues: Issue[] = [];

    if (foundCliches.length > 0) {
      const clicheSummary = foundCliches
        .slice(0, 5)
        .map((c) => `\u300c${c.pattern}\u300d(${c.count}\u6b21)`)
        .join(', ');

      const severity =
        foundCliches.length > 3 ? Severity.MAJOR : Severity.MINOR;

      issues.push({
        code: 'CLICHE_DETECTED',
        message: `\u68c0\u6d4b\u5230${foundCliches.length}\u5904\u9648\u8bcd\u6ee5\u8c03\uff1a${clicheSummary}`,
        severity,
        suggestion:
          '\u8003\u8651\u4f7f\u7528\u66f4\u72ec\u7279\u7684\u8868\u8fbe\u65b9\u5f0f\u66ff\u4ee3\u8fd9\u4e9b\u8001\u5957\u6865\u6bb5',
        relatedSkill: 'script-doctor',
      });
    }

    const isOpening = context?.['is_opening'] === true;
    if (isOpening) {
      const openingIssues = foundCliches.filter((c) =>
        c.label.includes('\u5f00\u573a'),
      );
      if (openingIssues.length > 0) {
        issues.push({
          code: 'OPENING_CLICHE',
          message: '\u5f00\u573a\u4f7f\u7528\u4e86\u9648\u8bcd\u6ee5\u8c03\u7684\u65b9\u5f0f',
          severity: Severity.MAJOR,
          suggestion:
            '\u5c1d\u8bd5\u4ece\u51b2\u7a81\u6216\u60ac\u5ff5\u5f00\u59cb\uff0c\u800c\u975e\u65e5\u5e38\u63cf\u5199',
          relatedSkill: 'script-doctor',
        });
      }
    }

    const totalOccurrences = foundCliches.reduce(
      (sum, c) => sum + c.count,
      0,
    );

    return new EvaluationResult(
      this.name,
      finalScore,
      this.scoreToLevel(finalScore),
      issues,
      {
        cliche_count: foundCliches.length,
        total_cliche_occurrences: totalOccurrences,
      },
      `\u9648\u8bcd\u6ee5\u8c03\u68c0\u6d4b\uff1a\u53d1\u73b0${foundCliches.length}\u5904`,
      {
        cliche_details: foundCliches.map((c) => ({
          pattern: c.pattern,
          label: c.label,
          count: c.count,
        })),
      },
    );
  }
}
