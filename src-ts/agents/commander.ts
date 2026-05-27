/**
 * CommanderAgent - Task routing and orchestration
 *
 * Routes user tasks to appropriate workflow levels (L1-L5),
 * detects scene types, and generates task assignments for agents.
 */

import { WorkflowLevel, toWorkflowLabel } from '../workflow/types';
import { BaseAgent } from './base';
import type { IAgentLLMService } from './base';
import { SkillRouter } from './skill-router';
import type { SkillRecommendation } from './skill-router';

// --- Data types ---

export interface TaskAnalysis {
  reasoning: string;
  workflowLevel: number;
}

export enum SceneType {
  OPENING = 'opening',
  DIALOGUE = 'dialogue',
  ACTION = 'action',
  CLIMAX = 'climax',
  ENDING = 'ending',
  TRANSITION = 'transition',
  WORLDBUILDING = 'worldbuilding',
  CHARACTER_FOCUS = 'character_focus',
  SUSPENSE = 'suspense',
}

export interface TaskAssignment {
  taskId: string;
  agentType: string;
  sceneType: SceneType;
  instruction: string;
  skills: string[];
  context: Record<string, unknown>;
  dependsOn: string[];
}

export interface TaskDecomposition {
  sceneType: string;
  subtasks: string[];
  agentSequence: string[];
}

export interface CommanderOutput {
  workflowLevel: number;
  taskAssignments: TaskAssignment[];
  totalSteps: number;
  estimatedTokens: number;
}

// Scene type to skill mapping
const SCENE_SKILL_MAP: Record<SceneType, string[]> = {
  [SceneType.OPENING]: ['opening-craft', 'tension-scene', 'character-forge'],
  [SceneType.DIALOGUE]: ['dialogue-system', 'psychology-craft', 'show-dont-tell'],
  [SceneType.ACTION]: ['action-craft', 'tension-scene', 'pov-system'],
  [SceneType.CLIMAX]: ['conflict-escalation', 'tension-arc', 'emotion-arc'],
  [SceneType.ENDING]: ['ending-craft', 'foreshadowing-craft', 'emotion-arc'],
  [SceneType.TRANSITION]: ['transition-craft', 'timeline-craft'],
  [SceneType.WORLDBUILDING]: ['worldview-craft', 'setting-craft', 'environment-craft'],
  [SceneType.CHARACTER_FOCUS]: ['character-forge', 'four-selves', 'psychology-craft'],
  [SceneType.SUSPENSE]: ['suspense-craft', 'foreshadowing-craft', 'misdirection-twist'],
};

// --- CommanderAgent ---

export class CommanderAgent extends BaseAgent {
  private llmService: IAgentLLMService | null;
  private skillRouter: SkillRouter;
  private lastRouteDiagnostics: Record<string, unknown>;

  constructor(
    llmService?: IAgentLLMService | null,
    name = 'Commander',
    config?: Record<string, unknown>,
  ) {
    super(name, config);
    this.llmService = llmService ?? null;
    this.skillRouter = new SkillRouter();
    this.lastRouteDiagnostics = {
      fallbackUsed: false,
      matchedKeywords: [],
      routingMethod: 'unknown',
    };
  }

  /** Heuristic routing when LLM is unavailable or fails */
  private routeByHeuristics(taskDescription: string): number {
    const taskLower = taskDescription.toLowerCase();

    const keywordGroups: [number, string[]][] = [
      [
        WorkflowLevel.L1_RAPID,
        ['typo', 'fix', 'polish', 'correct', 'grammar', '修复', '错别字', '纠正', '语法'],
      ],
      [
        WorkflowLevel.L2_LITE,
        ['paragraph', 'short', 'snippet', '段落', '片段', '短文'],
      ],
      [
        WorkflowLevel.L4_BRAINSTORM,
        [
          'brainstorm', 'idea', 'concept', 'world', 'character', 'setting', 'story', 'plot', 'outline', 'arc',
          '头脑风暴', '构思', '世界观', '设定', '角色', '性格', '设计', '体系', '大纲', '剧情', '情节', '规划', '计划',
        ],
      ],
      [
        WorkflowLevel.L5_COORDINATOR,
        ['project', 'roadmap', 'full', 'novel', '长篇', '完整', '小说', '项目'],
      ],
    ];

    for (const [level, keywords] of keywordGroups) {
      if (keywords.some((kw) => taskLower.includes(kw))) {
        this.lastRouteDiagnostics = {
          fallbackUsed: true,
          matchedKeywords: keywords.filter((kw) => taskLower.includes(kw)),
          routingMethod: 'heuristic',
        };
        return level;
      }
    }

    this.lastRouteDiagnostics = {
      fallbackUsed: true,
      matchedKeywords: [],
      routingMethod: 'heuristic_default',
    };
    return WorkflowLevel.L3_STANDARD;
  }

  /** Route task to appropriate workflow level */
  async route(taskDescription: string): Promise<number> {
    if (!this.llmService) {
      return this.routeByHeuristics(taskDescription);
    }

    try {
      const systemPrompt = 'You are a creative writing workflow router. Analyze the user request and determine the complexity level.';
      const userPrompt = `Analyze this creative writing request and determine the workflow level (1-5):

${taskDescription}

Respond with JSON:
{
  "reasoning": "Brief explanation",
  "workflow_level": <1-5>
}

Levels:
1 = Quick fix (typo, grammar, polish)
2 = Simple task (single paragraph, short scene)
3 = Standard (chapter, character development)
4 = Brainstorm (multi-perspective, creative exploration)
5 = Full project (novel, complex multi-step)`;

      const result = await this.llmService.generateJson<TaskAnalysis>(userPrompt, {
        systemPrompt,
      });

      const level = result.workflowLevel;
      if (typeof level === 'number' && level >= 1 && level <= 5) {
        this.lastRouteDiagnostics = {
          fallbackUsed: false,
          matchedKeywords: [],
          routingMethod: 'llm',
        };
        return level;
      }
    } catch (e) {
      this.logActivity('LLM routing failed, falling back to heuristics', { detail: e });
    }

    return this.routeByHeuristics(taskDescription);
  }

  /** Detect scene type from content */
  async detectSceneChange(content: string): Promise<SceneType> {
    const contentLower = content.toLowerCase();

    const sceneKeywords: [SceneType, string[]][] = [
      [SceneType.OPENING, ['开篇', '开始', '开头', 'opening', 'beginning', 'first scene']],
      [SceneType.DIALOGUE, ['对话', '对白', '台词', 'dialogue', 'conversation', 'said']],
      [SceneType.ACTION, ['动作', '战斗', '追逐', 'action', 'fight', 'chase', 'battle']],
      [SceneType.CLIMAX, ['高潮', '巅峰', 'climax', 'peak', 'confrontation']],
      [SceneType.ENDING, ['结局', '结尾', 'ending', 'conclusion', 'final']],
      [SceneType.WORLDBUILDING, ['世界', '设定', '环境', 'world', 'setting', 'environment']],
      [SceneType.CHARACTER_FOCUS, ['角色', '人物', 'character', 'personality', 'backstory']],
      [SceneType.SUSPENSE, ['悬念', '紧张', 'suspense', 'tension', 'mystery']],
    ];

    for (const [sceneType, keywords] of sceneKeywords) {
      if (keywords.some((kw) => contentLower.includes(kw))) {
        return sceneType;
      }
    }
    return SceneType.TRANSITION;
  }

  /** Dispatch tasks based on workflow level */
  async dispatchTasks(taskDescription: string, level: number): Promise<TaskAssignment[]> {
    const sceneType = await this.detectSceneChange(taskDescription);
    const levelLabel = toWorkflowLabel(level);
    const skills = SCENE_SKILL_MAP[sceneType] ?? [];
    const assignments: TaskAssignment[] = [];

    if (level === WorkflowLevel.L1_RAPID) {
      assignments.push({
        taskId: 'task-001',
        agentType: 'writer',
        sceneType,
        instruction: `Quick fix: ${taskDescription}`,
        skills: [],
        context: { level: levelLabel, max_tokens: 500 },
        dependsOn: [],
      });
    } else if (level === WorkflowLevel.L2_LITE) {
      assignments.push({
        taskId: 'task-001',
        agentType: 'writer',
        sceneType,
        instruction: `Write: ${taskDescription}`,
        skills,
        context: { level: levelLabel, max_tokens: 1000 },
        dependsOn: [],
      });
    } else if (level === WorkflowLevel.L3_STANDARD) {
      assignments.push({
        taskId: 'task-001',
        agentType: 'architect',
        sceneType,
        instruction: `Design structure: ${taskDescription}`,
        skills: ['22-steps-outline'],
        context: { level: levelLabel },
        dependsOn: [],
      });
      assignments.push({
        taskId: 'task-002',
        agentType: 'writer',
        sceneType,
        instruction: `Write based on architectural plan: ${taskDescription}`,
        skills,
        context: { level: levelLabel, max_tokens: 2000 },
        dependsOn: ['task-001'],
      });
      assignments.push({
        taskId: 'task-003',
        agentType: 'critic',
        sceneType,
        instruction: 'Evaluate writing quality with LOCK dimensions',
        skills: ['script-doctor'],
        context: { level: levelLabel },
        dependsOn: ['task-002'],
      });
    } else if (level === WorkflowLevel.L4_BRAINSTORM) {
      assignments.push({
        taskId: 'task-001',
        agentType: 'architect',
        sceneType,
        instruction: `Brainstorm structure: ${taskDescription}`,
        skills: ['22-steps-outline', 'pyramid-structure'],
        context: { level: levelLabel },
        dependsOn: [],
      });
      assignments.push({
        taskId: 'task-002',
        agentType: 'character',
        sceneType: SceneType.CHARACTER_FOCUS,
        instruction: `Gather character context: ${taskDescription}`,
        skills: ['character-forge'],
        context: { level: levelLabel },
        dependsOn: [],
      });
      assignments.push({
        taskId: 'task-003',
        agentType: 'critic',
        sceneType,
        instruction: 'Analyze brainstorm feasibility',
        skills: ['self-knowledge-eval'],
        context: { level: levelLabel },
        dependsOn: ['task-001'],
      });
      assignments.push({
        taskId: 'task-004',
        agentType: 'writer',
        sceneType,
        instruction: `Write based on brainstorm synthesis: ${taskDescription}`,
        skills,
        context: { level: levelLabel, max_tokens: 2500 },
        dependsOn: ['task-003'],
      });
      assignments.push({
        taskId: 'task-005',
        agentType: 'critic',
        sceneType,
        instruction: 'Evaluate brainstorm output with 8-dimension LOCK matrix',
        skills: ['script-doctor', 'self-knowledge-eval'],
        context: { level: levelLabel },
        dependsOn: ['task-004'],
      });
    } else if (level === WorkflowLevel.L5_COORDINATOR) {
      assignments.push({
        taskId: 'task-001',
        agentType: 'worldbuilding',
        sceneType: SceneType.WORLDBUILDING,
        instruction: `Gather world context: ${taskDescription}`,
        skills: ['worldview-craft', 'setting-craft'],
        context: { level: 'L5' },
        dependsOn: [],
      });
      assignments.push({
        taskId: 'task-002',
        agentType: 'character',
        sceneType: SceneType.CHARACTER_FOCUS,
        instruction: `Gather character context: ${taskDescription}`,
        skills: ['character-forge', 'four-selves'],
        context: { level: 'L5' },
        dependsOn: [],
      });
      assignments.push({
        taskId: 'task-003',
        agentType: 'architect',
        sceneType,
        instruction: `Design structure with full context: ${taskDescription}`,
        skills: ['22-steps-outline', 'pyramid-structure'],
        context: { level: 'L5' },
        dependsOn: ['task-001', 'task-002'],
      });
      assignments.push({
        taskId: 'task-004',
        agentType: 'writer',
        sceneType,
        instruction: `Write with coordinator depth: ${taskDescription}`,
        skills,
        context: { level: 'L5', max_tokens: 3000 },
        dependsOn: ['task-003'],
      });
      assignments.push({
        taskId: 'task-005',
        agentType: 'critic',
        sceneType,
        instruction: 'Full 8-dimension evaluation with LOCK analysis',
        skills: ['script-doctor', 'self-knowledge-eval', 'deus-ex-machina'],
        context: { level: 'L5' },
        dependsOn: ['task-004'],
      });
    }

    this.logActivity(`Dispatched ${assignments.length} tasks for ${levelLabel}`);
    return assignments;
  }

  /** Integrate results from multiple agents */
  integrateResults(results: Record<string, unknown>[]): Record<string, unknown> {
    const finalOutput: Record<string, unknown> = {
      status: 'completed',
      content: '',
      metadata: {
        agentsInvoked: [] as string[],
        totalTokens: 0,
        qualityScore: 0,
      },
    };

    const metadata = finalOutput.metadata as Record<string, unknown>;
    const agentsInvoked = metadata.agentsInvoked as string[];

    for (const result of results) {
      const agentType = (result.agentType as string) ?? 'unknown';
      agentsInvoked.push(agentType);
      metadata.totalTokens = (metadata.totalTokens as number) + ((result.tokensUsed as number) ?? 0);

      if (agentType === 'writer') {
        finalOutput.content = (result.content as string) ?? '';
      } else if (agentType === 'critic') {
        metadata.qualityScore = (result.score as number) ?? 0;
        metadata.decision = (result.decision as string) ?? 'UNKNOWN';
      }
    }

    this.logActivity(`Integrated results from ${results.length} agents`);
    return finalOutput;
  }

  /** Full execution pipeline */
  async execute(taskDescription: string): Promise<CommanderOutput> {
    const level = await this.route(taskDescription);
    const assignments = await this.dispatchTasks(taskDescription, level);

    const output: CommanderOutput = {
      workflowLevel: level,
      taskAssignments: assignments,
      totalSteps: assignments.length,
      estimatedTokens: assignments.reduce(
        (sum, a) => sum + ((a.context.max_tokens as number) ?? 1000),
        0,
      ),
    };

    this.logActivity(
      `Commander execution complete: ${toWorkflowLabel(level)}, ${assignments.length} tasks`,
    );
    return output;
  }

  /** BaseAgent.run implementation */
  run(inputData: Record<string, unknown>): Promise<unknown> {
    const taskDescription = (inputData.taskDescription as string) ?? (inputData.description as string) ?? '';
    return this.execute(taskDescription);
  }
}

// --- LangGraph-style node/chain helpers ---

export function createCommanderNode(llmService: IAgentLLMService | null) {
  return async (state: Record<string, unknown>): Promise<Record<string, unknown>> => {
    const commander = new CommanderAgent(llmService);
    const taskDescription = (state.userRequest as string) ?? '';
    const result = await commander.execute(taskDescription);
    return { ...state, commanderOutput: result };
  };
}

export function createCommanderChain(llmService: IAgentLLMService | null) {
  return async (input: string): Promise<CommanderOutput> => {
    const commander = new CommanderAgent(llmService);
    return commander.execute(input);
  };
}
