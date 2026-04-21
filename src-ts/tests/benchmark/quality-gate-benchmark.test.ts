/**
 * Quality Gate Benchmark Tests
 *
 * Classic literature samples evaluated through narrative evaluators.
 * These tests verify that high-quality prose scores significantly
 * higher than low-quality prose, establishing baseline quality gate
 * thresholds for the Niko Studio evaluation system.
 *
 * All evaluators used here are deterministic (no LLM calls).
 * Thresholds are calibrated to the actual scoring ranges of the
 * keyword-heuristic evaluators (not LLM-grade).
 */

import { describe, expect, it } from 'vitest';

import { DreamEvaluator } from '../../narrative/evaluators/dream-evaluator';
import { SuspenseEvaluator } from '../../narrative/evaluators/suspense-evaluator';
import { CharacterEvaluator } from '../../narrative/evaluators/character-evaluator';
import { PremiseEvaluator } from '../../narrative/evaluators/premise-evaluator';
import { VoiceEvaluator } from '../../narrative/evaluators/voice-evaluator';
import { ClicheDetector } from '../../narrative/evaluators/cliche-detector';
import { FourSelvesEvaluator } from '../../narrative/evaluators/four-selves-evaluator';
import { SubtextEvaluator } from '../../narrative/evaluators/subtext-evaluator';
import { DeadlySinsChecker } from '../../narrative/evaluators/deadly-sins-checker';

import {
  type EvidenceTestResult,
  type EvidenceScore,
  buildQualityGateReport,
  reportToJson,
} from './evidence-helpers';

// ---------------------------------------------------------------------------
// Literature samples
// ---------------------------------------------------------------------------

/**
 * HIGH-QUALITY SAMPLE 1: Internal conflict / deep character (Crime and Punishment style)
 * Targets: conflict markers (一边...一边, 矛盾, 挣扎, 犹豫), sensory detail (冰冷, 看到光线),
 * sympathy triggers (贫穷, 绝望, 孤独), narrator presence (讽刺的是, 显然).
 */
const HIGH_INTERNAL_CONFLICT = `拉斯柯尔尼科夫犹豫了一下。一方面，他知道自己应该放弃这个疯狂的念头；另一方面，贫穷和绝望又在内心深处驱使着他。他感到冰冷的手指在颤抖，看到窗外的黄昏光线渐渐暗下去，闻到潮湿的墙壁发霉的味道。然而他内心的矛盾并没有因此消解，虽然恐惧和渴望在激烈地交锋，他却依然无法做出决定。他陷入了深深的挣扎，两个自我在灵魂深处对抗。他既想摆脱困境，又害怕面对后果。这不是一个简单的选择，而是命运对他无情的考验。讽刺的是，他越是想要逃避贫穷，就越是被贫穷的阴影所吞噬。显然，这是一个走投无路的人。`;

/**
 * HIGH-QUALITY SAMPLE 2: Suspenseful opening (Jaws style)
 * Targets: threat markers (危险, 威胁, 死亡, 恐惧), time pressure (最后, 即将, 还有),
 * story questions (谁, 什么, 为什么, 到底), sensory detail (看到, 听到, 感觉).
 */
const HIGH_SUSPENSE_OPENING = `海面上，月光被波纹撕成碎片。谁也不知道水下潜伏着什么。如果今晚不把那东西找到，明天清晨的海滩将变成屠宰场。时间不多了，只剩下最后三个小时，即将天亮。危险的气息从深水中传来，令人窒息。为什么没有人听到那些最后的呼救？那条巨大的阴影正在逼近，却没有人注意到。沙滩上的篝火快要熄灭，而海里的猎手正在等待最佳时机。这是否就是他们最后的夜晚？恐惧在每个人的心中蔓延。`;

/**
 * HIGH-QUALITY SAMPLE 3: Emotional scene with empathy and sensory detail
 * Targets: sensory patterns (看到, 闻到, 听到, 触摸, 冰冷, 温度), sympathy triggers (痛苦, 孤独),
 * narrator presence (讽刺的是, 令人惊讶的是), four-selves layers (家人, 独自, 内心, 压抑).
 */
const HIGH_EMOTIONAL_SCENE = `母亲独自站在门口，双手微微颤抖。她看到女儿瘦削的背影，闻到病房里刺鼻的消毒水气味，听到心电监护仪有节奏的嘀嘀声。心里一阵剧痛，眼泪终于忍不住滑落。她想去握住女儿冰凉的手，感受到那微弱的温度。窗外，夜色已深，走廊上没人。她关上门，面对镜子里憔悴的自己，多年前的创伤再次闪回。讽刺的是，她一直以为自己能保护女儿。悲伤像潮水一样将她淹没，但身为家人的责任让她必须坚强。`;

/**
 * LOW-QUALITY SAMPLE 1: Flat, emotionless exposition
 * Lacks: sensory detail, conflict markers, narrator presence, emotional depth.
 */
const LOW_FLAT_EXPOSITION = `男人走路去商店。他买了面包。然后他回到家。面包放在桌子上。他吃了面包。之后他看了电视。电视节目还不错。然后他去睡觉了。第二天早上他起床了。他做了早饭。早饭是面条。吃完早饭他出门了。`;

/**
 * LOW-QUALITY SAMPLE 2: Cliche-ridden text
 * Loaded with cliche patterns: opening cliches (闹钟响起, 从梦中醒来, 睁开眼, 阳光透过窗帘),
 * character cliches (高冷, 腹黑, 天才), plot cliches (误会分手, 车祸),
 * description cliches (泪如雨下, 心如刀割, 突然, 竟然).
 */
const LOW_CLICHE_RIDDEN = `闹钟响起，她从梦中醒来，睁开眼睛。阳光透过窗帘洒进来，这是新的一天。她照镜子，发现自己很特别。突然，他竟然出现了。他是高冷的天才，而且腹黑。她不忍住哭了出来，泪如雨下，心如刀割。最终因为误会分手。突然一切都变了，她不禁心动了。令人惊讶的是，命运竟然如此捉弄人。`;

/**
 * LOW-QUALITY SAMPLE 3: On-the-nose telling without showing
 * Direct emotion statements with zero sensory detail or subtext.
 * Uses subtext on-the-nose markers: "我很难过", "我很开心", "因为我在乎你".
 */
const LOW_TELLING = `他很高兴。他觉得自己很幸运。我的意思是你不配。你明白吗？让我解释一下。换句话说是这样的。作为你的朋友，我必须告诉你真相。我的内心其实一直很害怕。他总是做正确的事，从不出错。生活很顺遂，一切安好。没有任何困难。他觉得很开心。因为我很在乎，所以我这么做了。`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type EvaluatorKey = 'dream' | 'suspense' | 'character' | 'premise' | 'voice' | 'cliche' | 'four_selves' | 'subtext' | 'deadly_sins';

interface EvaluatorInstance {
  evaluate(content: string, context?: Record<string, unknown>): Promise<{ score: number; issues: { severity: string }[] }>;
}

async function runEvaluator(
  key: EvaluatorKey,
  content: string,
  context?: Record<string, unknown>,
): Promise<EvidenceScore> {
  let instance: EvaluatorInstance;
  let name: string;

  switch (key) {
    case 'dream':
      instance = new DreamEvaluator();
      name = 'dream';
      break;
    case 'suspense':
      instance = new SuspenseEvaluator();
      name = 'suspense';
      break;
    case 'character':
      instance = new CharacterEvaluator();
      name = 'character';
      break;
    case 'premise':
      instance = new PremiseEvaluator();
      name = 'premise';
      break;
    case 'voice':
      instance = new VoiceEvaluator();
      name = 'voice';
      break;
    case 'cliche':
      instance = new ClicheDetector();
      name = 'cliche';
      break;
    case 'four_selves':
      instance = new FourSelvesEvaluator();
      name = 'four_selves';
      break;
    case 'subtext':
      instance = new SubtextEvaluator();
      name = 'subtext';
      break;
    case 'deadly_sins':
      instance = new DeadlySinsChecker();
      name = 'deadly_sins';
      break;
  }

  const result = await instance.evaluate(content, context);
  const criticalCount = result.issues.filter((i) => i.severity === 'critical').length;
  const majorCount = result.issues.filter((i) => i.severity === 'major').length;

  return {
    evaluator: name,
    score: result.score,
    level: result.score >= 90 ? 'excellent' : result.score >= 75 ? 'good' : result.score >= 60 ? 'fair' : result.score >= 40 ? 'poor' : 'critical',
    issues: result.issues.length,
    criticalIssues: criticalCount,
    majorIssues: majorCount,
  };
}

const ALL_EVALUATORS: EvaluatorKey[] = [
  'dream', 'suspense', 'character', 'premise', 'voice',
  'cliche', 'four_selves', 'deadly_sins',
];

async function evaluateAll(content: string, context?: Record<string, unknown>): Promise<EvidenceScore[]> {
  const results: EvidenceScore[] = [];
  for (const key of ALL_EVALUATORS) {
    results.push(await runEvaluator(key, content, context));
  }
  return results;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('quality-gate-benchmark', () => {
  // Evidence collection for report generation
  const evidenceResults: EvidenceTestResult[] = [];

  // =========================================================================
  // HIGH-QUALITY SAMPLES: should score well
  // =========================================================================

  describe('high-quality samples', () => {
    it('internal conflict passage scores above threshold', async () => {
      const scores = await evaluateAll(HIGH_INTERNAL_CONFLICT);
      const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;

      // High-quality prose with rich conflict/sensory markers should average >= 55
      expect(avg).toBeGreaterThanOrEqual(55);

      // Character evaluator should detect inner conflict markers
      const charScore = scores.find((s) => s.evaluator === 'character');
      expect(charScore!.score).toBeGreaterThanOrEqual(50);

      // Dream evaluator should detect conflict/immersion markers
      const dreamScore = scores.find((s) => s.evaluator === 'dream');
      expect(dreamScore!.score).toBeGreaterThanOrEqual(50);

      evidenceResults.push({
        test_name: 'internal_conflict_high_quality',
        sample_label: 'Crime and Punishment style internal conflict',
        sample_category: 'high_quality',
        scores,
        passed: avg >= 55,
        pass_criteria: 'average_score >= 55',
        details: `average=${avg.toFixed(1)}`,
      });
    });

    it('suspenseful opening scores above threshold', async () => {
      const scores = await evaluateAll(HIGH_SUSPENSE_OPENING);
      const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;

      expect(avg).toBeGreaterThanOrEqual(50);

      // Suspense evaluator should detect threat/question/fuse markers
      const suspenseScore = scores.find((s) => s.evaluator === 'suspense');
      expect(suspenseScore!.score).toBeGreaterThanOrEqual(60);

      evidenceResults.push({
        test_name: 'suspense_opening_high_quality',
        sample_label: 'Jaws style suspenseful opening',
        sample_category: 'high_quality',
        scores,
        passed: avg >= 50 && suspenseScore!.score >= 60,
        pass_criteria: 'average_score >= 50 AND suspense >= 60',
        details: `average=${avg.toFixed(1)}, suspense=${suspenseScore!.score.toFixed(1)}`,
      });
    });

    it('emotional scene scores above threshold', async () => {
      const scores = await evaluateAll(HIGH_EMOTIONAL_SCENE);
      const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;

      expect(avg).toBeGreaterThanOrEqual(50);

      // Dream evaluator should detect sensory/empathy markers
      const dreamScore = scores.find((s) => s.evaluator === 'dream');
      expect(dreamScore!.score).toBeGreaterThanOrEqual(50);

      // Four-selves should detect multiple character layers
      const fsScore = scores.find((s) => s.evaluator === 'four_selves');
      expect(fsScore!.score).toBeGreaterThanOrEqual(40);

      evidenceResults.push({
        test_name: 'emotional_scene_high_quality',
        sample_label: 'Empathy and sensory detail scene',
        sample_category: 'high_quality',
        scores,
        passed: avg >= 50 && dreamScore!.score >= 50,
        pass_criteria: 'average_score >= 50 AND dream >= 50',
        details: `average=${avg.toFixed(1)}, dream=${dreamScore!.score.toFixed(1)}, four_selves=${fsScore!.score.toFixed(1)}`,
      });
    });
  });

  // =========================================================================
  // LOW-QUALITY SAMPLES: should score poorly
  // =========================================================================

  describe('low-quality samples', () => {
    it('flat exposition scores below threshold', async () => {
      const scores = await evaluateAll(LOW_FLAT_EXPOSITION);
      const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;

      // Flat text should score well below high-quality threshold
      expect(avg).toBeLessThan(55);

      // Dream evaluator should flag low sensory/empathy content
      const dreamScore = scores.find((s) => s.evaluator === 'dream');
      expect(dreamScore!.score).toBeLessThan(55);

      evidenceResults.push({
        test_name: 'flat_exposition_low_quality',
        sample_label: 'Flat, emotionless exposition',
        sample_category: 'low_quality',
        scores,
        passed: avg < 55,
        pass_criteria: 'average_score < 55',
        details: `average=${avg.toFixed(1)}`,
      });
    });

    it('cliche-ridden text triggers cliche detector', async () => {
      const scores = await evaluateAll(LOW_CLICHE_RIDDEN);
      const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;

      // Cliche detector should penalize heavily
      const clicheScore = scores.find((s) => s.evaluator === 'cliche');
      expect(clicheScore!.score).toBeLessThan(80);
      // Should detect at least some cliches
      expect(clicheScore!.issues).toBeGreaterThanOrEqual(1);

      evidenceResults.push({
        test_name: 'cliche_ridden_low_quality',
        sample_label: 'Cliche-ridden text',
        sample_category: 'low_quality',
        scores,
        passed: clicheScore!.score < 80,
        pass_criteria: 'cliche_score < 80',
        details: `cliche_score=${clicheScore!.score.toFixed(1)}, cliches=${clicheScore!.issues}`,
      });
    });

    it('on-the-nose telling lacks depth', async () => {
      const scores = await evaluateAll(LOW_TELLING);
      const avg = scores.reduce((s, e) => s + e.score, 0) / scores.length;

      // Telling without showing should score low
      expect(avg).toBeLessThan(55);

      evidenceResults.push({
        test_name: 'on_the_nose_telling_low_quality',
        sample_label: 'On-the-nose telling without showing',
        sample_category: 'low_quality',
        scores,
        passed: avg < 55,
        pass_criteria: 'average_score < 55',
        details: `average=${avg.toFixed(1)}`,
      });
    });
  });

  // =========================================================================
  // DIFFERENTIATION: high vs low quality gap
  // =========================================================================

  describe('quality differentiation', () => {
    it('high-quality internal conflict outscores flat exposition by meaningful margin', async () => {
      const highScores = await evaluateAll(HIGH_INTERNAL_CONFLICT);
      const lowScores = await evaluateAll(LOW_FLAT_EXPOSITION);

      const highAvg = highScores.reduce((s, e) => s + e.score, 0) / highScores.length;
      const lowAvg = lowScores.reduce((s, e) => s + e.score, 0) / lowScores.length;

      const gap = highAvg - lowAvg;
      expect(gap).toBeGreaterThan(10);

      evidenceResults.push({
        test_name: 'gap_internal_vs_flat',
        sample_label: 'Internal conflict vs flat exposition',
        sample_category: 'high_quality',
        scores: highScores,
        passed: gap > 10,
        pass_criteria: 'score_gap > 10',
        details: `high_avg=${highAvg.toFixed(1)}, low_avg=${lowAvg.toFixed(1)}, gap=${gap.toFixed(1)}`,
      });
    });

    it('high-quality suspense outscores cliche-ridden text by meaningful margin', async () => {
      const highScores = await evaluateAll(HIGH_SUSPENSE_OPENING);
      const lowScores = await evaluateAll(LOW_CLICHE_RIDDEN);

      const highAvg = highScores.reduce((s, e) => s + e.score, 0) / highScores.length;
      const lowAvg = lowScores.reduce((s, e) => s + e.score, 0) / lowScores.length;

      const gap = highAvg - lowAvg;
      expect(gap).toBeGreaterThan(5);

      evidenceResults.push({
        test_name: 'gap_suspense_vs_cliche',
        sample_label: 'Suspense opening vs cliche-ridden text',
        sample_category: 'high_quality',
        scores: highScores,
        passed: gap > 5,
        pass_criteria: 'score_gap > 5',
        details: `high_avg=${highAvg.toFixed(1)}, low_avg=${lowAvg.toFixed(1)}, gap=${gap.toFixed(1)}`,
      });
    });

    it('high-quality emotional scene outscores flat exposition by meaningful margin', async () => {
      const highScores = await evaluateAll(HIGH_EMOTIONAL_SCENE);
      const lowScores = await evaluateAll(LOW_FLAT_EXPOSITION);

      const highAvg = highScores.reduce((s, e) => s + e.score, 0) / highScores.length;
      const lowAvg = lowScores.reduce((s, e) => s + e.score, 0) / lowScores.length;

      const gap = highAvg - lowAvg;
      expect(gap).toBeGreaterThan(5);

      evidenceResults.push({
        test_name: 'gap_emotional_vs_flat',
        sample_label: 'Emotional scene vs flat exposition',
        sample_category: 'high_quality',
        scores: highScores,
        passed: gap > 5,
        pass_criteria: 'score_gap > 5',
        details: `high_avg=${highAvg.toFixed(1)}, low_avg=${lowAvg.toFixed(1)}, gap=${gap.toFixed(1)}`,
      });
    });

    it('evaluators produce bounded scores (0-100) for all inputs', async () => {
      const samples = [
        HIGH_INTERNAL_CONFLICT,
        HIGH_SUSPENSE_OPENING,
        HIGH_EMOTIONAL_SCENE,
        LOW_FLAT_EXPOSITION,
        LOW_CLICHE_RIDDEN,
        LOW_TELLING,
      ];

      for (const sample of samples) {
        const scores = await evaluateAll(sample);
        for (const score of scores) {
          expect(score.score).toBeGreaterThanOrEqual(0);
          expect(score.score).toBeLessThanOrEqual(100);
          expect(score.issues).toBeGreaterThanOrEqual(0);
          expect(score.criticalIssues).toBeGreaterThanOrEqual(0);
          expect(score.majorIssues).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('generates valid evidence report for quality gate', () => {
      const report = buildQualityGateReport('quality-gate-benchmark', evidenceResults);

      expect(report.timestamp).toBeTruthy();
      expect(report.report_id).toMatch(/^EVD-\d{8}-\d{6}$/);
      expect(report.suite_name).toBe('quality-gate-benchmark');
      expect(report.sample_size).toBeGreaterThan(0);
      expect(report.results.length).toBeGreaterThan(0);
      expect(report.summary.total_tests).toBe(evidenceResults.length);
      expect(report.summary.passed).toBeGreaterThanOrEqual(0);
      expect(report.summary.failed).toBeGreaterThanOrEqual(0);
      expect(report.summary.pass_rate).toBeGreaterThanOrEqual(0);
      expect(report.summary.pass_rate).toBeLessThanOrEqual(100);

      // Verify JSON serialization
      const json = reportToJson(report);
      expect(json).toBeTruthy();
      const parsed = JSON.parse(json);
      expect(parsed.report_id).toBe(report.report_id);
      expect(parsed.results).toHaveLength(evidenceResults.length);
    });
  });
});
