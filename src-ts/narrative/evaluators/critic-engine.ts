/**
 * Critic Engine
 *
 * Integrates all evaluators, providing a unified evaluation interface.
 * Based on the five-module theory for comprehensive assessment.
 */

import {
  EvaluationResult,
  Issue,
  Severity,
  ScoreLevel,
  BaseEvaluator,
} from './base';
import { DreamEvaluator } from './dream-evaluator';
import { SuspenseEvaluator } from './suspense-evaluator';
import { CharacterEvaluator } from './character-evaluator';
import { PremiseEvaluator } from './premise-evaluator';
import { VoiceEvaluator } from './voice-evaluator';
import type { INarrativeLLMClient } from '../types';
import { scoreToLevel } from '../types';

export class ComprehensiveReport {
  readonly overallScore: number;
  readonly overallLevel: string;
  readonly moduleScores: Record<string, number>;
  readonly allIssues: Issue[];
  readonly criticalIssues: Issue[];
  readonly top3Issues: Issue[];
  readonly moduleResults: Record<string, EvaluationResult>;
  readonly summary: string;
  readonly recommendedSkills: string[];

  constructor(data: {
    overallScore: number;
    overallLevel: string;
    moduleScores: Record<string, number>;
    allIssues: Issue[];
    criticalIssues: Issue[];
    top3Issues: Issue[];
    moduleResults: Record<string, EvaluationResult>;
    summary: string;
    recommendedSkills: string[];
  }) {
    this.overallScore = data.overallScore;
    this.overallLevel = data.overallLevel;
    this.moduleScores = data.moduleScores;
    this.allIssues = data.allIssues;
    this.criticalIssues = data.criticalIssues;
    this.top3Issues = data.top3Issues;
    this.moduleResults = data.moduleResults;
    this.summary = data.summary;
    this.recommendedSkills = data.recommendedSkills;
  }

  toDict(): Record<string, unknown> {
    return {
      overall_score: this.overallScore,
      overall_level: this.overallLevel,
      module_scores: this.moduleScores,
      issues_count: this.allIssues.length,
      critical_count: this.criticalIssues.length,
      top_3_issues: this.top3Issues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: i.severity,
      })),
      summary: this.summary,
      recommended_skills: this.recommendedSkills,
    };
  }

  toMarkdown(): string {
    const lines: string[] = [
      '# \u7efc\u5408\u8bc4\u4f30\u62a5\u544a',
      '',
      `**\u603b\u5206**: ${this.overallScore.toFixed(1)}/100 (${this.overallLevel})`,
      '',
      '## \u6a21\u5757\u5f97\u5206',
      '| \u6a21\u5757 | \u5f97\u5206 | \u72b6\u6001 |',
      '|------|------|------|',
    ];

    for (const [mod, sc] of Object.entries(this.moduleScores)) {
      const status =
        sc >= 70
          ? '\u2713'
          : sc >= 50
            ? '\u26a0'
            : '\u2717';
      lines.push(`| ${mod} | ${sc.toFixed(1)} | ${status} |`);
    }

    lines.push('', '## \u9700\u8981\u4f18\u5148\u89e3\u51b3\u7684\u95ee\u9898');

    this.top3Issues.forEach((issue, idx) => {
      lines.push(`${idx + 1}. **${issue.code}**: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`   - \u5efa\u8bae: ${issue.suggestion}`);
      }
    });

    if (this.recommendedSkills.length > 0) {
      lines.push('', '## \u63a8\u8350\u6280\u80fd\u5305');
      for (const skill of this.recommendedSkills) {
        lines.push(`- \`skills/${skill}/SKILL.md\``);
      }
    }

    return lines.join('\n');
  }
}

export class CriticEngine {
  private llmClient: INarrativeLLMClient | null;
  private evaluators: Record<string, BaseEvaluator>;
  private weights: Record<string, number>;

  constructor(llmClient?: INarrativeLLMClient | null) {
    this.llmClient = llmClient ?? null;

    this.evaluators = {
      fictional_dream: new DreamEvaluator(llmClient),
      suspense: new SuspenseEvaluator(llmClient),
      character: new CharacterEvaluator(llmClient),
      premise: new PremiseEvaluator(llmClient),
      voice: new VoiceEvaluator(llmClient),
    };

    this.weights = {
      fictional_dream: 0.25,
      suspense: 0.2,
      character: 0.2,
      premise: 0.15,
      voice: 0.2,
    };
  }

  async evaluate(
    content: string,
    context?: Record<string, unknown>,
    modules?: string[],
  ): Promise<ComprehensiveReport> {
    const selectedModules = modules ?? Object.keys(this.evaluators);

    const moduleResults: Record<string, EvaluationResult> = {};
    const allIssues: Issue[] = [];

    for (const moduleName of selectedModules) {
      const evaluator = this.evaluators[moduleName];
      if (evaluator) {
        const result = await evaluator.evaluate(content, context);
        moduleResults[moduleName] = result;
        allIssues.push(...result.issues);
      }
    }

    let totalScore = 0;
    let weightSum = 0;
    const moduleScores: Record<string, number> = {};

    for (const [moduleName, result] of Object.entries(moduleResults)) {
      const weight = this.weights[moduleName] ?? 0.2;
      totalScore += result.score * weight;
      weightSum += weight;
      moduleScores[moduleName] = result.score;
    }

    if (weightSum > 0) {
      const selectedWeightSum = selectedModules
        .filter((m) => m in this.weights)
        .reduce((sum, m) => sum + (this.weights[m] ?? 0), 0);
      totalScore =
        (totalScore / weightSum) * (weightSum / selectedWeightSum);
    }

    const criticalIssues = allIssues.filter(
      (i) => i.severity === Severity.CRITICAL,
    );
    const sortedIssues = [...allIssues].sort((a, b) => {
      const order = (s: Severity): number => {
        switch (s) {
          case Severity.CRITICAL:
            return 0;
          case Severity.MAJOR:
            return 1;
          case Severity.MINOR:
            return 2;
          default:
            return 3;
        }
      };
      return order(a.severity) - order(b.severity);
    });
    const top3 = sortedIssues.slice(0, 3);

    const recommendedSkills = [
      ...new Set(
        top3
          .map((i) => i.relatedSkill)
          .filter((s): s is string => typeof s === 'string' && s.length > 0),
      ),
    ];

    const level = this.scoreToLevel(totalScore);
    const summary = this.generateSummary(
      totalScore,
      level,
      moduleScores,
      top3,
    );

    return new ComprehensiveReport({
      overallScore: totalScore,
      overallLevel: level,
      moduleScores,
      allIssues,
      criticalIssues,
      top3Issues: top3,
      moduleResults,
      summary,
      recommendedSkills,
    });
  }

  async quickScan(content: string): Promise<ComprehensiveReport> {
    const moduleResults: Record<string, EvaluationResult> = {};
    const allIssues: Issue[] = [];

    for (const [name, evaluator] of Object.entries(this.evaluators)) {
      const result = evaluator.quickScan(content);
      moduleResults[name] = result;
      allIssues.push(...result.issues);
    }

    const moduleScores: Record<string, number> = {};
    for (const [n, r] of Object.entries(moduleResults)) {
      moduleScores[n] = r.score;
    }

    const totalScore = Object.entries(moduleScores).reduce(
      (sum, [n, s]) => sum + s * (this.weights[n] ?? 0.2),
      0,
    );

    const level = this.scoreToLevel(totalScore);

    return new ComprehensiveReport({
      overallScore: totalScore,
      overallLevel: level,
      moduleScores,
      allIssues,
      criticalIssues: allIssues.filter(
        (i) => i.severity === Severity.CRITICAL,
      ),
      top3Issues: allIssues.slice(0, 3),
      moduleResults,
      summary: `\u5feb\u901f\u626b\u63cf\u5b8c\u6210\uff0c\u603b\u5206\uff1a${totalScore.toFixed(1)}`,
      recommendedSkills: [],
    });
  }

  private scoreToLevel(score: number): string {
    return scoreToLevel(score);
  }

  private generateSummary(
    score: number,
    level: string,
    moduleScores: Record<string, number>,
    topIssues: Issue[],
  ): string {
    const entries = Object.entries(moduleScores);
    const weakest =
      entries.length > 0
        ? entries.reduce((a, b) => (b[1] < a[1] ? b : a), entries[0])[0]
        : 'N/A';
    const strongest =
      entries.length > 0
        ? entries.reduce((a, b) => (b[1] > a[1] ? b : a), entries[0])[0]
        : 'N/A';

    const levelDesc: Record<string, string> = {
      excellent: '\u5353\u8d8a',
      good: '\u826f\u597d',
      fair: '\u4e00\u822c',
      poor: '\u8f83\u5dee',
      critical: '\u9700\u8981\u5927\u5e45\u6539\u8fdb',
    };

    let summary = `\u603b\u4f53\u8bc4\u4ef7\uff1a${levelDesc[level] ?? '\u672a\u77e5'}\uff08${score.toFixed(1)}\u5206\uff09\u3002`;
    summary += `\u6700\u5f3a\u6a21\u5757\uff1a${strongest}\uff0c\u6700\u5f31\u6a21\u5757\uff1a${weakest}\u3002`;

    if (topIssues.length > 0) {
      summary += `\u9996\u8981\u95ee\u9898\uff1a${topIssues[0].message}`;
    }

    return summary;
  }
}
