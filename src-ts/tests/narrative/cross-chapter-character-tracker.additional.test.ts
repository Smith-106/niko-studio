import { describe, expect, it } from 'vitest';

import {
  CharacterConflictType,
  ConsistencySeverity,
  CrossChapterCharacterTracker,
  type CharacterChapterState,
  type CharacterTimelineConflict,
} from '../../narrative/cross-chapter-character-tracker';

describe('CrossChapterCharacterTracker additional coverage', () => {
  it('covers async analyze, knowledge regression, and default chapter metadata', async () => {
    const tracker = new CrossChapterCharacterTracker();

    const report = await tracker.analyze(
      [
        '林岚在书房里发现地图，得知密码，终于知道真相。',
        '林岚在书房里来回踱步，反复整理旧纸页。',
      ],
      [{ chapterNumber: 1, title: 'Study' }],
      ['林岚'],
    );

    const knowledgeRegression = report.conflicts.find(
      (conflict) => conflict.type === CharacterConflictType.KNOWLEDGE_REGRESSION,
    );
    expect(knowledgeRegression).toMatchObject({
      severity: ConsistencySeverity.MINOR,
      chaptersInvolved: [1, 2],
    });

    const timeline = report.characterTimelines.get('林岚');
    expect(timeline?.[0]).toMatchObject({
      chapterTitle: 'Study',
      location: '书房里',
    });
    expect(timeline?.[1]).toMatchObject({
      chapterTitle: 'Chapter 2',
    });
    expect(timeline?.[0]?.knowledge.length).toBeGreaterThanOrEqual(3);
  });

  it('uses default chapter metadata in quickAnalyze when later metadata is missing', () => {
    const tracker = new CrossChapterCharacterTracker();

    const report = tracker.quickAnalyze(
      ['林岚调查档案。', '林岚继续追查。'],
      [{ chapterNumber: 1, title: 'Archive' }],
      ['林岚'],
    );

    expect(report.characterTimelines.get('林岚')?.[1]).toMatchObject({
      chapterNumber: 2,
      chapterTitle: 'Chapter 2',
    });
  });

  it('returns the empty report from async analyze when no chapters are provided', async () => {
    const tracker = new CrossChapterCharacterTracker();

    await expect(tracker.analyze([], [])).resolves.toMatchObject({
      totalConflicts: 0,
      coherenceScore: 100,
      summary: 'No chapters provided for analysis.',
    });
  });

  it('uses automatic character extraction in async analyze when names are omitted', async () => {
    const tracker = new CrossChapterCharacterTracker();

    const report = await tracker.analyze(
      [
        '林岚走进书房，翻看旧档案。',
        '陈明跑向窗边，提醒林岚有人接近。',
      ],
      [
        { chapterNumber: 1, title: 'Archive' },
        { chapterNumber: 2, title: 'Warning' },
      ],
    );

    expect(report.characterTimelines.has('林岚')).toBe(true);
    expect(report.characterTimelines.has('陈明')).toBe(true);
  });

  it('covers async state extraction with populated relevant states', async () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    tracker.stateAnalyzer = {
      getDominantEmotions: () => ['positive'],
      quickAnalyze: () => ({
        items: [
          {
            content: '林岚在书房里整理地图。',
            emotions: ['positive'],
            goals: ['找到真相'],
            conflicts: ['时间紧迫'],
            agencyScore: 0.8,
          },
        ],
      }),
    };

    const report = await tracker.analyze(
      ['林岚在书房里整理地图。'],
      [{ chapterNumber: 1, title: 'Mapped' }],
      ['林岚'],
    );

    expect(report.characterTimelines.get('林岚')?.[0]).toMatchObject({
      agencyScore: 0.8,
      goals: ['找到真相'],
      conflicts: ['时间紧迫'],
      emotions: ['positive'],
    });
  });

  it('extracts relationship targets from helper patterns through whitebox access', () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    const hePattern = tracker.extractRelationships('林岚和陈明朋友，一起调查旧案。', '林岚');
    expect(hePattern.get('陈明')).toBe('friend');

    const verbPattern = tracker.extractRelationships('林岚视陈明敌人，誓要追查到底。', '林岚');
    expect(verbPattern.get('陈明')).toBe('enemy');
  });

  it('extracts names from joint openings and ignores false-positive starters', () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    const names = tracker.extractCharacterNames([
      '但是不要停。',
      '林岚和陈明。',
      '林岚走进书房。',
      '陈明跑向窗边。',
    ]);

    expect(names).toEqual(expect.arrayContaining(['林岚', '陈明']));
    expect(names).not.toContain('但是');
  });

  it('covers short-sentence skips and ignores false-positive second names in joint openings', () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    const names = tracker.extractCharacterNames([
      '啊。',
      '林岚。',
      '林岚和但是一起行动。',
      '林岚走进书房。',
    ]);

    expect(names).toContain('林岚');
    expect(names).not.toContain('但是');
  });

  it('ignores false-positive first names in joint openings', () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    const names = tracker.extractCharacterNames([
      '但是和林岚调查旧案。',
      '林岚走进书房。',
    ]);

    expect(names).toContain('林岚');
    expect(names).not.toContain('但是');
  });

  it('deduplicates duplicate conflicts in the whitebox report builder', () => {
    const tracker = new CrossChapterCharacterTracker();
    const baseConflict: CharacterTimelineConflict = {
      id: 'dup-1',
      type: CharacterConflictType.POST_MORTEM_APPEARANCE,
      severity: ConsistencySeverity.CRITICAL,
      characterName: '林岚',
      chaptersInvolved: [1, 3],
      description: 'duplicate conflict',
      evidence: ['Ch1', 'Ch3'],
      suggestion: 'keep one record',
    };
    const states: CharacterChapterState[] = [
      {
        chapterNumber: 1,
        chapterTitle: 'Start',
        characterName: '林岚',
        present: true,
        alive: true,
        emotions: [],
        goals: [],
        conflicts: [],
        agencyScore: 0.5,
        location: '',
        knowledge: [],
        relationships: new Map(),
        chapterContent: '林岚在场。',
      },
    ];

    const report = (tracker as any).buildReport(
      [baseConflict, { ...baseConflict, id: 'dup-2' }],
      states,
    );

    expect(report.totalConflicts).toBe(1);
    expect(report.criticalCount).toBe(1);
    expect(report.summary).toContain('critical');
  });

  it('returns early when relationship contradiction detection has no character name', () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    const conflicts = tracker.detectRelationshipContradictions(
      [
        {
          chapterNumber: 1,
          chapterTitle: 'Nameless',
          characterName: '',
          present: true,
          alive: true,
          emotions: [],
          goals: [],
          conflicts: [],
          agencyScore: 0.5,
          location: '',
          knowledge: [],
          relationships: new Map(),
          chapterContent: '无人出场。',
        },
      ],
      [],
    );

    expect(conflicts).toEqual([]);
  });

  it('treats absent characters as alive in whitebox chapter-state construction', async () => {
    const tracker = new CrossChapterCharacterTracker() as any;

    tracker.stateAnalyzer = {
      getDominantEmotions: () => [],
      quickAnalyze: () => ({ items: [] }),
    };

    const state = await tracker.buildChapterState(
      '林岚',
      '陈明独自留在书房里整理档案。',
      { chapterNumber: 3, title: 'Absent' },
    );

    expect(state.present).toBe(false);
    expect(state.alive).toBe(true);
  });

  it('detects relationship reversals from enemy to friend as contradictions', () => {
    const tracker = new CrossChapterCharacterTracker();

    const report = tracker.quickAnalyze(
      [
        '林岚视陈明敌人，发誓不再信任他。',
        '林岚和陈明朋友，一起守住秘密。',
      ],
      [
        { chapterNumber: 1, title: 'Enemy' },
        { chapterNumber: 2, title: 'Friend' },
      ],
      ['林岚', '陈明'],
    );

    expect(
      report.conflicts.some(
        (conflict) =>
          conflict.type === CharacterConflictType.RELATIONSHIP_CONTRADICTION
          && conflict.chaptersInvolved[0] === 1
          && conflict.chaptersInvolved[1] === 2,
      ),
    ).toBe(true);
  });

  it('sorts unknown severities after known ones in both comparator directions', () => {
    const tracker = new CrossChapterCharacterTracker() as any;
    const baseConflict: CharacterTimelineConflict = {
      id: 'severity-base',
      type: CharacterConflictType.POST_MORTEM_APPEARANCE,
      severity: ConsistencySeverity.MAJOR,
      characterName: '林岚',
      chaptersInvolved: [1, 2],
      description: 'known severity',
      evidence: ['A', 'B'],
      suggestion: 'keep order',
    };
    const states: CharacterChapterState[] = [
      {
        chapterNumber: 1,
        chapterTitle: 'Start',
        characterName: '林岚',
        present: true,
        alive: true,
        emotions: [],
        goals: [],
        conflicts: [],
        agencyScore: 0.5,
        location: '',
        knowledge: [],
        relationships: new Map(),
        chapterContent: '林岚在场。',
      },
    ];

    const reportForward = tracker.buildReport(
      [
        {
          ...baseConflict,
          id: 'unknown-a',
          type: CharacterConflictType.KNOWLEDGE_REGRESSION,
          severity: 'mystery' as ConsistencySeverity,
          chaptersInvolved: [3, 4],
          description: 'unknown severity a',
        },
        baseConflict,
      ],
      states,
    );
    const reportReverse = tracker.buildReport(
      [
        baseConflict,
        {
          ...baseConflict,
          id: 'unknown-b',
          type: CharacterConflictType.PERSONALITY_FLIP,
          severity: 'alien' as ConsistencySeverity,
          chaptersInvolved: [5, 6],
          description: 'unknown severity b',
        },
      ],
      states,
    );

    expect(reportForward.conflicts[0]?.severity).toBe(ConsistencySeverity.MAJOR);
    expect(reportReverse.conflicts[0]?.severity).toBe(ConsistencySeverity.MAJOR);
  });
});
