import { describe, expect, it, vi } from 'vitest';

import {
  CharacterManager,
  EmotionalState,
  GrowthStage,
  MotivationType,
  PersonalityType,
  charToDict,
  getFiveDimensionScore,
} from '../../narrative/character-manager';

describe('CharacterManager', () => {
  it('creates characters and accumulates five-dimension score from configured dimensions', () => {
    const manager = new CharacterManager();
    const character = manager.createCharacter('林岚', 'protagonist');

    expect(manager.getByName('林岚')?.id).toBe(character.id);

    manager.setDynamicEmotion(character.id, '冷静', '焦虑', 80);
    manager.evolveEmotion(character.id, 'scene-1', '愤怒');
    manager.setCompetence(character.id, '侦查', 85, ['推理']);
    manager.addCompetenceDemonstration(character.id, 'scene-1', '识破谎言', '锁定嫌疑人');
    manager.setEccentricity(character.id, { quirks: ['总在记笔记'], eccentricityLevel: 70 });
    manager.setEnvironmentContrast(character.id, '档案室', '废弃剧院', 'high');
    manager.setDualPersonality(character.id, {
      primaryName: '理性林岚',
      primaryTraits: ['冷静'],
      primaryPatterns: ['先观察后行动'],
      shadowName: '冲动林岚',
      shadowTraits: ['偏执'],
      shadowPatterns: ['先行动后思考'],
      internalConflict: '真相与代价冲突',
      conflictScenarios: ['面对旧友'],
      dualityScore: 75,
    });

    const score = getFiveDimensionScore(manager.getCharacter(character.id)!);
    expect(score.dynamicScore).toBeGreaterThan(0);
    expect(score.competenceScore).toBeGreaterThan(0);
    expect(score.eccentricityScore).toBeGreaterThan(0);
    expect(score.contrastScore).toBeGreaterThan(0);
    expect(score.dualityScore).toBeGreaterThan(0);
  });

  it('tracks state history and dialogue consistency', () => {
    const manager = new CharacterManager();
    const character = manager.createCharacter('阿澈', 'supporting');

    manager.setDialogueStyle(character.id, {
      formality: 'formal',
      verbalTics: ['请听我说'],
      emotionalExpression: 'reserved',
    });

    const state = manager.recordState(character.id, {
      sceneId: 'scene-1',
      location: '医院',
      emotionalState: EmotionalState.ANGER,
      emotionalIntensity: 70,
      currentGoal: '找出幕后黑手',
      physicalCondition: 'injured',
    });
    manager.recordState(character.id, {
      sceneId: 'scene-2',
      location: '街头',
      emotionalState: EmotionalState.NEUTRAL,
      physicalCondition: 'normal',
    });

    const dialogueCheck = manager.checkDialogueConsistency(
      character.id,
      '喂，你最好现在就说清楚。',
    );
    const timeline = manager.getCharacterTimeline(character.id);

    expect(state?.sceneId).toBe('scene-1');
    expect(timeline).toHaveLength(2);
    expect(dialogueCheck.consistent).toBe(false);
    expect((dialogueCheck.issues as string[]).length).toBeGreaterThan(0);
  });

  it('exports and re-imports characters with configured dimensions', () => {
    const manager = new CharacterManager();
    const character = manager.createCharacter('周衡', 'mentor');

    manager.setDynamicEmotion(character.id, '克制', '担忧', 60);
    manager.setCompetence(character.id, '谈判', 78);
    manager.setEccentricity(character.id, { obsessions: ['钟表'], eccentricityLevel: 68 });
    manager.setEnvironmentContrast(character.id, '办公室', '地下赌场', 'extreme');
    manager.setDualPersonality(character.id, {
      primaryName: '白昼周衡',
      primaryTraits: ['克制'],
      primaryPatterns: ['保持距离'],
      shadowName: '黑夜周衡',
      shadowTraits: ['冷酷'],
      shadowPatterns: ['主动压迫'],
      internalConflict: '原则与生存冲突',
    });

    const payload = charToDict(manager.getCharacter(character.id)!);
    const restoredManager = new CharacterManager();
    const restored = restoredManager.importCharacter(payload);

    expect(restored?.name).toBe('周衡');
    expect(restored?.dynamicEmotion?.dynamicEmotion).toBe('担忧');
    expect(restored?.competence?.primarySkill).toBe('谈判');
    expect(restored?.eccentricity?.obsessions).toContain('钟表');
    expect(restored?.environmentContrast?.contrastLevel).toBe('extreme');
    expect(restored?.dualPersonality?.primaryPersona.name).toBe('白昼周衡');
  });

  it('returns explicit degraded responses when llm is unavailable and still validates consistency', async () => {
    const manager = new CharacterManager();
    const character = manager.createCharacter('季宁', 'protagonist');

    manager.updateCharacter(character.id, {
      motivation: {
        type: MotivationType.SURVIVAL,
        surfaceGoal: '自我实现',
        deepNeed: '安全感',
        innerFear: '失去控制',
        want: '活下去',
        need: '信任他人',
        lie: '只能靠自己',
        ghost: '旧案失败',
        stakes: ['生命'],
      },
      personality: {
        type: PersonalityType.ANALYST,
        coreTraits: ['谨慎'],
        strengths: ['观察'],
        weaknesses: ['疏离'],
        quirks: [],
        speechPatterns: [],
        values: ['真相'],
        openness: 50,
        conscientiousness: 60,
        extraversion: 10,
        agreeableness: 40,
        neuroticism: 60,
      },
    });
    manager.recordState(character.id, {
      sceneId: 'scene-1',
      location: '街头',
      physicalCondition: 'injured',
    });
    manager.recordState(character.id, {
      sceneId: 'scene-2',
      location: '仓库',
      physicalCondition: 'normal',
    });

    const analysis = await manager.analyzeCharacter(character.id, '角色在本章仍然保持克制');
    const development = await manager.suggestDevelopment(character.id);
    const fiveDimensions = await manager.analyzeFiveDimensions(character.id, '角色在危机中展现能力');
    const consistency = manager.validateConsistency(character.id);

    expect(analysis).toMatchObject({
      character: '季宁',
      status: 'degraded',
      state: 'degraded',
      code: 'LLM_UNAVAILABLE',
      operation: 'character_analysis',
    });
    expect(development).toMatchObject({
      character: '季宁',
      status: 'degraded',
      state: 'degraded',
      code: 'LLM_UNAVAILABLE',
      operation: 'development_suggestions',
    });
    expect(fiveDimensions).toMatchObject({
      character: '季宁',
      status: 'degraded',
      state: 'degraded',
      code: 'LLM_UNAVAILABLE',
      operation: 'five_dimension_analysis',
    });
    expect(analysis).not.toHaveProperty('consistency_score');
    expect(development).not.toHaveProperty('next_stage');
    expect(fiveDimensions).not.toHaveProperty('dimensions');
    expect(fiveDimensions).not.toHaveProperty('overall');
    expect(consistency.valid).toBe(false);
    expect((consistency.issues as string[]).length).toBeGreaterThan(0);
  });

  it('returns llm-backed analysis payloads for character analysis helpers', async () => {
    const llm = {
      generateJson: vi.fn()
        .mockResolvedValueOnce({
          consistency_score: 0.82,
          summary: '角色状态整体稳定，但压力下会出现偏执倾向。',
        })
        .mockResolvedValueOnce({
          next_stage: '让季宁学会向同伴求助',
          suggestions: ['增加一次主动示弱的场景'],
        })
        .mockResolvedValueOnce({
          dimensions: {
            dynamic_emotion: 8,
            competence: 7,
            eccentricity: 6,
            environment_contrast: 8,
            dual_personality: 9,
          },
          overall: 7.6,
        }),
    };
    const manager = new CharacterManager(llm as never);
    const character = manager.createCharacter('季宁', 'protagonist');

    const analysis = await manager.analyzeCharacter(character.id, '角色在压力下仍努力维持冷静。');
    const development = await manager.suggestDevelopment(character.id);
    const fiveDimensions = await manager.analyzeFiveDimensions(
      character.id,
      '角色在危机中展现能力，也暴露出更强烈的双重人格冲突。',
    );

    expect(llm.generateJson).toHaveBeenCalledTimes(3);
    expect(analysis).toMatchObject({
      consistency_score: 0.82,
      summary: '角色状态整体稳定，但压力下会出现偏执倾向。',
    });
    expect(development).toMatchObject({
      next_stage: '让季宁学会向同伴求助',
      suggestions: ['增加一次主动示弱的场景'],
    });
    expect(fiveDimensions).toMatchObject({
      dimensions: {
        dynamic_emotion: 8,
        competence: 7,
        eccentricity: 6,
        environment_contrast: 8,
        dual_personality: 9,
      },
      overall: 7.6,
    });
  });
});
