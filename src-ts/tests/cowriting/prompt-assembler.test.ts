import { describe, expect, it } from 'vitest';

import {
  PromptAssembler,
  createPromptAssembler,
} from '../../cowriting/PromptAssembler.js';
import type { ScrapedContext } from '../../cowriting/ContextScraper.js';
import {
  createCharacterProfile,
  createPlotThread,
  createTimelineEvent,
  createWorldRule,
  CharacterArchetype,
  PlotThreadStatus,
  TimelineEventType,
  WorldRuleCategory,
} from '../../knowledge/entities/story-bible-types.js';
import {
  CreativityPreset,
  resolveCreativityConfig,
} from '../../quality/types.js';

function createSampleContext(): ScrapedContext {
  return {
    storyBible: {
      characters: [
        createCharacterProfile({
          id: 'char-1',
          name: '林岚',
          archetype: CharacterArchetype.PROTAGONIST,
          arcStage: 'rising',
          traits: [
            { trait: 'stubborn', intensity: 0.9, evidence: 'She refuses to retreat.' },
            { trait: 'observant', intensity: 0.8, evidence: 'She notices the hidden seal.' },
          ],
          motivations: ['Protect her brother'],
          backstory:
            'She survived the archive fire as a child and has spent years tracing who erased the official record.',
        }),
      ],
      worldRules: [
        createWorldRule({
          id: 'rule-1',
          name: 'Sealbound Doors',
          category: WorldRuleCategory.MAGIC,
          description:
            'Every archive gate responds only to a spoken seal phrase and leaves a frost trace on the hinge.',
          constraints: ['Requires a blood relative voiceprint'],
          exceptions: ['Emergency override exists for wardens'],
          impactScope: 'regional',
          relatedEntities: ['char-1'],
        }),
      ],
      plotThreads: [
        createPlotThread({
          id: 'plot-1',
          name: 'Missing Ledger',
          status: PlotThreadStatus.DEVELOPING,
          premise: 'A ledger vanished the night the archive burned.',
          goal: 'Recover the ledger',
          stakes: 'Expose the conspiracy before the tribunal convenes.',
        }),
      ],
      timelineEvents: [
        createTimelineEvent({
          id: 'event-1',
          name: 'Archive Fire',
          eventType: TimelineEventType.INCIDENT,
          description: 'The lower archive burned and several official witness logs vanished overnight.',
          chapterRef: 'CH01',
          timestamp: 'Night 1',
          emotionalImpact: 'high',
        }),
      ],
      completeness: {
        overallScore: 0.42,
        level: 'incomplete',
        entityScores: new Map(),
        missingFields: ['supporting cast'],
        recommendations: ['Add secondary witness accounts'],
        timestamp: '2026-06-04T00:00:00.000Z',
      },
    },
    sessionContext: {
      recentEdits: ['Expanded the tribunal argument.', 'Tightened the opening beat.'],
      writingStyle: 'Close third person with clipped, tense sentences.',
      currentChapter: 'CH03',
      cursorPosition: 128,
    },
    chapterContext: {
      precedingText: '林岚把手按在冰冷的门缝上，听见门后有水滴一声一声落下。',
      succeedingText: '远处的走廊尽头，还亮着一盏快要熄灭的灯。',
      chapterSummary: '林岚在旧档案馆寻找失踪账册的入口。',
    },
    totalTokenEstimate: 512,
  };
}

describe('cowriting/PromptAssembler', () => {
  it('assembles a rich auto-mode prompt with story bible, session, chapter, and high-creativity guidance', () => {
    const assembler = createPromptAssembler();
    const creativityConfig = resolveCreativityConfig(
      CreativityPreset.EXPERIMENTAL,
      'auto',
    );

    const prompt = assembler.assemblePrompt({
      context: createSampleContext(),
      mode: 'auto',
      creativityConfig,
    });

    expect(prompt).toMatchObject({
      mode: 'auto',
      creativityConfig,
    });
    expect(prompt.systemPrompt).toContain('You are a seamless co-writer');
    expect(prompt.systemPrompt).toContain('## Quality Constraints');
    expect(prompt.systemPrompt).toContain('High creativity setting');
    expect(prompt.userPrompt).toContain('## Story Bible Context');
    expect(prompt.userPrompt).toContain('Characters:');
    expect(prompt.userPrompt).toContain('林岚');
    expect(prompt.userPrompt).toContain('World Rules:');
    expect(prompt.userPrompt).toContain('Plot Threads:');
    expect(prompt.userPrompt).toContain('Timeline Events:');
    expect(prompt.userPrompt).toContain('## Writing Style');
    expect(prompt.userPrompt).toContain('## Recent Edits');
    expect(prompt.userPrompt).toContain('## Chapter Context');
    expect(prompt.userPrompt).toContain('Succeeding Text (for reference');
    expect(prompt.userPrompt).toContain('Story Bible completeness is low (42%)');
    expect(prompt.estimatedTokens).toBeGreaterThan(0);
  });

  it('falls back to a natural continuation note when directed mode has no user instruction', () => {
    const assembler = new PromptAssembler();

    const prompt = assembler.assemblePrompt({
      context: createSampleContext(),
      mode: 'directed',
    });

    expect(prompt.mode).toBe('directed');
    expect(prompt.creativityConfig.modeDefault).toBe(0.4);
    expect(prompt.userPrompt).toContain('## Instructions');
    expect(prompt.userPrompt).toContain('No specific instruction provided. Continue naturally as in auto mode.');
    expect(prompt.userPrompt).not.toContain('User Instruction:');
  });
});
