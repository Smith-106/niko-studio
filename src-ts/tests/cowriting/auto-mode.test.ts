import { describe, expect, it, vi } from 'vitest';

import { AutoMode, createAutoMode } from '../../cowriting/AutoMode.js';
import type { ScrapedContext } from '../../cowriting/ContextScraper.js';
import type { AssembledPrompt } from '../../cowriting/PromptAssembler.js';
import type { RoutingDecision, ModelConfig } from '../../cowriting/ModelRouter.js';
import type { AggregatedOutput } from '../../cowriting/OutputAggregator.js';
import { resolveCreativityConfig, CreativityPreset } from '../../quality/types.js';

const model: ModelConfig = {
  id: 'auto-model',
  name: 'Auto Model',
  provider: 'openai',
  maxTokens: 16000,
  supportsStreaming: true,
};

function createScrapedContext(): ScrapedContext {
  return {
    storyBible: {
      characters: [],
      worldRules: [],
      plotThreads: [],
      timelineEvents: [],
      completeness: {
        overallScore: 0.8,
        level: 'adequate',
        entityScores: new Map(),
        missingFields: [],
        recommendations: [],
        timestamp: '2026-06-04T00:00:00.000Z',
      },
    },
    sessionContext: {
      recentEdits: ['edit-1'],
      writingStyle: 'tense',
      currentChapter: 'CH03',
      cursorPosition: 42,
    },
    chapterContext: {
      precedingText: '前文片段',
      succeedingText: '后文片段',
      chapterSummary: '章节摘要',
    },
    totalTokenEstimate: 321,
  };
}

describe('cowriting/AutoMode', () => {
  it('runs the full auto pipeline with injected collaborators', async () => {
    const scrapedContext = createScrapedContext();
    const assembledPrompt: AssembledPrompt = {
      systemPrompt: 'system',
      userPrompt: 'user',
      mode: 'auto',
      creativityConfig: resolveCreativityConfig(CreativityPreset.CREATIVE, 'auto'),
      estimatedTokens: 888,
    };
    const routingDecision: RoutingDecision = {
      model,
      reason: 'selected for test',
      estimatedLatency: 'medium',
    };
    const aggregated: AggregatedOutput = {
      mode: 'auto',
      text: '生成结果',
      metadata: {
        model: model.id,
        generatedAt: '2026-06-04T12:00:00.000Z',
        tokenCount: 123,
        confidence: 0.91,
      },
    };

    const contextScraper = {
      assembleContext: vi.fn(() => scrapedContext),
    };
    const promptAssembler = {
      assemblePrompt: vi.fn(() => assembledPrompt),
    };
    const modelRouter = {
      route: vi.fn(() => routingDecision),
    };
    const outputAggregator = {
      aggregate: vi.fn(() => aggregated),
    };

    const autoMode = new AutoMode(
      contextScraper as never,
      promptAssembler as never,
      modelRouter as never,
      outputAggregator as never,
    );

    const creativityConfig = resolveCreativityConfig(CreativityPreset.EXPERIMENTAL, 'auto');
    const result = await autoMode.generate({
      manuscriptText: '正文',
      chapterContext: {
        precedingText: '前文',
        succeedingText: '后文',
        chapterSummary: '摘要',
      },
      storyBible: scrapedContext.storyBible,
      sessionContext: scrapedContext.sessionContext,
      creativityConfig,
    });

    expect(contextScraper.assembleContext).toHaveBeenCalledWith(
      {
        characters: [],
        worldRules: [],
        plotThreads: [],
        timelineEvents: [],
      },
      {
        recentEdits: ['edit-1'],
        writingStyle: 'tense',
        currentChapter: 'CH03',
        cursorPosition: 42,
      },
      {
        fullText: '正文',
        cursorPosition: 2,
        chapterSummary: '摘要',
      },
    );
    expect(promptAssembler.assemblePrompt).toHaveBeenCalledWith({
      context: scrapedContext,
      mode: 'auto',
      creativityConfig,
    });
    expect(modelRouter.route).toHaveBeenCalledWith('auto', 888);
    expect(outputAggregator.aggregate).toHaveBeenCalledWith(
      expect.stringContaining('Building on the arc of 章节摘要'),
      'auto',
      model,
    );
    expect(result).toEqual({
      text: '生成结果',
      mode: 'auto',
      metadata: {
        model: model.id,
        generatedAt: '2026-06-04T12:00:00.000Z',
        tokenCount: 123,
        confidence: 0.91,
        creativityLevel: assembledPrompt.creativityConfig.value,
      },
    });
  });

  it('exposes the factory helper', () => {
    expect(createAutoMode()).toBeInstanceOf(AutoMode);
  });
});
