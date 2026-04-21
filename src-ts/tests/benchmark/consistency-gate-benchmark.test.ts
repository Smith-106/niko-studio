/**
 * Consistency Gate Benchmark Tests
 *
 * Tests cross-chapter consistency checkers with coherent vs contradictory
 * multi-chapter inputs. Verifies that coherent content produces no false
 * positives, and contradictory content triggers appropriate conflicts.
 *
 * All checkers used here are deterministic (no LLM calls, using quickAnalyze).
 * Test data is crafted to match the exact keyword/pattern detection logic
 * of each checker.
 */

import { describe, expect, it } from 'vitest';

import { CrossChapterCharacterTracker } from '../../narrative/cross-chapter-character-tracker';
import { TimelineConsistencyChecker } from '../../narrative/timeline-consistency-checker';
import { WorldviewCoherenceValidator } from '../../narrative/worldview-coherence-validator';

import {
  type EvidenceTestResult,
  type ConsistencyEvidenceScore,
  buildConsistencyGateReport,
  reportToJson,
} from './evidence-helpers';

// ---------------------------------------------------------------------------
// Coherent multi-chapter input
// ---------------------------------------------------------------------------
// These chapters form a consistent narrative:
// - Lin Ming arrives in Green Mountain Town (spring)
// - Investigates a mystery (summer)
// - Resolves and departs (autumn)
// - Character alive throughout, consistent relationships

const COHERENT_CHAPTERS = [
  `林明来到青山镇。这里是南方的一个小镇，春天花开遍野。他在客栈住下，认识了掌柜老王。老王对林明很热情，把林明当做朋友。林明打算在这里停留几天，打听消息。`,
  `第二天，林明继续在镇上打听。夏天已经临近，天气逐渐炎热。他从老王口中得知，镇外的古庙经常传出怪声。林明决定亲自去看看。老王提醒他要小心。`,
  `几个月后，秋天到了，青山镇恢复了平静。林明最终查明了古庙的秘密。他治好了受伤的灵兽，灵兽离开了青山镇。老王对林明说："你是我的朋友。"林明笑着告别了青山镇，继续他的旅程。`,
];

const COHERENT_META = [
  { chapterNumber: 1, title: 'Arrival at Green Mountain Town' },
  { chapterNumber: 2, title: 'Investigation' },
  { chapterNumber: 3, title: 'Resolution' },
];

const COHERENT_CHARACTERS = ['林明', '老王'];

// ---------------------------------------------------------------------------
// Contradictory multi-chapter input
// ---------------------------------------------------------------------------
// These chapters contain deliberate contradictions:
//
// Ch1: Character death - uses DEATH_MARKERS ('死亡', '离世') near character name
// Ch2: Season regression - autumn keywords in ch2 after summer in ch1,
//      PLUS summer keywords in ch2 without proper transition (detects season regression)
// Ch3: Dead character reappears - uses ALIVE_MARKERS ('走了过来', '笑着')
//      after being dead in ch1. Also introduces magic ('法术') not present before.

const CONTRADICTORY_CHAPTERS = [
  // Chapter 1: Character dies using death markers from DEATH_MARKERS ('死亡', '离世')
  // Also establishes SUMMER season context.
  `盛夏的阳光照在战场上，夏日的炎热让人窒息。林明在战斗中受了重伤。鲜血染红了他的衣衫，他感到生命在流逝。最终，林明死亡，永远闭上了眼睛。他的朋友老王跪在他身边，泪流满面。老王的好友林明离世了。`,

  // Chapter 2: Season regression from summer (ch1) to spring (ch2)
  // Timeline checker infers one season per chapter:
  //   ch1 -> summer (盛夏, 夏日), ch2 -> spring (春天, 春日, 三月)
  //   detectSeasonProgression: prev=summer(idx=1), curr=spring(idx=0)
  //   Check: currIdx(0) === prevIdx(1) - 1 && prevIdx !== 0 => true => MAJOR conflict
  `春天来了，春暖花开，三月的风轻轻吹过。林明不在了，老王独自坐在院子里。春日的阳光温暖而柔和，人们脱下了冬装。日子一天天过去，春天仍然是春天。`,

  // Chapter 3: Dead character reappears (uses ALIVE_MARKERS from the checker)
  `林明走了过来，笑着和大家打招呼。"昨天我去城里买了些东西。"他说。老王看到林明走了过来。林明熟练地使用法术，虽然之前从未展示过这种能力。他现在已经30岁了，比之前看起来更年轻了。`,
];

const CONTRADICTORY_META = [
  { chapterNumber: 1, title: 'Death of Lin Ming' },
  { chapterNumber: 2, title: 'Season Chaos' },
  { chapterNumber: 3, title: 'Impossible Return' },
];

const CONTRADICTORY_CHARACTERS = ['林明', '老王'];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('consistency-gate-benchmark', () => {
  const evidenceResults: EvidenceTestResult[] = [];

  // =========================================================================
  // COHERENT INPUT: no false positives
  // =========================================================================

  describe('coherent input: no false positives', () => {
    it('character tracker finds 0 CRITICAL conflicts in coherent chapters', () => {
      const tracker = new CrossChapterCharacterTracker();
      const report = tracker.quickAnalyze(
        COHERENT_CHAPTERS,
        COHERENT_META,
        COHERENT_CHARACTERS,
      );

      expect(report.criticalCount).toBe(0);

      const score: ConsistencyEvidenceScore = {
        checker: 'cross_chapter_character_tracker',
        score: report.coherenceScore,
        totalConflicts: report.totalConflicts,
        criticalCount: report.criticalCount,
        majorCount: report.majorCount,
        minorCount: report.minorCount,
      };

      evidenceResults.push({
        test_name: 'character_tracker_coherent_zero_critical',
        sample_label: 'Coherent 3-chapter character arc',
        sample_category: 'coherent',
        scores: [score],
        passed: report.criticalCount === 0,
        pass_criteria: 'critical_count == 0',
        details: `coherence=${report.coherenceScore}, total=${report.totalConflicts}`,
      });
    });

    it('timeline checker finds 0 CRITICAL conflicts in coherent chapters', () => {
      const checker = new TimelineConsistencyChecker();
      const report = checker.quickAnalyze(COHERENT_CHAPTERS, COHERENT_META);

      expect(report.criticalCount).toBe(0);

      const score: ConsistencyEvidenceScore = {
        checker: 'timeline_consistency_checker',
        score: report.consistencyScore,
        totalConflicts: report.totalConflicts,
        criticalCount: report.criticalCount,
        majorCount: report.majorCount,
        minorCount: report.minorCount,
      };

      evidenceResults.push({
        test_name: 'timeline_checker_coherent_zero_critical',
        sample_label: 'Coherent 3-chapter timeline (spring -> summer -> autumn)',
        sample_category: 'coherent',
        scores: [score],
        passed: report.criticalCount === 0,
        pass_criteria: 'critical_count == 0',
        details: `consistency=${report.consistencyScore}, total=${report.totalConflicts}`,
      });
    });

    it('worldview validator finds 0 CRITICAL conflicts in coherent chapters', () => {
      const validator = new WorldviewCoherenceValidator();
      const report = validator.quickAnalyze(COHERENT_CHAPTERS, COHERENT_META);

      expect(report.criticalCount).toBe(0);

      const score: ConsistencyEvidenceScore = {
        checker: 'worldview_coherence_validator',
        score: report.coherenceScore,
        totalConflicts: report.totalConflicts,
        criticalCount: report.criticalCount,
        majorCount: report.majorCount,
        minorCount: report.minorCount,
      };

      evidenceResults.push({
        test_name: 'worldview_validator_coherent_zero_critical',
        sample_label: 'Coherent 3-chapter world rules',
        sample_category: 'coherent',
        scores: [score],
        passed: report.criticalCount === 0,
        pass_criteria: 'critical_count == 0',
        details: `coherence=${report.coherenceScore}, total=${report.totalConflicts}`,
      });
    });
  });

  // =========================================================================
  // CONTRADICTORY INPUT: triggers conflicts
  // =========================================================================

  describe('contradictory input: detects conflicts', () => {
    it('character tracker detects post-mortem appearance', () => {
      const tracker = new CrossChapterCharacterTracker();
      const report = tracker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
        CONTRADICTORY_CHARACTERS,
      );

      // Should detect at least one conflict (post-mortem appearance)
      expect(report.totalConflicts).toBeGreaterThanOrEqual(1);
      expect(report.criticalCount).toBeGreaterThanOrEqual(1);

      // Verify the specific conflict type
      const postMortemConflict = report.conflicts.find(
        (c) => c.type === 'post_mortem_appearance',
      );
      expect(postMortemConflict).toBeDefined();
      expect(postMortemConflict!.severity).toBe('critical');
      expect(postMortemConflict!.characterName).toBe('林明');

      const score: ConsistencyEvidenceScore = {
        checker: 'cross_chapter_character_tracker',
        score: report.coherenceScore,
        totalConflicts: report.totalConflicts,
        criticalCount: report.criticalCount,
        majorCount: report.majorCount,
        minorCount: report.minorCount,
      };

      evidenceResults.push({
        test_name: 'character_tracker_contradictory_detects_death',
        sample_label: 'Character dies Ch1, appears Ch3',
        sample_category: 'contradictory',
        scores: [score],
        passed: report.criticalCount >= 1,
        pass_criteria: 'critical_count >= 1 (post_mortem_appearance)',
        details: `coherence=${report.coherenceScore}, conflicts=${report.conflicts.map((c) => c.type).join(', ')}`,
      });
    });

    it('timeline checker detects season regression', () => {
      const checker = new TimelineConsistencyChecker();
      const report = checker.quickAnalyze(CONTRADICTORY_CHAPTERS, CONTRADICTORY_META);

      // Chapter 2 has both summer ('夏天') and autumn ('秋天', '深秋') keywords
      // The checker should detect season-related conflicts
      expect(report.totalConflicts).toBeGreaterThanOrEqual(1);

      const score: ConsistencyEvidenceScore = {
        checker: 'timeline_consistency_checker',
        score: report.consistencyScore,
        totalConflicts: report.totalConflicts,
        criticalCount: report.criticalCount,
        majorCount: report.majorCount,
        minorCount: report.minorCount,
      };

      evidenceResults.push({
        test_name: 'timeline_checker_contradictory_detects_season',
        sample_label: 'Mixed season keywords without time skip',
        sample_category: 'contradictory',
        scores: [score],
        passed: report.totalConflicts >= 1,
        pass_criteria: 'total_conflicts >= 1 (season/timeline conflict)',
        details: `consistency=${report.consistencyScore}, conflicts=${report.conflicts.map((c) => `${c.type}(${c.severity})`).join(', ')}`,
      });
    });

    it('at least one checker detects issues in contradictory input', () => {
      const charTracker = new CrossChapterCharacterTracker();
      const timelineChecker = new TimelineConsistencyChecker();
      const worldviewValidator = new WorldviewCoherenceValidator();

      const charReport = charTracker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
        CONTRADICTORY_CHARACTERS,
      );
      const timelineReport = timelineChecker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
      );
      const worldviewReport = worldviewValidator.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
      );

      // At least one checker should detect problems
      const anyConflicts =
        charReport.totalConflicts > 0 ||
        timelineReport.totalConflicts > 0 ||
        worldviewReport.totalConflicts > 0;

      expect(anyConflicts).toBe(true);

      evidenceResults.push({
        test_name: 'any_checker_contradictory',
        sample_label: 'At least one checker detects contradictory input',
        sample_category: 'contradictory',
        scores: [
          {
            checker: 'character_tracker',
            score: charReport.coherenceScore,
            totalConflicts: charReport.totalConflicts,
            criticalCount: charReport.criticalCount,
            majorCount: charReport.majorCount,
            minorCount: charReport.minorCount,
          },
          {
            checker: 'timeline_checker',
            score: timelineReport.consistencyScore,
            totalConflicts: timelineReport.totalConflicts,
            criticalCount: timelineReport.criticalCount,
            majorCount: timelineReport.majorCount,
            minorCount: timelineReport.minorCount,
          },
          {
            checker: 'worldview_validator',
            score: worldviewReport.coherenceScore,
            totalConflicts: worldviewReport.totalConflicts,
            criticalCount: worldviewReport.criticalCount,
            majorCount: worldviewReport.majorCount,
            minorCount: worldviewReport.minorCount,
          },
        ],
        passed: anyConflicts,
        pass_criteria: 'any_checker_totalConflicts > 0',
        details: `char=${charReport.totalConflicts}, timeline=${timelineReport.totalConflicts}, worldview=${worldviewReport.totalConflicts}`,
      });
    });
  });

  // =========================================================================
  // SCORING DIFFERENTIATION
  // =========================================================================

  describe('scoring differentiation', () => {
    it('coherent input scores higher or equal than contradictory input on character tracker', () => {
      const charTracker = new CrossChapterCharacterTracker();

      const coherentReport = charTracker.quickAnalyze(
        COHERENT_CHAPTERS,
        COHERENT_META,
        COHERENT_CHARACTERS,
      );
      const contradictReport = charTracker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
        CONTRADICTORY_CHARACTERS,
      );

      // Coherent should score >= contradictory
      expect(coherentReport.coherenceScore).toBeGreaterThanOrEqual(
        contradictReport.coherenceScore,
      );

      evidenceResults.push({
        test_name: 'character_tracker_coherent_vs_contradictory',
        sample_label: 'Coherent vs contradictory character tracking',
        sample_category: 'coherent',
        scores: [
          {
            checker: 'coherent',
            score: coherentReport.coherenceScore,
            totalConflicts: coherentReport.totalConflicts,
            criticalCount: coherentReport.criticalCount,
            majorCount: coherentReport.majorCount,
            minorCount: coherentReport.minorCount,
          },
          {
            checker: 'contradictory',
            score: contradictReport.coherenceScore,
            totalConflicts: contradictReport.totalConflicts,
            criticalCount: contradictReport.criticalCount,
            majorCount: contradictReport.majorCount,
            minorCount: contradictReport.minorCount,
          },
        ],
        passed: coherentReport.coherenceScore >= contradictReport.coherenceScore,
        pass_criteria: 'coherent_score >= contradictory_score',
        details: `coherent=${coherentReport.coherenceScore}, contradictory=${contradictReport.coherenceScore}`,
      });
    });

    it('timeline checker: coherent scores higher or equal than contradictory', () => {
      const checker = new TimelineConsistencyChecker();

      const coherentReport = checker.quickAnalyze(COHERENT_CHAPTERS, COHERENT_META);
      const contradictReport = checker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
      );

      expect(coherentReport.consistencyScore).toBeGreaterThanOrEqual(
        contradictReport.consistencyScore,
      );
    });

    it('all checkers produce bounded coherence scores (0-100)', () => {
      const charTracker = new CrossChapterCharacterTracker();
      const timelineChecker = new TimelineConsistencyChecker();
      const worldviewValidator = new WorldviewCoherenceValidator();

      const charReport = charTracker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
        CONTRADICTORY_CHARACTERS,
      );
      const timelineReport = timelineChecker.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
      );
      const worldviewReport = worldviewValidator.quickAnalyze(
        CONTRADICTORY_CHAPTERS,
        CONTRADICTORY_META,
      );

      expect(charReport.coherenceScore).toBeGreaterThanOrEqual(0);
      expect(charReport.coherenceScore).toBeLessThanOrEqual(100);
      expect(timelineReport.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(timelineReport.consistencyScore).toBeLessThanOrEqual(100);
      expect(worldviewReport.coherenceScore).toBeGreaterThanOrEqual(0);
      expect(worldviewReport.coherenceScore).toBeLessThanOrEqual(100);
    });
  });

  // =========================================================================
  // EVIDENCE REPORT
  // =========================================================================

  describe('evidence report generation', () => {
    it('generates valid consistency gate evidence report', () => {
      const report = buildConsistencyGateReport(
        'consistency-gate-benchmark',
        evidenceResults,
      );

      expect(report.timestamp).toBeTruthy();
      expect(report.report_id).toMatch(/^EVD-\d{8}-\d{6}$/);
      expect(report.suite_name).toBe('consistency-gate-benchmark');
      expect(report.sample_size).toBeGreaterThan(0);
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.summary.total_tests).toBe(evidenceResults.length);
      expect(report.summary.passed).toBeGreaterThanOrEqual(0);
      expect(report.summary.failed).toBeGreaterThanOrEqual(0);
      expect(report.summary.pass_rate).toBeGreaterThanOrEqual(0);
      expect(report.summary.pass_rate).toBeLessThanOrEqual(100);

      // Verify JSON serialization works (no Map/Set circular refs)
      const json = reportToJson(report);
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(parsed.report_id).toBe(report.report_id);
      expect(parsed.results).toHaveLength(evidenceResults.length);
    });
  });
});
