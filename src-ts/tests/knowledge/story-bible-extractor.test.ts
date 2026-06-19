import { describe, expect, it, vi } from 'vitest';

import {
  StoryBibleExtractor,
  createStoryBibleExtractor,
} from '../../knowledge/extraction/StoryBibleExtractor.js';
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

describe('knowledge/extraction/StoryBibleExtractor', () => {
  it('factory creates an extractor instance', () => {
    const extractor = createStoryBibleExtractor();
    expect(extractor).toBeInstanceOf(StoryBibleExtractor);
  });

  it('returns zero confidence and no warnings when all extraction switches are disabled', async () => {
    const extractor = new StoryBibleExtractor({
      extractCharacters: false,
      extractWorldRules: false,
      extractPlotThreads: false,
      extractTimelineEvents: false,
    });

    const result = await extractor.extractFromManuscript('plain text only', 'novel-disabled');

    expect(result).toEqual({
      entities: [],
      confidence: 0,
      warnings: [],
    });
  });

  it('aggregates extracted entities and emits warnings for empty channels', async () => {
    const extractor = new StoryBibleExtractor();
    const character = createCharacterProfile({
      id: 'char-1',
      novelId: 'novel-1',
      name: 'Hero',
      source: 'auto-extract',
      completenessScore: 0.6,
      traits: [{ trait: 'brave', intensity: 0.5, evidence: 'evidence' }],
      speechPatterns: ['Keep moving'],
      archetype: CharacterArchetype.PROTAGONIST,
    });
    const plotThread = createPlotThread({
      id: 'plot-1',
      novelId: 'novel-1',
      name: 'Recover the map',
      source: 'auto-extract',
      completenessScore: 0.7,
      premise: 'Recover the lost map',
      goal: 'Reach the hidden city',
      status: PlotThreadStatus.DEVELOPING,
    });

    const charSpy = vi.spyOn(extractor, 'extractCharacters').mockReturnValue([character]);
    const rulesSpy = vi.spyOn(extractor, 'extractWorldRules').mockReturnValue([]);
    const plotSpy = vi.spyOn(extractor, 'extractPlotThreads').mockReturnValue([plotThread]);
    const timelineSpy = vi.spyOn(extractor, 'extractTimelineEvents').mockReturnValue([]);

    const result = await extractor.extractFromManuscript('ignored body', 'novel-1');

    expect(result.entities).toEqual([character, plotThread]);
    expect(result.confidence).toBe(0.65);
    expect(result.warnings).toEqual([
      'No world rules extracted from manuscript',
      'No timeline events extracted from manuscript',
    ]);
    expect(charSpy).toHaveBeenCalledWith('ignored body', 'novel-1');
    expect(rulesSpy).toHaveBeenCalledWith('ignored body', 'novel-1');
    expect(plotSpy).toHaveBeenCalledWith('ignored body', 'novel-1');
    expect(timelineSpy).toHaveBeenCalledWith('ignored body', 'novel-1');
  });

  it('returns empty arrays for unmatched source text in all concrete extractors', () => {
    const extractor = new StoryBibleExtractor();
    const plain = 'This ASCII-only paragraph deliberately avoids every extractor pattern.';

    expect(extractor.extractCharacters(plain, 'novel-plain')).toEqual([]);
    expect(extractor.extractWorldRules(plain, 'novel-plain')).toEqual([]);
    expect(extractor.extractPlotThreads(plain, 'novel-plain')).toEqual([]);
    expect(extractor.extractTimelineEvents(plain, 'novel-plain')).toEqual([]);
  });

  it('reports empty extraction warnings when enabled channels find nothing', async () => {
    const extractor = new StoryBibleExtractor();
    const plain = 'This ASCII-only paragraph deliberately avoids every extractor pattern.';

    const result = await extractor.extractFromManuscript(plain, 'novel-empty');

    expect(result).toEqual({
      entities: [],
      confidence: 0,
      warnings: [
        'No characters extracted from manuscript',
        'No world rules extracted from manuscript',
        'No plot threads extracted from manuscript',
        'No timeline events extracted from manuscript',
      ],
    });
  });

  it('aggregates world-rule and timeline confidence when only those channels are enabled', async () => {
    const extractor = new StoryBibleExtractor({
      extractCharacters: false,
      extractPlotThreads: false,
    });
    const worldRule = createWorldRule({
      id: 'rule-agg',
      novelId: 'novel-agg',
      name: 'Gate law',
      source: 'auto-extract',
      category: WorldRuleCategory.MAGIC,
      description: 'Only artifact bearers can open the gate without shattering the seals.',
    });
    worldRule.completenessScore = 0.6;

    const timelineEvent = createTimelineEvent({
      id: 'event-agg',
      novelId: 'novel-agg',
      name: 'Gate opens',
      source: 'auto-extract',
      description: 'The gate opens and changes the balance of the city overnight.',
    });
    timelineEvent.completenessScore = 0.3;

    vi.spyOn(extractor, 'extractWorldRules').mockReturnValue([worldRule]);
    vi.spyOn(extractor, 'extractTimelineEvents').mockReturnValue([timelineEvent]);

    const result = await extractor.extractFromManuscript('ignored body', 'novel-agg');

    expect(result.entities).toEqual([worldRule, timelineEvent]);
    expect(result.confidence).toBe(0.45);
    expect(result.warnings).toEqual([]);
  });

  it('builds character skeletons and computes character completeness scores', () => {
    const extractor = new StoryBibleExtractor();
    const skeleton = (extractor as any).createCharacterSkeleton('Lin', 'novel-skeleton');

    expect(skeleton.name).toBe('Lin');
    expect(skeleton.novelId).toBe('novel-skeleton');
    expect(skeleton.source).toBe('auto-extract');
    expect(skeleton.archetype).toBe(CharacterArchetype.SUPPORTING);
    expect(skeleton.traits).toEqual([]);
    expect(skeleton.speechPatterns).toEqual([]);

    const richCharacter = createCharacterProfile({
      id: 'char-rich',
      novelId: 'novel-skeleton',
      name: 'Rich',
      source: 'auto-extract',
      archetype: CharacterArchetype.MENTOR,
      traits: [{ trait: 'calm', intensity: 0.6, evidence: 'calm' }],
      motivations: ['Protect the group'],
      backstory: 'Former captain.',
      relationships: [{ targetId: 'other', type: 'ally', description: 'Trusted ally' }],
      speechPatterns: ['Listen carefully.'],
    });
    const sparseCharacter = createCharacterProfile({
      id: 'char-sparse',
      novelId: 'novel-skeleton',
      name: 'Sparse',
      source: 'auto-extract',
    });

    expect((extractor as any).calculateCharacterCompleteness(richCharacter)).toBe(1);
    expect((extractor as any).calculateCharacterCompleteness(sparseCharacter)).toBe(0);
  });

  it('computes completeness for world rules, plot threads, and timeline events', () => {
    const extractor = new StoryBibleExtractor();
    const worldRule = createWorldRule({
      id: 'rule-1',
      novelId: 'novel-2',
      name: 'Gravity storm',
      source: 'auto-extract',
      category: WorldRuleCategory.PHYSICS,
      description: 'A long enough description of the gravity storm rule.',
      constraints: ['Cannot fly'],
      exceptions: ['Unless shielded'],
      relatedEntities: ['zone-1'],
    });
    const sparseRule = createWorldRule({
      id: 'rule-2',
      novelId: 'novel-2',
      name: 'Sparse rule',
      source: 'auto-extract',
      description: 'tiny',
    });

    const plotThread = createPlotThread({
      id: 'plot-2',
      novelId: 'novel-2',
      name: 'Escape thread',
      source: 'auto-extract',
      premise: 'Escape the fortress',
      goal: 'Reach the harbor safely',
      stakes: 'Failure means capture',
      involvedCharacters: ['c1'],
      keyEvents: ['e1'],
      status: PlotThreadStatus.CLIMAX,
    });
    const sparseThread = createPlotThread({
      id: 'plot-3',
      novelId: 'novel-2',
      name: 'Sparse thread',
      source: 'auto-extract',
      premise: 'tiny',
      goal: '',
    });

    const timelineEvent = createTimelineEvent({
      id: 'event-1',
      novelId: 'novel-2',
      name: 'Harbor fire',
      source: 'auto-extract',
      description: 'A major event changes the entire harbor district overnight.',
      timestamp: 'night-3',
      chapterRef: 'CH03',
      participants: ['c1'],
      consequences: ['district-lost'],
    });
    const sparseEvent = createTimelineEvent({
      id: 'event-2',
      novelId: 'novel-2',
      name: 'Sparse event',
      source: 'auto-extract',
      description: 'short',
    });

    expect((extractor as any).calculateWorldRuleCompleteness(worldRule)).toBe(1);
    expect((extractor as any).calculateWorldRuleCompleteness(sparseRule)).toBe(0);
    expect((extractor as any).calculatePlotThreadCompleteness(plotThread)).toBe(1);
    expect((extractor as any).calculatePlotThreadCompleteness(sparseThread)).toBe(0);
    expect((extractor as any).calculateTimelineEventCompleteness(timelineEvent)).toBe(1);
    expect((extractor as any).calculateTimelineEventCompleteness(sparseEvent)).toBe(0);
  });

  it('truncates names and deduplicates long descriptions while preserving short entries', () => {
    const extractor = new StoryBibleExtractor();

    expect((extractor as any).truncateName('  line one\nline two  ', 50)).toBe('line one line two');
    expect((extractor as any).truncateName('abcdefghijklmnopqrstuvwxyz', 10)).toBe('abcdefghij...');

    const dedupedDescriptions = (extractor as any).deduplicateByDescription([
      { description: 'short' },
      { description: 'A very long duplicate description that should collapse into one result.' },
      { description: 'A very long duplicate description that should collapse into one result.' },
    ]);
    const dedupedPremises = (extractor as any).deduplicateByDescription([
      { premise: 'short' },
      { premise: 'A premise that is definitely long enough to deduplicate cleanly.' },
      { premise: 'A premise that is definitely long enough to deduplicate cleanly.' },
    ], 'premise');

    expect(dedupedDescriptions).toHaveLength(2);
    expect(dedupedPremises).toHaveLength(2);
  });

  it('extracts characters only when occurrence and confidence thresholds are satisfied', () => {
    const extractor = new StoryBibleExtractor();
    const manuscript = [
      '"我们必须前进"林川说。',
      '"不要害怕"林川低语。',
      '勇敢的林川是这场远征的主角，林川绝不会后退。',
      '"我会撤退"阿木说。',
      '聪明的阿木望着山谷。',
    ].join('');

    const characters = extractor.extractCharacters(manuscript, 'novel-characters');

    expect(characters).toHaveLength(1);
    expect(characters[0].name).toBe('林川');
    expect(characters[0].archetype).toBe(CharacterArchetype.PROTAGONIST);
    expect(characters[0].traits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ trait: '勇敢', evidence: '勇敢', intensity: 0.5 }),
      ]),
    );
    expect(characters[0].speechPatterns).toEqual(['我们必须前进', '不要害怕']);
    expect(characters[0].completenessScore).toBe(0.55);

    const strictExtractor = new StoryBibleExtractor({ minConfidence: 0.6 });
    expect(strictExtractor.extractCharacters(manuscript, 'novel-characters')).toEqual([]);
  });

  it('extracts world rules with category detection and removes duplicates', () => {
    const extractor = new StoryBibleExtractor();
    const manuscript = [
      '只有掌握古老魔法的人才能打开星门并施展咒语。',
      '只有掌握古老魔法的人才能打开星门并施展咒语。',
      '凡是新兵都要服从。',
    ].join('');

    const rules = extractor.extractWorldRules(manuscript, 'novel-rules');

    expect(rules).toHaveLength(1);
    expect(rules[0].category).toBe(WorldRuleCategory.MAGIC);
    expect(rules[0].description).toContain('只有掌握古老魔法的人才能打开星门并施展咒语');
    expect(rules[0].completenessScore).toBe(0.6);
  });

  it('extracts plot threads with status detection and deduplicates repeated premises', () => {
    const extractor = new StoryBibleExtractor();
    const manuscript = [
      '必须推进远征行动夺回失落王城，否则王城防线与都城命运会彻底崩溃。',
      '必须推进远征行动夺回失落王城，否则王城防线与都城命运会彻底崩溃。',
    ].join('');

    const threads = extractor.extractPlotThreads(manuscript, 'novel-threads');

    expect(threads).toHaveLength(1);
    expect(threads[0].premise).toBe('推进远征行动夺回失落王城');
    expect(threads[0].goal).toBe('王城防线与都城命运会彻底崩溃');
    expect(threads[0].status).toBe(PlotThreadStatus.DEVELOPING);
    expect(threads[0].completenessScore).toBe(0.6);
  });

  it('keeps setup plot threads with empty goals when single-capture patterns match', () => {
    const extractor = new StoryBibleExtractor({ minConfidence: 0.2 });

    const threads = extractor.extractPlotThreads('目标是守住王城与城门直到援军赶到。', 'novel-goal-only');

    expect(threads).toHaveLength(1);
    expect(threads[0].premise).toBe('守住王城与城门直到援军赶到');
    expect(threads[0].goal).toBe('');
    expect(threads[0].status).toBe(PlotThreadStatus.SETUP);
  });

  it('extracts timeline events when confidence threshold is lowered', () => {
    const extractor = new StoryBibleExtractor({ minConfidence: 0.3 });
    const manuscript = [
      '这一段只是背景说明，没有任何事件动词可以命中。',
      '',
      '在清晨，林川决定离开边城，前往王都，这次行动关系到所有人的命运，也让所有人第一次明白真相。',
    ].join('\n');

    const events = extractor.extractTimelineEvents(manuscript, 'novel-events');

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(TimelineEventType.DECISION);
    expect(events[0].emotionalImpact).toBe('critical');
    expect(events[0].description).toContain('林川决定离开边城');
    expect(events[0].completenessScore).toBe(0.3);
  });
});
