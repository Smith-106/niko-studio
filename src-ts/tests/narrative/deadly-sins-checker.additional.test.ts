import { describe, expect, it } from 'vitest';

import { Severity } from '../../narrative/evaluators/base';
import { DeadlySinsChecker } from '../../narrative/evaluators/deadly-sins-checker';

type SinResult = {
  detected: boolean;
  severity: Severity;
  score: number;
  diagnosis: string;
  nameCn: string;
};

type DeadlySinsCheckerWhitebox = {
  checkStructuralDrift: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  checkEmotionalVacuum: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  checkNarrativeStagnation: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  checkApatheticCoward: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  checkAimlessPlotting: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  checkFacelessNarration: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  checkChaoticPresentation: (
    content: string,
    context: Record<string, unknown>,
  ) => SinResult;
  generateSummary: (
    score: number,
    sinResults: Array<{ detected: boolean; nameCn: string }>,
    criticalSins: Array<{ nameCn: string }>,
    majorSins: Array<{ nameCn: string }>,
  ) => string;
};

describe('narrative/evaluators/deadly-sins-checker additional coverage', () => {
  it('rewards balanced craft when all seven deadly sins are avoided', async () => {
    const checker = new DeadlySinsChecker();
    const content = [
      '因此，我们认为档案必须在今晚公开。',
      '',
      '第一，她看到灯塔的光线，听到潮水拍岸，感觉石阶冰冷，于是追问：为什么信号会在这里熄灭？到底谁改写了航线？',
      '',
      '第二，因为旧地图指向密室，所以她决定行动，面对守卫，并在最后时限前带回证据，否则全城都会陷入危险。',
      '',
      '接下来，她沿着“档案公开将改变城市命运”的主线复盘，因此每一步都服务于档案公开将改变城市命运的核心前提。',
    ].join('\n\n');

    const result = await checker.evaluate(content, {
      premise: '档案公开将改变城市命运',
    });

    expect(result.issues).toHaveLength(0);
    expect(result.summary).toContain('整体质量良好');
    expect(result.metrics).toMatchObject({
      structural_drift: 70,
      emotional_vacuum: 70,
      narrative_stagnation: 70,
      apathetic_coward: 70,
      aimless_plotting: 70,
      faceless_narration: 75,
      chaotic_presentation: 75,
    });

    const rawAnalysis = result.rawAnalysis as {
      sin_results: Array<{ detected: boolean; diagnosis: string }>;
    };
    expect(rawAnalysis.sin_results).toHaveLength(7);
    expect(rawAnalysis.sin_results.every((item) => item.detected === false)).toBe(
      true,
    );
  });

  it('stacks major and minor findings when the draft trips multiple deadly sins', async () => {
    const checker = new DeadlySinsChecker();
    const paragraph =
      '我只能被迫无奈地看着你转身，其实吧，鉴于局面混乱，我高兴、难过、害怕、愤怒、紧张，却还是只能被迫无奈地重复这句空话。'.repeat(
        20,
      );
    const content = [paragraph, paragraph, paragraph, paragraph].join('\n\n');

    const result = await checker.evaluate(content, {});
    const issueCodes = result.issues.map((issue) => issue.code);

    expect(result.summary).toContain('主要问题');
    expect(result.majorIssues.length).toBeGreaterThanOrEqual(5);
    expect(result.hasCriticalIssues).toBe(false);
    expect(issueCodes).toEqual(
      expect.arrayContaining([
        'DEADLY_SIN_STRUCTURAL_DRIFT',
        'DEADLY_SIN_EMOTIONAL_VACUUM',
        'DEADLY_SIN_NARRATIVE_STAGNATION',
        'DEADLY_SIN_APATHETIC_COWARD',
        'DEADLY_SIN_AIMLESS_PLOTTING',
        'DEADLY_SIN_FACELESS_NARRATION',
        'DEADLY_SIN_CHAOTIC_PRESENTATION',
      ]),
    );
  });

  it('covers the remaining structural, emotional, and suspense branch combinations', () => {
    const checker = new DeadlySinsChecker() as unknown as DeadlySinsCheckerWhitebox;

    const structureOnly = checker.checkStructuralDrift(
      '因此，我们认为方案可行，但全文没有任何层次标记来组织论证。',
      {},
    );
    expect(structureOnly).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 50,
      diagnosis: '论证缺乏清晰的层次结构',
    });

    const abstractEmotionOnly = checker.checkEmotionalVacuum(
      '她看到火光，听到铃声，闻到焦味，却依旧高兴、难过、害怕、愤怒、紧张。',
      {},
    );
    expect(abstractEmotionOnly).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 55,
    });
    expect(abstractEmotionOnly.diagnosis).toContain(
      '过多直接陈述情感，而非用细节展示',
    );

    const suspenseThreatOnly = checker.checkNarrativeStagnation(
      '为什么他要回城？到底是谁在门外？',
      {},
    );
    expect(suspenseThreatOnly).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 55,
      diagnosis: '角色未处于有意义的威胁之下',
    });
  });

  it('covers the passive, premise-mismatch, perspective, and presentation edge branches', () => {
    const checker = new DeadlySinsChecker() as unknown as DeadlySinsCheckerWhitebox;

    const passiveButActive = checker.checkApatheticCoward(
      '她决定行动，却又只能被迫无奈地忍受眼前的安排。',
      {},
    );
    expect(passiveButActive).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 55,
      diagnosis: '角色过于被动，只是忍受而非行动',
    });

    const premiseMismatch = checker.checkAimlessPlotting(
      '因为调查受阻，所以小队暂时靠岸休整。',
      { premise: '月蚀诅咒吞没王城' },
    );
    expect(premiseMismatch).toMatchObject({
      detected: true,
      severity: Severity.MAJOR,
      score: 45,
    });
    expect(premiseMismatch.diagnosis).toContain('月蚀诅咒吞没王城');

    const perspectiveChaos = checker.checkFacelessNarration(
      '我我我我我我你你你你你你我们我们我们',
      {},
    );
    expect(perspectiveChaos).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 60,
    });
    expect(perspectiveChaos.diagnosis).toContain('叙述视角混乱');

    const transitionOnly = checker.checkChaoticPresentation(
      ['第一段说明背景。', '第二段突然改口。', '第三段继续跳转。', '第四段又换主题。'].join(
        '\n\n',
      ),
      {},
    );
    expect(transitionOnly).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 60,
      diagnosis: '段落之间缺乏过渡词，跳跃感强',
    });

    const formatOnly = checker.checkChaoticPresentation(
      ['甲'.repeat(350), '乙'.repeat(350), '丙'.repeat(350)].join('\n\n'),
      {},
    );
    expect(formatOnly).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 65,
      diagnosis: '长文缺乏格式化元素（标题、列表等）',
    });
  });

  it('covers the causal-gap branch when premise matching succeeds first', () => {
    const checker = new DeadlySinsChecker() as unknown as DeadlySinsCheckerWhitebox;

    const result = checker.checkAimlessPlotting(
      '档案公开将改变城市命运。角色反复提到档案公开将改变城市命运，却始终没有建立清晰因果。',
      {
        premise: '档案公开将改变城市命运',
      },
    );

    expect(result).toMatchObject({
      detected: true,
      severity: Severity.MINOR,
      score: 55,
      diagnosis: '情节之间缺乏明确的因果关联',
    });
  });

  it('covers the synthetic critical summary branch and the quick-scan healthy path', () => {
    const checker = new DeadlySinsChecker();
    const quickScan = checker.quickScan('第一，她看到火光，也听到钟声。');

    expect(quickScan.score).toBe(70);
    expect(quickScan.issues).toEqual([]);
    expect(quickScan.summary).toBe('快速扫描：70/100');

    const criticalSummary = (
      checker as unknown as DeadlySinsCheckerWhitebox
    ).generateSummary(
      12.3,
      [{ detected: true, nameCn: '结构漂移' }],
      [{ nameCn: '结构漂移' }],
      [],
    );

    expect(criticalSummary).toContain('12.3/100');
    expect(criticalSummary).toContain('发现1个问题');
    expect(criticalSummary).toContain('严重问题：结构漂移');
  });
});
