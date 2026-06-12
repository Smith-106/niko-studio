import { describe, expect, it, vi } from 'vitest';

import {
  ArcStage,
  CharacterArcType,
  CharacterDepthSystem,
  type CharacterDepthScore,
  CharacterTrait,
  computeCharacterDepthResult,
  createDominantEmotion,
  OCEANDimension,
} from '../../narrative/character-depth';

function makeScore(trait: CharacterTrait, score: number): CharacterDepthScore {
  return {
    trait,
    score,
    evidence: [],
    issues: [],
    suggestions: [],
  };
}

function computeWithScore(score: number) {
  return computeCharacterDepthResult(
    'agent',
    makeScore(CharacterTrait.INTERESTING, score),
    makeScore(CharacterTrait.COMPETENT, score),
    makeScore(CharacterTrait.ECCENTRIC, score),
    makeScore(CharacterTrait.KNOWLEDGEABLE, score),
    makeScore(CharacterTrait.DUAL_PERSONALITY, score),
    null,
  );
}

describe('narrative/character-depth additional coverage', () => {
  it('covers equal dominant-emotion evolution and remaining depth buckets', () => {
    expect(createDominantEmotion('fear', 'fear')).toEqual({
      staticEmotion: 'fear',
      dynamicEmotion: 'fear',
      evolution: ['fear'],
    });

    expect(computeWithScore(10).depthLevel).toBe('UNFORGETTABLE');
    expect(computeWithScore(6).depthLevel).toBe('MODERATE');
    expect(computeWithScore(1).depthLevel).toBe('FLAT');
  });

  it('defaults sparse llm depth responses into empty evidence and persona fields', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({ score: 4 })
        .mockResolvedValueOnce({ score: 5 })
        .mockResolvedValueOnce({ has_dual_personality: true, score: 6 })
        .mockResolvedValueOnce({ score: 7 }),
    };
    const system = new CharacterDepthSystem(llm as never);

    const interest = await system.assessInterestLevel({ name: 'A' }, 'content');
    const eccentricity = await system.detectEccentricity({ name: 'A' }, 'content');
    const [dualScore, dualPersonality] = await system.mapDualPersonality({ name: 'A' }, 'content');
    const environment = await system.checkEnvironmentContrast({ name: 'A' }, {}, 'content');

    expect(interest).toMatchObject({ score: 4, evidence: [], issues: [], suggestions: [] });
    expect(eccentricity).toMatchObject({ score: 5, evidence: [], issues: [], suggestions: [] });
    expect(dualScore).toMatchObject({ score: 6, evidence: [''], issues: [], suggestions: [] });
    expect(dualPersonality).toEqual({
      primaryPersona: {
        name: '',
        traits: [],
        triggerConditions: [],
        behaviorPatterns: [],
      },
      shadowPersona: {
        name: '',
        traits: [],
        triggerConditions: [],
        behaviorPatterns: [],
      },
      internalConflict: '',
      switchTriggers: [],
    });
    expect(environment).toMatchObject({ score: 7, evidence: [], issues: [], suggestions: [] });
    expect(llm.generateJson).toHaveBeenCalledTimes(4);
  });

  it('uses Unknown when evaluateFull receives no character name', async () => {
    const system = new CharacterDepthSystem();

    await expect(system.evaluateFull({}, {}, 'content')).resolves.toMatchObject({
      characterName: 'Unknown',
    });
  });

  it('defaults sparse arc responses and nested arc stage fields', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ stages: [{}], transitionPoints: [{}] }),
    };
    const system = new CharacterDepthSystem(llm as never);

    const emptyArc = await system.assessCharacterArc({ name: 'A' }, 'content');
    const nestedArc = await system.assessCharacterArc({ name: 'A' }, 'content');

    expect(emptyArc).toMatchObject({
      arcType: CharacterArcType.FLAT_ARC,
      stages: [],
      transitionPoints: [],
      arcCompletionScore: 0,
      arcCoherenceScore: 0,
      suggestions: [],
    });
    expect(nestedArc.stages[0]).toEqual({
      stage: ArcStage.SETUP,
      detected: false,
      confidence: 0,
      evidence: [],
      position: 0,
    });
    expect(nestedArc.transitionPoints[0]).toEqual({
      from: ArcStage.SETUP,
      to: ArcStage.CATALYST,
      evidence: '',
      position: 0,
    });
  });

  it('defaults sparse OCEAN responses and nested dimension fields', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ dimensions: [{}] }),
    };
    const system = new CharacterDepthSystem(llm as never);

    const emptyProfile = await system.profileOCEAN('A', {}, 'content');
    const nestedProfile = await system.profileOCEAN('A', {}, 'content');

    expect(emptyProfile.characterName).toBe('A');
    expect(emptyProfile.dimensions).toEqual([]);
    expect(emptyProfile.suggestions).toEqual([]);
    expect(typeof emptyProfile.overallProfile).toBe('string');
    expect(emptyProfile.overallProfile.length).toBeGreaterThan(0);
    expect(nestedProfile.dimensions[0]).toEqual({
      dimension: OCEANDimension.OPENNESS,
      label: '',
      score: 5,
      confidence: 0,
      evidence: [],
      traits: [],
    });
  });

  it('covers high-quality creation suggestions and zero-plot balance fallback', () => {
    const content = [
      '\u72ec\u7279\u7684 \u4e0e\u4f17\u4e0d\u540c \u6807\u5fd7\u6027\u7684 \u72ec\u6709',
      '\u75db\u82e6 \u6323\u624e \u6e34\u671b \u6050\u60e7',
      '\u77db\u76fe \u4e24\u96be \u72b9\u8c6b \u7ea0\u7ed3',
      '\u6210\u957f \u6539\u53d8 \u5b66\u4f1a \u9886\u609f',
      '\u80cc\u53db \u4fe1\u4efb \u66a7\u6627 \u4ea6\u654c\u4ea6\u53cb',
      '\u7070\u8272\u5730\u5e26 \u4e0d\u5b8c\u7f8e \u6709\u7f3a\u9677 \u81ea\u79c1',
    ].join(' ');
    const system = new CharacterDepthSystem();

    const creation = system.assessCharacterCreation({}, content);
    const balance = system.evaluatePlotCharacterBalance([], ['inner beat']);

    expect(creation.overallScore).toBeGreaterThanOrEqual(7);
    expect(creation.suggestions.length).toBeGreaterThan(0);
    expect(balance.plotDensity).toBe(0);
    expect(balance.characterDepth).toBeGreaterThan(0);
    expect(balance.balanceScore).toBe(5);
  });
});
