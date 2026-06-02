/**
 * Auto Mode — full auto-continuation pipeline for the Co-Writing Engine
 *
 * Orchestrates the complete auto-continuation flow:
 *   1. Assemble context via ContextScraper
 *   2. Build auto prompt via PromptAssembler
 *   3. Route to model via ModelRouter
 *   4. Aggregate output via OutputAggregator
 *   5. Return CowritingResult with continuation text
 *
 * The actual LLM call is a placeholder that returns a structured mock response.
 * Real LLM integration will be wired later via the MCP layer.
 *
 * @module cowriting/AutoMode
 */

import { ContextScraper, createContextScraper } from './ContextScraper';
import type {
  ScrapedContext,
  StoryBibleInput,
  SessionInput,
  ChapterInput,
} from './ContextScraper';
import { PromptAssembler, createPromptAssembler } from './PromptAssembler';
import type { AssembledPrompt } from './PromptAssembler';
import { ModelRouter, createModelRouter } from './ModelRouter';
import type { RoutingDecision } from './ModelRouter';
import { OutputAggregator, createOutputAggregator } from './OutputAggregator';
import type { AggregatedOutput } from './OutputAggregator';
import type { CreativitySpectrumConfig } from '../quality/types';
import { createDefaultCreativityConfig } from '../quality/types';
import { createLogger } from '../logger';

const _log = createLogger('auto-mode');

// ============================================================
// Public Interfaces
// ============================================================

export interface AutoModeInput {
  manuscriptText: string;
  chapterContext: {
    precedingText: string;
    succeedingText: string;
    chapterSummary: string;
  };
  storyBible: ScrapedContext['storyBible'];
  sessionContext: ScrapedContext['sessionContext'];
  creativityConfig?: CreativitySpectrumConfig;
}

export interface CowritingResult {
  text: string;
  mode: 'auto';
  metadata: {
    model: string;
    generatedAt: string;
    tokenCount: number;
    confidence: number;
    creativityLevel: number;
  };
}

// ============================================================
// Placeholder LLM Response
// ============================================================

/**
 * Placeholder LLM call that returns a structured mock response.
 * Exercises the full pipeline without requiring a real LLM connection.
 *
 * The mock response is context-aware: it references the preceding text
 * and chapter summary to simulate a realistic continuation.
 */
function placeholderLLMCall(
  _systemPrompt: string,
  _userPrompt: string,
  _routing: RoutingDecision,
  context: ScrapedContext,
): string {
  const precedingSnippet = context.chapterContext.precedingText
    .slice(-80)
    .trim();

  const summary = context.chapterContext.chapterSummary
    ? `Building on the arc of ${context.chapterContext.chapterSummary.slice(0, 60)}, `
    : '';

  // Generate a mock continuation that exercises the output aggregator
  const mockContinuation = [
    `${summary}the narrative continues from where it left off.`,
    precedingSnippet
      ? `Following the thread established in "${precedingSnippet}...", the scene deepens with renewed tension.`
      : 'The scene unfolds with a sense of quiet anticipation.',
    'Characters move through the space with purpose, each action carrying the weight of what came before. The dialogue crackles with subtext, revealing layers of motivation beneath the surface.',
    'A shift in the atmosphere signals the turning point — what was implicit becomes explicit, and the stakes rise to meet the moment.',
  ].join('\n\n');

  _log.info('Placeholder LLM call executed', {
    model: _routing.model.id,
    contextTokens: context.totalTokenEstimate,
  });

  return mockContinuation;
}

// ============================================================
// AutoMode Class
// ============================================================

export class AutoMode {
  private readonly contextScraper: ContextScraper;
  private readonly promptAssembler: PromptAssembler;
  private readonly modelRouter: ModelRouter;
  private readonly outputAggregator: OutputAggregator;

  constructor(
    contextScraper?: ContextScraper,
    promptAssembler?: PromptAssembler,
    modelRouter?: ModelRouter,
    outputAggregator?: OutputAggregator,
  ) {
    this.contextScraper = contextScraper ?? createContextScraper();
    this.promptAssembler = promptAssembler ?? createPromptAssembler();
    this.modelRouter = modelRouter ?? createModelRouter();
    this.outputAggregator = outputAggregator ?? createOutputAggregator();
  }

  /**
   * Generate an auto-continuation for the manuscript.
   *
   * Full pipeline: context → prompt → route → aggregate → result
   *
   * @param input - AutoModeInput with manuscript context and creativity config
   * @returns CowritingResult with the continuation text and metadata
   */
  async generate(input: AutoModeInput): Promise<CowritingResult> {
    _log.info('Auto mode generation started');

    // Step 1: Assemble context via ContextScraper
    const storyBibleInput: StoryBibleInput = {
      characters: input.storyBible.characters,
      worldRules: input.storyBible.worldRules,
      plotThreads: input.storyBible.plotThreads,
      timelineEvents: input.storyBible.timelineEvents,
    };

    const sessionInput: SessionInput = {
      recentEdits: input.sessionContext.recentEdits,
      writingStyle: input.sessionContext.writingStyle,
      currentChapter: input.sessionContext.currentChapter,
      cursorPosition: input.sessionContext.cursorPosition,
    };

    const chapterInput: ChapterInput = {
      fullText: input.manuscriptText,
      cursorPosition: input.chapterContext.precedingText.length,
      chapterSummary: input.chapterContext.chapterSummary,
    };

    const context = this.contextScraper.assembleContext(
      storyBibleInput,
      sessionInput,
      chapterInput,
    );

    _log.info('Context assembled', {
      totalTokenEstimate: context.totalTokenEstimate,
      characterCount: context.storyBible.characters.length,
      worldRuleCount: context.storyBible.worldRules.length,
    });

    // Step 2: Build auto prompt via PromptAssembler
    const creativityConfig = input.creativityConfig
      ?? createDefaultCreativityConfig('auto');

    const assembledPrompt: AssembledPrompt = this.promptAssembler.assemblePrompt({
      context,
      mode: 'auto',
      creativityConfig,
    });

    _log.info('Prompt assembled', {
      estimatedTokens: assembledPrompt.estimatedTokens,
      creativityValue: assembledPrompt.creativityConfig.value,
    });

    // Step 3: Route to model via ModelRouter
    const routing: RoutingDecision = this.modelRouter.route(
      'auto',
      assembledPrompt.estimatedTokens,
    );

    _log.info('Model routed', {
      model: routing.model.id,
      reason: routing.reason,
      estimatedLatency: routing.estimatedLatency,
    });

    // Step 4: Call LLM (placeholder for now)
    const rawOutput = placeholderLLMCall(
      assembledPrompt.systemPrompt,
      assembledPrompt.userPrompt,
      routing,
      context,
    );

    // Step 5: Aggregate output via OutputAggregator
    const aggregated: AggregatedOutput = this.outputAggregator.aggregate(
      rawOutput,
      'auto',
      routing.model,
    );

    _log.info('Output aggregated', {
      tokenCount: aggregated.metadata.tokenCount,
      confidence: aggregated.metadata.confidence,
    });

    // Step 6: Build and return CowritingResult
    const result: CowritingResult = {
      text: aggregated.text,
      mode: 'auto',
      metadata: {
        model: aggregated.metadata.model,
        generatedAt: aggregated.metadata.generatedAt,
        tokenCount: aggregated.metadata.tokenCount,
        confidence: aggregated.metadata.confidence,
        creativityLevel: assembledPrompt.creativityConfig.value,
      },
    };

    _log.info('Auto mode generation complete', {
      textLength: result.text.length,
      model: result.metadata.model,
      confidence: result.metadata.confidence,
    });

    return result;
  }
}

// ============================================================
// Factory
// ============================================================

export function createAutoMode(
  contextScraper?: ContextScraper,
  promptAssembler?: PromptAssembler,
  modelRouter?: ModelRouter,
  outputAggregator?: OutputAggregator,
): AutoMode {
  return new AutoMode(contextScraper, promptAssembler, modelRouter, outputAggregator);
}
