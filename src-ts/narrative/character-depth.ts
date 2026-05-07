/**
 * Character Depth System
 *
 * Based on Frey's "How to Write a Damn Good Novel" character theory:
 * 1. Interesting & Knowledgeable
 * 2. Competent & Eccentric
 * 3. Contrast with Setting
 * 4. Dominant Emotion
 * 5. Dual Personality
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Dynamic Character State (M11 — BookWorld integration)
// ============================================================

export interface DynamicCharacterState {
  goals: string[];
  currentStates: string[];
  recentActions: string[];
  lastUpdated: string;
}

export function createEmptyDynamicState(): DynamicCharacterState {
  return {
    goals: [],
    currentStates: [],
    recentActions: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function mergeDynamicState(
  current: DynamicCharacterState,
  newGoals: string[],
  newStates: string[],
  newAction: string,
): DynamicCharacterState {
  return {
    goals: [...new Set([...current.goals, ...newGoals])].slice(-10),
    currentStates: newStates.length > 0 ? newStates : current.currentStates,
    recentActions: [...current.recentActions, newAction].slice(-20),
    lastUpdated: new Date().toISOString(),
  };
}

// ============================================================
// Enums (original)
// ============================================================

export enum CharacterTrait {
  INTERESTING = 'interesting',
  KNOWLEDGEABLE = 'knowledgeable',
  COMPETENT = 'competent',
  ECCENTRIC = 'eccentric',
  DUAL_PERSONALITY = 'dual_personality',
}

// ============================================================
// M14: McKee Character Arc + OCEAN Personality Model
// ============================================================

export enum CharacterArcType {
  POSITIVE_CHANGE = 'positive_change',
  NEGATIVE_CHANGE = 'negative_change',
  FLAT_ARC = 'flat_arc',
  TRAGIC_ARC = 'tragic_arc',
  REDEMPTION_ARC = 'redemption_arc',
  CORRUPTION_ARC = 'corruption_arc',
  MATURATION_ARC = 'maturation_arc',
  DISILLUSIONMENT_ARC = 'disillusionment_arc',
}

export enum ArcStage {
  SETUP = 'setup',
  CATALYST = 'catalyst',
  STRUGGLE = 'struggle',
  TURNING_POINT = 'turning_point',
  TRANSFORMATION = 'transformation',
  NEW_EQUILIBRIUM = 'new_equilibrium',
}

export interface ArcStageDetection {
  stage: ArcStage;
  detected: boolean;
  confidence: number;
  evidence: string[];
  position: number;
}

export interface ArcAssessment {
  arcType: CharacterArcType;
  arcTypeLabel: string;
  stages: ArcStageDetection[];
  transitionPoints: { from: ArcStage; to: ArcStage; evidence: string; position: number }[];
  arcCompletionScore: number;
  arcCoherenceScore: number;
  suggestions: string[];
}

export enum OCEANDimension {
  OPENNESS = 'openness',
  CONSCIENTIOUSNESS = 'conscientiousness',
  EXTRAVERSION = 'extraversion',
  AGREEABLENESS = 'agreeableness',
  NEUROTICISM = 'neuroticism',
}

export interface DimensionScore {
  dimension: OCEANDimension;
  label: string;
  score: number;
  confidence: number;
  evidence: string[];
  traits: string[];
}

export interface OCEANProfile {
  characterName: string;
  dimensions: DimensionScore[];
  overallProfile: string;
  suggestions: string[];
}

// ============================================================
// Data Types
// ============================================================

export interface DominantEmotion {
  staticEmotion: string;
  dynamicEmotion: string;
  evolution: string[];
}

export function createDominantEmotion(
  staticEmotion: string,
  dynamicEmotion: string,
): DominantEmotion {
  const evolution =
    staticEmotion !== dynamicEmotion
      ? [staticEmotion, dynamicEmotion]
      : [staticEmotion];
  return { staticEmotion, dynamicEmotion, evolution };
}

export function addEvolutionPoint(emotion: DominantEmotion, newEmotion: string): void {
  emotion.evolution.push(newEmotion);
  emotion.dynamicEmotion = newEmotion;
}

export interface Persona {
  name: string;
  traits: string[];
  triggerConditions: string[];
  behaviorPatterns: string[];
}

export interface DualPersonality {
  primaryPersona: Persona;
  shadowPersona: Persona;
  internalConflict: string;
  switchTriggers: string[];
}

export function getConflictPotential(dp: DualPersonality): string {
  return `当${dp.primaryPersona.name}必须面对${dp.shadowPersona.name}的需求时，内心冲突将达到顶峰`;
}

export interface CharacterDepthScore {
  trait: CharacterTrait;
  score: number;
  evidence: string[];
  issues: string[];
  suggestions: string[];
}

export interface CharacterDepthResult {
  characterName: string;
  interestScore: CharacterDepthScore;
  competenceScore: CharacterDepthScore;
  eccentricityScore: CharacterDepthScore;
  environmentContrastScore: CharacterDepthScore;
  dualPersonalityScore: CharacterDepthScore;
  dominantEmotion: DominantEmotion | null;
  dualPersonality: DualPersonality | null;
  overallScore: number;
  depthLevel: string;
}

export function computeCharacterDepthResult(
  characterName: string,
  interestScore: CharacterDepthScore,
  competenceScore: CharacterDepthScore,
  eccentricityScore: CharacterDepthScore,
  environmentContrastScore: CharacterDepthScore,
  dualPersonalityScore: CharacterDepthScore,
  dualPersonality: DualPersonality | null,
): CharacterDepthResult {
  const overallScore =
    (interestScore.score * 0.2 +
      competenceScore.score * 0.15 +
      eccentricityScore.score * 0.15 +
      environmentContrastScore.score * 0.2 +
      dualPersonalityScore.score * 0.3) *
    10;

  let depthLevel: string;
  if (overallScore >= 85) depthLevel = 'UNFORGETTABLE';
  else if (overallScore >= 70) depthLevel = 'DEEP';
  else if (overallScore >= 50) depthLevel = 'MODERATE';
  else depthLevel = 'FLAT';

  return {
    characterName,
    interestScore,
    competenceScore,
    eccentricityScore,
    environmentContrastScore,
    dualPersonalityScore,
    dominantEmotion: null,
    dualPersonality,
    overallScore,
    depthLevel,
  };
}

// ============================================================
// LLM Prompts
// ============================================================

const CHARACTER_INTEREST_PROMPT = `
## 角色趣味性评估 (Character Interest Assessment)

分析以下角色是否足够有趣和知识渊博。

**评估要点**:
1. 角色是否有独特的经历？
2. 角色是否有坚定的想法或信念？
3. 角色是否有精神追求或特殊爱好？
4. 读者是否想更多地了解这个角色？

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
`;

const CHARACTER_ECCENTRICITY_PROMPT = `
## 角色古怪特质检测 (Eccentricity Detection)

分析角色是否具有古怪、令人难忘的特质。

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
`;

const DUAL_PERSONALITY_PROMPT = `
## 双重人格分析 (Dual Personality Analysis)

分析角色是否具有双重性——一个身体里存在两种截然不同的性格。

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
`;

const ENVIRONMENT_CONTRAST_PROMPT = `
## 人物与环境对比分析 (Environment Contrast Analysis)

分析角色是否被置于其不适应的环境中。

**角色信息**:
{character_info}

**环境设定**:
{environment_info}

**内容展示**:
{content}

请输出JSON格式:
`;

// ============================================================
// CharacterDepthSystem
// ============================================================

export class CharacterDepthSystem {
  private llmClient: INarrativeLLMClient | null;

  constructor(llmClient?: INarrativeLLMClient) {
    this.llmClient = llmClient ?? null;
  }

  async assessInterestLevel(
    characterInfo: Record<string, unknown>,
    content: string,
  ): Promise<CharacterDepthScore> {
    if (!this.llmClient) return this.mockInterestScore();

    const prompt = CHARACTER_INTEREST_PROMPT.replace(
      '{character_info}',
      JSON.stringify(characterInfo),
    ).replace('{content}', content);

    const result = await this.llmClient.generateJson<{
      score: number;
      evidence: string[];
      issues: string[];
      suggestions: string[];
    }>(prompt);

    return {
      trait: CharacterTrait.INTERESTING,
      score: result.score,
      evidence: result.evidence ?? [],
      issues: result.issues ?? [],
      suggestions: result.suggestions ?? [],
    };
  }

  async detectEccentricity(
    characterInfo: Record<string, unknown>,
    content: string,
  ): Promise<CharacterDepthScore> {
    if (!this.llmClient) return this.mockEccentricityScore();

    const prompt = CHARACTER_ECCENTRICITY_PROMPT.replace(
      '{character_info}',
      JSON.stringify(characterInfo),
    ).replace('{content}', content);

    const result = await this.llmClient.generateJson<{
      score: number;
      evidence: string[];
      issues: string[];
      suggestions: string[];
    }>(prompt);

    return {
      trait: CharacterTrait.ECCENTRIC,
      score: result.score,
      evidence: result.evidence ?? [],
      issues: result.issues ?? [],
      suggestions: result.suggestions ?? [],
    };
  }

  async mapDualPersonality(
    characterInfo: Record<string, unknown>,
    content: string,
  ): Promise<[CharacterDepthScore, DualPersonality | null]> {
    if (!this.llmClient) return [this.mockDualPersonalityScore(), null];

    const prompt = DUAL_PERSONALITY_PROMPT.replace(
      '{character_info}',
      JSON.stringify(characterInfo),
    ).replace('{content}', content);

    const result = await this.llmClient.generateJson<{
      has_dual_personality: boolean;
      score: number;
      primary_persona: { name: string; traits: string[]; behavior_patterns: string[] };
      shadow_persona: { name: string; traits: string[]; behavior_patterns: string[] };
      internal_conflict: string;
      switch_triggers: string[];
      dramatic_potential: string;
      suggestions: string[];
    }>(prompt);

    let dualPersonality: DualPersonality | null = null;
    if (result.has_dual_personality) {
      const primary = result.primary_persona ?? {};
      const shadow = result.shadow_persona ?? {};
      dualPersonality = {
        primaryPersona: {
          name: primary.name ?? '',
          traits: primary.traits ?? [],
          triggerConditions: [],
          behaviorPatterns: primary.behavior_patterns ?? [],
        },
        shadowPersona: {
          name: shadow.name ?? '',
          traits: shadow.traits ?? [],
          triggerConditions: [],
          behaviorPatterns: shadow.behavior_patterns ?? [],
        },
        internalConflict: result.internal_conflict ?? '',
        switchTriggers: result.switch_triggers ?? [],
      };
    }

    return [
      {
        trait: CharacterTrait.DUAL_PERSONALITY,
        score: result.score,
        evidence: [result.dramatic_potential ?? ''],
        issues: [],
        suggestions: result.suggestions ?? [],
      },
      dualPersonality,
    ];
  }

  async checkEnvironmentContrast(
    characterInfo: Record<string, unknown>,
    environmentInfo: Record<string, unknown>,
    content: string,
  ): Promise<CharacterDepthScore> {
    if (!this.llmClient) return this.mockEnvironmentContrastScore();

    const prompt = ENVIRONMENT_CONTRAST_PROMPT.replace(
      '{character_info}',
      JSON.stringify(characterInfo),
    )
      .replace('{environment_info}', JSON.stringify(environmentInfo))
      .replace('{content}', content);

    const result = await this.llmClient.generateJson<{
      score: number;
      evidence: string[];
      suggestions: string[];
    }>(prompt);

    return {
      trait: CharacterTrait.INTERESTING,
      score: result.score,
      evidence: result.evidence ?? [],
      issues: [],
      suggestions: result.suggestions ?? [],
    };
  }

  trackDominantEmotion(
    _characterName: string,
    staticEmotion: string,
    dynamicEmotion: string,
  ): DominantEmotion {
    return createDominantEmotion(staticEmotion, dynamicEmotion);
  }

  async evaluateFull(
    characterInfo: Record<string, unknown>,
    environmentInfo: Record<string, unknown>,
    content: string,
  ): Promise<CharacterDepthResult> {
    const interest = await this.assessInterestLevel(characterInfo, content);
    const eccentricity = await this.detectEccentricity(characterInfo, content);
    const [dualScore, dualPersonality] = await this.mapDualPersonality(
      characterInfo,
      content,
    );
    const environment = await this.checkEnvironmentContrast(
      characterInfo,
      environmentInfo,
      content,
    );
    const competence = this.mockCompetenceScore();

    return computeCharacterDepthResult(
      (characterInfo as Record<string, unknown>).name as string ?? 'Unknown',
      interest,
      competence,
      eccentricity,
      environment,
      dualScore,
      dualPersonality,
    );
  }

  // ============================================================
  // M14: Character Arc Assessment (McKee Model)
  // ============================================================

  async assessCharacterArc(
    characterInfo: Record<string, unknown>,
    content: string,
  ): Promise<ArcAssessment> {
    if (!this.llmClient) {
      console.log('MOCK PATH: returning mockArcAssessment');
      return this.mockArcAssessment();
    }

    console.log('LLM PATH: calling generateJson');
    const prompt = `
## 角色弧线评估 (Character Arc Assessment — McKee Model)

分析以下角色在内容中呈现的弧线结构。

**六个阶段**:
1. SETUP — 角色初始状态和世界观的建立
2. CATALYST — 打破平衡的催化事件
3. STRUGGLE — 角色与内外冲突的对抗
4. TURNING_POINT — 不可逆的转折点
5. TRANSFORMATION — 角色发生根本性变化
6. NEW_EQUILIBRIUM — 新的平衡状态

**八种弧线类型**:
- positive_change: 正向变化
- negative_change: 负向变化
- flat_arc: 平坦弧线
- tragic_arc: 悲剧弧线
- redemption_arc: 救赎弧线
- corruption_arc: 堕落弧线
- maturation_arc: 成长弧线
- disillusionment_arc: 幻灭弧线

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
{
  "arcType": "string (CharacterArcType value)",
  "arcTypeLabel": "中文标签",
  "stages": [
    { "stage": "ArcStage value", "detected": boolean, "confidence": number, "evidence": ["文本证据"], "position": number }
  ],
  "transitionPoints": [
    { "from": "ArcStage", "to": "ArcStage", "evidence": "转变证据", "position": number }
  ],
  "arcCompletionScore": number (0-100),
  "arcCoherenceScore": number (0-100),
  "suggestions": ["改进建议"]
}
`;

    const result = await this.llmClient.generateJson<{
      arcType: string;
      arcTypeLabel: string;
      stages: { stage: string; detected: boolean; confidence: number; evidence: string[]; position: number }[];
      transitionPoints: { from: string; to: string; evidence: string; position: number }[];
      arcCompletionScore: number;
      arcCoherenceScore: number;
      suggestions: string[];
    }>(prompt.replace('{character_info}', JSON.stringify(characterInfo)).replace('{content}', content));

    return {
      arcType: (result.arcType as CharacterArcType) ?? CharacterArcType.FLAT_ARC,
      arcTypeLabel: result.arcTypeLabel ?? '待定',
      stages: (result.stages ?? []).map((s) => ({
        stage: (s.stage as ArcStage) ?? ArcStage.SETUP,
        detected: s.detected ?? false,
        confidence: s.confidence ?? 0,
        evidence: s.evidence ?? [],
        position: s.position ?? 0,
      })),
      transitionPoints: (result.transitionPoints ?? []).map((tp) => ({
        from: (tp.from as ArcStage) ?? ArcStage.SETUP,
        to: (tp.to as ArcStage) ?? ArcStage.CATALYST,
        evidence: tp.evidence ?? '',
        position: tp.position ?? 0,
      })),
      arcCompletionScore: result.arcCompletionScore ?? 0,
      arcCoherenceScore: result.arcCoherenceScore ?? 0,
      suggestions: result.suggestions ?? [],
    };
  }

  // ============================================================
  // M14: OCEAN Personality Profiling (Big Five)
  // ============================================================

  async profileOCEAN(
    characterName: string,
    characterInfo: Record<string, unknown>,
    content: string,
  ): Promise<OCEANProfile> {
    if (!this.llmClient) return this.mockOCEANProfile(characterName);

    const prompt = `
## OCEAN人格画像 (Big Five Personality Profile)

基于大五人格模型 (OCEAN) 分析角色性格。

**五个维度**:
1. OPENNESS — 开放性：好奇心、创造力、对新鲜事物的接受度
2. CONSCIENTIOUSNESS — 尽责性：自律、责任感、目标导向
3. EXTRAVERSION — 外向性：社交倾向、活力、积极情绪
4. AGREEABLENESS — 宜人性：合作、同理心、信任他人
5. NEUROTICISM — 神经质：情绪稳定性、焦虑倾向、压力反应

每个维度评分 0-10 (低→高)。

**角色名称**: ${characterName}

**角色信息**:
{character_info}

**内容展示**:
{content}

请输出JSON格式:
{
  "dimensions": [
    { "dimension": "OCEANDimension value", "label": "中文标签", "score": number, "confidence": number, "evidence": ["文本证据"], "traits": ["特质标签"] }
  ],
  "overallProfile": "整体性格描述",
  "suggestions": ["改进建议"]
}
`;

    const result = await this.llmClient.generateJson<{
      dimensions: { dimension: string; label: string; score: number; confidence: number; evidence: string[]; traits: string[] }[];
      overallProfile: string;
      suggestions: string[];
    }>(prompt.replace('{character_info}', JSON.stringify(characterInfo)).replace('{content}', content));

    return {
      characterName,
      dimensions: (result.dimensions ?? []).map((d) => ({
        dimension: (d.dimension as OCEANDimension) ?? OCEANDimension.OPENNESS,
        label: d.label ?? '',
        score: d.score ?? 5,
        confidence: d.confidence ?? 0,
        evidence: d.evidence ?? [],
        traits: d.traits ?? [],
      })),
      overallProfile: result.overallProfile ?? '未能生成整体人格画像',
      suggestions: result.suggestions ?? [],
    };
  }

  // ============================================================
  // Mock methods
  // ============================================================

  private mockInterestScore(): CharacterDepthScore {
    return {
      trait: CharacterTrait.INTERESTING,
      score: 6.0,
      evidence: ['角色有一些独特背景'],
      issues: ['可以增加更多独特经历'],
      suggestions: ['考虑增加角色的特殊技能或知识'],
    };
  }

  private mockEccentricityScore(): CharacterDepthScore {
    return {
      trait: CharacterTrait.ECCENTRIC,
      score: 5.0,
      evidence: [],
      issues: ['角色较为普通'],
      suggestions: ['增加一些古怪的习惯或观点'],
    };
  }

  private mockCompetenceScore(): CharacterDepthScore {
    return {
      trait: CharacterTrait.COMPETENT,
      score: 7.0,
      evidence: ['角色在其领域表现出能力'],
      issues: [],
      suggestions: [],
    };
  }

  private mockDualPersonalityScore(): CharacterDepthScore {
    return {
      trait: CharacterTrait.DUAL_PERSONALITY,
      score: 4.0,
      evidence: [],
      issues: ['未发现明显的双重人格'],
      suggestions: ['考虑为角色设计内在矛盾的两面'],
    };
  }

  private mockEnvironmentContrastScore(): CharacterDepthScore {
    return {
      trait: CharacterTrait.INTERESTING,
      score: 5.0,
      evidence: [],
      issues: ['角色与环境较为适应'],
      suggestions: ['考虑将角色置于更不适应的环境中'],
    };
  }

  // ============================================================
  // M14 mock methods
  // ============================================================

  private mockArcAssessment(): ArcAssessment {
    return {
      arcType: CharacterArcType.MATURATION_ARC,
      arcTypeLabel: '成长弧线',
      stages: [
        { stage: ArcStage.SETUP, detected: true, confidence: 0.8, evidence: ['角色初始状态'], position: 0 },
        { stage: ArcStage.CATALYST, detected: true, confidence: 0.7, evidence: ['催化事件'], position: 1 },
        { stage: ArcStage.STRUGGLE, detected: true, confidence: 0.6, evidence: ['角色与冲突对抗'], position: 2 },
        { stage: ArcStage.TURNING_POINT, detected: false, confidence: 0.3, evidence: [], position: 3 },
        { stage: ArcStage.TRANSFORMATION, detected: false, confidence: 0.2, evidence: [], position: 4 },
        { stage: ArcStage.NEW_EQUILIBRIUM, detected: false, confidence: 0.1, evidence: [], position: 5 },
      ],
      transitionPoints: [],
      arcCompletionScore: 48,
      arcCoherenceScore: 55,
      suggestions: ['弧线尚处于早期阶段，后续章节需加强转折点和转变的描写'],
    };
  }

  private mockOCEANProfile(characterName: string): OCEANProfile {
    return {
      characterName,
      dimensions: [
        {
          dimension: OCEANDimension.OPENNESS,
          label: '开放性',
          score: 6,
          confidence: 0.6,
          evidence: ['角色对新事物保持适度好奇'],
          traits: ['好奇心'],
        },
        {
          dimension: OCEANDimension.CONSCIENTIOUSNESS,
          label: '尽责性',
          score: 7,
          confidence: 0.6,
          evidence: ['角色表现出较强的责任感'],
          traits: ['自律'],
        },
        {
          dimension: OCEANDimension.EXTRAVERSION,
          label: '外向性',
          score: 5,
          confidence: 0.5,
          evidence: ['角色在社交中表现适中'],
          traits: ['温和'],
        },
        {
          dimension: OCEANDimension.AGREEABLENESS,
          label: '宜人性',
          score: 6,
          confidence: 0.5,
          evidence: ['角色显示出合作倾向'],
          traits: ['同理心'],
        },
        {
          dimension: OCEANDimension.NEUROTICISM,
          label: '神经质',
          score: 5,
          confidence: 0.5,
          evidence: ['角色情绪总体平稳'],
          traits: ['稳定'],
        },
      ],
      overallProfile: '性格较为均衡，尽责性维度略高于其他维度',
      suggestions: ['需更多文本内容以进行更准确的 OCEAN 分析'],
    };
  }
}
