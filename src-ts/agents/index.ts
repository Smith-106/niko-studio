/**
 * agents/index.ts - Barrel file re-exporting all agent types and classes.
 */

import { AgentType } from "./base";

// base.ts
export {
  ModelProvider,
  AgentType,
  MODEL_PRICING,
  BudgetExceededError,
  tokenUsageToDict,
  BaseAgent,
} from "./base";

/** All available agent names (for health reporting and introspection) */
export const AGENT_NAMES: readonly string[] = [
  ...Object.values(AgentType),
  'worldbuilding',
  'character',
];

export type {
  ModelPricing,
  TokenUsage,
  BudgetConfig,
  IAgentLLMService,
  IAgentGraphEngine,
  IAgentMemoryEngine,
} from "./base";

// sequential-thinking.ts
export {
  ThoughtType,
  ThoughtStatus,
  thoughtDataToDict,
  thoughtDataFromDictProper as thoughtDataFromDict,
  SequentialThinking,
} from "./sequential-thinking";

export type {
  ThoughtData,
  Branch,
} from "./sequential-thinking";

// skill-router.ts
export {
  TaskType,
  SKILL_REGISTRY,
  TASK_SKILL_MAP,
  SkillRouter,
  getSkillsForTask,
  getSkillsForIssue,
} from "./skill-router";

export type {
  SkillRecommendation,
} from "./skill-router";

// character.ts
export { CharacterAgent } from "./character";
export type { CharacterProfile, CharacterContext } from "./character";

// plot.ts
export { PlotAgent, ForeshadowStatus } from "./plot";
export type { Foreshadow, TimelineEvent, PlotContext } from "./plot";

// worldbuilding.ts
export { WorldbuildingAgent } from "./worldbuilding";
export type { WorldSetting, WorldContext } from "./worldbuilding";

// architect.ts
export { ArchitectAgent, createArchitectNode, createArchitectChain } from "./architect";
export type {
  LOCKAnalysis,
  TwoDoorsStructure,
  SceneCard,
  RhythmAnalysis,
  StoryBlueprint,
} from "./architect";

// critic.ts
export { CriticAgent, createCriticNode, createCriticChain } from "./critic";
export type {
  LOCKSceneCheck,
  LOCKDimensionResult,
  LOCKAnalysisResult,
  CriticDecision,
  CriticOutput,
} from "./critic";

// writer.ts
export { WriterAgent, createWriterNode, createWriterChain } from "./writer";
export type { WriterInput, WriterOutput } from "./writer";

// commander.ts
export {
  CommanderAgent,
  SceneType,
  createCommanderNode,
  createCommanderChain,
} from "./commander";
export type {
  TaskAssignment,
  TaskDecomposition,
  CommanderOutput,
} from "./commander";

// factory.ts
export { AgentFactory } from "./factory";
export type { AgentConstructor } from "./factory";

// registry.ts
export { AgentRegistry } from "./registry";

// lifecycle-hooks.ts
export {
  LifecycleStage,
  LifecycleHookRegistry,
} from "./lifecycle-hooks";

export type {
  AgentLifecycleHook,
  AgentContext,
} from "./lifecycle-hooks";
