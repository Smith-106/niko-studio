import { describe, expect, it } from 'vitest';

import {
  CharacterDepthSystem,
  CharacterTrait,
  addEvolutionPoint,
  computeCharacterDepthResult,
  createDominantEmotion,
  getConflictPotential,
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
});
