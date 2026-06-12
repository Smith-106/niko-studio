import { describe, expect, it } from 'vitest';

import { PromptAssembler } from '../../cowriting/PromptAssembler.js';
import type { ScrapedContext } from '../../cowriting/ContextScraper.js';
import {
  createCharacterProfile,
  createWorldRule,
  CharacterArchetype,
  WorldRuleCategory,
} from '../../knowledge/entities/story-bible-types.js';
import {
  CreativityPreset,
  resolveCreativityConfig,
} from '../../quality/types.js';

function createBranchGapContext(): ScrapedContext {
  return {
    storyBible: {
      characters: [
        createCharacterProfile({
          id: 'char-gap',
          name: '沈青',
          archetype: CharacterArchetype.PROTAGONIST,
          arcStage: 'uncertain',
          traits: [],
          motivations: [],
        }),
      ],
      worldRules: [
        createWorldRule({
          id: 'rule-gap',
          name: 'Silent Oath',
          category: WorldRuleCategory.MAGIC,
          description: '誓言会在说谎时暂时失声。',
          constraints: [],
          impactScope: 'personal',
          relatedEntities: [],
        }),
      ],
      plotThreads: [],
      timelineEvents: [],
      completeness: {
        overallScore: 0.9,
        level: 'good',
        entityScores: new Map(),
        missingFields: [],
        recommendations: [],
        timestamp: '2026-06-09T00:00:00.000Z',
      },
    },
    sessionContext: {
      recentEdits: [],
      writingStyle: '冷静克制的近距离叙述。',
      currentChapter: 'CH08',
      cursorPosition: 42,
    },
    chapterContext: {
      precedingText: '她在门前停下，没有立刻推门。',
      succeedingText: '',
      chapterSummary: '主角试探誓言规则的边界。',
    },
    totalTokenEstimate: 128,
  };
}

describe('cowriting/PromptAssembler branch-gap coverage', () => {
  it('renders empty traits and constraints fallbacks and includes directed instructions', () => {
    const assembler = new PromptAssembler();

    const prompt = assembler.assemblePrompt({
      context: createBranchGapContext(),
      mode: 'directed',
      userInstruction: '让主角主动试探誓言的副作用，但不要打破既有世界规则。',
    });

    expect(prompt.mode).toBe('directed');
    expect(prompt.userPrompt).toContain('Traits: none specified');
    expect(prompt.userPrompt).toContain('Motivations: none specified');
    expect(prompt.userPrompt).toContain('Constraints: none');
    expect(prompt.userPrompt).toContain(
      'User Instruction: 让主角主动试探誓言的副作用，但不要打破既有世界规则。',
    );
  });

  it('renders the conservative creativity note for low creativity presets', () => {
    const assembler = new PromptAssembler();

    const prompt = assembler.assemblePrompt({
      context: createBranchGapContext(),
      mode: 'auto',
      creativityConfig: resolveCreativityConfig(CreativityPreset.CONSERVATIVE, 'auto'),
    });

    expect(prompt.systemPrompt).toContain('Conservative creativity setting');
  });
});
