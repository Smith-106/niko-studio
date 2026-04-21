import { describe, expect, it } from 'vitest';

import {
  CrossChapterCharacterTracker,
  CharacterConflictType,
  ConsistencySeverity,
} from '../../narrative/cross-chapter-character-tracker';

describe('CrossChapterCharacterTracker', () => {
  // ---------------------------------------------------------------
  // Post-mortem appearance detection
  // ---------------------------------------------------------------

  it('detects character appearing after death across chapters', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '林岚和阿澈在废弃工厂中调查，突然发生爆炸，阿澈在爆炸中死亡。林岚悲痛欲绝。',
      '第二天林岚独自前往港口，发现了一条重要线索。阿澈却若无其事地走了过来，打招呼。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Explosion' },
      { chapterNumber: 2, title: 'Harbor' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['林岚', '阿澈']);

    const deathConflicts = report.conflicts.filter(
      (c) => c.type === CharacterConflictType.POST_MORTEM_APPEARANCE,
    );
    expect(deathConflicts.length).toBeGreaterThanOrEqual(1);
    expect(deathConflicts[0].severity).toBe(ConsistencySeverity.CRITICAL);
    expect(deathConflicts[0].chaptersInvolved).toContain(1);
    expect(deathConflicts[0].chaptersInvolved).toContain(2);
  });

  // ---------------------------------------------------------------
  // Personality flip detection
  // ---------------------------------------------------------------

  it('detects personality flip without development arc', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '林岚决定亲自调查此案，她冲进现场，抓住嫌疑人质问，完全不顾危险。',
      '林岚什么也没做，她只是安静地坐在角落里，一句话也没说。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Active' },
      { chapterNumber: 2, title: 'Passive' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['林岚']);

    const personalityConflicts = report.conflicts.filter(
      (c) => c.type === CharacterConflictType.PERSONALITY_FLIP,
    );
    expect(personalityConflicts.length).toBeGreaterThanOrEqual(1);
    if (personalityConflicts.length > 0) {
      expect(personalityConflicts[0].severity).toBe(ConsistencySeverity.MAJOR);
    }
  });

  // ---------------------------------------------------------------
  // Relationship contradiction detection
  // ---------------------------------------------------------------

  it('detects relationship contradictions between chapters', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '林岚和陈明是最好的朋友，两人从小一起长大，互相信任。',
      '林岚对陈明恨之入骨，视他为自己的仇人，发誓要报复。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Friends' },
      { chapterNumber: 2, title: 'Enemies' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['林岚', '陈明']);

    const relConflicts = report.conflicts.filter(
      (c) => c.type === CharacterConflictType.RELATIONSHIP_CONTRADICTION,
    );
    expect(relConflicts.length).toBeGreaterThanOrEqual(1);
    if (relConflicts.length > 0) {
      expect(relConflicts[0].chaptersInvolved).toContain(1);
      expect(relConflicts[0].chaptersInvolved).toContain(2);
    }
  });

  // ---------------------------------------------------------------
  // Emotional discontinuity
  // ---------------------------------------------------------------

  it('detects emotional discontinuity across chapters', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '林岚感到恐惧和焦虑，她害怕真相被揭开，痛苦不已。',
      '林岚非常开心，充满了喜悦和期待，一切都那么美好。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Fear' },
      { chapterNumber: 2, title: 'Joy' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['林岚']);

    const emotionalConflicts = report.conflicts.filter(
      (c) => c.type === CharacterConflictType.EMOTIONAL_DISCONTINUITY,
    );
    expect(emotionalConflicts.length).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------
  // No conflicts scenario
  // ---------------------------------------------------------------

  it('returns no conflicts for consistent character portrayal', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '林岚认真调查案件，她仔细查看每一份档案。',
      '林岚继续追查线索，她决定去港口调查。',
      '林岚发现了一条重要线索，她准备采取行动。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Investigation' },
      { chapterNumber: 2, title: 'Follow-up' },
      { chapterNumber: 3, title: 'Discovery' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['林岚']);

    expect(report.totalConflicts).toBe(0);
    expect(report.coherenceScore).toBe(100);
    expect(report.conflicts).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Empty input
  // ---------------------------------------------------------------

  it('returns empty report for empty input', () => {
    const tracker = new CrossChapterCharacterTracker();

    const report = tracker.quickAnalyze([], []);

    expect(report.totalConflicts).toBe(0);
    expect(report.coherenceScore).toBe(100);
    expect(report.conflicts).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Report structure
  // ---------------------------------------------------------------

  it('produces well-structured report with all required fields', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '阿澈在爆炸中死亡，林岚悲痛欲绝。',
      '第二天，阿澈却若无其事地走了过来。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Death' },
      { chapterNumber: 2, title: 'Return' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['阿澈', '林岚']);

    expect(report).toHaveProperty('totalConflicts');
    expect(report).toHaveProperty('criticalCount');
    expect(report).toHaveProperty('majorCount');
    expect(report).toHaveProperty('minorCount');
    expect(report).toHaveProperty('infoCount');
    expect(report).toHaveProperty('conflicts');
    expect(report).toHaveProperty('characterTimelines');
    expect(report).toHaveProperty('coherenceScore');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('analyzedAt');
    expect(typeof report.analyzedAt).toBe('string');

    // Conflicts sorted by severity
    if (report.conflicts.length >= 2) {
      for (let i = 1; i < report.conflicts.length; i++) {
        const prev = severityRank(report.conflicts[i - 1].severity);
        const curr = severityRank(report.conflicts[i].severity);
        expect(prev).toBeLessThanOrEqual(curr);
      }
    }
  });

  // ---------------------------------------------------------------
  // Score calculation
  // ---------------------------------------------------------------

  it('calculates lower coherence score when conflicts exist', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '阿澈在爆炸中死亡。',
      '阿澈走了过来，和大家打招呼。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Death' },
      { chapterNumber: 2, title: 'Alive' },
    ];

    const report = tracker.quickAnalyze(chapters, meta, ['阿澈']);

    expect(report.coherenceScore).toBeLessThan(100);
    expect(report.totalConflicts).toBeGreaterThan(0);
  });

  // ---------------------------------------------------------------
  // Automatic name extraction fallback
  // ---------------------------------------------------------------

  it('works without explicit character names using extraction', () => {
    const tracker = new CrossChapterCharacterTracker();

    const chapters = [
      '林岚认真调查案件。',
      '林岚继续追查。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Start' },
      { chapterNumber: 2, title: 'Follow-up' },
    ];

    // No explicit names - uses automatic extraction
    const report = tracker.quickAnalyze(chapters, meta);

    // Should not error; may or may not find conflicts
    expect(report).toHaveProperty('totalConflicts');
    expect(report).toHaveProperty('coherenceScore');
  });
});

function severityRank(s: string): number {
  switch (s) {
    case 'critical': return 0;
    case 'major': return 1;
    case 'minor': return 2;
    case 'info': return 3;
    default: return 4;
  }
}
