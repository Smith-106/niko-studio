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
// Enums
// ============================================================

export enum CharacterTrait {
  INTERESTING = 'interesting',
  KNOWLEDGEABLE = 'knowledgeable',
  COMPETENT = 'competent',
  ECCENTRIC = 'eccentric',
  DUAL_PERSONALITY = 'dual_personality',
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
}
