import { describe, expect, it, vi } from 'vitest';

import {
  CharacterDepthSystem,
  CharacterTrait,
  addEvolutionPoint,
  computeCharacterDepthResult,
  createDominantEmotion,
  createEmptyDynamicState,
  getConflictPotential,
  mergeDynamicState,
} from '../../narrative/character-depth';

describe('narrative/character-depth', () => {
  it('builds dominant-emotion helpers and computes depth buckets from weighted scores', () => {
    const emotion = createDominantEmotion('恐惧', '勇气');
    addEvolutionPoint(emotion, '决心');

    expect(emotion).toEqual({
      staticEmotion: '恐惧',
      dynamicEmotion: '决心',
      evolution: ['恐惧', '勇气', '决心'],
    });
    expect(
      getConflictPotential({
        primaryPersona: {
          name: '理性',
          traits: ['冷静'],
          triggerConditions: ['白天'],
          behaviorPatterns: ['分析'],
        },
        shadowPersona: {
          name: '偏执',
          traits: ['执拗'],
          triggerConditions: ['夜晚'],
          behaviorPatterns: ['追索'],
        },
        internalConflict: '理性与偏执拉扯',
        switchTriggers: ['压力'],
      }),
    ).toContain('理性');

    const result = computeCharacterDepthResult(
      '林岚',
      { trait: CharacterTrait.INTERESTING, score: 9, evidence: [], issues: [], suggestions: [] },
      { trait: CharacterTrait.COMPETENT, score: 8, evidence: [], issues: [], suggestions: [] },
      { trait: CharacterTrait.ECCENTRIC, score: 7, evidence: [], issues: [], suggestions: [] },
      { trait: CharacterTrait.KNOWLEDGEABLE, score: 8, evidence: [], issues: [], suggestions: [] },
      { trait: CharacterTrait.DUAL_PERSONALITY, score: 9, evidence: [], issues: [], suggestions: [] },
      null,
    );

    expect(result.characterName).toBe('林岚');
    expect(result.overallScore).toBe(83.5);
    expect(result.depthLevel).toBe('DEEP');
  });

  it('uses the no-llm mock-backed path for selected system methods', async () => {
    const system = new CharacterDepthSystem();

    const interest = await system.assessInterestLevel({ name: '林岚' }, '她总能从旧表上找到线索。');
    const eccentricity = await system.detectEccentricity({ name: '林岚' }, '她习惯在钟声响起时记笔记。');
    const [dualScore, dualPersonality] = await system.mapDualPersonality(
      { name: '林岚' },
      '她在冷静与偏执之间来回切换。',
    );
    const environment = await system.checkEnvironmentContrast(
      { name: '林岚' },
      { setting: '废弃剧院' },
      '她闯进完全陌生的剧院追查真相。',
    );
    const tracked = system.trackDominantEmotion('林岚', '恐惧', '勇气');
    const full = await system.evaluateFull(
      { name: '林岚' },
      { setting: '废弃剧院' },
      '她闯进剧院追查真相，内心始终在理性与偏执之间拉扯。',
    );

    expect(interest.trait).toBe(CharacterTrait.INTERESTING);
    expect(eccentricity.trait).toBe(CharacterTrait.ECCENTRIC);
    expect(dualScore.trait).toBe(CharacterTrait.DUAL_PERSONALITY);
    expect(dualPersonality).toBeNull();
    expect(environment.score).toBeGreaterThan(0);
    expect(tracked.evolution).toEqual(['恐惧', '勇气']);
    expect(full.characterName).toBe('林岚');
    expect(['UNFORGETTABLE', 'DEEP', 'MODERATE', 'FLAT']).toContain(full.depthLevel);
  });

  it('propagates llm-backed depth scoring through evaluateFull', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({
          score: 9,
          evidence: ['角色拥有反差鲜明的职业细节'],
          issues: [],
          suggestions: ['继续强化独特技能'],
        })
        .mockResolvedValueOnce({
          score: 8,
          evidence: ['她坚持在钟声响起时记录线索'],
          issues: [],
          suggestions: ['保留这一怪癖'],
        })
        .mockResolvedValueOnce({
          has_dual_personality: true,
          score: 9,
          primary_persona: {
            name: '理性林岚',
            traits: ['冷静'],
            behavior_patterns: ['先观察后行动'],
          },
          shadow_persona: {
            name: '偏执林岚',
            traits: ['执拗'],
            behavior_patterns: ['先追索再思考'],
          },
          internal_conflict: '真相与代价冲突',
          switch_triggers: ['压力'],
          dramatic_potential: '人格切换能放大剧情张力',
          suggestions: ['增加触发切换的高压场景'],
        })
        .mockResolvedValueOnce({
          score: 8,
          evidence: ['角色与废弃剧院形成强烈反差'],
          suggestions: ['进一步利用空间压迫感'],
        }),
    };
    const system = new CharacterDepthSystem(llm);

    const result = await system.evaluateFull(
      { name: '林岚' },
      { setting: '废弃剧院' },
      '她总能从旧表上找到线索，也习惯在钟声响起时记笔记。她在冷静与偏执之间来回切换，闯进废弃剧院追查真相。',
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(4);
    expect(result.interestScore.score).toBe(9);
    expect(result.eccentricityScore.score).toBe(8);
    expect(result.dualPersonalityScore.score).toBe(9);
    expect(result.environmentContrastScore.score).toBe(8);
    expect(result.dualPersonality).toMatchObject({
      primaryPersona: {
        name: '理性林岚',
      },
      shadowPersona: {
        name: '偏执林岚',
      },
      internalConflict: '真相与代价冲突',
      switchTriggers: ['压力'],
    });
    expect(['UNFORGETTABLE', 'DEEP', 'MODERATE', 'FLAT']).toContain(result.depthLevel);
  });

  // ── M11: DynamicCharacterState ─────────────────────────────

  describe('DynamicCharacterState', () => {
    it('creates empty dynamic state with correct defaults', () => {
      const state = createEmptyDynamicState();
      expect(state.goals).toEqual([]);
      expect(state.currentStates).toEqual([]);
      expect(state.recentActions).toEqual([]);
      expect(state.lastUpdated).toBeTruthy();
    });

    it('merges new goals and states into existing state', () => {
      const base = createEmptyDynamicState();
      const merged = mergeDynamicState(base, ['找出真相'], ['坚定'], '调查线索');

      expect(merged.goals).toEqual(['找出真相']);
      expect(merged.currentStates).toEqual(['坚定']);
      expect(merged.recentActions).toContain('调查线索');
      expect(merged.lastUpdated).toBeTruthy();
    });

    it('appends actions without exceeding recentActions limit', () => {
      const base = createEmptyDynamicState();
      base.recentActions = Array.from({ length: 8 }, (_, i) => `Action ${i}`);

      const merged = mergeDynamicState(base, [], [], 'New action');

      expect(merged.recentActions).toHaveLength(9);
      expect(merged.recentActions[8]).toBe('New action');
    });
  });
});
