import { describe, expect, it } from 'vitest';

import {
  ContextScraper,
  estimateTokens,
  type ChapterInput,
  type ScrapedContext,
  type SessionInput,
  type StoryBibleInput,
} from '../../cowriting/ContextScraper.js';
import {
  CharacterArchetype,
  TimelineEventType,
  WorldRuleCategory,
  createCharacterProfile,
  createTimelineEvent,
  createWorldRule,
} from '../../knowledge/entities/story-bible-types.js';

type ContextScraperInternals = ContextScraper & {
  estimateTotalTokens(context: ScrapedContext): number;
  applyShrinkRay(context: ScrapedContext): void;
};

function createSession(): SessionInput {
  return {
    recentEdits: ['edit-1'.repeat(10), 'edit-2'.repeat(10), 'edit-3'.repeat(10)],
    writingStyle: 'tense '.repeat(30),
    currentChapter: 'CH08',
    cursorPosition: 120,
  };
}

function createChapter(): ChapterInput {
  return {
    fullText: 'before '.repeat(80) + 'after '.repeat(30),
    cursorPosition: 'before '.repeat(80).length,
    chapterSummary: 'summary '.repeat(20),
  };
}

function buildContext(storyBible: StoryBibleInput): ScrapedContext {
  const scraper = new ContextScraper({ maxTokens: 999_999, maxRecentEdits: 3 });
  return scraper.assembleContext(storyBible, createSession(), createChapter());
}

describe('cowriting/ContextScraper additional coverage', () => {
  it('counts extension-A, CJK punctuation, and fullwidth characters as CJK tokens', () => {
    expect(estimateTokens('\u3400')).toBe(1);
    expect(estimateTokens('。')).toBe(1);
    expect(estimateTokens('Ａ')).toBe(1);
  });

  it('scores and drops a regional world rule between global and local rules', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;

    const original = buildContext({
      characters: [],
      plotThreads: [],
      timelineEvents: [],
      worldRules: [
        createWorldRule({
          id: 'rule-global',
          name: 'Sky Accord',
          category: WorldRuleCategory.POLITICAL,
          description: 'A world-spanning oath binds every city-state to the same response.',
          constraints: ['Witness required'],
          exceptions: ['Royal decree'],
          impactScope: 'global',
          relatedEntities: ['char-pro'],
          completenessScore: 1,
        }),
        createWorldRule({
          id: 'rule-regional',
          name: 'Border Lantern',
          category: WorldRuleCategory.SOCIAL,
          description: 'A regional custom marks the passes with coded lanterns.',
          constraints: ['North pass only'],
          exceptions: [],
          impactScope: 'regional',
          relatedEntities: ['char-pro'],
          completenessScore: 0.5,
        }),
        createWorldRule({
          id: 'rule-local',
          name: 'Market Bell',
          category: WorldRuleCategory.ECONOMIC,
          description: 'A small town charges a bell tax at the gate.',
          constraints: ['Coin only'],
          exceptions: [],
          impactScope: 'local',
          relatedEntities: [],
          completenessScore: 0,
        }),
      ],
    });

    const targetContext = buildContext({
      characters: [],
      plotThreads: [],
      timelineEvents: [],
      worldRules: [
        original.storyBible.worldRules[0],
        original.storyBible.worldRules[1],
      ],
    });

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens, maxRecentEdits: 3 });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    expect(original.storyBible.worldRules.map((rule) => rule.name)).toEqual([
      'Sky Accord',
      'Border Lantern',
    ]);
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });

  it('keeps high-impact events intact while summarizing medium events', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;

    const original = buildContext({
      characters: [],
      worldRules: [],
      plotThreads: [],
      timelineEvents: [
        createTimelineEvent({
          id: 'event-critical',
          name: 'Gate Breach',
          eventType: TimelineEventType.CONFRONTATION,
          timestamp: 'Night 2',
          chapterRef: 'CH08',
          description: 'Critical breach at the north gate.',
          participants: ['char-pro'],
          consequences: ['Wall compromised'],
          plotThreadRefs: ['thread-1'],
          emotionalImpact: 'critical',
        }),
        createTimelineEvent({
          id: 'event-high',
          name: 'Signal Fire',
          eventType: TimelineEventType.REVELATION,
          timestamp: 'Night 2',
          chapterRef: 'CH08',
          description: 'A high-priority warning reveals the enemy approach.',
          participants: ['char-pro', 'char-support'],
          consequences: ['Alarm raised'],
          plotThreadRefs: ['thread-1'],
          emotionalImpact: 'high',
        }),
        createTimelineEvent({
          id: 'event-medium',
          name: 'Archive Inventory',
          eventType: TimelineEventType.REVELATION,
          timestamp: 'Night 1',
          chapterRef: 'CH07',
          description: 'M'.repeat(180),
          participants: ['char-pro', 'char-support', 'char-rival'],
          consequences: ['Inventory mismatch', 'Trust shaken'],
          plotThreadRefs: ['thread-1'],
          emotionalImpact: 'medium',
        }),
      ],
    });

    const targetContext = buildContext({
      characters: [],
      worldRules: [],
      plotThreads: [],
      timelineEvents: [
        original.storyBible.timelineEvents[0],
        original.storyBible.timelineEvents[1],
        {
          ...original.storyBible.timelineEvents[2],
          description: `${'M'.repeat(57)}...`,
          participants: [],
          consequences: [],
          plotThreadRefs: [],
        },
      ],
    });

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens, maxRecentEdits: 3 });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    expect(original.storyBible.timelineEvents).toHaveLength(3);
    expect(original.storyBible.timelineEvents[1]).toMatchObject({
      name: 'Signal Fire',
      participants: ['char-pro', 'char-support'],
      consequences: ['Alarm raised'],
      plotThreadRefs: ['thread-1'],
      description: 'A high-priority warning reveals the enemy approach.',
    });
    expect(original.storyBible.timelineEvents[2]).toMatchObject({
      name: 'Archive Inventory',
      participants: [],
      consequences: [],
      plotThreadRefs: [],
      description: `${'M'.repeat(57)}...`,
    });
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });

  it('ranks deuteragonist above antagonist, mentor, and narrator when dropping characters', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;

    const original = buildContext({
      worldRules: [],
      timelineEvents: [],
      plotThreads: [],
      characters: [
        createCharacterProfile({
          id: 'char-pro',
          name: 'Aster',
          archetype: CharacterArchetype.PROTAGONIST,
          completenessScore: 0.6,
          povAffinity: 0.6,
          traits: [{ trait: 'steady', intensity: 0.7, evidence: 'Leads calmly.' }],
          motivations: ['Protect the team'],
          backstory: 'P'.repeat(240),
          relationships: [{ targetId: 'char-deut', type: 'ally', description: 'Trusted partner' }],
          speechPatterns: ['Short lines'],
          arcStage: 'rising',
        }),
        createCharacterProfile({
          id: 'char-deut',
          name: 'Bryn',
          archetype: CharacterArchetype.DEUTERAGONIST,
          completenessScore: 0.4,
          povAffinity: 0.2,
          traits: [{ trait: 'quick', intensity: 0.7, evidence: 'Acts first.' }],
          motivations: ['Keep up with Aster'],
          backstory: 'D'.repeat(220),
          relationships: [{ targetId: 'char-pro', type: 'ally', description: 'Follows Aster' }],
          speechPatterns: ['Fast banter'],
          arcStage: 'rising',
        }),
        createCharacterProfile({
          id: 'char-ant',
          name: 'Cairn',
          archetype: CharacterArchetype.ANTAGONIST,
          completenessScore: 0.4,
          povAffinity: 0.2,
          traits: [{ trait: 'cold', intensity: 0.7, evidence: 'Calculates losses.' }],
          motivations: ['Break the alliance'],
          backstory: 'A'.repeat(220),
          relationships: [{ targetId: 'char-pro', type: 'rival', description: 'Sabotages Aster' }],
          speechPatterns: ['Measured threats'],
          arcStage: 'rising',
        }),
        createCharacterProfile({
          id: 'char-mentor',
          name: 'Dorin',
          archetype: CharacterArchetype.MENTOR,
          completenessScore: 0.4,
          povAffinity: 0.2,
          traits: [{ trait: 'patient', intensity: 0.7, evidence: 'Explains every step.' }],
          motivations: ['Prepare the next generation'],
          backstory: 'M'.repeat(220),
          relationships: [{ targetId: 'char-pro', type: 'mentor-student', description: 'Trains Aster' }],
          speechPatterns: ['Long pauses'],
          arcStage: 'steady',
        }),
        createCharacterProfile({
          id: 'char-narr',
          name: 'Echo',
          archetype: CharacterArchetype.NARRATOR,
          completenessScore: 0.4,
          povAffinity: 0.2,
          traits: [{ trait: 'observant', intensity: 0.7, evidence: 'Notes every shift.' }],
          motivations: ['Record the truth'],
          backstory: 'N'.repeat(220),
          relationships: [{ targetId: 'char-pro', type: 'other', description: 'Documents the campaign' }],
          speechPatterns: ['Detached voice'],
          arcStage: 'steady',
        }),
      ],
    });

    const targetContext = buildContext({
      worldRules: [],
      timelineEvents: [],
      plotThreads: [],
      characters: [
        {
          ...original.storyBible.characters[0],
          backstory: '',
          speechPatterns: [],
          relationships: original.storyBible.characters[0].relationships.slice(0, 2),
          traits: [{ trait: 'steady', intensity: 0.5, evidence: '' }],
        },
        {
          ...original.storyBible.characters[1],
          backstory: '',
          speechPatterns: [],
          relationships: original.storyBible.characters[1].relationships.slice(0, 2),
          traits: [{ trait: 'quick', intensity: 0.5, evidence: '' }],
        },
      ],
    });

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens, maxRecentEdits: 3 });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    expect(original.storyBible.characters.map((char) => char.name)).toEqual([
      'Aster',
      'Bryn',
    ]);
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });
});
