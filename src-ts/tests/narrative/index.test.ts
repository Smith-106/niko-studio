import { describe, expect, it } from 'vitest';

import * as narrative from '../../narrative';
import * as analyzers from '../../narrative/analyzers';
import * as evaluators from '../../narrative/evaluators';
import {
  CharacterTrait,
  createDominantEmotion,
  computeCharacterDepthResult,
} from '../../narrative/character-depth';
import { scoreToLevel, severityOrder } from '../../narrative/types';

describe('narrative/index barrel', () => {
  it('re-exports representative narrative helpers, barrels, and aliases through the public entrypoint', () => {
    expect(narrative.scoreToLevel).toBe(scoreToLevel);
    expect(narrative.severityOrder).toBe(severityOrder);
    expect(narrative.AnalysisType).toBe(analyzers.AnalysisType);
    expect(narrative.EvaluationResult).toBe(evaluators.EvaluationResult);
    expect(narrative.FictionalDreamEvaluator).toBeDefined();
    expect(narrative.CharacterDepthSystem).toBeDefined();
    expect(narrative.CharacterManager).toBeDefined();

    const emotion = narrative.createDominantEmotion('恐惧', '勇气');
    narrative.addEvolutionPoint(emotion, '决心');

    expect(emotion).toEqual({
      staticEmotion: '恐惧',
      dynamicEmotion: '决心',
      evolution: ['恐惧', '勇气', '决心'],
    });
    expect(narrative.scoreToLevel(90)).toBe('excellent');
    expect(narrative.severityOrder('major')).toBe(1);
  });

  it('provides working representative classes and character-depth helpers through the barrel', () => {
    const sensory = new narrative.SensoryAnalyzer();
    const critic = new narrative.CriticEngine();
    const result = computeCharacterDepthResult(
      '林岚',
      { trait: CharacterTrait.INTERESTING, score: 8, evidence: ['线索'], issues: [], suggestions: [] },
      { trait: CharacterTrait.COMPETENT, score: 7, evidence: ['追踪'], issues: [], suggestions: [] },
      { trait: CharacterTrait.ECCENTRIC, score: 6, evidence: ['旧表'], issues: [], suggestions: [] },
      { trait: CharacterTrait.KNOWLEDGEABLE, score: 8, evidence: ['旧城区'], issues: [], suggestions: [] },
      { trait: CharacterTrait.DUAL_PERSONALITY, score: 9, evidence: ['自我拉扯'], issues: [], suggestions: [] },
      {
        primaryPersona: { name: '理性', traits: ['冷静'], triggerConditions: ['白天'], behaviorPatterns: ['分析'] },
        shadowPersona: { name: '偏执', traits: ['执拗'], triggerConditions: ['夜晚'], behaviorPatterns: ['追索'] },
        internalConflict: '理性与偏执拉扯',
        switchTriggers: ['压力'],
      },
    );

    expect(sensory.extractByType('她看到冷光，也听到钟声。', narrative.SensoryType.VISUAL)).toHaveLength(1);
    expect(critic).toBeInstanceOf(narrative.CriticEngine);
    expect(result.characterName).toBe('林岚');
    expect(result.overallScore).toBeGreaterThan(0);
    expect(['UNFORGETTABLE', 'DEEP', 'MODERATE', 'FLAT']).toContain(result.depthLevel);
  });
});
