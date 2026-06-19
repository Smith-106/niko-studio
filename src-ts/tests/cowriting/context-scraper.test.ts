import { describe, expect, it } from 'vitest';

import {
  ContextScraper,
  createContextScraper,
  estimateTokens,
} from '../../cowriting/ContextScraper.js';
import type { ScrapedContext } from '../../cowriting/ContextScraper.js';
import {
  CharacterArchetype,
  PlotThreadStatus,
  TimelineEventType,
  WorldRuleCategory,
  createCharacterProfile,
  createPlotThread,
  createTimelineEvent,
  createWorldRule,
} from '../../knowledge/entities/story-bible-types.js';

type ContextScraperInternals = ContextScraper & {
  estimateTotalTokens(context: ScrapedContext): number;
  applyShrinkRay(context: ScrapedContext): void;
};

function createCompleteness() {
  return {
    overallScore: 0.75,
    level: 'adequate' as const,
    entityScores: new Map(),
    missingFields: [],
    recommendations: [],
    timestamp: '2026-06-04T00:00:00.000Z',
  };
}

function createStoryBibleContext(): ScrapedContext {
  return {
    storyBible: {
      characters: [
        createCharacterProfile({
          id: 'char-pro',
          name: 'Aster',
          archetype: CharacterArchetype.PROTAGONIST,
          completenessScore: 1,
          povAffinity: 1,
          traits: [
            { trait: 'brave', intensity: 0.9, evidence: 'Charges first.' },
            { trait: 'careful', intensity: 0.8, evidence: 'Plans every move.' },
            { trait: 'loyal', intensity: 0.8, evidence: 'Never abandons allies.' },
          ],
          motivations: ['Protect the city', 'Find the missing map'],
          backstory: 'P'.repeat(220),
          relationships: [
            { targetId: 'char-support', type: 'ally', description: 'Trusted scout' },
            { targetId: 'char-rival', type: 'rival', description: 'Competes for command' },
          ],
          speechPatterns: ['Short commands', 'Measured pauses'],
          arcStage: 'rising',
        }),
        createCharacterProfile({
          id: 'char-support',
          name: 'Bryn',
          archetype: CharacterArchetype.SUPPORTING,
          completenessScore: 0.4,
          povAffinity: 0.2,
          traits: [
            { trait: 'quick', intensity: 0.6, evidence: 'Moves first.' },
            { trait: 'witty', intensity: 0.7, evidence: 'Jokes under pressure.' },
            { trait: 'hidden grief', intensity: 0.8, evidence: 'Avoids home.' },
          ],
          motivations: ['Prove herself'],
          backstory: 'S'.repeat(260),
          relationships: [
            { targetId: 'char-pro', type: 'ally', description: 'Follows Aster' },
            { targetId: 'char-rival', type: 'other', description: 'Mutual suspicion' },
            { targetId: 'char-mentor', type: 'mentor-student', description: 'Old training bond' },
          ],
          speechPatterns: ['Fast banter', 'Dry sarcasm'],
          arcStage: 'rising',
        }),
      ],
      worldRules: [
        createWorldRule({
          id: 'rule-high',
          name: 'Crown Oath',
          category: WorldRuleCategory.POLITICAL,
          description: 'A global oath binds every command post and every refusal triggers a public ledger review.',
          constraints: ['Witness required'],
          exceptions: ['Royal pardon'],
          impactScope: 'global',
          relatedEntities: ['char-pro', 'char-support'],
          completenessScore: 1,
        }),
        createWorldRule({
          id: 'rule-low',
          name: 'Dust Tax',
          category: WorldRuleCategory.ECONOMIC,
          description: 'A local checkpoint rule about paying a small market tax at the outer road.',
          constraints: ['Coin only'],
          exceptions: [],
          impactScope: 'local',
          relatedEntities: [],
          completenessScore: 0,
        }),
      ],
      plotThreads: [
        createPlotThread({
          id: 'thread-1',
          name: 'Missing Map',
          status: PlotThreadStatus.DEVELOPING,
          premise: 'A map vanished before the campaign started.',
          goal: 'Recover the map',
          stakes: 'The defense grid will fail without it.',
          involvedCharacters: ['char-pro', 'char-support'],
        }),
      ],
      timelineEvents: [
        createTimelineEvent({
          id: 'event-critical',
          name: 'Gate Breach',
          eventType: TimelineEventType.CONFRONTATION,
          timestamp: 'Night 2',
          chapterRef: 'CH05',
          description: 'The northern gate collapses under coordinated sabotage.',
          participants: ['char-pro'],
          consequences: ['Walls compromised'],
          plotThreadRefs: ['thread-1'],
          emotionalImpact: 'critical',
        }),
        createTimelineEvent({
          id: 'event-medium',
          name: 'Archive Inventory',
          eventType: TimelineEventType.REVELATION,
          timestamp: 'Night 1',
          chapterRef: 'CH04',
          description: 'M'.repeat(180),
          participants: ['char-pro', 'char-support', 'char-rival'],
          consequences: ['Inventory mismatch', 'Trust shaken'],
          plotThreadRefs: ['thread-1'],
          emotionalImpact: 'medium',
        }),
      ],
      completeness: createCompleteness(),
    },
    sessionContext: {
      recentEdits: ['edit-1'.repeat(12), 'edit-2'.repeat(12), 'edit-3'.repeat(12)],
      writingStyle: 'tense '.repeat(40),
      currentChapter: 'CH05',
      cursorPosition: 88,
    },
    chapterContext: {
      precedingText: 'before '.repeat(60),
      succeedingText: 'after '.repeat(24),
      chapterSummary: 'summary '.repeat(30),
    },
    totalTokenEstimate: 0,
  };
}

describe('cowriting/ContextScraper', () => {
  it('estimates empty and mixed-language token counts', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('中文ABCD')).toBe(2);
  });

  it('assembles chapter slices and trims recent edits from configuration', () => {
    const scraper = new ContextScraper({
      maxTokens: 10_000,
      precedingTextChars: 6,
      succeedingTextChars: 4,
      maxRecentEdits: 2,
    });

    const context = scraper.assembleContext(
      {
        characters: [
          createCharacterProfile({
            id: 'char-1',
            name: 'Aster',
            archetype: CharacterArchetype.PROTAGONIST,
            completenessScore: 1,
            povAffinity: 1,
            traits: [
              { trait: 'steady', intensity: 0.8, evidence: 'Never rushes.' },
              { trait: 'loyal', intensity: 0.9, evidence: 'Keeps promises.' },
            ],
            motivations: ['Protect the team'],
            backstory: 'B'.repeat(80),
            relationships: [
              { targetId: 'char-2', type: 'ally', description: 'Battle partner' },
            ],
            speechPatterns: ['Short lines'],
            arcStage: 'rising',
          }),
        ],
        worldRules: [],
        plotThreads: [],
        timelineEvents: [],
      },
      {
        recentEdits: ['first', 'second', 'third'],
        writingStyle: 'close-third',
        currentChapter: 'CH03',
        cursorPosition: 8,
      },
      {
        fullText: '0123456789abcdef',
        cursorPosition: 8,
        chapterSummary: 'checkpoint summary',
      },
    );

    expect(context.chapterContext.precedingText).toBe('234567');
    expect(context.chapterContext.succeedingText).toBe('89ab');
    expect(context.sessionContext.recentEdits).toEqual(['second', 'third']);
    expect(context.storyBible.completeness.overallScore).toBeGreaterThan(0);
    expect(context.totalTokenEstimate).toBeGreaterThan(0);
  });

  it('invokes Shrink Ray from assembleContext when the public assembly exceeds maxTokens', () => {
    const oversized = createStoryBibleContext();
    const warmup = new ContextScraper({ maxTokens: 99_999, maxRecentEdits: 3 });
    const oversizedStoryBible = {
      characters: oversized.storyBible.characters,
      worldRules: oversized.storyBible.worldRules,
      plotThreads: oversized.storyBible.plotThreads,
      timelineEvents: oversized.storyBible.timelineEvents,
    };
    const oversizedSession = {
      recentEdits: oversized.sessionContext.recentEdits,
      writingStyle: oversized.sessionContext.writingStyle,
      currentChapter: oversized.sessionContext.currentChapter,
      cursorPosition: oversized.sessionContext.cursorPosition,
    };
    const oversizedChapter = {
      fullText: `${oversized.chapterContext.precedingText}${oversized.chapterContext.succeedingText}`,
      cursorPosition: oversized.chapterContext.precedingText.length,
      chapterSummary: oversized.chapterContext.chapterSummary,
    };

    const baseline = warmup.assembleContext(
      oversizedStoryBible,
      oversizedSession,
      oversizedChapter,
    );

    const scraper = new ContextScraper({
      maxTokens: baseline.totalTokenEstimate - 1,
      maxRecentEdits: 3,
    });
    const shrunken = scraper.assembleContext(
      oversizedStoryBible,
      oversizedSession,
      oversizedChapter,
    );

    expect(shrunken.totalTokenEstimate).toBeLessThanOrEqual(baseline.totalTokenEstimate - 1);
    expect(shrunken.storyBible.worldRules.length).toBeLessThanOrEqual(baseline.storyBible.worldRules.length);
  });

  it('drops lower-relevance rules and summarizes medium-priority timeline events under pressure', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;
    const original = createStoryBibleContext();
    original.storyBible.characters = [];

    const targetContext = createStoryBibleContext();
    targetContext.storyBible.characters = [];
    targetContext.storyBible.worldRules = [targetContext.storyBible.worldRules[0]];
    targetContext.storyBible.timelineEvents = [
      targetContext.storyBible.timelineEvents[0],
      {
        ...targetContext.storyBible.timelineEvents[1],
        description: `${'M'.repeat(57)}...`,
        participants: [],
        consequences: [],
        plotThreadRefs: [],
      },
    ];

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    expect(original.storyBible.worldRules).toHaveLength(1);
    expect(original.storyBible.worldRules[0].name).toBe('Crown Oath');
    expect(original.storyBible.timelineEvents).toHaveLength(2);
    expect(original.storyBible.timelineEvents[1]).toMatchObject({
      name: 'Archive Inventory',
      participants: [],
      consequences: [],
      plotThreadRefs: [],
      description: `${'M'.repeat(57)}...`,
    });
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });

  it('truncates lower-relevance characters before touching the protagonist', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;
    const original = createStoryBibleContext();
    original.storyBible.worldRules = [];
    original.storyBible.timelineEvents = [];
    original.storyBible.plotThreads = [];

    const targetContext = createStoryBibleContext();
    targetContext.storyBible.worldRules = [];
    targetContext.storyBible.timelineEvents = [];
    targetContext.storyBible.plotThreads = [];
    targetContext.storyBible.characters = [
      targetContext.storyBible.characters[0],
      {
        ...targetContext.storyBible.characters[1],
        backstory: '',
        speechPatterns: [],
        relationships: targetContext.storyBible.characters[1].relationships.slice(0, 2),
        traits: [{ trait: 'quick, witty, hidden grief', intensity: 0.5, evidence: '' }],
      },
    ];

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    const protagonist = original.storyBible.characters.find((char) => char.name === 'Aster');
    const supporting = original.storyBible.characters.find((char) => char.name === 'Bryn');

    expect(protagonist?.backstory).toBe('P'.repeat(220));
    expect(supporting).toMatchObject({
      backstory: '',
      speechPatterns: [],
      relationships: [
        { targetId: 'char-pro', type: 'ally', description: 'Follows Aster' },
        { targetId: 'char-rival', type: 'other', description: 'Mutual suspicion' },
      ],
      traits: [{ trait: 'quick, witty, hidden grief', intensity: 0.5, evidence: '' }],
    });
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });

  it('drops summarized low-priority timeline events when they still exceed the token budget', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;

    const original = createStoryBibleContext();
    original.storyBible.characters = [];
    original.storyBible.worldRules = [];
    original.storyBible.plotThreads = [];
    original.storyBible.timelineEvents = [
      original.storyBible.timelineEvents[0],
      createTimelineEvent({
        id: 'event-low-1',
        name: 'Bell Echo',
        eventType: TimelineEventType.TRANSITION,
        timestamp: 'Night 1',
        chapterRef: 'CH04',
        description: 'Short clue',
        participants: ['char-pro', 'char-support'],
        consequences: ['Echo logged'],
        plotThreadRefs: ['thread-1'],
        emotionalImpact: 'low',
      }),
      createTimelineEvent({
        id: 'event-low-2',
        name: 'Torch Flicker',
        eventType: TimelineEventType.TRANSITION,
        timestamp: 'Night 1',
        chapterRef: 'CH04',
        description: 'Another clue',
        participants: ['char-pro', 'char-support'],
        consequences: ['Torch shifted'],
        plotThreadRefs: ['thread-1'],
        emotionalImpact: 'low',
      }),
    ];

    const targetContext = createStoryBibleContext();
    targetContext.storyBible.characters = [];
    targetContext.storyBible.worldRules = [];
    targetContext.storyBible.plotThreads = [];
    targetContext.storyBible.timelineEvents = [
      targetContext.storyBible.timelineEvents[0],
      {
        ...original.storyBible.timelineEvents[1],
        participants: [],
        consequences: [],
        plotThreadRefs: [],
      },
    ];

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    expect(original.storyBible.timelineEvents).toHaveLength(2);
    expect(original.storyBible.timelineEvents[1]).toMatchObject({
      name: 'Bell Echo',
      description: 'Short clue',
      participants: [],
      consequences: [],
      plotThreadRefs: [],
    });
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });

  it('truncates the protagonist and drops least relevant characters when the budget remains too tight', () => {
    const estimator = new ContextScraper({ maxTokens: 999_999 });
    const estimatorInternals = estimator as unknown as ContextScraperInternals;

    const original = createStoryBibleContext();
    original.storyBible.worldRules = [];
    original.storyBible.timelineEvents = [];
    original.storyBible.plotThreads = [];
    original.storyBible.characters.push(
      createCharacterProfile({
        id: 'char-extra',
        name: 'Corin',
        archetype: CharacterArchetype.SUPPORTING,
        completenessScore: 0.1,
        povAffinity: 0,
        traits: [],
        motivations: ['Stay unnoticed'],
        backstory: 'C'.repeat(300),
        relationships: [
          { targetId: 'char-pro', type: 'other', description: 'Keeps distance' },
          { targetId: 'char-support', type: 'other', description: 'Shares rumors' },
          { targetId: 'char-rival', type: 'other', description: 'Distrusts openly' },
        ],
        speechPatterns: ['Rarely speaks'],
        arcStage: 'rising',
      }),
    );

    const targetContext = createStoryBibleContext();
    targetContext.storyBible.worldRules = [];
    targetContext.storyBible.timelineEvents = [];
    targetContext.storyBible.plotThreads = [];
    targetContext.storyBible.characters = [
      {
        ...targetContext.storyBible.characters[0],
        backstory: '',
        speechPatterns: [],
        relationships: targetContext.storyBible.characters[0].relationships.slice(0, 2),
        traits: [{ trait: 'brave, careful, loyal', intensity: 0.5, evidence: '' }],
      },
    ];

    const targetTokens = estimatorInternals.estimateTotalTokens(targetContext);
    const scraper = new ContextScraper({ maxTokens: targetTokens });
    const internals = scraper as unknown as ContextScraperInternals;

    original.totalTokenEstimate = internals.estimateTotalTokens(original);
    expect(original.totalTokenEstimate).toBeGreaterThan(targetTokens);

    internals.applyShrinkRay(original);

    expect(original.storyBible.characters).toHaveLength(1);
    expect(original.storyBible.characters[0]).toMatchObject({
      name: 'Aster',
      backstory: '',
      speechPatterns: [],
      traits: [{ trait: 'brave, careful, loyal', intensity: 0.5, evidence: '' }],
    });
    expect(original.totalTokenEstimate).toBeLessThanOrEqual(targetTokens);
  });

  it('exposes the factory helper', () => {
    expect(createContextScraper()).toBeInstanceOf(ContextScraper);
  });
});
