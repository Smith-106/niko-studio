import { describe, expect, it, vi } from 'vitest';

import {
  addEccentricityQuirk,
  addRelationship as addRelationshipHelper,
  CharacterManager,
  DepthLevel,
  EmotionalState,
  getDepthLevel,
  getDualConflictPotential,
  getEmotionTrajectory,
  getOverallScore,
  getRelationship,
  getRelationshipsByType,
  GrowthStage,
  MotivationType,
  PersonalityType,
  RelationshipType,
} from '../../narrative/character-manager';

describe('character-manager additional coverage', () => {
  it('covers exported helper utilities and depth thresholds', () => {
    const trajectory = getEmotionTrajectory({
      staticEmotion: '平静',
      dynamicEmotion: '坚定',
      intensity: 70,
      evolution: [
        ['scene-1', '焦虑'],
        ['scene-2', '愤怒'],
      ],
    });
    expect(trajectory).toEqual(['平静', '焦虑', '愤怒', '坚定']);

    const eccentricity = {
      quirks: [] as string[],
      obsessions: [] as string[],
      unusualHabits: [] as string[],
      uniqueWorldview: '',
      catchphrases: [],
      eccentricityLevel: 40,
    };
    addEccentricityQuirk(eccentricity, '总把钢笔摆成直线');
    addEccentricityQuirk(eccentricity, '收集旧报纸', 'obsessions');
    addEccentricityQuirk(eccentricity, '深夜擦拭门把手', 'habits');
    expect(eccentricity).toMatchObject({
      quirks: ['总把钢笔摆成直线'],
      obsessions: ['收集旧报纸'],
      unusualHabits: ['深夜擦拭门把手'],
    });

    const conflict = getDualConflictPotential({
      primaryPersona: {
        name: '白昼的她',
        traits: ['克制'],
        triggerConditions: [],
        behaviorPatterns: ['先观察'],
      },
      shadowPersona: {
        name: '暗面的她',
        traits: ['偏执'],
        triggerConditions: ['受辱'],
        behaviorPatterns: ['立刻反击'],
      },
      internalConflict: '秩序与报复冲突',
      switchTriggers: ['被背叛'],
      conflictScenarios: ['面对旧友'],
      dualityScore: 82,
    });
    expect(conflict).toContain('白昼的她');
    expect(conflict).toContain('暗面的她');

    const relationships = {
      connections: [] as Array<{
        targetId: string;
        targetName: string;
        type: RelationshipType;
        trustLevel: number;
        powerBalance: number;
        emotionalBond: number;
        conflictPotential: number;
        history: string;
        currentStatus: string;
        tensionPoints: string[];
      }>,
      socialRole: '调查员',
      groupAffiliations: ['特别行动组'],
    };
    addRelationshipHelper(relationships, {
      targetId: 'ally-1',
      targetName: '同伴',
      type: RelationshipType.ALLY,
      trustLevel: 78,
      powerBalance: 45,
      emotionalBond: 60,
      conflictPotential: 25,
      history: '并肩破案',
      currentStatus: '合作',
      tensionPoints: [],
    });
    addRelationshipHelper(relationships, {
      targetId: 'friend-1',
      targetName: '朋友',
      type: RelationshipType.FRIENDSHIP,
      trustLevel: 88,
      powerBalance: 50,
      emotionalBond: 80,
      conflictPotential: 10,
      history: '多年相识',
      currentStatus: '稳定',
      tensionPoints: [],
    });
    expect(getRelationship(relationships, 'ally-1')?.targetName).toBe('同伴');
    expect(getRelationship(relationships, 'missing')).toBeNull();
    expect(getRelationshipsByType(relationships, RelationshipType.FRIENDSHIP)).toHaveLength(1);

    expect(getOverallScore({
      dynamicScore: 40,
      competenceScore: 50,
      eccentricityScore: 60,
      contrastScore: 70,
      dualityScore: 80,
    })).toBe(63.5);
    expect(getDepthLevel({
      dynamicScore: 40,
      competenceScore: 40,
      eccentricityScore: 40,
      contrastScore: 40,
      dualityScore: 40,
    })).toBe(DepthLevel.FLAT);
    expect(getDepthLevel({
      dynamicScore: 55,
      competenceScore: 55,
      eccentricityScore: 55,
      contrastScore: 55,
      dualityScore: 55,
    })).toBe(DepthLevel.MODERATE);
    expect(getDepthLevel({
      dynamicScore: 75,
      competenceScore: 75,
      eccentricityScore: 75,
      contrastScore: 75,
      dualityScore: 75,
    })).toBe(DepthLevel.DEEP);
    expect(getDepthLevel({
      dynamicScore: 90,
      competenceScore: 90,
      eccentricityScore: 90,
      contrastScore: 90,
      dualityScore: 90,
    })).toBe(DepthLevel.UNFORGETTABLE);
  });

  it('covers CRUD fallbacks and five-dimension setup failures', () => {
    const manager = new CharacterManager();
    const alpha = manager.createCharacter('顾沉', 'mentor');
    const beta = manager.createCharacter('洛遥', 'supporting');

    expect(manager.getCharacter('missing')).toBeNull();
    expect(manager.getByName('missing')).toBeNull();
    expect(manager.updateCharacter('missing', { role: 'ghost' })).toBe(false);
    expect(manager.deleteCharacter('missing')).toBe(false);
    expect(manager.listCharacters('mentor').map((char) => char.name)).toEqual(['顾沉']);
    expect(manager.deleteCharacter(alpha.id)).toBe(true);
    expect(manager.getByName('顾沉')).toBeNull();
    expect(manager.listCharacters().map((char) => char.name)).toEqual(['洛遥']);

    expect(manager.setDynamicEmotion('missing', '冷静', '焦虑')).toBe(false);
    expect(manager.evolveEmotion('missing', 'scene-1', '愤怒')).toBe(false);
    expect(manager.evolveEmotion(beta.id, 'scene-1', '愤怒')).toBe(false);
    expect(manager.setCompetence('missing', '推理')).toBe(false);
    expect(manager.addCompetenceDemonstration(beta.id, 'scene-1', '推断', '得出结论')).toBe(false);
    expect(manager.setEccentricity('missing', { quirks: ['敲桌面'] })).toBe(false);
    expect(manager.setEnvironmentContrast('missing', '家中', '审讯室')).toBe(false);
    expect(manager.setDualPersonality('missing', {
      primaryName: '表层',
      primaryTraits: ['平静'],
      primaryPatterns: ['回避'],
      shadowName: '深层',
      shadowTraits: ['暴烈'],
      shadowPatterns: ['报复'],
      internalConflict: '克制与爆发',
    })).toBe(false);
  });

  it('covers depth assessment, dialogue branches and state comparison', () => {
    const manager = new CharacterManager();
    const protagonist = manager.createCharacter('季衡', 'protagonist');

    expect(manager.getDepthAssessment('missing')).toEqual({ error: 'Character not found' });
    expect(manager.getDepthAssessment(protagonist.id)).toMatchObject({
      character: '季衡',
      depth_level: DepthLevel.FLAT,
    });
    expect((manager.getDepthAssessment(protagonist.id).suggestions as string[])).toHaveLength(5);

    expect(manager.setDialogueStyle('missing', { formality: 'casual' })).toBe(false);
    expect(manager.addDialogueSample('missing', 'scene-0', '没人会听见')).toBe(false);
    expect(manager.checkDialogueConsistency('missing', '测试')).toEqual({ error: 'Character not found' });
    expect(manager.checkDialogueConsistency(protagonist.id, '先观察情况。')).toEqual({
      warning: 'No dialogue style defined',
      consistent: true,
    });

    manager.setDialogueStyle(protagonist.id, {
      formality: 'casual',
      emotionalExpression: 'expressive',
      verbalTics: ['老实说'],
      favoriteWords: ['其实'],
      speechPatterns: ['反问'],
    });
    manager.getCharacter(protagonist.id)!.dialogueStyle!.avoidedWords = ['禁词'];
    expect(manager.addDialogueSample(protagonist.id, 'scene-1', '老实说，这事没那么简单！')).toBe(true);

    const dialogueCheck = manager.checkDialogueConsistency(
      protagonist.id,
      '请问您是否愿意接受这个禁词安排。嗯，哦，好的。',
    );
    expect(dialogueCheck.consistent).toBe(false);
    expect((dialogueCheck.issues as string[]).length).toBeGreaterThanOrEqual(3);

    manager.setDialogueStyle(protagonist.id, {
      formality: 'formal',
      emotionalExpression: 'reserved',
    });
    const reservedMismatch = manager.checkDialogueConsistency(
      protagonist.id,
      '嘿，哟，呐，咋?!...~',
    );
    expect(reservedMismatch.consistent).toBe(false);
    expect(reservedMismatch.issues).toEqual(
      expect.arrayContaining([
        '对话过于随意，与角色正式风格不符',
        '情感表达过于强烈，与角色内敛风格不符',
      ]),
    );

    expect(manager.getCharacterTimeline('missing')).toEqual([]);

    manager.recordState(protagonist.id, {
      sceneId: 'scene-a',
      location: '旧城区',
      emotionalState: EmotionalState.FEAR,
      physicalCondition: 'injured',
      knowledge: ['线索 A'],
      possessions: ['怀表'],
    });
    manager.recordState(protagonist.id, {
      sceneId: 'scene-b',
      location: '港口',
      emotionalState: EmotionalState.JOY,
      physicalCondition: 'normal',
      knowledge: ['线索 A', '线索 B'],
      possessions: ['车票'],
    });
    expect(manager.compareStates('missing', 'scene-a', 'scene-b')).toEqual({ error: 'Character not found' });
    expect(manager.compareStates(protagonist.id, 'scene-a', 'scene-x')).toEqual({ error: 'State not found' });
    expect(manager.compareStates(protagonist.id, 'scene-a', 'scene-b')).toMatchObject({
      character: '季衡',
      scene_a: 'scene-a',
      scene_b: 'scene-b',
      changes: {
        location: { from: '旧城区', to: '港口' },
        emotional_state: { from: EmotionalState.FEAR, to: EmotionalState.JOY },
        physical_condition: { from: 'injured', to: 'normal' },
        knowledge_gained: ['线索 B'],
        possessions_changed: {
          gained: ['车票'],
          lost: ['怀表'],
        },
      },
    });
  });

  it('covers relationship management, growth progression and aggregate validation', () => {
    const manager = new CharacterManager();
    const main = manager.createCharacter('周既明', 'protagonist');
    const ally = manager.createCharacter('闻笙', 'supporting');
    const extraCharacters = Array.from({ length: 5 }, (_, index) =>
      manager.createCharacter(`朋友-${index + 1}`, 'supporting'),
    );

    expect(manager.addRelationship('missing', ally.id, RelationshipType.ALLY)).toBe(false);
    expect(manager.addRelationship(main.id, 'missing', RelationshipType.ALLY)).toBe(false);
    expect(manager.addRelationship(main.id, ally.id, RelationshipType.FRIENDSHIP, 95, '共同经历生死')).toBe(true);
    for (const friend of extraCharacters) {
      expect(manager.addRelationship(main.id, friend.id, RelationshipType.FRIENDSHIP, 60)).toBe(true);
    }

    expect(manager.updateRelationship('missing', ally.id, 10)).toBe(false);
    expect(manager.updateRelationship(main.id, 'ghost', 10)).toBe(false);
    expect(manager.updateRelationship(main.id, ally.id, 30, -80, '决裂')).toBe(true);
    expect(manager.updateRelationship(main.id, ally.id, 50, 200)).toBe(true);

    const network = manager.getRelationshipNetwork();
    expect(network.nodes).toHaveLength(7);
    expect(network.edges).toHaveLength(6);
    expect(network.edges[0]).toMatchObject({
      source: main.id,
      target: ally.id,
      type: RelationshipType.FRIENDSHIP,
      trust: 100,
    });

    expect(manager.advanceGrowth('missing', GrowthStage.ORDEAL)).toBe(false);
    expect(manager.advanceGrowth(main.id, GrowthStage.ORDEAL, '首次主动承担代价')).toBe(true);

    manager.updateCharacter(main.id, {
      personality: {
        ...main.personality,
        extraversion: 10,
      },
      motivation: {
        ...main.motivation,
        type: MotivationType.SURVIVAL,
        surfaceGoal: '实现自我实现',
      },
      growth: {
        ...main.growth,
        currentStage: GrowthStage.ORDINARY_WORLD,
        progress: 0.8,
      },
    });
    manager.recordState(main.id, {
      sceneId: 'scene-1',
      location: '隧道',
      physicalCondition: 'injured',
    });
    manager.recordState(main.id, {
      sceneId: 'scene-2',
      location: '废楼',
      physicalCondition: 'normal',
    });

    const mainValidation = manager.validateConsistency(main.id);
    expect(mainValidation.valid).toBe(false);
    expect((mainValidation.issues as string[]).length).toBeGreaterThanOrEqual(2);
    expect((mainValidation.warnings as string[]).length).toBeGreaterThanOrEqual(6);
    expect(manager.validateConsistency('missing')).toEqual({
      valid: false,
      error: 'Character not found',
    });

    const allValidation = manager.validateAll();
    expect(allValidation).toMatchObject({
      total_characters: 7,
    });
    expect((allValidation.results as Record<string, unknown>)[main.id]).toBeDefined();
    expect((allValidation.average_score as number)).toBeGreaterThanOrEqual(0);
  });

  it('covers export and import branches including defaults, deserializers and failures', () => {
    const manager = new CharacterManager();
    const source = manager.createCharacter('沈砚', 'mentor');
    const peer = manager.createCharacter('顾时', 'supporting');

    manager.setDialogueStyle(source.id, {
      formality: 'formal',
      emotionalExpression: 'reserved',
      verbalTics: ['请稍等'],
    });
    manager.addDialogueSample(source.id, 'scene-1', '请稍等，我们还需要核对细节。');
    manager.addRelationship(source.id, peer.id, RelationshipType.MENTOR, 82, '长期指导关系');

    const exported = manager.exportAll();
    expect((exported.characters as Record<string, unknown>)[source.id]).toBeDefined();
    expect((exported.relationship_network as { edges: unknown[] }).edges).toHaveLength(1);

    const importer = new CharacterManager();
    const minimal = importer.importCharacter({
      id: 'minimal-role',
      name: '简角',
    });
    expect(minimal?.personality.type).toBe(PersonalityType.ANALYST);
    expect(minimal?.growth.currentStage).toBe(GrowthStage.ORDINARY_WORLD);

    const hydrated = importer.importCharacter({
      id: 'hydrated-role',
      name: '导入角色',
      role: 'antagonist',
      personality: {
        type: 'invalid-type',
        core_traits: ['冷硬'],
        strengths: ['谋划'],
        weaknesses: ['迟疑'],
        quirks: ['反复摩挲袖口'],
        speech_patterns: ['多用反问'],
        values: ['控制'],
        big_five: { openness: 61 },
      },
      background: {
        birth_place: '北境',
        family_structure: '单亲',
        social_class: '下层',
        education: '自学',
        occupation: '情报贩子',
        childhood_events: [{ age: 9, description: '失火', impact: '怕黑' }],
        formative_events: [{ age: 18, description: '背叛', impact: '不信任任何人' }],
        trauma: [{ description: '围捕', impact: '长期戒备', emotional_residue: '惊醒' }],
        gifts: ['记忆力'],
        secrets: ['真实身份'],
      },
      motivation: {
        type: 'unknown',
        surface_goal: '夺回据点',
      },
      relationships: {
        social_role: '中间人',
        group_affiliations: ['灰港同盟'],
        connections: [{
          target_id: 't-1',
          target_name: '旧部',
          type: 'bad-type',
          history: '互相利用',
        }],
      },
      growth: {
        current_stage: 'not-a-stage',
        progress: 0.25,
        arc_type: 'negative',
      },
      dynamic_emotion: {},
      competence: {},
      eccentricity: {},
      environment_contrast: {},
      dual_personality: {},
      dialogue_style: {
        formality: 'casual',
        favorite_words: ['喂'],
        avoided_words: ['您'],
        speech_patterns: ['短句'],
        verbal_tics: ['嘛'],
        emotional_expression: 'expressive',
      },
    });

    expect(hydrated).not.toBeNull();
    expect(hydrated?.role).toBe('antagonist');
    expect(hydrated?.personality.type).toBe(PersonalityType.ANALYST);
    expect(hydrated?.personality.openness).toBe(61);
    expect(hydrated?.background.trauma[0].emotionalResidue).toBe('惊醒');
    expect(hydrated?.motivation.type).toBe(MotivationType.SELF_ACTUALIZATION);
    expect(hydrated?.relationships.socialRole).toBe('中间人');
    expect(hydrated?.relationships.connections[0].type).toBe(RelationshipType.ACQUAINTANCE);
    expect(hydrated?.growth.currentStage).toBe(GrowthStage.ORDINARY_WORLD);
    expect(hydrated?.dynamicEmotion?.intensity).toBe(50);
    expect(hydrated?.competence?.skillLevel).toBe(75);
    expect(hydrated?.eccentricity?.eccentricityLevel).toBe(50);
    expect(hydrated?.environmentContrast?.contrastScore).toBe(50);
    expect(hydrated?.dualPersonality?.dualityScore).toBe(50);
    expect(hydrated?.dialogueStyle?.formality).toBe('casual');
    expect(hydrated?.dialogueStyle?.verbalTics).toEqual(['嘛']);

    const defaultsHydrated = importer.importCharacter({
      id: 'defaults-role',
      name: '默认角色',
      growth: {},
      dialogue_style: {},
    });
    expect(defaultsHydrated?.growth.progress).toBe(0);
    expect(defaultsHydrated?.dialogueStyle).toMatchObject({
      formality: 'neutral',
      favoriteWords: [],
      avoidedWords: [],
      speechPatterns: [],
      verbalTics: [],
      emotionalExpression: 'moderate',
    });

    const growthWithThrowingStage: Record<string, unknown> = {};
    Object.defineProperty(growthWithThrowingStage, 'current_stage', {
      get() {
        throw new Error('stage broken');
      },
    });

    const branchHydrated = importer.importCharacter({
      id: 'branch-role',
      name: '分支角色',
      relationships: {
        connections: [
          {
            target_id: 'target-1',
            target_name: '目标',
            type: RelationshipType.ENEMY,
            trust_level: 12,
            power_balance: 34,
            emotional_bond: 56,
            conflict_potential: 78,
            history: '旧怨',
            current_status: '对立',
            tension_points: ['误会'],
          },
        ],
      },
      growth: growthWithThrowingStage,
    });
    expect(branchHydrated?.relationships.connections[0]).toMatchObject({
      targetId: 'target-1',
      targetName: '目标',
      type: RelationshipType.ENEMY,
      trustLevel: 12,
      powerBalance: 34,
      emotionalBond: 56,
      conflictPotential: 78,
      history: '旧怨',
      currentStatus: '对立',
      tensionPoints: ['误会'],
    });
    expect(branchHydrated?.growth.currentStage).toBe(GrowthStage.ORDINARY_WORLD);

    expect(importer.importCharacter({ name: '缺少 id' } as Record<string, unknown>)).toBeNull();

    const throwingPayload = {};
    Object.defineProperty(throwingPayload, 'id', {
      get() {
        throw new Error('boom');
      },
    });
    expect(importer.importCharacter(throwingPayload as Record<string, unknown>)).toBeNull();
  });

  it('covers remaining manager fallback branches for defaults and validation aggregation', () => {
    const manager = new CharacterManager();
    const character = manager.createCharacter('余烬', 'supporting');

    expect(manager.setEccentricity(character.id, {})).toBe(true);
    expect(manager.setEnvironmentContrast(character.id, '旧居', '异乡', 'unexpected' as never)).toBe(true);
    expect(manager.setDialogueStyle(character.id, {})).toBe(true);

    const state = manager.recordState(character.id, { sceneId: 'scene-defaults' });
    expect(state).toMatchObject({
      sceneId: 'scene-defaults',
      location: '',
      physicalCondition: 'normal',
      possessions: [],
      emotionalState: EmotionalState.NEUTRAL,
      emotionalIntensity: 50,
      currentGoal: '',
      knowledge: [],
    });
    expect(manager.recordState('missing', { sceneId: 'scene-missing' })).toBeNull();

    expect(manager.getCharacter(character.id)?.eccentricity?.eccentricityLevel).toBe(50);
    expect(manager.getCharacter(character.id)?.environmentContrast?.contrastScore).toBe(50);
    expect(manager.getCharacter(character.id)?.dialogueStyle).toMatchObject({
      formality: 'neutral',
      emotionalExpression: 'moderate',
    });

    const internals = manager as unknown as {
      nameIndex: Map<string, string>;
    };
    internals.nameIndex.set('幽灵索引', 'ghost-id');
    expect(manager.getByName('幽灵索引')).toBeNull();

    const emptyManager = new CharacterManager();
    expect(emptyManager.validateAll()).toEqual({
      total_characters: 0,
      average_score: 0,
      results: {},
    });

    const validationSpy = vi
      .spyOn(manager, 'validateConsistency')
      .mockReturnValueOnce({ valid: true } as Record<string, unknown>);

    expect(manager.validateAll()).toMatchObject({
      total_characters: 1,
      average_score: 0,
    });

    validationSpy.mockRestore();
  });

  it('covers remaining nested deserializer fallback branches during import', () => {
    const importer = new CharacterManager();

    const partialDefaults = importer.importCharacter({
      id: 'fallback-role',
      name: '回退角色',
      personality: {},
      background: {
        childhood_events: [{}],
        formative_events: [{}],
        trauma: [{}],
      },
      motivation: {},
      relationships: {
        connections: [{}],
      },
      growth: {},
      dynamic_emotion: {},
      competence: {},
      eccentricity: {},
      environment_contrast: {},
      dual_personality: {},
      dialogue_style: {},
    });

    expect(partialDefaults).not.toBeNull();
    expect(partialDefaults?.personality).toMatchObject({
      type: PersonalityType.ANALYST,
      coreTraits: [],
      strengths: [],
      weaknesses: [],
      quirks: [],
      speechPatterns: [],
      values: [],
      openness: 50,
      conscientiousness: 50,
      extraversion: 50,
      agreeableness: 50,
      neuroticism: 50,
    });
    expect(partialDefaults?.background).toMatchObject({
      birthPlace: '未知',
      familyStructure: '普通家庭',
      socialClass: '中产',
      education: '普通教育',
      occupation: '未知',
      gifts: [],
      secrets: [],
    });
    expect(partialDefaults?.background.childhoodEvents[0]).toMatchObject({
      age: null,
      description: '',
      impact: '',
      emotionalResidue: '',
    });
    expect(partialDefaults?.background.formativeEvents[0]).toMatchObject({
      age: null,
      description: '',
      impact: '',
      emotionalResidue: '',
    });
    expect(partialDefaults?.background.trauma[0]).toMatchObject({
      age: null,
      description: '',
      impact: '',
      emotionalResidue: '',
    });
    expect(partialDefaults?.motivation).toMatchObject({
      type: MotivationType.SELF_ACTUALIZATION,
      surfaceGoal: '待定',
      deepNeed: '待定',
      innerFear: '待定',
      want: '待定',
      need: '待定',
      lie: '待定',
      ghost: '待定',
      stakes: [],
    });
    expect(partialDefaults?.relationships).toMatchObject({
      socialRole: '',
      groupAffiliations: [],
    });
    expect(partialDefaults?.relationships.connections[0]).toMatchObject({
      targetId: '',
      targetName: '',
      type: RelationshipType.ACQUAINTANCE,
      trustLevel: 50,
      powerBalance: 50,
      emotionalBond: 50,
      conflictPotential: 50,
      history: '',
      currentStatus: '',
      tensionPoints: [],
    });

    const backgroundArrayFallbacks = importer.importCharacter({
      id: 'background-array-fallbacks',
      name: '背景数组回退',
      background: {},
    });

    expect(backgroundArrayFallbacks?.background.childhoodEvents).toEqual([]);
    expect(backgroundArrayFallbacks?.background.formativeEvents).toEqual([]);
    expect(backgroundArrayFallbacks?.background.trauma).toEqual([]);

    const personalityWithThrowingType: Record<string, unknown> = {};
    Object.defineProperty(personalityWithThrowingType, 'type', {
      get() {
        throw new Error('broken personality type');
      },
    });

    const motivationWithThrowingType: Record<string, unknown> = {};
    Object.defineProperty(motivationWithThrowingType, 'type', {
      get() {
        throw new Error('broken motivation type');
      },
    });

    const relationshipWithThrowingType: Record<string, unknown> = {};
    Object.defineProperty(relationshipWithThrowingType, 'type', {
      get() {
        throw new Error('broken relationship type');
      },
    });

    const throwingDefaults = importer.importCharacter({
      id: 'fallback-throwing-role',
      name: '抛错回退角色',
      personality: personalityWithThrowingType,
      motivation: motivationWithThrowingType,
      relationships: {
        connections: [relationshipWithThrowingType],
      },
    });

    expect(throwingDefaults).not.toBeNull();
    expect(throwingDefaults?.personality.type).toBe(PersonalityType.ANALYST);
    expect(throwingDefaults?.motivation.type).toBe(MotivationType.SELF_ACTUALIZATION);
    expect(throwingDefaults?.relationships.connections[0]).toMatchObject({
      type: RelationshipType.ACQUAINTANCE,
      targetId: '',
      targetName: '',
      history: '',
      currentStatus: '',
      tensionPoints: [],
    });
  });

  it('covers not-found branches for llm analysis helpers', async () => {
    const manager = new CharacterManager();

    await expect(manager.analyzeCharacter('missing', '内容')).resolves.toEqual({ error: 'Character not found' });
    await expect(manager.suggestDevelopment('missing')).resolves.toEqual({ error: 'Character not found' });
    await expect(manager.analyzeFiveDimensions('missing', '内容')).resolves.toEqual({ error: 'Character not found' });
  });
});
