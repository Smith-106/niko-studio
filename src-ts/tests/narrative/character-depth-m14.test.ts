import { describe, expect, it, vi } from 'vitest';

import {
  ArcStage,
  CharacterArcType,
  CharacterDepthSystem,
  DimensionScore,
  OCEANDimension,
  OCEANProfile,
} from '../../narrative/character-depth';

describe('CharacterDepthSystem — M14 character arc (McKee Model)', () => {
  it('CharacterArcType has all 8 entries', () => {
    const values = Object.values(CharacterArcType);
    expect(values).toHaveLength(8);
    expect(values).toContain('positive_change');
    expect(values).toContain('negative_change');
    expect(values).toContain('flat_arc');
    expect(values).toContain('tragic_arc');
    expect(values).toContain('redemption_arc');
    expect(values).toContain('corruption_arc');
    expect(values).toContain('maturation_arc');
    expect(values).toContain('disillusionment_arc');
  });

  it('ArcStage has all 6 entries', () => {
    const values = Object.values(ArcStage);
    expect(values).toHaveLength(6);
    expect(values).toContain('setup');
    expect(values).toContain('catalyst');
    expect(values).toContain('struggle');
    expect(values).toContain('turning_point');
    expect(values).toContain('transformation');
    expect(values).toContain('new_equilibrium');
  });

  it('assessCharacterArc returns ArcAssessment with all 6 stages in mock mode', async () => {
    const system = new CharacterDepthSystem();
    const arc = await system.assessCharacterArc(
      { name: '林岚' },
      '她来到陌生的城市，遭遇背叛后逐渐学会独自面对风雨，最终找到了属于自己的方向。',
    );

    expect(arc.arcType).toBeDefined();
    expect(Object.values(CharacterArcType)).toContain(arc.arcType);
    expect(arc.arcTypeLabel).toBeTruthy();
    expect(arc.stages).toHaveLength(6);
    expect(arc.stages[0].stage).toBe(ArcStage.SETUP);
    expect(arc.stages[1].stage).toBe(ArcStage.CATALYST);
    expect(arc.stages[2].stage).toBe(ArcStage.STRUGGLE);
    expect(arc.stages[3].stage).toBe(ArcStage.TURNING_POINT);
    expect(arc.stages[4].stage).toBe(ArcStage.TRANSFORMATION);
    expect(arc.stages[5].stage).toBe(ArcStage.NEW_EQUILIBRIUM);
    expect(typeof arc.arcCompletionScore).toBe('number');
    expect(arc.arcCompletionScore).toBeGreaterThanOrEqual(0);
    expect(arc.arcCompletionScore).toBeLessThanOrEqual(100);
    expect(typeof arc.arcCoherenceScore).toBe('number');
    expect(arc.suggestions).toBeInstanceOf(Array);
    expect(arc.transitionPoints).toBeInstanceOf(Array);
  });

  it('assessCharacterArc uses LLM-backed path when client is provided', async () => {
    const llm = {
      generateJson: vi.fn().mockResolvedValueOnce({
        arcType: 'redemption_arc',
        arcTypeLabel: '救赎弧线',
        stages: [
          { stage: 'setup', detected: true, confidence: 0.9, evidence: ['林岚初登场时为冷漠孤僻的性格'], position: 0 },
          { stage: 'catalyst', detected: true, confidence: 0.85, evidence: ['她被迫介入一起案件'], position: 1 },
          { stage: 'struggle', detected: true, confidence: 0.7, evidence: ['她与内心恐惧反复对抗'], position: 2 },
          { stage: 'turning_point', detected: true, confidence: 0.8, evidence: ['她在关键时刻选择保护弱者'], position: 3 },
          { stage: 'transformation', detected: true, confidence: 0.75, evidence: ['她逐渐接受自己柔软的一面'], position: 4 },
          { stage: 'new_equilibrium', detected: true, confidence: 0.65, evidence: ['她找到了内心的平静'], position: 5 },
        ],
        transitionPoints: [
          { from: 'struggle', to: 'turning_point', evidence: '保护弱者让她超越自我', position: 10 },
        ],
        arcCompletionScore: 88,
        arcCoherenceScore: 90,
        suggestions: ['弧线完整，可加强转变的细节描写'],
      }),
    };
    const system = new CharacterDepthSystem(llm);

    const arc = await system.assessCharacterArc(
      { name: '林岚', role: '侦探' },
      '她从冷漠到关怀，最终完成了自我救赎。',
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(arc.arcType).toBe(CharacterArcType.REDEMPTION_ARC);
    expect(arc.arcTypeLabel).toBe('救赎弧线');
    expect(arc.stages).toHaveLength(6);
    expect(arc.transitionPoints).toHaveLength(1);
    expect(arc.transitionPoints[0].from).toBe(ArcStage.STRUGGLE);
    expect(arc.transitionPoints[0].to).toBe(ArcStage.TURNING_POINT);
    expect(arc.arcCompletionScore).toBe(88);
    expect(arc.arcCoherenceScore).toBe(90);
    expect(arc.suggestions).toContain('弧线完整，可加强转变的细节描写');
  });

  it('assessCharacterArc keyword detection: default mock returns maturation_arc with detected stages', async () => {
    const system = new CharacterDepthSystem();
    const arc = await system.assessCharacterArc({ name: '测试角色' }, '任意内容');

    expect(arc.arcType).toBe(CharacterArcType.MATURATION_ARC);
    expect(arc.stages.filter((s) => s.detected)).toHaveLength(3);
    expect(arc.stages.filter((s) => !s.detected)).toHaveLength(3);
  });
});

describe('CharacterDepthSystem — M14 OCEAN profile (Big Five)', () => {
  it('OCEANDimension has all 5 entries', () => {
    const values = Object.values(OCEANDimension);
    expect(values).toHaveLength(5);
    expect(values).toContain('openness');
    expect(values).toContain('conscientiousness');
    expect(values).toContain('extraversion');
    expect(values).toContain('agreeableness');
    expect(values).toContain('neuroticism');
  });

  it('profileOCEAN returns OCEANProfile with 5 dimensions in mock mode', async () => {
    const system = new CharacterDepthSystem();
    const profile = await system.profileOCEAN(
      '林岚',
      { name: '林岚', role: '侦探' },
      '她好奇心旺盛，但做事一丝不苟，社交场合进退有度，待人和善，情绪平稳。',
    );

    expect(profile.characterName).toBe('林岚');
    expect(profile.dimensions).toHaveLength(5);

    const dimNames = profile.dimensions.map((d) => d.dimension);
    expect(dimNames).toContain(OCEANDimension.OPENNESS);
    expect(dimNames).toContain(OCEANDimension.CONSCIENTIOUSNESS);
    expect(dimNames).toContain(OCEANDimension.EXTRAVERSION);
    expect(dimNames).toContain(OCEANDimension.AGREEABLENESS);
    expect(dimNames).toContain(OCEANDimension.NEUROTICISM);

    for (const d of profile.dimensions) {
      expect(d.score).toBeGreaterThanOrEqual(0);
      expect(d.score).toBeLessThanOrEqual(10);
      expect(typeof d.confidence).toBe('number');
      expect(d.evidence).toBeInstanceOf(Array);
      expect(d.traits).toBeInstanceOf(Array);
    }

    expect(profile.overallProfile).toBeTruthy();
    expect(profile.suggestions).toBeInstanceOf(Array);
  });

  it('profileOCEAN uses LLM-backed path with explicit scores', async () => {
    const llm = {
      generateJson: vi.fn().mockResolvedValueOnce({
        dimensions: [
          { dimension: 'openness', label: '开放性', score: 8, confidence: 0.85, evidence: ['她乐于探索未知线索'], traits: ['好奇', '创新'] },
          { dimension: 'conscientiousness', label: '尽责性', score: 9, confidence: 0.9, evidence: ['她一丝不苟地记录每条线索'], traits: ['自律', '严谨'] },
          { dimension: 'extraversion', label: '外向性', score: 3, confidence: 0.8, evidence: ['她倾向于独自工作'], traits: ['内向', '沉静'] },
          { dimension: 'agreeableness', label: '宜人性', score: 6, confidence: 0.7, evidence: ['她对受害者展示同理心'], traits: ['合作'] },
          { dimension: 'neuroticism', label: '神经质', score: 4, confidence: 0.75, evidence: ['面对压力她保持冷静'], traits: ['情绪稳定'] },
        ],
        overallProfile: '林岚呈现典型的侦探人格画像：高尽责性、高开放性、低外向性，情绪稳定且具备适度的宜人性。',
        suggestions: ['可增强社交互动场景以丰富外向性维度'],
      }),
    };
    const system = new CharacterDepthSystem(llm);

    const profile = await system.profileOCEAN(
      '林岚',
      { name: '林岚', role: '侦探' },
      '她独自一人在深夜翻阅案卷，不放过任何蛛丝马迹，偶尔走出家门与目击者交谈。',
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(1);
    expect(profile.characterName).toBe('林岚');
    expect(profile.dimensions).toHaveLength(5);
    expect(profile.dimensions[0].score).toBe(8);   // openness
    expect(profile.dimensions[1].score).toBe(9);   // conscientiousness
    expect(profile.dimensions[2].score).toBe(3);   // extraversion
    expect(profile.dimensions[3].score).toBe(6);   // agreeableness
    expect(profile.dimensions[4].score).toBe(4);   // neuroticism
    expect(profile.overallProfile).toContain('高尽责性');
    expect(profile.suggestions).toHaveLength(1);
  });

  it('profileOCEAN keyword detection: all dimensions get scored', async () => {
    const system = new CharacterDepthSystem();
    const profile = await system.profileOCEAN(
      '李渔',
      { name: '李渔' },
      '他固守自己的书屋，日复一日整理古籍，极少出门。',
    );

    const dimensionScores = new Map(profile.dimensions.map((d) => [d.dimension, d.score]));
    expect(dimensionScores.has(OCEANDimension.OPENNESS)).toBe(true);
    expect(dimensionScores.has(OCEANDimension.CONSCIENTIOUSNESS)).toBe(true);
    expect(dimensionScores.has(OCEANDimension.EXTRAVERSION)).toBe(true);
    expect(dimensionScores.has(OCEANDimension.AGREEABLENESS)).toBe(true);
    expect(dimensionScores.has(OCEANDimension.NEUROTICISM)).toBe(true);
  });
});