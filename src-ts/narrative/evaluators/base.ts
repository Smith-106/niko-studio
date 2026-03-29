/**
 * Evaluator base classes
 *
 * All narrative evaluators extend BaseEvaluator. Evaluators
 * score text and produce structured issues.
 */

import type { INarrativeLLMClient } from '../types';
import { scoreToLevel, severityOrder } from '../types';

/** Issue severity levels */
export enum Severity {
  CRITICAL = 'critical',
  MAJOR = 'major',
  MINOR = 'minor',
  INFO = 'info',
}

/** Score level labels */
export enum ScoreLevel {
  EXCELLENT = 'excellent',
  GOOD = 'good',
  FAIR = 'fair',
  POOR = 'poor',
  CRITICAL = 'critical',
}

/** An issue found during evaluation */
export interface Issue {
  code: string;
  message: string;
  severity: Severity;
  location?: string;
  suggestion?: string;
  relatedSkill?: string;
}

/** Evaluation result */
export class EvaluationResult {
  readonly evaluatorName: string;
  score: number;
  level: ScoreLevel;
  issues: Issue[];
  metrics: Record<string, number>;
  summary: string;
  rawAnalysis: Record<string, unknown> | null;

  constructor(
    evaluatorName: string,
    score: number,
    level: ScoreLevel,
    issues: Issue[] = [],
    metrics: Record<string, number> = {},
    summary = '',
    rawAnalysis: Record<string, unknown> | null = null,
  ) {
    this.evaluatorName = evaluatorName;
    this.score = score;
    this.level = level;
    this.issues = issues;
    this.metrics = metrics;
    this.summary = summary;
    this.rawAnalysis = rawAnalysis;
  }

  get criticalIssues(): Issue[] {
    return this.issues.filter((i) => i.severity === Severity.CRITICAL);
  }

  get majorIssues(): Issue[] {
    return this.issues.filter((i) => i.severity === Severity.MAJOR);
  }

  get hasCriticalIssues(): boolean {
    return this.criticalIssues.length > 0;
  }

  topIssues(n = 3): Issue[] {
    return [...this.issues]
      .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
      .slice(0, n);
  }

  toDict(): Record<string, unknown> {
    return {
      evaluator: this.evaluatorName,
      score: this.score,
      level: this.level,
      issues: this.issues.map((i) => ({
        code: i.code,
        message: i.message,
        severity: i.severity,
        location: i.location,
        suggestion: i.suggestion,
        relatedSkill: i.relatedSkill,
      })),
      metrics: this.metrics,
      summary: this.summary,
    };
  }
}

/** Abstract base evaluator */
export abstract class BaseEvaluator {
  protected llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient | null) {
    this.llmClient = llmClient ?? null;
  }

  abstract get name(): string;
  abstract get description(): string;
  get relatedSkill(): string | null {
    return null;
  }

  abstract evaluate(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<EvaluationResult>;

  quickScan(content: string): EvaluationResult {
    return new EvaluationResult(this.name, 0, ScoreLevel.FAIR, [], {}, '快速扫描未实现');
  }

  protected scoreToLevel(score: number): ScoreLevel {
    return scoreToLevel(score) as ScoreLevel;
  }
}
