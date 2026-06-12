import { describe, expect, it } from 'vitest';

import {
  TimelineConflictType,
  TimelineConsistencyChecker,
  TimelineSeverity,
  type ChapterTimeProfile,
  type TimelineConflict,
} from '../../narrative/timeline-consistency-checker';

function createProfile(
  overrides: Partial<ChapterTimeProfile>,
): ChapterTimeProfile {
  return {
    chapterNumber: 1,
    chapterTitle: 'Chapter',
    timeReferences: [],
    inferredSeason: null,
    inferredYear: null,
    inferredAge: null,
    inferredTimeOfDay: null,
    dayOffset: null,
    ...overrides,
  };
}

function createConflict(
  overrides: Partial<TimelineConflict>,
): TimelineConflict {
  return {
    id: 'conflict-1',
    type: TimelineConflictType.SEASON_PROGRESSION,
    severity: TimelineSeverity.MINOR,
    chaptersInvolved: [1, 2],
    description: 'conflict',
    evidence: ['A', 'B'],
    suggestedFix: 'fix it',
    ...overrides,
  };
}

describe('TimelineConsistencyChecker additional coverage', () => {
  it('uses default chapter metadata when later chapter meta is missing', () => {
    const checker = new TimelineConsistencyChecker();

    const report = checker.quickAnalyze(
      ['春天来了。', '第二天，调查继续推进。'],
      [{ chapterNumber: 1, title: 'Start' }],
    );

    expect(report.chapterProfiles[1]).toMatchObject({
      chapterNumber: 2,
      chapterTitle: 'Chapter 2',
      dayOffset: 1,
    });
  });

  it('skips unknown and repeated seasons when detecting progression', () => {
    const checker = new TimelineConsistencyChecker() as any;

    const conflicts = checker.detectSeasonProgression([
      createProfile({
        chapterNumber: 1,
        inferredSeason: 'monsoon' as any,
      }),
      createProfile({
        chapterNumber: 2,
        inferredSeason: 'spring',
      }),
      createProfile({
        chapterNumber: 3,
        inferredSeason: 'spring',
      }),
    ]);

    expect(conflicts).toEqual([]);
  });

  it('deduplicates duplicate conflicts and includes inferred year in the global timeline', () => {
    const checker = new TimelineConsistencyChecker() as any;
    const duplicateA = createConflict({
      id: 'dup-a',
      type: TimelineConflictType.AGE_INCONSISTENCY,
      severity: TimelineSeverity.INFO,
      description: 'same age',
    });
    const duplicateB = createConflict({
      id: 'dup-b',
      type: TimelineConflictType.AGE_INCONSISTENCY,
      severity: TimelineSeverity.INFO,
      description: 'same age',
    });

    const report = checker.buildReport(
      [duplicateA, duplicateB],
      [
        createProfile({
          chapterNumber: 7,
          inferredYear: '2026',
        }),
      ],
    );

    expect(report.totalConflicts).toBe(1);
    expect(report.infoCount).toBe(1);
    expect(report.globalTimeline).toEqual(['Ch7 / 2026']);
  });

  it('sorts unknown severities after known ones in both comparator directions', () => {
    const checker = new TimelineConsistencyChecker() as any;
    const unknownA = createConflict({
      id: 'unknown-a',
      severity: 'mystery' as any,
      description: 'unknown a',
    });
    const unknownB = createConflict({
      id: 'unknown-b',
      severity: 'alien' as any,
      description: 'unknown b',
    });
    const major = createConflict({
      id: 'major',
      severity: TimelineSeverity.MAJOR,
      description: 'known major',
    });

    const reportForward = checker.buildReport(
      [unknownA, major],
      [],
    );
    const reportReverse = checker.buildReport(
      [major, unknownB],
      [],
    );

    expect(reportForward.conflicts[0]?.severity).toBe(TimelineSeverity.MAJOR);
    expect(reportReverse.conflicts[0]?.severity).toBe(TimelineSeverity.MAJOR);
  });
});
