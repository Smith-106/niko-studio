/**
 * Analyzer base classes
 *
 * All narrative analyzers extend BaseAnalyzer. Analyzers extract
 * structured data from text (not scores).
 */

import type { INarrativeLLMClient } from '../types';

/** Analysis type enum */
export enum AnalysisType {
  SENSORY = 'sensory',
  CONFLICT = 'conflict',
  TENSION = 'tension',
  CHARACTER_STATE = 'character_state',
  DIALOGUE = 'dialogue',
  PACING = 'pacing',
}

/** Analysis result container */
export class AnalysisResult<T = unknown> {
  readonly analyzerName: string;
  readonly analysisType: AnalysisType;
  readonly items: T[];
  readonly metadata: Record<string, unknown>;
  summary: string;

  constructor(
    analyzerName: string,
    analysisType: AnalysisType,
    items: T[] = [],
    metadata: Record<string, unknown> = {},
    summary = '',
  ) {
    this.analyzerName = analyzerName;
    this.analysisType = analysisType;
    this.items = items;
    this.metadata = metadata;
    this.summary = summary;
  }

  get count(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  toDict(): Record<string, unknown> {
    return {
      analyzer: this.analyzerName,
      type: this.analysisType,
      count: this.count,
      items: this.items.map((item) =>
        typeof item === 'object' && item !== null && 'toDict' in item
          ? (item as { toDict: () => unknown }).toDict()
          : String(item),
      ),
      metadata: this.metadata,
      summary: this.summary,
    };
  }
}

/** Abstract base analyzer */
export abstract class BaseAnalyzer<T = unknown> {
  protected llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient | null) {
    this.llmClient = llmClient ?? null;
  }

  abstract get name(): string;
  abstract get analysisType(): AnalysisType;
  abstract get description(): string;

  abstract analyze(
    content: string,
    context?: Record<string, unknown>,
  ): Promise<AnalysisResult<T>>;

  quickAnalyze(content: string): AnalysisResult<T> {
    return new AnalysisResult(this.name, this.analysisType, [], {}, '快速分析未实现');
  }
}
