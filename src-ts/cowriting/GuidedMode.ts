/**
 * Guided Mode — 3 scored options for user selection in the Co-Writing Engine
 *
 * Implements the guided-continuation pipeline:
 * 1. Accept manuscript context + creativity config
 * 2. Assemble prompt via PromptAssembler (guided mode)
 * 3. Route to model via ModelRouter (guided model)
 * 4. Aggregate output via OutputAggregator (guided mode) — parses 3 options with scores
 * 5. Return GuidedCowritingResult with 3 options
 *
 * @module cowriting/GuidedMode
 */

import { ContextScraper, createContextScraper, type ScrapedContext, type StoryBibleInput, type SessionInput, type ChapterInput } from './ContextScraper';
import { PromptAssembler, createPromptAssembler, type AssembledPrompt } from './PromptAssembler';
import { ModelRouter, createModelRouter, type RoutingDecision } from './ModelRouter';
import { OutputAggregator, createOutputAggregator, type GuidedOption } from './OutputAggregator';
import type { CreativitySpectrumConfig } from '../quality/types';
import { createDefaultCreativityConfig } from '../quality/types';
import { createLogger } from '../logger';

const _log = createLogger('guided-mode');

// ============================================================
// Public Interfaces
// ============================================================

export interface GuidedModeInput {
  manuscriptText: string;
  chapterContext: {
    precedingText: string;
    succeedingText: string;
    chapterSummary: string;
  };
  storyBible: StoryBibleInput;
  sessionContext: SessionInput;
  creativityConfig?: CreativitySpectrumConfig;
}

export interface GuidedCowritingResult {
  options: GuidedOption[];
  mode: 'guided';
  metadata: {
    model: string;
    generatedAt: string;
    tokenCount: number;
    creativityLevel: number;
  };
}

// ============================================================
// Placeholder LLM Response
// ============================================================

/**
 * Generate a placeholder LLM response with 3 mock options.
 * This exercises the full pipeline while actual LLM integration is pending.
 */
function generatePlaceholderResponse(prompt: AssembledPrompt): string {
  const mockOptions = [
    {
      text: 'The door creaked open, revealing a dimly lit corridor that stretched into shadow. She hesitated, her hand still on the worn brass handle, listening for any sound from within.',
      coherence: 92,
      creativity: 65,
      styleMatch: 88,
      rationale: 'Natural continuation maintaining established atmosphere and character hesitation.',
    },
    {
      text: 'A sudden draft swept through the room, extinguishing the candle and plunging everything into darkness. She heard footsteps—quick, deliberate—approaching from the hallway.',
      coherence: 85,
      creativity: 78,
      styleMatch: 82,
      rationale: 'Bolder direction introducing tension and sensory shift while respecting scene logic.',
    },
    {
      text: 'Before she could step inside, a voice called her name from behind. She turned to find him standing at the top of the stairs, his expression unreadable in the fading light.',
      creativity: 88,
      coherence: 78,
      styleMatch: 75,
      rationale: 'Unexpected twist introducing character confrontation, opens new narrative possibilities.',
    },
  ];

  const formatted = mockOptions.map((opt, i) => {
    return `Option ${i + 1}:\n${opt.text}\n\nScores:\n- Coherence: ${opt.coherence}/100\n- Creativity: ${opt.creativity}/100\n- Style Match: ${opt.styleMatch}/100\n- Overall: ${Math.round((opt.coherence + opt.creativity + opt.styleMatch) / 3)}/100\n\nRationale: ${opt.rationale}`;
  });

  return formatted.join('\n\n---\n\n');
}

// ============================================================
// GuidedMode Class
// ============================================================

export class GuidedMode {
  private readonly contextScraper: ContextScraper;
  private readonly promptAssembler: PromptAssembler;
  private readonly modelRouter: ModelRouter;
  private readonly outputAggregator: OutputAggregator;

  constructor() {
    this.contextScraper = createContextScraper();
    this.promptAssembler = createPromptAssembler();
    this.modelRouter = createModelRouter();
    this.outputAggregator = createOutputAggregator();
  }

  /**
   * Generate 3 scored continuation options for user selection.
   *
   * Pipeline:
   * 1. Assemble context from manuscript + story bible + session
   * 2. Build guided prompt via PromptAssembler
   * 3. Route to guided model via ModelRouter
   * 4. Aggregate output via OutputAggregator (parses 3 options)
   * 5. Return GuidedCowritingResult
   *
   * @param input - Guided mode input with manuscript context and creativity config
   * @returns GuidedCowritingResult with 3 scored options
   */
  async generate(input: GuidedModeInput): Promise<GuidedCowritingResult> {
    _log.info('Starting guided mode generation', {
      manuscriptLength: input.manuscriptText.length,
      hasStoryBible: !!input.storyBible,
      hasSessionContext: !!input.sessionContext,
    });

    // Step 1: Assemble context
    const chapterInput: ChapterInput = {
      fullText: input.chapterContext.precedingText + input.chapterContext.succeedingText,
      cursorPosition: input.chapterContext.precedingText.length,
      chapterSummary: input.chapterContext.chapterSummary,
    };

    const scrapedContext = this.contextScraper.assembleContext(
      input.storyBible,
      input.sessionContext,
      chapterInput,
    );

    _log.debug('Context assembled', {
      totalTokenEstimate: scrapedContext.totalTokenEstimate,
      characterCount: scrapedContext.storyBible.characters.length,
      worldRuleCount: scrapedContext.storyBible.worldRules.length,
    });

    // Step 2: Build guided prompt
    const creativityConfig = input.creativityConfig ?? createDefaultCreativityConfig('guided');

    const assembledPrompt = this.promptAssembler.assemblePrompt({
      context: scrapedContext,
      mode: 'guided',
      creativityConfig,
    });

    _log.debug('Prompt assembled', {
      estimatedTokens: assembledPrompt.estimatedTokens,
      creativityValue: creativityConfig.value,
    });

    // Step 3: Route to guided model
    const routingDecision = this.modelRouter.route('guided', assembledPrompt.estimatedTokens);

    _log.debug('Model routing decision', {
      model: routingDecision.model.id,
      reason: routingDecision.reason,
      estimatedLatency: routingDecision.estimatedLatency,
    });

    // Step 4: Generate output (placeholder for now)
    const rawOutput = generatePlaceholderResponse(assembledPrompt);

    _log.debug('Raw output generated', {
      outputLength: rawOutput.length,
    });

    // Step 5: Aggregate output (parse 3 options)
    const aggregated = this.outputAggregator.aggregate(rawOutput, 'guided', routingDecision.model);

    if (!aggregated.options || aggregated.options.length < 3) {
      _log.warn('OutputAggregator returned fewer than 3 options', {
        optionCount: aggregated.options?.length ?? 0,
      });
    }

    // Step 6: Build final result
    const result: GuidedCowritingResult = {
      options: aggregated.options ?? [],
      mode: 'guided',
      metadata: {
        model: routingDecision.model.id,
        generatedAt: aggregated.metadata.generatedAt,
        tokenCount: aggregated.metadata.tokenCount,
        creativityLevel: creativityConfig.value,
      },
    };

    _log.info('Guided mode generation complete', {
      optionCount: result.options.length,
      model: result.metadata.model,
      tokenCount: result.metadata.tokenCount,
      creativityLevel: result.metadata.creativityLevel,
    });

    return result;
  }
}

// ============================================================
// Factory
// ============================================================

export function createGuidedMode(): GuidedMode {
  return new GuidedMode();
}
