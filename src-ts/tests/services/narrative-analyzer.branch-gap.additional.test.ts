import { afterEach, describe, expect, it, vi } from 'vitest';

import { NarrativeAnalyzer } from '../../services/narrative-analyzer';

describe('services/narrative-analyzer branch gaps', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to empty paragraphs when split results are nullish', () => {
    const analyzer = new NarrativeAnalyzer();
    const splitSpy = vi.spyOn(String.prototype, 'split');

    splitSpy.mockReturnValueOnce([undefined] as never);
    const hook = analyzer.analyzeHook('ignored');

    splitSpy.mockReturnValueOnce([] as never);
    const cliffhanger = analyzer.analyzeCliffhanger('ignored');

    expect(hook).toMatchObject({
      score: 20,
      hookType: 'question',
      strength: 0.2,
    });
    expect(cliffhanger).toMatchObject({
      tension: 20,
      uncertainty: 20,
      emotional: 30,
      curiosity: 20,
    });
  });

  it('detects surprise hooks and unresolved emotional cliffhangers without curiosity keywords', () => {
    const analyzer = new NarrativeAnalyzer();

    const hook = analyzer.analyzeHook('她居然站在门外。');
    const cliffhanger = analyzer.analyzeCliffhanger('她心碎地后退，究竟会发生什么。');

    expect(hook).toMatchObject({
      score: 30,
      hookType: 'surprise',
      strength: 0.3,
    });
    expect(cliffhanger).toMatchObject({
      tension: 50,
      uncertainty: 80,
      emotional: 80,
      curiosity: 60,
    });
  });

  it('detects question hooks and danger-heavy cliffhangers', () => {
    const analyzer = new NarrativeAnalyzer();

    const hook = analyzer.analyzeHook('她为什么会出现在这里？');
    const cliffhanger = analyzer.analyzeCliffhanger('危险正逼近，她听见脚步一路追来。');

    expect(hook).toMatchObject({
      score: 30,
      hookType: 'question',
      strength: 0.3,
    });
    expect(cliffhanger).toMatchObject({
      tension: 80,
      uncertainty: 20,
      emotional: 30,
      curiosity: 20,
    });
  });

  it('prefers sensory and metaphor layers in the emotion craft analysis', () => {
    const analyzer = new NarrativeAnalyzer();

    const sensory = analyzer.analyzeEmotionCraft('她看到窗外的灯，指尖一阵冰冷。');
    const metaphor = analyzer.analyzeEmotionCraft('她仿佛被一只无形的手拖进深海。');

    expect(sensory).toMatchObject({
      dominantLayer: 'sensory',
      showTellRatio: 1,
      score: 100,
    });
    expect(metaphor).toMatchObject({
      dominantLayer: 'metaphor',
      showTellRatio: 1,
      score: 100,
    });
  });

  it('marks all suspense signals and emits low-quality report guidance when the text is flat and tell-heavy', () => {
    const analyzer = new NarrativeAnalyzer();

    const suspense = analyzer.analyzeSuspense('秘密背后有敌人追杀，她必须在最后期限前揭开真相。');
    const report = analyzer.generateQualityReport('她感到悲伤。');

    expect(suspense).toMatchObject({
      informationGap: 70,
      threatEscalation: 75,
      timePressure: 80,
    });
    expect(report.criticalIssues).toContain('开头缺乏吸引力');
    expect(report.criticalIssues).toContain('情感描写过于直白（tell > show）');
    expect(report.suggestions).toContain('章节结尾增加未解决的张力');
    expect(report.suggestions).toContain('增加信息缺口、威胁递进或时间压力提升悬疑感');
  });
});
