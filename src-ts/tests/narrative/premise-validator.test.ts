import { describe, expect, it, vi } from 'vitest';

import {
  computeValidationResult,
  PremiseType,
  premiseFromStatement,
  PremiseValidator,
} from '../../narrative/premise-validator';

describe('PremiseValidator', () => {
  it('builds premise fallback objects and computes validation aggregates', () => {
    const premise = premiseFromStatement('懦弱导致背叛', PremiseType.CHAIN_REACTION);
    const result = computeValidationResult(premise, [
      {
        sceneId: 'scene-1',
        alignmentScore: 0.8,
        contribution: '角色第一次退缩',
        evidence: ['退缩'],
        driftDetected: false,
        driftDescription: null,
      },
      {
        sceneId: 'scene-2',
        alignmentScore: 0.6,
        contribution: '冲突升级',
        evidence: ['升级'],
        driftDetected: true,
        driftDescription: '结局导向不明确',
      },
    ]);

    expect(premise).toMatchObject({
      premiseType: PremiseType.CHAIN_REACTION,
      fullStatement: '懦弱导致背叛',
    });
    expect(result.overallAlignment).toBe(7);
    expect(result.driftCount).toBe(1);
  });

  it('uses mock validation paths when llm is absent', async () => {
    const validator = new PremiseValidator();
    await validator.parsePremise('贪婪导致毁灭');

    const alignment = await validator.validateScene(
      'scene-1',
      '主角为利益做出危险选择。',
      '推进贪婪冲突',
    );
    const progress = await validator.trackPremiseProgress('scene-1: 主角选择了冒险。');

    expect(alignment).toMatchObject({
      sceneId: 'scene-1',
      alignmentScore: 7,
      driftDetected: false,
    });
    expect(progress).toMatchObject({
      proof_progress: 50,
      current_stage: '发展中',
    });
    expect(validator.detectPremiseDrift()).toEqual([]);
    expect(validator.suggestRealignment('scene-1')[0]).toContain('场景未找到');
  });

  it('maps llm premise parsing and alignment data into validator state', async () => {
    const llmClient = {
      generateJson: vi
        .fn()
        .mockResolvedValueOnce({
          character_trait: '傲慢',
          conflict: '家族崩塌',
          conclusion: '失去一切',
          premise_type: 'situational',
        })
        .mockResolvedValueOnce({
          alignment_score: 0.4,
          contribution: '场景偏离主线',
          evidence: ['角色目标模糊'],
          drift_detected: true,
          drift_description: '没有推进预设中的冲突',
        })
        .mockResolvedValueOnce({
          proof_progress: 30,
          current_stage: '偏航',
          remaining_elements: ['需要重新聚焦冲突'],
        }),
    };
    const validator = new PremiseValidator(llmClient as never);

    const premise = await validator.parsePremise('傲慢导致失去一切');
    const alignment = await validator.validateScene(
      'scene-2',
      '角色在无关支线里消耗篇幅。',
      '推进家族危机',
    );
    const progress = await validator.trackPremiseProgress('scene-2: 偏离主线');
    const result = validator.getValidationResult();

    expect(premise).toMatchObject({
      premiseType: PremiseType.SITUATIONAL,
      characterTrait: '傲慢',
    });
    expect(alignment.driftDetected).toBe(true);
    expect(progress.current_stage).toBe('偏航');
    expect(result.criticalIssues[0]).toContain('偏离预设');
    expect(result.realignmentSuggestions[0]).toContain('scene-2');
    expect(validator.suggestRealignment('scene-2')[1]).toContain('偏离描述');
  });

  it('resets validator state and enforces premise presence before scene validation', async () => {
    const validator = new PremiseValidator();

    await expect(
      validator.validateScene('scene-0', 'content'),
    ).rejects.toThrow('请先使用 parsePremise() 设置预设');

    await validator.parsePremise('善良导致牺牲');
    await validator.validateScene('scene-1', '主角帮助他人');
    validator.reset();

    expect(validator.detectPremiseDrift()).toEqual([]);
    await expect(
      validator.getValidationResult.bind(validator),
    ).toThrow('请先使用 parsePremise() 设置预设');
  });
});
