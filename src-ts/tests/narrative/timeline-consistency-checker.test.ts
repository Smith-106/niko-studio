import { describe, expect, it } from 'vitest';

import {
  TimelineConsistencyChecker,
  TimelineConflictType,
  TimelineSeverity,
} from '../../narrative/timeline-consistency-checker';

describe('TimelineConsistencyChecker', () => {
  // ---------------------------------------------------------------
  // Season progression detection
  // ---------------------------------------------------------------

  it('detects season regression between chapters', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '秋风萧瑟，落叶纷飞，林岚裹紧了外套走在街上。',
      '夏日炎炎，骄阳似火，汗水浸透了衣服。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Autumn' },
      { chapterNumber: 2, title: 'Summer' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    const seasonConflicts = report.conflicts.filter(
      (c) => c.type === TimelineConflictType.SEASON_PROGRESSION,
    );
    expect(seasonConflicts.length).toBeGreaterThanOrEqual(1);
    expect(seasonConflicts[0].severity).toBe(TimelineSeverity.MAJOR);
    expect(seasonConflicts[0].chaptersInvolved).toContain(1);
    expect(seasonConflicts[0].chaptersInvolved).toContain(2);
  });

  it('accepts normal season progression (spring -> summer)', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '春天来了，万物复苏，花园里的花开始绽放。',
      '夏天到了，烈日当空，蝉鸣声此起彼伏。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Spring' },
      { chapterNumber: 2, title: 'Summer' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    const seasonConflicts = report.conflicts.filter(
      (c) => c.type === TimelineConflictType.SEASON_PROGRESSION,
    );
    expect(seasonConflicts).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Age inconsistency detection
  // ---------------------------------------------------------------

  it('detects age decrease across chapters', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '林岚今年25岁，正值壮年。',
      '几年过去了，林岚22岁了。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Young' },
      { chapterNumber: 2, title: 'Younger' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    const ageConflicts = report.conflicts.filter(
      (c) => c.type === TimelineConflictType.AGE_INCONSISTENCY,
    );
    expect(ageConflicts.length).toBeGreaterThanOrEqual(1);
    expect(ageConflicts[0].severity).toBe(TimelineSeverity.CRITICAL);
  });

  // ---------------------------------------------------------------
  // Duration contradiction detection
  // ---------------------------------------------------------------

  it('detects conflicting duration references in same chapter', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '事情发生在几天后，那时候一切还很平静。但是数年后那个事件改变了一切。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Mixed durations' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    const durationConflicts = report.conflicts.filter(
      (c) => c.type === TimelineConflictType.DURATION_CONTRADICTION,
    );
    expect(durationConflicts.length).toBeGreaterThanOrEqual(1);
  });

  // ---------------------------------------------------------------
  // No conflicts scenario
  // ---------------------------------------------------------------

  it('returns no conflicts for consistent timeline', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '春天到了，故事开始了。林岚开始了她的调查。',
      '夏天来了，调查持续了几个月。',
      '秋天到了，案件终于有了突破。几个月后真相大白。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Spring start' },
      { chapterNumber: 2, title: 'Summer investigation' },
      { chapterNumber: 3, title: 'Autumn resolution' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    // Should not have season regression (spring -> summer -> autumn is fine)
    const seasonConflicts = report.conflicts.filter(
      (c) => c.type === TimelineConflictType.SEASON_PROGRESSION,
    );
    expect(seasonConflicts).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Empty input
  // ---------------------------------------------------------------

  it('returns empty report for empty input', () => {
    const checker = new TimelineConsistencyChecker();

    const report = checker.quickAnalyze([], []);

    expect(report.totalConflicts).toBe(0);
    expect(report.consistencyScore).toBe(100);
    expect(report.conflicts).toHaveLength(0);
    expect(report.chapterProfiles).toHaveLength(0);
    expect(report.globalTimeline).toHaveLength(0);
  });

  // ---------------------------------------------------------------
  // Report structure
  // ---------------------------------------------------------------

  it('produces well-structured report with all required fields', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '秋天到了。',
      '春天来了。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Autumn' },
      { chapterNumber: 2, title: 'Spring' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    expect(report).toHaveProperty('totalConflicts');
    expect(report).toHaveProperty('criticalCount');
    expect(report).toHaveProperty('majorCount');
    expect(report).toHaveProperty('minorCount');
    expect(report).toHaveProperty('infoCount');
    expect(report).toHaveProperty('conflicts');
    expect(report).toHaveProperty('chapterProfiles');
    expect(report).toHaveProperty('globalTimeline');
    expect(report).toHaveProperty('consistencyScore');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('analyzedAt');
    expect(typeof report.analyzedAt).toBe('string');

    // Chapter profiles should have time reference data
    expect(report.chapterProfiles.length).toBe(2);
    expect(report.chapterProfiles[0].chapterNumber).toBe(1);
    expect(report.chapterProfiles[0].inferredSeason).toBe('autumn');
    expect(report.chapterProfiles[1].inferredSeason).toBe('spring');
  });

  // ---------------------------------------------------------------
  // Time reference extraction
  // ---------------------------------------------------------------

  it('extracts season, time-of-day, and age references from content', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '早上七点，冬天的寒风刺骨。林岚今年30岁，站在城门口。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Morning in winter' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    expect(report.chapterProfiles[0].inferredSeason).toBe('winter');
    expect(report.chapterProfiles[0].inferredTimeOfDay).toBe('morning');
    expect(report.chapterProfiles[0].inferredAge).toBe('30');

    // Should have multiple time references
    expect(report.chapterProfiles[0].timeReferences.length).toBeGreaterThanOrEqual(3);
  });

  // ---------------------------------------------------------------
  // Score calculation
  // ---------------------------------------------------------------

  it('calculates lower score when conflicts exist', () => {
    const checker = new TimelineConsistencyChecker();

    const chapters = [
      '林岚30岁。',
      '林岚22岁。',
    ];
    const meta = [
      { chapterNumber: 1, title: 'Older' },
      { chapterNumber: 2, title: 'Younger' },
    ];

    const report = checker.quickAnalyze(chapters, meta);

    expect(report.consistencyScore).toBeLessThan(100);
    expect(report.totalConflicts).toBeGreaterThan(0);
  });
});
