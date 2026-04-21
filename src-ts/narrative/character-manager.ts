/**
 * Character Manager - Deep Character Modeling System
 *
 * Five-dimension character model (based on Frey):
 * 1. Dynamic - Dynamic Dominant Emotion (static + dynamic evolution)
 * 2. Competence - Skill demonstration
 * 3. Eccentricity - Unique quirks/obsessions
 * 4. Contrast - Environment contrast (fish out of water)
 * 5. Duality - Dual personality / inner conflict
 *
 * Core features:
 * - Five-dimension character modeling
 * - Cross-scene state tracking
 * - Dialogue style consistency detection
 * - IGraphManager integration
 * - Character arc management
 */

import type { INarrativeLLMClient } from './types.js';

// ============================================================
// Enums
// ============================================================

export enum PersonalityType {
  ANALYST = 'analyst',
  DIPLOMAT = 'diplomat',
  SENTINEL = 'sentinel',
  EXPLORER = 'explorer',
}

export enum MotivationType {
  SURVIVAL = 'survival',
  SAFETY = 'safety',
  BELONGING = 'belonging',
  ESTEEM = 'esteem',
  SELF_ACTUALIZATION = 'self_actualization',
}

export enum RelationshipType {
  FAMILY = 'family',
  ROMANTIC = 'romantic',
  FRIENDSHIP = 'friendship',
  RIVALRY = 'rivalry',
  MENTOR = 'mentor',
  PROTEGE = 'protege',
  ALLY = 'ally',
  ENEMY = 'enemy',
  ACQUAINTANCE = 'acquaintance',
}

export enum GrowthStage {
  ORDINARY_WORLD = 'ordinary_world',
  CALL_TO_ADVENTURE = 'call',
  REFUSAL = 'refusal',
  MEETING_MENTOR = 'mentor',
  CROSSING_THRESHOLD = 'threshold',
  TESTS_ALLIES_ENEMIES = 'tests',
  INNERMOST_CAVE = 'cave',
  ORDEAL = 'ordeal',
  REWARD = 'reward',
  ROAD_BACK = 'road_back',
  RESURRECTION = 'resurrection',
  RETURN_WITH_ELIXIR = 'elixir',
}

export enum EmotionalState {
  JOY = 'joy',
  SADNESS = 'sadness',
  ANGER = 'anger',
  FEAR = 'fear',
  DISGUST = 'disgust',
  SURPRISE = 'surprise',
  TRUST = 'trust',
  ANTICIPATION = 'anticipation',
  NEUTRAL = 'neutral',
}

export enum DepthLevel {
  FLAT = 'flat',
  MODERATE = 'moderate',
  DEEP = 'deep',
  UNFORGETTABLE = 'unforgettable',
}

// ============================================================
// GraphManager integration (real service from graph/graph-manager.ts)
// ============================================================

export interface IGraphManager {
  getEntity(id: string): unknown;
  createEntity(entity: unknown): unknown;
  updateEntity(entity: unknown): unknown;
  deleteEntity(id: string): unknown;
  createRelationship(rel: unknown): unknown;
  findRelatedEntities(id: string, maxDepth?: number, limit?: number): unknown[];
  getSubgraph(id: string, radius?: number): { entities: unknown[]; relationships: unknown[] };
}

// ============================================================
// Five-dimension model data types
// ============================================================

export interface DynamicEmotion {
  staticEmotion: string;
  dynamicEmotion: string;
  intensity: number;
  evolution: [string, string][];
}

export function evolveDynamicEmotion(emotion: DynamicEmotion, sceneId: string, newEmotion: string): void {
  emotion.evolution.push([sceneId, emotion.dynamicEmotion]);
  emotion.dynamicEmotion = newEmotion;
}

export function getEmotionTrajectory(emotion: DynamicEmotion): string[] {
  const trajectory = [emotion.staticEmotion];
  for (const [, emo] of emotion.evolution) {
    trajectory.push(emo);
  }
  trajectory.push(emotion.dynamicEmotion);
  return trajectory;
}

export interface Competence {
  primarySkill: string;
  skillLevel: number;
  specializations: string[];
  demonstrations: Array<{ scene_id: string; action: string; result: string }>;
  limitations: string[];
}

export function addCompetenceDemo(c: Competence, sceneId: string, action: string, result: string): void {
  c.demonstrations.push({ scene_id: sceneId, action, result });
}

export interface Eccentricity {
  quirks: string[];
  obsessions: string[];
  unusualHabits: string[];
  uniqueWorldview: string;
  catchphrases: string[];
  eccentricityLevel: number;
}

export function addEccentricityQuirk(e: Eccentricity, quirk: string, category = 'quirks'): void {
  if (category === 'obsessions') e.obsessions.push(quirk);
  else if (category === 'habits') e.unusualHabits.push(quirk);
  else e.quirks.push(quirk);
}

export interface EnvironmentContrast {
  comfortZone: string;
  currentEnvironment: string;
  contrastLevel: string;
  frictionPoints: string[];
  growthOpportunities: string[];
  contrastScore: number;
}

export interface CmPersona {
  name: string;
  traits: string[];
  triggerConditions: string[];
  behaviorPatterns: string[];
}

export interface DualPersonality {
  primaryPersona: CmPersona;
  shadowPersona: CmPersona;
  internalConflict: string;
  switchTriggers: string[];
  conflictScenarios: string[];
  dualityScore: number;
}

export function getDualConflictPotential(dp: DualPersonality): string {
  return `当${dp.primaryPersona.name}必须面对${dp.shadowPersona.name}的需求时，内心冲突将达到顶峰`;
}

// ============================================================
// Dialogue style
// ============================================================

export interface DialogueStyle {
  vocabularyLevel: string;
  sentenceLength: string;
  formality: string;
  favoriteWords: string[];
  avoidedWords: string[];
  speechPatterns: string[];
  verbalTics: string[];
  emotionalExpression: string;
  dialogueSamples: string[];
}

// ============================================================
// Base data types
// ============================================================

export interface Personality {
  type: PersonalityType;
  coreTraits: string[];
  strengths: string[];
  weaknesses: string[];
  quirks: string[];
  speechPatterns: string[];
  values: string[];
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

export interface KeyEvent {
  age: number | null;
  description: string;
  impact: string;
  emotionalResidue: string;
}

export interface Background {
  birthPlace: string;
  familyStructure: string;
  socialClass: string;
  education: string;
  occupation: string;
  childhoodEvents: KeyEvent[];
  formativeEvents: KeyEvent[];
  trauma: KeyEvent[];
  gifts: string[];
  secrets: string[];
}

export interface Motivation {
  type: MotivationType;
  surfaceGoal: string;
  deepNeed: string;
  innerFear: string;
  want: string;
  need: string;
  lie: string;
  ghost: string;
  stakes: string[];
}

export interface Relationship {
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
}

export interface Relationships {
  connections: Relationship[];
  socialRole: string;
  groupAffiliations: string[];
}

export function addRelationship(rels: Relationships, rel: Relationship): void {
  rels.connections.push(rel);
}

export function getRelationship(rels: Relationships, targetId: string): Relationship | null {
  return rels.connections.find((r) => r.targetId === targetId) ?? null;
}

export function getRelationshipsByType(rels: Relationships, relType: RelationshipType): Relationship[] {
  return rels.connections.filter((r) => r.type === relType);
}

export interface GrowthArc {
  arcType: string;
  startingState: string;
  endingState: string;
  catalyst: string;
  turningPoints: string[];
  currentStage: GrowthStage;
  progress: number;
  beliefChange: string;
  skillGrowth: string[];
  relationshipEvolution: string[];
}

// ============================================================
// CharacterState - scene state tracking
// ============================================================

export interface CharacterState {
  sceneId: string;
  timestamp: string;
  location: string;
  physicalCondition: string;
  appearance: string;
  possessions: string[];
  emotionalState: EmotionalState;
  emotionalIntensity: number;
  mood: string;
  currentGoal: string;
  concerns: string[];
  knowledge: string[];
  relationshipChanges: Record<string, number>;
}

// ============================================================
// FiveDimensionScore
// ============================================================

const FIVE_DIM_WEIGHTS = {
  dynamic: 0.15,
  competence: 0.15,
  eccentricity: 0.20,
  contrast: 0.20,
  duality: 0.30,
};

export interface FiveDimensionScore {
  dynamicScore: number;
  competenceScore: number;
  eccentricityScore: number;
  contrastScore: number;
  dualityScore: number;
}

export function getOverallScore(s: FiveDimensionScore): number {
  return (
    s.dynamicScore * FIVE_DIM_WEIGHTS.dynamic +
    s.competenceScore * FIVE_DIM_WEIGHTS.competence +
    s.eccentricityScore * FIVE_DIM_WEIGHTS.eccentricity +
    s.contrastScore * FIVE_DIM_WEIGHTS.contrast +
    s.dualityScore * FIVE_DIM_WEIGHTS.duality
  );
}

export function getDepthLevel(s: FiveDimensionScore): DepthLevel {
  const score = getOverallScore(s);
  if (score >= 85) return DepthLevel.UNFORGETTABLE;
  if (score >= 70) return DepthLevel.DEEP;
  if (score >= 50) return DepthLevel.MODERATE;
  return DepthLevel.FLAT;
}

// ============================================================
// Character - full character model
// ============================================================

export interface Character {
  id: string;
  name: string;
  personality: Personality;
  background: Background;
  motivation: Motivation;
  relationships: Relationships;
  growth: GrowthArc;

  dynamicEmotion: DynamicEmotion | null;
  competence: Competence | null;
  eccentricity: Eccentricity | null;
  environmentContrast: EnvironmentContrast | null;
  dualPersonality: DualPersonality | null;
  dialogueStyle: DialogueStyle | null;

  role: string;
  createdAt: string;
  updatedAt: string;

  stateHistory: CharacterState[];
  dialogueHistory: Array<{ scene_id: string; dialogue: string; timestamp: string }>;
}

export function getFiveDimensionScore(char: Character): FiveDimensionScore {
  const score: FiveDimensionScore = {
    dynamicScore: 0,
    competenceScore: 0,
    eccentricityScore: 0,
    contrastScore: 0,
    dualityScore: 0,
  };

  if (char.dynamicEmotion) {
    const evolutionBonus = Math.min(char.dynamicEmotion.evolution.length * 10, 30);
    score.dynamicScore = Math.min(100, 40 + char.dynamicEmotion.intensity * 0.3 + evolutionBonus);
  }
  if (char.competence) {
    const demoBonus = Math.min(char.competence.demonstrations.length * 15, 45);
    score.competenceScore = Math.min(100, 25 + char.competence.skillLevel * 0.3 + demoBonus);
  }
  if (char.eccentricity) {
    const quirkCount =
      char.eccentricity.quirks.length +
      char.eccentricity.obsessions.length * 2 +
      char.eccentricity.unusualHabits.length;
    score.eccentricityScore = Math.min(100, char.eccentricity.eccentricityLevel + quirkCount * 5);
  }
  if (char.environmentContrast) {
    score.contrastScore = char.environmentContrast.contrastScore;
  }
  if (char.dualPersonality) {
    const conflictBonus = Math.min(char.dualPersonality.conflictScenarios.length * 10, 30);
    score.dualityScore = Math.min(100, char.dualPersonality.dualityScore + conflictBonus);
  }

  return score;
}

// ============================================================
// LLM Prompts
// ============================================================

const CHARACTER_ANALYSIS_PROMPT = `
## 角色表现分析

分析角色在以下内容中的表现是否与其设定一致。

**角色设定**:
{character_info}

**内容**:
{content}

请输出JSON格式:
`;

const CHARACTER_DEVELOPMENT_PROMPT = `
## 角色发展建议

基于角色当前状态，建议下一步发展方向。

**角色设定**:
{character_info}

请输出JSON格式:
`;

const FIVE_DIMENSIONS_PROMPT = `
## 五维度角色深度分析

基于弗雷《让劲爆小说飞起来》的五维度模型分析角色表现:
1. Dynamic (动态情感)
2. Competence (能力展示)
3. Eccentricity (古怪特质)
4. Contrast (环境对比)
5. Duality (双重人格)

**角色设定**:
{character_info}

**内容**:
{content}

请输出JSON格式:
`;

// ============================================================
// CharacterManager
// ============================================================

export class CharacterManager {
  private llmClient: INarrativeLLMClient | null;
  private graphManager: IGraphManager | null;
  private characters: Map<string, Character>;
  private nameIndex: Map<string, string>;

  private static readonly STYLE_MARKERS: Record<string, string[]> = {
    formal: ['\u60A8', '\u8D35', '\u656C', '\u8BF7\u95EE', '\u6055\u6211'],
    casual: ['\u563F', '\u54DF', '\u5450', '\u548B', '\u6574'],
    expressive: ['!', '?!', '...', '~'],
    reserved: ['\u55EF', '\u54E6', '\u662F\u7684', '\u597D\u7684'],
  };

  constructor(llmClient?: INarrativeLLMClient, graphManager?: IGraphManager) {
    this.llmClient = llmClient ?? null;
    this.graphManager = graphManager ?? null;
    this.characters = new Map();
    this.nameIndex = new Map();
  }

  // ========================================
  // CRUD Operations
  // ========================================

  createCharacter(
    name: string,
    role = 'supporting',
    personality?: Personality,
    background?: Background,
    motivation?: Motivation,
    growth?: GrowthArc,
  ): Character {
    const charId = this.generateId(name);

    const character: Character = {
      id: charId,
      name,
      personality: personality ?? this.defaultPersonality(),
      background: background ?? this.defaultBackground(),
      motivation: motivation ?? this.defaultMotivation(),
      relationships: { connections: [], socialRole: '', groupAffiliations: [] },
      growth: growth ?? this.defaultGrowth(),
      dynamicEmotion: null,
      competence: null,
      eccentricity: null,
      environmentContrast: null,
      dualPersonality: null,
      dialogueStyle: null,
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stateHistory: [],
      dialogueHistory: [],
    };

    this.characters.set(charId, character);
    this.nameIndex.set(name, charId);

    return character;
  }

  getCharacter(charId: string): Character | null {
    return this.characters.get(charId) ?? null;
  }

  getByName(name: string): Character | null {
    const charId = this.nameIndex.get(name);
    if (charId) return this.characters.get(charId) ?? null;
    return null;
  }

  updateCharacter(charId: string, updates: Record<string, unknown>): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;

    for (const [key, value] of Object.entries(updates)) {
      if (key in char) {
        (char as unknown as Record<string, unknown>)[key] = value;
      }
    }
    char.updatedAt = new Date().toISOString();
    return true;
  }

  deleteCharacter(charId: string): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    this.nameIndex.delete(char.name);
    this.characters.delete(charId);
    return true;
  }

  listCharacters(role?: string): Character[] {
    const chars = Array.from(this.characters.values());
    if (role) return chars.filter((c) => c.role === role);
    return chars;
  }

  // ========================================
  // Five-dimension modeling
  // ========================================

  setDynamicEmotion(charId: string, staticEmotion: string, dynamicEmotion: string, intensity = 50): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    char.dynamicEmotion = { staticEmotion, dynamicEmotion, intensity, evolution: [] };
    char.updatedAt = new Date().toISOString();
    return true;
  }

  evolveEmotion(charId: string, sceneId: string, newEmotion: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.dynamicEmotion) return false;
    evolveDynamicEmotion(char.dynamicEmotion, sceneId, newEmotion);
    char.updatedAt = new Date().toISOString();
    return true;
  }

  setCompetence(charId: string, primarySkill: string, skillLevel = 75, specializations?: string[], limitations?: string[]): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    char.competence = { primarySkill, skillLevel, specializations: specializations ?? [], demonstrations: [], limitations: limitations ?? [] };
    char.updatedAt = new Date().toISOString();
    return true;
  }

  addCompetenceDemonstration(charId: string, sceneId: string, action: string, result: string): boolean {
    const char = this.characters.get(charId);
    if (!char || !char.competence) return false;
    addCompetenceDemo(char.competence, sceneId, action, result);
    char.updatedAt = new Date().toISOString();
    return true;
  }

  setEccentricity(charId: string, opts: {
    quirks?: string[]; obsessions?: string[]; unusualHabits?: string[];
    uniqueWorldview?: string; catchphrases?: string[]; eccentricityLevel?: number;
  }): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    char.eccentricity = {
      quirks: opts.quirks ?? [],
      obsessions: opts.obsessions ?? [],
      unusualHabits: opts.unusualHabits ?? [],
      uniqueWorldview: opts.uniqueWorldview ?? '',
      catchphrases: opts.catchphrases ?? [],
      eccentricityLevel: opts.eccentricityLevel ?? 50,
    };
    char.updatedAt = new Date().toISOString();
    return true;
  }

  setEnvironmentContrast(charId: string, comfortZone: string, currentEnvironment: string, contrastLevel = 'medium', frictionPoints?: string[], growthOpportunities?: string[]): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    const levelScores: Record<string, number> = { low: 30, medium: 50, high: 70, extreme: 90 };
    char.environmentContrast = {
      comfortZone, currentEnvironment, contrastLevel,
      frictionPoints: frictionPoints ?? [],
      growthOpportunities: growthOpportunities ?? [],
      contrastScore: levelScores[contrastLevel] ?? 50,
    };
    char.updatedAt = new Date().toISOString();
    return true;
  }

  setDualPersonality(charId: string, opts: {
    primaryName: string; primaryTraits: string[]; primaryPatterns: string[];
    shadowName: string; shadowTraits: string[]; shadowPatterns: string[];
    internalConflict: string; switchTriggers?: string[]; conflictScenarios?: string[]; dualityScore?: number;
  }): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    char.dualPersonality = {
      primaryPersona: { name: opts.primaryName, traits: opts.primaryTraits, triggerConditions: [], behaviorPatterns: opts.primaryPatterns },
      shadowPersona: { name: opts.shadowName, traits: opts.shadowTraits, triggerConditions: opts.switchTriggers ?? [], behaviorPatterns: opts.shadowPatterns },
      internalConflict: opts.internalConflict,
      switchTriggers: opts.switchTriggers ?? [],
      conflictScenarios: opts.conflictScenarios ?? [],
      dualityScore: opts.dualityScore ?? 50,
    };
    char.updatedAt = new Date().toISOString();
    return true;
  }

  getDepthAssessment(charId: string): Record<string, unknown> {
    const char = this.characters.get(charId);
    if (!char) return { error: 'Character not found' };

    const score = getFiveDimensionScore(char);
    const suggestions: string[] = [];

    if (score.dynamicScore < 50) suggestions.push('增加情感演变场景，展示角色情感的动态变化');
    if (score.competenceScore < 50) suggestions.push('添加能力展示场景，让角色在其专长领域表现出色');
    if (score.eccentricityScore < 50) suggestions.push('赋予角色独特的怪癖或执念，让其更加难忘');
    if (score.contrastScore < 50) suggestions.push('将角色置于其不适应的环境中，产生戏剧张力');
    if (score.dualityScore < 50) suggestions.push('设计双重人格或内心矛盾，增加角色深度');

    return {
      character: char.name,
      scores: score,
      depth_level: getDepthLevel(score),
      suggestions,
    };
  }

  // ========================================
  // Dialogue style consistency
  // ========================================

  setDialogueStyle(charId: string, opts: {
    vocabularyLevel?: string; sentenceLength?: string; formality?: string;
    favoriteWords?: string[]; speechPatterns?: string[]; verbalTics?: string[];
    emotionalExpression?: string;
  }): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    char.dialogueStyle = {
      vocabularyLevel: opts.vocabularyLevel ?? 'medium',
      sentenceLength: opts.sentenceLength ?? 'medium',
      formality: opts.formality ?? 'neutral',
      favoriteWords: opts.favoriteWords ?? [],
      avoidedWords: [],
      speechPatterns: opts.speechPatterns ?? [],
      verbalTics: opts.verbalTics ?? [],
      emotionalExpression: opts.emotionalExpression ?? 'moderate',
      dialogueSamples: [],
    };
    char.updatedAt = new Date().toISOString();
    return true;
  }

  addDialogueSample(charId: string, sceneId: string, dialogue: string): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;
    char.dialogueHistory.push({ scene_id: sceneId, dialogue, timestamp: new Date().toISOString() });
    if (char.dialogueStyle) char.dialogueStyle.dialogueSamples.push(dialogue);
    return true;
  }

  checkDialogueConsistency(charId: string, newDialogue: string): Record<string, unknown> {
    const char = this.characters.get(charId);
    if (!char) return { error: 'Character not found' };
    if (!char.dialogueStyle) return { warning: 'No dialogue style defined', consistent: true };

    const issues: string[] = [];
    const style = char.dialogueStyle;

    const formalCount = CharacterManager.STYLE_MARKERS.formal.filter((m) => newDialogue.includes(m)).length;
    const casualCount = CharacterManager.STYLE_MARKERS.casual.filter((m) => newDialogue.includes(m)).length;

    if (style.formality === 'formal' && casualCount > formalCount) {
      issues.push('对话过于随意，与角色正式风格不符');
    } else if (style.formality === 'casual' && formalCount > casualCount) {
      issues.push('对话过于正式，与角色随意风格不符');
    }

    const verbalTicFound = style.verbalTics.some((tic) => newDialogue.includes(tic));
    if (style.verbalTics.length > 0 && !verbalTicFound) {
      issues.push(`缺少角色口头禅: ${style.verbalTics.slice(0, 2)}`);
    }

    const avoidedFound = style.avoidedWords.filter((w) => newDialogue.includes(w));
    if (avoidedFound.length > 0) {
      issues.push(`使用了角色避免的词汇: ${avoidedFound}`);
    }

    const expressiveCount = CharacterManager.STYLE_MARKERS.expressive.filter((m) => newDialogue.includes(m)).length;
    const reservedCount = CharacterManager.STYLE_MARKERS.reserved.filter((m) => newDialogue.includes(m)).length;

    if (style.emotionalExpression === 'reserved' && expressiveCount > 3) {
      issues.push('情感表达过于强烈，与角色内敛风格不符');
    } else if (style.emotionalExpression === 'expressive' && reservedCount > expressiveCount) {
      issues.push('情感表达过于内敛，与角色外放风格不符');
    }

    const consistencyScore = Math.max(0, 100 - issues.length * 25);

    return {
      character: char.name,
      consistent: issues.length === 0,
      consistency_score: consistencyScore,
      issues,
    };
  }

  // ========================================
  // State Tracking
  // ========================================

  recordState(charId: string, opts: {
    sceneId: string; location?: string; emotionalState?: EmotionalState;
    emotionalIntensity?: number; currentGoal?: string; physicalCondition?: string;
    knowledge?: string[]; possessions?: string[];
  }): CharacterState | null {
    const char = this.characters.get(charId);
    if (!char) return null;

    const state: CharacterState = {
      sceneId: opts.sceneId,
      timestamp: new Date().toISOString(),
      location: opts.location ?? '',
      physicalCondition: opts.physicalCondition ?? 'normal',
      appearance: '',
      possessions: opts.possessions ?? [],
      emotionalState: opts.emotionalState ?? EmotionalState.NEUTRAL,
      emotionalIntensity: opts.emotionalIntensity ?? 50,
      mood: '',
      currentGoal: opts.currentGoal ?? '',
      concerns: [],
      knowledge: opts.knowledge ?? [],
      relationshipChanges: {},
    };

    char.stateHistory.push(state);
    char.updatedAt = new Date().toISOString();
    return state;
  }

  getCharacterTimeline(charId: string): CharacterState[] {
    const char = this.characters.get(charId);
    if (!char) return [];
    return char.stateHistory;
  }

  compareStates(charId: string, sceneA: string, sceneB: string): Record<string, unknown> {
    const char = this.characters.get(charId);
    if (!char) return { error: 'Character not found' };

    const stateA = char.stateHistory.find((s) => s.sceneId === sceneA);
    const stateB = char.stateHistory.find((s) => s.sceneId === sceneB);
    if (!stateA || !stateB) return { error: 'State not found' };

    return {
      character: char.name,
      scene_a: sceneA,
      scene_b: sceneB,
      changes: {
        location: { from: stateA.location, to: stateB.location },
        emotional_state: { from: stateA.emotionalState, to: stateB.emotionalState },
        physical_condition: { from: stateA.physicalCondition, to: stateB.physicalCondition },
        knowledge_gained: stateB.knowledge.filter((k) => !stateA.knowledge.includes(k)),
        possessions_changed: {
          gained: stateB.possessions.filter((p) => !stateA.possessions.includes(p)),
          lost: stateA.possessions.filter((p) => !stateB.possessions.includes(p)),
        },
      },
    };
  }

  // ========================================
  // Relationship Management
  // ========================================

  addRelationship(charId: string, targetId: string, relType: RelationshipType, trustLevel = 50, history = ''): boolean {
    const char = this.characters.get(charId);
    const target = this.characters.get(targetId);
    if (!char || !target) return false;

    const rel: Relationship = {
      targetId, targetName: target.name, type: relType,
      trustLevel, powerBalance: 50, emotionalBond: 50, conflictPotential: 50,
      history, currentStatus: '', tensionPoints: [],
    };

    char.relationships.connections.push(rel);
    return true;
  }

  updateRelationship(charId: string, targetId: string, trustChange = 0, powerChange = 0, newStatus?: string): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;

    const rel = char.relationships.connections.find((r) => r.targetId === targetId);
    if (!rel) return false;

    rel.trustLevel = Math.max(0, Math.min(100, rel.trustLevel + trustChange));
    rel.powerBalance = Math.max(0, Math.min(100, rel.powerBalance + powerChange));
    if (newStatus) rel.currentStatus = newStatus;
    return true;
  }

  getRelationshipNetwork(): { nodes: Array<{ id: string; name: string; role: string }>; edges: Array<{ source: string; target: string; type: string; trust: number }> } {
    const nodes: Array<{ id: string; name: string; role: string }> = [];
    const edges: Array<{ source: string; target: string; type: string; trust: number }> = [];

    for (const [charId, char] of this.characters) {
      nodes.push({ id: charId, name: char.name, role: char.role });
      for (const rel of char.relationships.connections) {
        edges.push({ source: charId, target: rel.targetId, type: rel.type, trust: rel.trustLevel });
      }
    }
    return { nodes, edges };
  }

  // ========================================
  // Growth Arc Management
  // ========================================

  advanceGrowth(charId: string, newStage: GrowthStage, turningPoint?: string): boolean {
    const char = this.characters.get(charId);
    if (!char) return false;

    char.growth.currentStage = newStage;
    const stages = Object.values(GrowthStage);
    const currentIndex = stages.indexOf(newStage);
    char.growth.progress = currentIndex / (stages.length - 1);

    if (turningPoint) char.growth.turningPoints.push(turningPoint);
    return true;
  }

  // ========================================
  // Consistency Validation
  // ========================================

  validateConsistency(charId: string): Record<string, unknown> {
    const char = this.characters.get(charId);
    if (!char) return { valid: false, error: 'Character not found' };

    const issues: string[] = [];
    const warnings: string[] = [];

    if (char.personality.extraversion < 30) {
      const socialRels = getRelationshipsByType(char.relationships, RelationshipType.FRIENDSHIP);
      if (socialRels.length > 5) warnings.push('内向角色有过多友谊关系');
    }

    if (char.motivation.type === MotivationType.SURVIVAL) {
      if (char.motivation.surfaceGoal.includes('\u81EA\u6211\u5B9E\u73B0')) {
        issues.push('\u751F\u5B58\u52A8\u673A\u4E0E\u81EA\u6211\u5B9E\u73B0\u76EE\u6807\u4E0D\u4E00\u81F4');
      }
    }

    if (char.growth.progress > 0.5 && char.growth.currentStage === GrowthStage.ORDINARY_WORLD) {
      issues.push('\u6210\u957F\u8FDB\u5EA6\u4E0E\u5F53\u524D\u9636\u6BB5\u4E0D\u4E00\u81F4');
    }

    if (char.stateHistory.length > 1) {
      for (let i = 1; i < char.stateHistory.length; i++) {
        const prev = char.stateHistory[i - 1];
        const curr = char.stateHistory[i];
        if (prev.physicalCondition === 'injured' && curr.physicalCondition === 'normal') {
          if (!curr.sceneId.includes('\u6CBB\u7597') && !curr.location.includes('\u533B\u9662')) {
            warnings.push(`\u573A\u666F ${curr.sceneId}: \u53D7\u4F24\u72B6\u6001\u7A81\u7136\u6062\u590D`);
          }
        }
      }
    }

    const dimensionWarnings: string[] = [];
    if (!char.dynamicEmotion) dimensionWarnings.push('\u7F3A\u5C11\u52A8\u6001\u60C5\u611F\u8BBE\u7F6E');
    if (!char.competence) dimensionWarnings.push('\u7F3A\u5C11\u80FD\u529B\u5C55\u793A\u8BBE\u7F6E');
    if (!char.eccentricity) dimensionWarnings.push('\u7F3A\u5C11\u53E4\u602A\u7279\u8D28\u8BBE\u7F6E');
    if (!char.environmentContrast) dimensionWarnings.push('\u7F3A\u5C11\u73AF\u5883\u5BF9\u6BD4\u8BBE\u7F6E');
    if (!char.dualPersonality) dimensionWarnings.push('\u7F3A\u5C11\u53CC\u91CD\u4EBA\u683C\u8BBE\u7F6E');
    warnings.push(...dimensionWarnings);

    return {
      valid: issues.length === 0,
      character: char.name,
      issues,
      warnings,
      score: Math.max(0, 100 - issues.length * 20 - warnings.length * 5),
    };
  }

  validateAll(): Record<string, unknown> {
    const results: Record<string, unknown> = {};
    let totalScore = 0;

    for (const charId of this.characters.keys()) {
      const result = this.validateConsistency(charId);
      results[charId] = result;
      totalScore += (result.score as number) ?? 0;
    }

    const avgScore = this.characters.size > 0 ? totalScore / this.characters.size : 0;
    return { total_characters: this.characters.size, average_score: Math.round(avgScore * 10) / 10, results };
  }

  // ========================================
  // LLM-Assisted Methods
  // ========================================

  async analyzeCharacter(charId: string, content: string): Promise<Record<string, unknown>> {
    const char = this.characters.get(charId);
    if (!char) return { error: 'Character not found' };
    if (!this.llmClient) return this.mockAnalysis(char);

    const prompt = CHARACTER_ANALYSIS_PROMPT
      .replace('{character_info}', JSON.stringify(charToDict(char)))
      .replace('{content}', content);

    return this.llmClient.generateJson<Record<string, unknown>>(prompt);
  }

  async suggestDevelopment(charId: string): Promise<Record<string, unknown>> {
    const char = this.characters.get(charId);
    if (!char) return { error: 'Character not found' };
    if (!this.llmClient) return this.mockDevelopmentSuggestions(char);

    const prompt = CHARACTER_DEVELOPMENT_PROMPT
      .replace('{character_info}', JSON.stringify(charToDict(char)));

    return this.llmClient.generateJson<Record<string, unknown>>(prompt);
  }

  async analyzeFiveDimensions(charId: string, content: string): Promise<Record<string, unknown>> {
    const char = this.characters.get(charId);
    if (!char) return { error: 'Character not found' };
    if (!this.llmClient) return this.mockFiveDimensionsAnalysis(char);

    const prompt = FIVE_DIMENSIONS_PROMPT
      .replace('{character_info}', JSON.stringify(charToDict(char)))
      .replace('{content}', content);

    return this.llmClient.generateJson<Record<string, unknown>>(prompt);
  }

  // ========================================
  // Export & Import
  // ========================================

  exportAll(): Record<string, unknown> {
    const chars: Record<string, unknown> = {};
    for (const [id, char] of this.characters) {
      chars[id] = charToDict(char);
    }
    return {
      characters: chars,
      relationship_network: this.getRelationshipNetwork(),
      exported_at: new Date().toISOString(),
    };
  }

  importCharacter(data: Record<string, unknown>): Character | null {
    try {
      if (!data.id || !data.name) return null;

      const charId = data.id as string;
      const name = data.name as string;

      const personality = this.deserializePersonality(data.personality as Record<string, unknown> | undefined);
      const background = this.deserializeBackground(data.background as Record<string, unknown> | undefined);
      const motivation = this.deserializeMotivation(data.motivation as Record<string, unknown> | undefined);
      const relationships = this.deserializeRelationships(data.relationships as Record<string, unknown> | undefined);
      const growth = this.deserializeGrowth(data.growth as Record<string, unknown> | undefined);

      const character: Character = {
        id: charId, name,
        role: (data.role as string) ?? 'supporting',
        personality, background, motivation, relationships, growth,
        dynamicEmotion: null, competence: null, eccentricity: null,
        environmentContrast: null, dualPersonality: null, dialogueStyle: null,
        createdAt: (data.created_at as string) ?? new Date().toISOString(),
        updatedAt: (data.updated_at as string) ?? new Date().toISOString(),
        stateHistory: [], dialogueHistory: [],
      };

      if (data.dynamic_emotion) character.dynamicEmotion = this.deserializeDynamicEmotion(data.dynamic_emotion as Record<string, unknown>);
      if (data.competence) character.competence = this.deserializeCompetence(data.competence as Record<string, unknown>);
      if (data.eccentricity) character.eccentricity = this.deserializeEccentricity(data.eccentricity as Record<string, unknown>);
      if (data.environment_contrast) character.environmentContrast = this.deserializeEnvironmentContrast(data.environment_contrast as Record<string, unknown>);
      if (data.dual_personality) character.dualPersonality = this.deserializeDualPersonality(data.dual_personality as Record<string, unknown>);
      if (data.dialogue_style) character.dialogueStyle = this.deserializeDialogueStyle(data.dialogue_style as Record<string, unknown>);

      this.characters.set(charId, character);
      this.nameIndex.set(name, charId);
      return character;
    } catch {
      return null;
    }
  }

  // ========================================
  // Default & Mock Methods
  // ========================================

  private defaultPersonality(): Personality {
    return {
      type: PersonalityType.ANALYST,
      coreTraits: ['\u7406\u6027', '\u5185\u7701'],
      strengths: ['\u5206\u6790\u80FD\u529B'],
      weaknesses: ['\u60C5\u611F\u8868\u8FBE'],
      quirks: [], speechPatterns: [],
      values: ['\u771F\u7406'],
      openness: 50, conscientiousness: 50, extraversion: 50,
      agreeableness: 50, neuroticism: 50,
    };
  }

  private defaultBackground(): Background {
    return {
      birthPlace: '\u672A\u77E5', familyStructure: '\u666E\u901A\u5BB6\u5EAD',
      socialClass: '\u4E2D\u4EA7', education: '\u666E\u901A\u6559\u80B2', occupation: '\u672A\u77E5',
      childhoodEvents: [], formativeEvents: [], trauma: [],
      gifts: [], secrets: [],
    };
  }

  private defaultMotivation(): Motivation {
    return {
      type: MotivationType.SELF_ACTUALIZATION,
      surfaceGoal: '\u5F85\u5B9A', deepNeed: '\u5F85\u5B9A', innerFear: '\u5F85\u5B9A',
      want: '\u5F85\u5B9A', need: '\u5F85\u5B9A', lie: '\u5F85\u5B9A', ghost: '\u5F85\u5B9A',
      stakes: [],
    };
  }

  private defaultGrowth(): GrowthArc {
    return {
      arcType: 'positive', startingState: '\u5F85\u5B9A', endingState: '\u5F85\u5B9A',
      catalyst: '\u5F85\u5B9A', turningPoints: [],
      currentStage: GrowthStage.ORDINARY_WORLD, progress: 0,
      beliefChange: '', skillGrowth: [], relationshipEvolution: [],
    };
  }

  private mockAnalysis(char: Character): Record<string, unknown> {
    return {
      character: char.name, consistency_score: 75,
      personality_expression: '\u57FA\u672C\u4E00\u81F4',
      motivation_clarity: '\u4E2D\u7B49', growth_visible: false,
      suggestions: ['\u589E\u52A0\u5185\u5FC3\u72EC\u767D', '\u5F3A\u5316\u6027\u683C\u7279\u8D28\u8868\u73B0'],
    };
  }

  private mockDevelopmentSuggestions(char: Character): Record<string, unknown> {
    return {
      character: char.name,
      current_stage: char.growth.currentStage,
      next_stage: GrowthStage.CROSSING_THRESHOLD,
      suggested_events: ['\u9762\u4E34\u91CD\u5927\u9009\u62E9', '\u53D1\u73B0\u9690\u85CF\u771F\u76F8', '\u4E0E\u5BFC\u5E08\u76F8\u9047'],
      relationship_opportunities: ['\u52A0\u6DF1\u4E0E\u76DF\u53CB\u7684\u4FE1\u4EFB', '\u4E0E\u5BF9\u624B\u4EA7\u751F\u51B2\u7A81'],
      internal_growth: ['\u8D28\u7591\u539F\u6709\u4FE1\u5FF5', '\u53D1\u73B0\u65B0\u7684\u4EF7\u503C\u89C2'],
    };
  }

  private mockFiveDimensionsAnalysis(char: Character): Record<string, unknown> {
    return {
      character: char.name,
      dimensions: {
        dynamic: { score: 60, evidence: ['\u60C5\u611F\u6709\u53D8\u5316'], suggestions: ['\u589E\u52A0\u60C5\u611F\u8F6C\u6298\u70B9'] },
        competence: { score: 70, evidence: ['\u5C55\u793A\u4E86\u6280\u80FD'], suggestions: ['\u6DFB\u52A0\u66F4\u591A\u5C55\u793A\u573A\u666F'] },
        eccentricity: { score: 50, evidence: [], suggestions: ['\u8D4B\u4E88\u72EC\u7279\u602A\u7656'] },
        contrast: { score: 55, evidence: ['\u6709\u73AF\u5883\u4E0D\u9002\u5E94'], suggestions: ['\u589E\u5F3A\u73AF\u5883\u5BF9\u6BD4'] },
        duality: { score: 40, evidence: [], suggestions: ['\u8BBE\u8BA1\u53CC\u91CD\u4EBA\u683C'] },
      },
      overall: 55, depth_level: 'MODERATE',
    };
  }

  private generateId(name: string): string {
    const content = `${name}-${new Date().toISOString()}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const chr = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + chr;
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(12, '0').slice(0, 12);
  }

  // ========================================
  // Deserialization helpers
  // ========================================

  private deserializePersonality(data?: Record<string, unknown>): Personality {
    if (!data) return this.defaultPersonality();
    let pType = PersonalityType.ANALYST;
    try {
      const raw = (data.type as string) ?? 'ANALYST';
      pType = (Object.values(PersonalityType) as string[]).includes(raw)
        ? (raw as PersonalityType) : PersonalityType.ANALYST;
    } catch { /* keep default */ }
    const bigFive = (data.big_five ?? {}) as Record<string, number>;
    return {
      type: pType,
      coreTraits: (data.core_traits as string[]) ?? [],
      strengths: (data.strengths as string[]) ?? [],
      weaknesses: (data.weaknesses as string[]) ?? [],
      quirks: (data.quirks as string[]) ?? [],
      speechPatterns: (data.speech_patterns as string[]) ?? [],
      values: (data.values as string[]) ?? [],
      openness: bigFive.openness ?? 50,
      conscientiousness: bigFive.conscientiousness ?? 50,
      extraversion: bigFive.extraversion ?? 50,
      agreeableness: bigFive.agreeableness ?? 50,
      neuroticism: bigFive.neuroticism ?? 50,
    };
  }

  private deserializeBackground(data?: Record<string, unknown>): Background {
    if (!data) return this.defaultBackground();
    const parseKeyEvents = (events: unknown[], includeResidue = false): KeyEvent[] =>
      (events as Record<string, unknown>[]).map((e) => ({
        age: (e.age as number) ?? null,
        description: (e.description as string) ?? '',
        impact: (e.impact as string) ?? '',
        emotionalResidue: includeResidue ? (e.emotional_residue as string) ?? '' : '',
      }));
    return {
      birthPlace: (data.birth_place as string) ?? '\u672A\u77E5',
      familyStructure: (data.family_structure as string) ?? '\u666E\u901A\u5BB6\u5EAD',
      socialClass: (data.social_class as string) ?? '\u4E2D\u4EA7',
      education: (data.education as string) ?? '\u666E\u901A\u6559\u80B2',
      occupation: (data.occupation as string) ?? '\u672A\u77E5',
      childhoodEvents: parseKeyEvents((data.childhood_events as unknown[]) ?? []),
      formativeEvents: parseKeyEvents((data.formative_events as unknown[]) ?? []),
      trauma: parseKeyEvents((data.trauma as unknown[]) ?? [], true),
      gifts: (data.gifts as string[]) ?? [],
      secrets: (data.secrets as string[]) ?? [],
    };
  }

  private deserializeMotivation(data?: Record<string, unknown>): Motivation {
    if (!data) return this.defaultMotivation();
    let mType = MotivationType.SELF_ACTUALIZATION;
    try {
      const raw = (data.type as string) ?? 'SELF_ACTUALIZATION';
      mType = (Object.values(MotivationType) as string[]).includes(raw)
        ? (raw as MotivationType) : MotivationType.SELF_ACTUALIZATION;
    } catch { /* keep default */ }
    return {
      type: mType,
      surfaceGoal: (data.surface_goal as string) ?? '\u5F85\u5B9A',
      deepNeed: (data.deep_need as string) ?? '\u5F85\u5B9A',
      innerFear: (data.inner_fear as string) ?? '\u5F85\u5B9A',
      want: (data.want as string) ?? '\u5F85\u5B9A',
      need: (data.need as string) ?? '\u5F85\u5B9A',
      lie: (data.lie as string) ?? '\u5F85\u5B9A',
      ghost: (data.ghost as string) ?? '\u5F85\u5B9A',
      stakes: (data.stakes as string[]) ?? [],
    };
  }

  private deserializeRelationships(data?: Record<string, unknown>): Relationships {
    const rels: Relationships = {
      connections: [],
      socialRole: (data?.social_role as string) ?? '',
      groupAffiliations: (data?.group_affiliations as string[]) ?? [],
    };
    for (const conn of (data?.connections as Record<string, unknown>[]) ?? []) {
      let relType = RelationshipType.ACQUAINTANCE;
      try {
        const raw = (conn.type as string) ?? 'ACQUAINTANCE';
        relType = (Object.values(RelationshipType) as string[]).includes(raw)
          ? (raw as RelationshipType) : RelationshipType.ACQUAINTANCE;
      } catch { /* keep default */ }
      rels.connections.push({
        targetId: (conn.target_id as string) ?? '',
        targetName: (conn.target_name as string) ?? '',
        type: relType,
        trustLevel: (conn.trust_level as number) ?? 50,
        powerBalance: (conn.power_balance as number) ?? 50,
        emotionalBond: (conn.emotional_bond as number) ?? 50,
        conflictPotential: (conn.conflict_potential as number) ?? 50,
        history: (conn.history as string) ?? '',
        currentStatus: (conn.current_status as string) ?? '',
        tensionPoints: (conn.tension_points as string[]) ?? [],
      });
    }
    return rels;
  }

  private deserializeGrowth(data?: Record<string, unknown>): GrowthArc {
    if (!data) return this.defaultGrowth();
    let stage = GrowthStage.ORDINARY_WORLD;
    try {
      const raw = (data.current_stage as string) ?? 'ORDINARY_WORLD';
      stage = (Object.values(GrowthStage) as string[]).includes(raw)
        ? (raw as GrowthStage) : GrowthStage.ORDINARY_WORLD;
    } catch { /* keep default */ }
    return {
      arcType: (data.arc_type as string) ?? 'positive',
      startingState: (data.starting_state as string) ?? '\u5F85\u5B9A',
      endingState: (data.ending_state as string) ?? '\u5F85\u5B9A',
      catalyst: (data.catalyst as string) ?? '\u5F85\u5B9A',
      turningPoints: (data.turning_points as string[]) ?? [],
      currentStage: stage,
      progress: (data.progress as number) ?? 0,
      beliefChange: (data.belief_change as string) ?? '',
      skillGrowth: (data.skill_growth as string[]) ?? [],
      relationshipEvolution: (data.relationship_evolution as string[]) ?? [],
    };
  }

  private deserializeDynamicEmotion(data: Record<string, unknown>): DynamicEmotion {
    return {
      staticEmotion: (data.static_emotion as string) ?? '',
      dynamicEmotion: (data.dynamic_emotion as string) ?? '',
      intensity: (data.intensity as number) ?? 50,
      evolution: (data.evolution as [string, string][]) ?? [],
    };
  }

  private deserializeCompetence(data: Record<string, unknown>): Competence {
    return {
      primarySkill: (data.primary_skill as string) ?? '',
      skillLevel: (data.skill_level as number) ?? 75,
      specializations: (data.specializations as string[]) ?? [],
      demonstrations: (data.demonstrations as Array<{ scene_id: string; action: string; result: string }>) ?? [],
      limitations: (data.limitations as string[]) ?? [],
    };
  }

  private deserializeEccentricity(data: Record<string, unknown>): Eccentricity {
    return {
      quirks: (data.quirks as string[]) ?? [],
      obsessions: (data.obsessions as string[]) ?? [],
      unusualHabits: (data.unusual_habits as string[]) ?? [],
      uniqueWorldview: (data.unique_worldview as string) ?? '',
      catchphrases: (data.catchphrases as string[]) ?? [],
      eccentricityLevel: (data.eccentricity_level as number) ?? 50,
    };
  }

  private deserializeEnvironmentContrast(data: Record<string, unknown>): EnvironmentContrast {
    return {
      comfortZone: (data.comfort_zone as string) ?? '',
      currentEnvironment: (data.current_environment as string) ?? '',
      contrastLevel: (data.contrast_level as string) ?? 'medium',
      frictionPoints: (data.friction_points as string[]) ?? [],
      growthOpportunities: (data.growth_opportunities as string[]) ?? [],
      contrastScore: (data.contrast_score as number) ?? 50,
    };
  }

  private deserializeDualPersonality(data: Record<string, unknown>): DualPersonality {
    const primary = (data.primary_persona as Record<string, unknown>) ?? {};
    const shadow = (data.shadow_persona as Record<string, unknown>) ?? {};
    return {
      primaryPersona: {
        name: (primary.name as string) ?? '',
        traits: (primary.traits as string[]) ?? [],
        triggerConditions: (primary.trigger_conditions as string[]) ?? [],
        behaviorPatterns: (primary.behavior_patterns as string[]) ?? [],
      },
      shadowPersona: {
        name: (shadow.name as string) ?? '',
        traits: (shadow.traits as string[]) ?? [],
        triggerConditions: (shadow.trigger_conditions as string[]) ?? [],
        behaviorPatterns: (shadow.behavior_patterns as string[]) ?? [],
      },
      internalConflict: (data.internal_conflict as string) ?? '',
      switchTriggers: (data.switch_triggers as string[]) ?? [],
      conflictScenarios: (data.conflict_scenarios as string[]) ?? [],
      dualityScore: (data.duality_score as number) ?? 50,
    };
  }

  private deserializeDialogueStyle(data: Record<string, unknown>): DialogueStyle {
    return {
      vocabularyLevel: (data.vocabulary_level as string) ?? 'medium',
      sentenceLength: (data.sentence_length as string) ?? 'medium',
      formality: (data.formality as string) ?? 'neutral',
      favoriteWords: (data.favorite_words as string[]) ?? [],
      avoidedWords: (data.avoided_words as string[]) ?? [],
      speechPatterns: (data.speech_patterns as string[]) ?? [],
      verbalTics: (data.verbal_tics as string[]) ?? [],
      emotionalExpression: (data.emotional_expression as string) ?? 'moderate',
      dialogueSamples: [],
    };
  }
}

// ============================================================
// Serialization helpers
// ============================================================

export function charToDict(char: Character): Record<string, unknown> {
  const result: Record<string, unknown> = {
    id: char.id, name: char.name, role: char.role,
    personality: personalityToDict(char.personality),
    background: backgroundToDict(char.background),
    motivation: motivationToDict(char.motivation),
    relationships: relationshipsToDict(char.relationships),
    growth: growthToDict(char.growth),
    created_at: char.createdAt,
    updated_at: char.updatedAt,
    state_count: char.stateHistory.length,
    dialogue_count: char.dialogueHistory.length,
  };
  if (char.dynamicEmotion) result.dynamic_emotion = dynamicEmotionToDict(char.dynamicEmotion);
  if (char.competence) result.competence = competenceToDict(char.competence);
  if (char.eccentricity) result.eccentricity = eccentricityToDict(char.eccentricity);
  if (char.environmentContrast) result.environment_contrast = environmentContrastToDict(char.environmentContrast);
  if (char.dualPersonality) result.dual_personality = dualPersonalityToDict(char.dualPersonality);
  if (char.dialogueStyle) result.dialogue_style = dialogueStyleToDict(char.dialogueStyle);

  const score = getFiveDimensionScore(char);
  result.five_dimension_score = { ...score, overall: getOverallScore(score), depth_level: getDepthLevel(score) };

  return result;
}

function personalityToDict(p: Personality): Record<string, unknown> {
  return {
    type: p.type, core_traits: p.coreTraits, strengths: p.strengths,
    weaknesses: p.weaknesses, quirks: p.quirks, speech_patterns: p.speechPatterns,
    values: p.values,
    big_five: { openness: p.openness, conscientiousness: p.conscientiousness, extraversion: p.extraversion, agreeableness: p.agreeableness, neuroticism: p.neuroticism },
  };
}

function backgroundToDict(b: Background): Record<string, unknown> {
  return {
    birth_place: b.birthPlace, family_structure: b.familyStructure,
    social_class: b.socialClass, education: b.education, occupation: b.occupation,
    childhood_events: b.childhoodEvents.map((e) => ({ age: e.age, description: e.description, impact: e.impact })),
    formative_events: b.formativeEvents.map((e) => ({ age: e.age, description: e.description, impact: e.impact })),
    trauma: b.trauma.map((e) => ({ description: e.description, impact: e.impact, emotional_residue: e.emotionalResidue })),
    gifts: b.gifts, secrets: b.secrets,
  };
}

function motivationToDict(m: Motivation): Record<string, unknown> {
  return {
    type: m.type, surface_goal: m.surfaceGoal, deep_need: m.deepNeed,
    inner_fear: m.innerFear, want: m.want, need: m.need, lie: m.lie, ghost: m.ghost, stakes: m.stakes,
  };
}

function relationshipsToDict(r: Relationships): Record<string, unknown> {
  return {
    connections: r.connections.map((c) => ({
      target_id: c.targetId, target_name: c.targetName, type: c.type,
      trust_level: c.trustLevel, power_balance: c.powerBalance,
      emotional_bond: c.emotionalBond, conflict_potential: c.conflictPotential,
      history: c.history, current_status: c.currentStatus, tension_points: c.tensionPoints,
    })),
    social_role: r.socialRole, group_affiliations: r.groupAffiliations,
  };
}

function growthToDict(g: GrowthArc): Record<string, unknown> {
  return {
    arc_type: g.arcType, starting_state: g.startingState, ending_state: g.endingState,
    catalyst: g.catalyst, turning_points: g.turningPoints, current_stage: g.currentStage,
    progress: g.progress, belief_change: g.beliefChange, skill_growth: g.skillGrowth,
    relationship_evolution: g.relationshipEvolution,
  };
}

function dynamicEmotionToDict(d: DynamicEmotion): Record<string, unknown> {
  return { static_emotion: d.staticEmotion, dynamic_emotion: d.dynamicEmotion, intensity: d.intensity, evolution: d.evolution };
}

function competenceToDict(c: Competence): Record<string, unknown> {
  return { primary_skill: c.primarySkill, skill_level: c.skillLevel, specializations: c.specializations, demonstrations: c.demonstrations, limitations: c.limitations };
}

function eccentricityToDict(e: Eccentricity): Record<string, unknown> {
  return { quirks: e.quirks, obsessions: e.obsessions, unusual_habits: e.unusualHabits, unique_worldview: e.uniqueWorldview, catchphrases: e.catchphrases, eccentricity_level: e.eccentricityLevel };
}

function environmentContrastToDict(e: EnvironmentContrast): Record<string, unknown> {
  return { comfort_zone: e.comfortZone, current_environment: e.currentEnvironment, contrast_level: e.contrastLevel, friction_points: e.frictionPoints, growth_opportunities: e.growthOpportunities, contrast_score: e.contrastScore };
}

function dualPersonalityToDict(d: DualPersonality): Record<string, unknown> {
  return {
    primary_persona: { name: d.primaryPersona.name, traits: d.primaryPersona.traits, trigger_conditions: d.primaryPersona.triggerConditions, behavior_patterns: d.primaryPersona.behaviorPatterns },
    shadow_persona: { name: d.shadowPersona.name, traits: d.shadowPersona.traits, trigger_conditions: d.shadowPersona.triggerConditions, behavior_patterns: d.shadowPersona.behaviorPatterns },
    internal_conflict: d.internalConflict, switch_triggers: d.switchTriggers,
    conflict_scenarios: d.conflictScenarios, duality_score: d.dualityScore,
  };
}

function dialogueStyleToDict(d: DialogueStyle): Record<string, unknown> {
  return {
    vocabulary_level: d.vocabularyLevel, sentence_length: d.sentenceLength, formality: d.formality,
    favorite_words: d.favoriteWords, avoided_words: d.avoidedWords, speech_patterns: d.speechPatterns,
    verbal_tics: d.verbalTics, emotional_expression: d.emotionalExpression, sample_count: d.dialogueSamples.length,
  };
}
