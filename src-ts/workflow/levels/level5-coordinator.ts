/**
 * level5-coordinator.ts - L5 Coordinator mode
 *
 * Intelligent workflow orchestration: requirement analysis, command chain
 * recommendation, minimal execution unit, state persistence.
 * Suitable for: complete novel creation, complex revision, multi-module collaboration.
 *
 * Command chain:
 * analyze_requirements -> recommend_chain -> execute_chain -> persist_state
 *
 * Migrated from src/workflow/levels/level5_coordinator.py
 */

import { randomUUID } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { BaseState } from '../state.js';
import { AgentType } from '../../agents/base.js';
import { createIterativeRetriever } from '../../search/index.js';
import type { IServiceContainer } from './level1-rapid.js';
import { Level2Lite } from './level2-lite.js';
import { Level3Standard } from './level3-standard.js';
import { Level4Brainstorm } from './level4-brainstorm.js';
import { ContentType, SessionManager } from '../session/session-manager.js';

// ============================================================
// Minimal SessionManager interface (not yet migrated)
// ============================================================

export interface ISessionManager {
  init(sessionId: string, options?: { sessionType?: string; domain?: string }): void;
  write(sessionId: string, contentType: string, content: string): void;
  read(sessionId: string, contentType: string): string | null;
}

interface ICoordinatorAnalysisRetriever {
  hybridSearch(params: {
    query: string;
    scope?: string;
    limit?: number;
    profile?: string | null;
    minScore?: number | null;
    budgetTokens?: number | null;
    rerank?: boolean;
    routeMode?: string | null;
  }): Promise<Array<Record<string, unknown>>>;
  resolveContext(text: string): Promise<string>;
}

function createSessionManagerAdapter(sessionManager = new SessionManager()): ISessionManager {
  return {
    init(sessionId: string, options?: { sessionType?: string; domain?: string }): void {
      sessionManager.init(
        sessionId,
        options?.sessionType ?? 'coordinator',
        'workflow',
        options?.domain ?? 'novel',
      );
    },
    write(sessionId: string, contentType: string, content: string): void {
      if (contentType !== 'state') return;
      sessionManager.write(sessionId, ContentType.STATE, content);
    },
    read(sessionId: string, contentType: string): string | null {
      if (contentType !== 'state') return null;
      const payload = sessionManager.read(sessionId, ContentType.STATE);
      return payload || null;
    },
  };
}

function createDefaultAnalysisRetriever(): ICoordinatorAnalysisRetriever {
  const retriever = createIterativeRetriever({
    projectRoot: process.cwd(),
  });

  return {
    async hybridSearch(params) {
      const results = await retriever.hybridSearch(
        params.query,
        params.scope ?? 'all',
        params.limit ?? 5,
        params.profile ?? undefined,
        params.minScore ?? undefined,
        params.budgetTokens ?? undefined,
        params.rerank ?? true,
        params.routeMode ?? 'hybrid',
      );
      return results as Array<Record<string, unknown>>;
    },
    resolveContext(text: string) {
      return retriever.resolveContext(text);
    },
  };
}

// ============================================================
// Data types
// ============================================================

export enum CommandType {
  ANALYZE = 'analyze',
  PLAN = 'plan',
  EXECUTE = 'execute',
  VERIFY = 'verify',
  REVISE = 'revise',
}

export enum ExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
}

export interface Command {
  commandId: string;
  commandType: CommandType;
  name: string;
  description: string;
  agent: string;
  parameters: Record<string, unknown>;
}

export function commandToDict(cmd: Command): Record<string, unknown> {
  return {
    command_id: cmd.commandId,
    command_type: cmd.commandType,
    name: cmd.name,
    description: cmd.description,
    agent: cmd.agent,
    parameters: cmd.parameters,
  };
}

export function commandFromDict(data: Record<string, unknown>): Command {
  return {
    commandId: data.command_id as string,
    commandType: data.command_type as CommandType,
    name: data.name as string,
    description: data.description as string,
    agent: data.agent as string,
    parameters: (data.parameters as Record<string, unknown>) ?? {},
  };
}

export interface CommandChain {
  chainId: string;
  name: string;
  description: string;
  commands: Command[];
  dependencies: Record<string, string[]>;
  executionOrder: string[];
  estimatedDuration: number;
}

export function createCommandChain(
  chainId: string,
  name: string,
  description: string,
): CommandChain {
  return {
    chainId,
    name,
    description,
    commands: [],
    dependencies: {},
    executionOrder: [],
    estimatedDuration: 0,
  };
}

export function addCommandToChain(
  chain: CommandChain,
  command: Command,
  dependsOn: string[] = [],
): void {
  chain.commands.push(command);
  chain.dependencies[command.commandId] = dependsOn;
  updateExecutionOrder(chain);
}

function updateExecutionOrder(chain: CommandChain): void {
  const visited = new Set<string>();
  const order: string[] = [];

  function visit(cmdId: string): void {
    if (visited.has(cmdId)) return;
    visited.add(cmdId);
    for (const dep of chain.dependencies[cmdId] ?? []) {
      visit(dep);
    }
    order.push(cmdId);
  }

  for (const cmd of chain.commands) {
    visit(cmd.commandId);
  }

  chain.executionOrder = order;
}

export function getCommandFromChain(chain: CommandChain, commandId: string): Command | undefined {
  return chain.commands.find(cmd => cmd.commandId === commandId);
}

export function commandChainToDict(chain: CommandChain): Record<string, unknown> {
  return {
    chain_id: chain.chainId,
    name: chain.name,
    description: chain.description,
    commands: chain.commands.map(commandToDict),
    dependencies: chain.dependencies,
    execution_order: chain.executionOrder,
    estimated_duration: chain.estimatedDuration,
  };
}

export function commandChainFromDict(data: Record<string, unknown>): CommandChain {
  const chain = createCommandChain(
    data.chain_id as string,
    data.name as string,
    data.description as string,
  );
  chain.commands = ((data.commands as Record<string, unknown>[]) ?? []).map(commandFromDict);
  chain.dependencies = (data.dependencies as Record<string, string[]>) ?? {};
  chain.executionOrder = (data.execution_order as string[]) ?? [];
  chain.estimatedDuration = (data.estimated_duration as number) ?? 0;
  return chain;
}

export interface ExecutionUnit {
  unitId: string;
  command: Command;
  state: ExecutionStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  retryCount: number;
  maxRetries: number;
}

export function createExecutionUnit(unitId: string, command: Command): ExecutionUnit {
  return {
    unitId,
    command,
    state: ExecutionStatus.PENDING,
    result: null,
    error: null,
    startedAt: null,
    completedAt: null,
    retryCount: 0,
    maxRetries: 3,
  };
}

export function startUnit(unit: ExecutionUnit): void {
  unit.state = ExecutionStatus.RUNNING;
  unit.startedAt = new Date().toISOString();
}

export function completeUnit(unit: ExecutionUnit, result: Record<string, unknown>): void {
  unit.state = ExecutionStatus.COMPLETED;
  unit.result = result;
  unit.completedAt = new Date().toISOString();
}

export function failUnit(unit: ExecutionUnit, error: string): void {
  unit.state = ExecutionStatus.FAILED;
  unit.error = error;
  unit.completedAt = new Date().toISOString();
}

export function canRetryUnit(unit: ExecutionUnit): boolean {
  return unit.retryCount < unit.maxRetries;
}

export function executionUnitToDict(unit: ExecutionUnit): Record<string, unknown> {
  return {
    unit_id: unit.unitId,
    command: commandToDict(unit.command),
    state: unit.state,
    result: unit.result,
    error: unit.error,
    started_at: unit.startedAt,
    completed_at: unit.completedAt,
    retry_count: unit.retryCount,
    max_retries: unit.maxRetries,
  };
}

export function executionUnitFromDict(data: Record<string, unknown>): ExecutionUnit {
  return {
    unitId: data.unit_id as string,
    command: commandFromDict(data.command as Record<string, unknown>),
    state: data.state as ExecutionStatus,
    result: (data.result as Record<string, unknown>) ?? null,
    error: (data.error as string) ?? null,
    startedAt: (data.started_at as string) ?? null,
    completedAt: (data.completed_at as string) ?? null,
    retryCount: (data.retry_count as number) ?? 0,
    maxRetries: (data.max_retries as number) ?? 3,
  };
}

export interface RequirementAnalysis {
  taskType: string;
  complexity: number;
  estimatedSteps: number;
  requiredAgents: string[];
  suggestedChain: string;
  constraints: string[];
  risks: string[];
}

export function requirementAnalysisToDict(ra: RequirementAnalysis): Record<string, unknown> {
  return {
    task_type: ra.taskType,
    complexity: ra.complexity,
    estimated_steps: ra.estimatedSteps,
    required_agents: ra.requiredAgents,
    suggested_chain: ra.suggestedChain,
    constraints: ra.constraints,
    risks: ra.risks,
  };
}

export function requirementAnalysisFromDict(data: Record<string, unknown>): RequirementAnalysis {
  return {
    taskType: (data.task_type as string) ?? '',
    complexity: (data.complexity as number) ?? 0,
    estimatedSteps: (data.estimated_steps as number) ?? 0,
    requiredAgents: (data.required_agents as string[]) ?? [],
    suggestedChain: (data.suggested_chain as string) ?? '',
    constraints: (data.constraints as string[]) ?? [],
    risks: (data.risks as string[]) ?? [],
  };
}

export interface CoordinatorState {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  requirementAnalysis: RequirementAnalysis | null;
  commandChain: CommandChain | null;
  executionUnits: ExecutionUnit[];
  currentUnitIndex: number;
  phase: 'init' | 'analyzing' | 'planning' | 'executing' | 'completed' | 'failed';
  overallProgress: number;
  finalResult: Record<string, unknown> | null;
  errors: string[];
}

export function createCoordinatorState(sessionId: string): CoordinatorState {
  const now = new Date().toISOString();
  return {
    sessionId,
    createdAt: now,
    updatedAt: now,
    requirementAnalysis: null,
    commandChain: null,
    executionUnits: [],
    currentUnitIndex: 0,
    phase: 'init',
    overallProgress: 0.0,
    finalResult: null,
    errors: [],
  };
}

export function coordinatorStateToDict(cs: CoordinatorState): Record<string, unknown> {
  return {
    session_id: cs.sessionId,
    created_at: cs.createdAt,
    updated_at: cs.updatedAt,
    requirement_analysis: cs.requirementAnalysis ? requirementAnalysisToDict(cs.requirementAnalysis) : null,
    command_chain: cs.commandChain ? commandChainToDict(cs.commandChain) : null,
    execution_units: cs.executionUnits.map(executionUnitToDict),
    current_unit_index: cs.currentUnitIndex,
    phase: cs.phase,
    overall_progress: cs.overallProgress,
    final_result: cs.finalResult,
    errors: cs.errors,
  };
}

export function coordinatorStateFromDict(data: Record<string, unknown>): CoordinatorState {
  const cs = createCoordinatorState(data.session_id as string);
  cs.createdAt = (data.created_at as string) ?? cs.createdAt;
  cs.updatedAt = (data.updated_at as string) ?? cs.updatedAt;

  if (data.requirement_analysis) {
    cs.requirementAnalysis = requirementAnalysisFromDict(data.requirement_analysis as Record<string, unknown>);
  }

  if (data.command_chain) {
    cs.commandChain = commandChainFromDict(data.command_chain as Record<string, unknown>);
  }

  cs.executionUnits = ((data.execution_units as Record<string, unknown>[]) ?? []).map(executionUnitFromDict);
  cs.currentUnitIndex = (data.current_unit_index as number) ?? 0;
  cs.phase = (data.phase as CoordinatorState['phase']) ?? 'init';
  cs.overallProgress = (data.overall_progress as number) ?? 0.0;
  cs.finalResult = (data.final_result as Record<string, unknown>) ?? null;
  cs.errors = (data.errors as string[]) ?? [];

  return cs;
}

// ============================================================
// Predefined chain templates
// ============================================================

function makeCmd(id: string, type: CommandType, name: string, desc: string, agent: string): Command {
  return { commandId: id, commandType: type, name, description: desc, agent, parameters: {} };
}

export const CHAIN_TEMPLATES: Record<string, CommandChain> = {
  novel_creation: {
    chainId: 'tpl_novel_creation',
    name: '完整小说创作',
    description: '从构思到完成的完整小说创作流程',
    commands: [
      makeCmd('cmd_1', CommandType.ANALYZE, '需求理解', '理解创作需求', 'coordinator'),
      makeCmd('cmd_2', CommandType.PLAN, '世界观构建', '构建小说世界观', 'architect'),
      makeCmd('cmd_3', CommandType.PLAN, '角色设计', '设计主要角色', 'architect'),
      makeCmd('cmd_4', CommandType.PLAN, '大纲规划', '规划整体大纲', 'architect'),
      makeCmd('cmd_5', CommandType.EXECUTE, '章节撰写', '撰写各章节内容', 'writer'),
      makeCmd('cmd_6', CommandType.VERIFY, '内容审核', '审核内容质量', 'critic'),
      makeCmd('cmd_7', CommandType.REVISE, '修订完善', '根据反馈修订', 'writer'),
    ],
    dependencies: {
      cmd_1: [],
      cmd_2: ['cmd_1'],
      cmd_3: ['cmd_1'],
      cmd_4: ['cmd_2', 'cmd_3'],
      cmd_5: ['cmd_4'],
      cmd_6: ['cmd_5'],
      cmd_7: ['cmd_6'],
    },
    executionOrder: ['cmd_1', 'cmd_2', 'cmd_3', 'cmd_4', 'cmd_5', 'cmd_6', 'cmd_7'],
    estimatedDuration: 0,
  },

  chapter_revision: {
    chainId: 'tpl_chapter_revision',
    name: '章节修订',
    description: '对现有章节进行深度修订',
    commands: [
      makeCmd('cmd_1', CommandType.ANALYZE, '问题分析', '分析现有问题', 'critic'),
      makeCmd('cmd_2', CommandType.PLAN, '修订计划', '制定修订计划', 'architect'),
      makeCmd('cmd_3', CommandType.EXECUTE, '执行修订', '执行修订内容', 'writer'),
      makeCmd('cmd_4', CommandType.VERIFY, '质量验证', '验证修订质量', 'critic'),
    ],
    dependencies: {
      cmd_1: [],
      cmd_2: ['cmd_1'],
      cmd_3: ['cmd_2'],
      cmd_4: ['cmd_3'],
    },
    executionOrder: ['cmd_1', 'cmd_2', 'cmd_3', 'cmd_4'],
    estimatedDuration: 0,
  },

  brainstorm_synthesis: {
    chainId: 'tpl_brainstorm_synthesis',
    name: '头脑风暴综合',
    description: '多角度头脑风暴后的综合整理',
    commands: [
      makeCmd('cmd_1', CommandType.ANALYZE, '观点收集', '收集多角度观点', 'coordinator'),
      makeCmd('cmd_2', CommandType.ANALYZE, '冲突识别', '识别观点冲突', 'devil_advocate'),
      makeCmd('cmd_3', CommandType.PLAN, '综合方案', '制定综合方案', 'architect'),
      makeCmd('cmd_4', CommandType.EXECUTE, '方案实施', '实施综合方案', 'writer'),
      makeCmd('cmd_5', CommandType.VERIFY, '效果评估', '评估实施效果', 'critic'),
    ],
    dependencies: {
      cmd_1: [],
      cmd_2: ['cmd_1'],
      cmd_3: ['cmd_2'],
      cmd_4: ['cmd_3'],
      cmd_5: ['cmd_4'],
    },
    executionOrder: ['cmd_1', 'cmd_2', 'cmd_3', 'cmd_4', 'cmd_5'],
    estimatedDuration: 0,
  },
};

// ============================================================
// Level5Coordinator
// ============================================================

const DEFAULT_PERSIST_DIR = '.niko-studio/coordinator';

export class Level5Coordinator {
  readonly level = 5;
  readonly name = 'coordinator';
  readonly description = '协调者模式 - 智能编排、状态持久化';

  protected config: Record<string, unknown>;
  private persistDir: string;
  private _coordinatorState: CoordinatorState;
  private _sessionManager: ISessionManager;
  private _analysisRetriever: ICoordinatorAnalysisRetriever;

  constructor(
    config?: Record<string, unknown> | null,
    sessionManager?: ISessionManager,
    analysisRetriever?: ICoordinatorAnalysisRetriever,
  ) {
    this.config = config ?? {};
    this.persistDir = (this.config.persist_dir as string) ?? DEFAULT_PERSIST_DIR;
    this._coordinatorState = createCoordinatorState('init');
    this._sessionManager = sessionManager ?? createSessionManagerAdapter();
    this._analysisRetriever = analysisRetriever ?? createDefaultAnalysisRetriever();
  }

  /**
   * Execute coordinator workflow
   *
   * Flow:
   * 1. Requirement analysis (analyze_requirements)
   * 2. Command chain recommendation (recommend_chain)
   * 3. Execute command chain (execute_chain)
   * 4. State persistence (persist_state)
   */
  async execute(state: BaseState): Promise<BaseState> {
    const config = { ...this.getDefaultConfig(), ...this.config };

    const sessionId = (state.session_id as string) ?? randomUUID();
    state.session_id = sessionId;

    try {
      this._sessionManager.init(sessionId, {
        sessionType: 'coordinator',
        domain: (state as Record<string, unknown>).domain as string ?? 'novel',
      });
    } catch (exc) {
      state.warnings = [...(state.warnings ?? []), `SessionManager 初始化失败: ${exc}`];
    }

    const resumeState = await this._tryResume(sessionId);

    if (resumeState) {
      this._coordinatorState = resumeState;
      (state as Record<string, unknown>).resumed = true;
    } else {
      this._coordinatorState = createCoordinatorState(sessionId);
    }

    try {
      // Phase 1: requirement analysis
      if (this._coordinatorState.phase === 'init' || this._coordinatorState.phase === 'analyzing') {
        this._coordinatorState.phase = 'analyzing';
        state = this._analyzeRequirementsPhase(state);
        await this.persistState(this._coordinatorState);
      }

      // Phase 2: command chain recommendation
      if (this._coordinatorState.phase === 'analyzing') {
        this._coordinatorState.phase = 'planning';
        state = this._recommendChainPhase(state);
        await this.persistState(this._coordinatorState);
      }

      // Phase 3: execute command chain
      if (this._coordinatorState.phase === 'planning') {
        this._coordinatorState.phase = 'executing';
        state = await this._executeChainPhase(state);
        await this.persistState(this._coordinatorState);
      }

      // Phase 4: completion
      if (this._coordinatorState.phase === 'executing') {
        if (this._allUnitsCompleted()) {
          this._coordinatorState.phase = 'completed';
          state.decision = 'APPROVED';
        } else {
          state.decision = 'HUMAN_REVIEW';
          state.requires_human_intervention = true;
        }
      }

      // Update final state
      this._coordinatorState.updatedAt = new Date().toISOString();
      await this.persistState(this._coordinatorState);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      if (this._coordinatorState) {
        this._coordinatorState.phase = 'failed';
        this._coordinatorState.errors.push(errorMsg);
      }
      state.errors = [...(state.errors ?? []), `协调者执行失败: ${errorMsg}`];
      state.decision = 'FAILED';
      if (this._coordinatorState) {
        await this.persistState(this._coordinatorState);
      }
    }

    return state;
  }

  getRequiredAgents(): string[] {
    return ['coordinator', 'architect', 'writer', 'critic'];
  }

  getDefaultConfig(): Record<string, unknown> {
    return {
      max_revisions: 10,
      pass_score: 90,
      verbose: true,
      persist_state: true,
      checkpoint_enabled: true,
      parallel_execution: true,
      max_parallel_tasks: 8,
      retrieval_profile: 'coordinator_quality',
    };
  }

  // ========================================
  // Core methods
  // ========================================

  /**
   * Analyze requirements
   */
  analyzeRequirements(task: Record<string, unknown>): RequirementAnalysis {
    const userRequest = (task.user_request as string) ?? '';
    const context = (task.context as string) ?? '';

    const taskType = this._detectTaskType(userRequest);
    const complexity = this._estimateComplexity(userRequest, context);
    const requiredAgents = this._determineRequiredAgents(taskType, complexity);
    const suggestedChain = this._suggestChainTemplate(taskType, complexity);
    const estimatedSteps = (CHAIN_TEMPLATES[suggestedChain] ?? CHAIN_TEMPLATES.chapter_revision).commands.length;
    const constraints = this._extractConstraints(userRequest);
    const risks = this._assessRisksForTask(taskType, complexity);

    return {
      taskType,
      complexity,
      estimatedSteps,
      requiredAgents,
      suggestedChain,
      constraints,
      risks,
    };
  }

  /**
   * Recommend command chain based on requirements
   */
  recommendChain(requirements: RequirementAnalysis): CommandChain {
    const templateName = requirements.suggestedChain;

    if (CHAIN_TEMPLATES[templateName]) {
      const template = CHAIN_TEMPLATES[templateName];
      const chain = createCommandChain(
        `chain_${randomUUID().slice(0, 8)}`,
        template.name,
        template.description,
      );

      // Copy commands with new IDs
      const idMapping: Record<string, string> = {};
      for (const cmd of template.commands) {
        const newCmdId = `cmd_${randomUUID().slice(0, 8)}`;
        idMapping[cmd.commandId] = newCmdId;
        chain.commands.push({
          commandId: newCmdId,
          commandType: cmd.commandType,
          name: cmd.name,
          description: cmd.description,
          agent: cmd.agent,
          parameters: { ...cmd.parameters },
        });
      }

      // Rebuild dependencies
      for (const [oldId, deps] of Object.entries(template.dependencies)) {
        const newId = idMapping[oldId];
        if (newId) {
          chain.dependencies[newId] = deps.map(d => idMapping[d] ?? d);
        }
      }

      updateExecutionOrder(chain);
      return chain;
    }

    return this._createDefaultChain();
  }

  /**
   * Execute a command chain
   */
  async executeChain(chain: CommandChain, state: BaseState): Promise<BaseState> {
    const units: ExecutionUnit[] = [];
    for (const cmdId of chain.executionOrder) {
      const cmd = getCommandFromChain(chain, cmdId);
      if (cmd) {
        units.push(createExecutionUnit(`unit_${randomUUID().slice(0, 8)}`, cmd));
      }
    }

    if (this._coordinatorState) {
      this._coordinatorState.executionUnits = units;
    }

    const totalUnits = units.length;
    for (let i = 0; i < units.length; i++) {
      const unit = units[i];

      if (this._coordinatorState) {
        this._coordinatorState.currentUnitIndex = i;
        this._coordinatorState.overallProgress = (i / totalUnits) * 100;
      }

      // Check dependencies
      const deps = chain.dependencies[unit.command.commandId] ?? [];
      const depsCompleted = this._checkDependenciesCompleted(deps, units);

      if (!depsCompleted) {
        unit.state = ExecutionStatus.SKIPPED;
        state.warnings = [...(state.warnings ?? []), `跳过单元 ${unit.unitId}: 依赖未完成`];
        continue;
      }

      state = await this._executeUnit(unit, state);

      // Checkpoint
      if (this._coordinatorState) {
        this._coordinatorState.updatedAt = new Date().toISOString();
      }

      // Failure handling
      if (unit.state === ExecutionStatus.FAILED) {
        if (canRetryUnit(unit)) {
          unit.retryCount++;
          state = await this._executeUnit(unit, state);
        } else {
          state.errors = [...(state.errors ?? []), `单元执行失败: ${unit.error}`];
        }
      }
    }

    if (this._coordinatorState) {
      this._coordinatorState.overallProgress = 100.0;
    }

    return state;
  }

  /**
   * Persist coordinator state to JSON file
   */
  async persistState(coordinatorState: CoordinatorState): Promise<string> {
    coordinatorState.updatedAt = new Date().toISOString();
    const payload = coordinatorStateToDict(coordinatorState);

    const filePath = join(this.persistDir, `${coordinatorState.sessionId}.json`);

    try {
      await mkdir(this.persistDir, { recursive: true });
      await writeFile(filePath, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (e) {
      console.warn(`Failed to persist state to file: ${e}`);
    }

    try {
      this._sessionManager.write(
        coordinatorState.sessionId,
        'state',
        JSON.stringify(payload, null, 2),
      );
    } catch (exc) {
      console.warn(`SessionManager 状态持久化失败: ${exc}`);
    }

    return coordinatorState.sessionId;
  }

  /**
   * Load persisted state
   */
  async loadState(sessionId: string): Promise<CoordinatorState | null> {
    // Try SessionManager first
    try {
      const payload = this._sessionManager.read(sessionId, 'state');
      if (payload) {
        return coordinatorStateFromDict(JSON.parse(payload));
      }
    } catch (exc) {
      console.warn(`SessionManager 状态恢复失败: ${exc}`);
    }

    // Fallback to file
    const filePath = join(this.persistDir, `${sessionId}.json`);
    try {
      const content = await readFile(filePath, 'utf-8');
      return coordinatorStateFromDict(JSON.parse(content));
    } catch {
      return null;
    }
  }

  // ========================================
  // Internal methods
  // ========================================

  private _analyzeRequirementsPhase(state: BaseState): BaseState {
    const task = {
      user_request: state.user_request ?? '',
      context: state.context ?? '',
    };

    const analysis = this.analyzeRequirements(task);
    if (this._coordinatorState) {
      this._coordinatorState.requirementAnalysis = analysis;
    }

    (state as Record<string, unknown>).requirement_analysis = requirementAnalysisToDict(analysis);
    return state;
  }

  private _recommendChainPhase(state: BaseState): BaseState {
    if (!this._coordinatorState?.requirementAnalysis) {
      state.errors = [...(state.errors ?? []), '需求分析未完成'];
      return state;
    }

    const chain = this.recommendChain(this._coordinatorState.requirementAnalysis);
    this._coordinatorState.commandChain = chain;

    (state as Record<string, unknown>).command_chain = commandChainToDict(chain);
    return state;
  }

  private async _executeChainPhase(state: BaseState): Promise<BaseState> {
    if (!this._coordinatorState?.commandChain) {
      state.errors = [...(state.errors ?? []), '命令链未生成'];
      return state;
    }

    return await this.executeChain(this._coordinatorState.commandChain, state);
  }

  private async _executeUnit(unit: ExecutionUnit, state: BaseState): Promise<BaseState> {
    startUnit(unit);

    try {
      const cmd = unit.command;
      let result: Record<string, unknown> = {};

      if (cmd.commandType === CommandType.ANALYZE) {
        result = await this._executeAnalyze(cmd, state);
      } else if (cmd.commandType === CommandType.PLAN) {
        result = this._executePlan(cmd, state);
      } else if (cmd.commandType === CommandType.EXECUTE) {
        result = this._executeWrite(cmd, state);
      } else if (cmd.commandType === CommandType.VERIFY) {
        result = this._executeVerify(cmd, state);
      } else if (cmd.commandType === CommandType.REVISE) {
        result = this._executeRevise(cmd, state);
      }

      completeUnit(unit, result);

      // Update state from result
      if (result.content) {
        state.draft_content = result.content as string;
        state.final_output = result.content as string;
      }
      if (result.score != null) state.score = result.score as number;
      if (result.feedback) (state as Record<string, unknown>).feedback_context = result.feedback;
      if (result.decision) state.decision = result.decision as string;
      if (result.plan) (state as Record<string, unknown>).implementation_plan = result.plan;
      if (result.analysis) {
        let metadata = state.metadata;
        if (typeof metadata !== 'object' || metadata == null) {
          metadata = {};
          state.metadata = metadata;
        }
        metadata.analysis = result.analysis;
      }
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      failUnit(unit, errorMsg);
      state.errors = [...(state.errors ?? []), `执行单元 ${unit.unitId} 失败: ${errorMsg}`];
    }

    return state;
  }

  private async _executeAnalyze(cmd: Command, state: BaseState): Promise<Record<string, unknown>> {
    const query = state.user_request || cmd.description || cmd.name;
    const profile = String(this.config.retrieval_profile ?? 'coordinator_quality');
    const scope = String(cmd.parameters.scope ?? 'all');
    const limit = Number(cmd.parameters.limit ?? 5);
    const routeMode = String(cmd.parameters.route_mode ?? 'hybrid');

    try {
      const resolvedContext = await this._analysisRetriever.resolveContext(String(query));
      const searchResults = await this._analysisRetriever.hybridSearch({
        query: resolvedContext,
        scope,
        limit,
        profile,
        rerank: true,
        routeMode,
      });

      const analysis = searchResults.slice(0, limit).map((item, index) => ({
        rank: index + 1,
        id: String(item.id ?? `analysis-${index + 1}`),
        source: String(item.source ?? 'unknown'),
        score: Number(item.score ?? 0),
        preview: String(item.content ?? '').slice(0, 200),
      }));

      return {
        analysis,
        resolved_context: resolvedContext,
        status: 'completed',
      };
    } catch (exc) {
      state.warnings = [...(state.warnings ?? []), `L5 分析阶段检索失败: ${exc}`];
      return { analysis: [], status: 'completed' };
    }
  }

  private _executePlan(cmd: Command, state: BaseState): Record<string, unknown> {
    const plannerState: Record<string, unknown> = { ...state };
    let plan: Record<string, unknown> = {};

    try {
      const planner = new Level3Standard({ config: this.config });
      const updated = planner._planPhase(plannerState as BaseState);
      plan = ((updated as Record<string, unknown>).implementation_plan as Record<string, unknown>) ?? {};
    } catch (exc) {
      state.warnings = [...(state.warnings ?? []), `L3 规划阶段失败: ${exc}`];
    }

    (state as Record<string, unknown>).implementation_plan = plan;
    return { plan, status: 'completed' };
  }

  private _selectExecutionBranch(cmd: Command): 'standard' | 'brainstorm' | 'lite' {
    const workflowBranch = String(cmd.parameters.workflow_branch ?? '').trim().toLowerCase();
    if (workflowBranch === 'lite') return 'lite';
    if (workflowBranch === 'brainstorm') return 'brainstorm';

    const requirement = this._coordinatorState?.requirementAnalysis;
    if (requirement && requirement.taskType === 'brainstorm_synthesis') return 'brainstorm';

    return 'standard';
  }

  private _executeWrite(cmd: Command, state: BaseState): Record<string, unknown> {
    const branch = this._selectExecutionBranch(cmd);
    const nextState: Record<string, unknown> = { ...state };

    if (branch === 'lite') {
      try {
        const lite = new Level2Lite(this.config);
        const updated = lite._executeLite(nextState as BaseState);
        Object.assign(nextState, updated);
      } catch (exc) {
        state.warnings = [...(state.warnings ?? []), `L2 执行失败: ${exc}`];
      }
    } else if (branch === 'brainstorm') {
      try {
        const brainstorm = new Level4Brainstorm(this.config);
        const updated = brainstorm.execute(nextState as BaseState);
        Object.assign(nextState, updated);
      } catch (exc) {
        state.warnings = [...(state.warnings ?? []), `L4 执行失败: ${exc}`];
      }
    } else {
      try {
        const standard = new Level3Standard({ config: this.config });
        const updated = standard._executePhase(nextState as BaseState);
        Object.assign(nextState, updated);
      } catch (exc) {
        state.warnings = [...(state.warnings ?? []), `L3 执行失败: ${exc}`];
      }
    }

    const content =
      (nextState.draft_content as string) ??
      (nextState.final_output as string) ??
      state.draft_content ??
      '';

    return { content, status: 'completed' };
  }

  private _executeVerify(cmd: Command, state: BaseState): Record<string, unknown> {
    const branch = this._selectExecutionBranch(cmd);
    const nextState: Record<string, unknown> = { ...state };

    if (branch === 'lite') {
      try {
        const lite = new Level2Lite(this.config);
        const updated = lite._verifyLite(nextState as BaseState);
        Object.assign(nextState, updated);
      } catch (exc) {
        state.warnings = [...(state.warnings ?? []), `L2 验证失败: ${exc}`];
      }
    } else {
      try {
        const standard = new Level3Standard({ config: this.config });
        const updated = standard._criticPhase(nextState as BaseState);
        Object.assign(nextState, updated);
      } catch (exc) {
        state.warnings = [...(state.warnings ?? []), `L3 验证失败: ${exc}`];
      }
    }

    const score = Number(nextState.score ?? state.score ?? 0);
    const feedback = String(nextState.feedback_context ?? '');
    const decision = String(nextState.decision ?? 'REVISE');

    // Append citation summary if available
    const metadata = state.metadata;
    if (metadata?.citations && Array.isArray(metadata.citations)) {
      const citations = metadata.citations as string[];
      if (citations.length > 0) {
        const citationSummary = `\n\n引用摘要: ${citations.slice(0, 5).join(', ')}`;
        return { score, feedback: feedback + citationSummary, decision, status: 'completed' };
      }
    }

    return { score, feedback, decision, status: 'completed' };
  }

  private _executeRevise(cmd: Command, state: BaseState): Record<string, unknown> {
    const reviseState: Record<string, unknown> = { ...state };
    const existingContext = (reviseState.context as string) ?? '';
    const feedbackContext = String((reviseState.feedback_context as string) ?? '');
    reviseState.context = `${existingContext}\n\n[REVISION_FEEDBACK]\n${feedbackContext}`.trim();

    const result = this._executeWrite(cmd, reviseState as BaseState);
    return { content: (result.content as string) ?? '', status: 'completed' };
  }

  private async _tryResume(sessionId: string): Promise<CoordinatorState | null> {
    const savedState = await this.loadState(sessionId);
    if (savedState && savedState.phase !== 'completed' && savedState.phase !== 'failed') {
      return savedState;
    }
    return null;
  }

  private _allUnitsCompleted(): boolean {
    if (!this._coordinatorState) return false;
    return this._coordinatorState.executionUnits.every(
      u => u.state === ExecutionStatus.COMPLETED || u.state === ExecutionStatus.SKIPPED,
    );
  }

  private _checkDependenciesCompleted(depIds: string[], units: ExecutionUnit[]): boolean {
    for (const unit of units) {
      if (depIds.includes(unit.command.commandId)) {
        if (unit.state !== ExecutionStatus.COMPLETED) return false;
      }
    }
    return true;
  }

  private _detectTaskType(text: string): string {
    const textLower = text.toLowerCase();

    if (['小说', '创作', '写作', '长篇'].some(kw => textLower.includes(kw))) return 'novel_creation';
    if (['修订', '修改', '改写', '重写'].some(kw => textLower.includes(kw))) return 'chapter_revision';
    if (['头脑风暴', '讨论', '多角度'].some(kw => textLower.includes(kw))) return 'brainstorm_synthesis';
    return 'chapter_revision';
  }

  private _estimateComplexity(request: string, context: string): number {
    let complexity = 60; // L5 baseline

    const totalLen = request.length + context.length;
    if (totalLen > 2000) complexity += 20;
    else if (totalLen > 500) complexity += 10;

    const complexKws = ['完整', '详细', '深入', '全面', '系统', '多章节'];
    for (const kw of complexKws) {
      if (request.includes(kw)) complexity += 5;
    }

    return Math.min(100, complexity);
  }

  private _determineRequiredAgents(taskType: string, complexity: number): string[] {
    const baseAgents = new Set(['coordinator', 'architect', 'writer', 'critic']);

    if (complexity > 80) {
      baseAgents.add('researcher');
      baseAgents.add('devil_advocate');
    }

    if (taskType === 'brainstorm_synthesis') {
      baseAgents.add('optimist');
      baseAgents.add('realist');
    }

    return [...baseAgents];
  }

  private _suggestChainTemplate(taskType: string, _complexity: number): string {
    if (taskType in CHAIN_TEMPLATES) return taskType;
    return 'chapter_revision';
  }

  private _extractConstraints(text: string): string[] {
    const constraints: string[] = [];
    const patterns: [string, string][] = [
      ['字数', '字数限制'],
      ['不要', '排除条件'],
      ['必须', '必要条件'],
      ['风格', '风格约束'],
    ];

    for (const [pattern, label] of patterns) {
      if (text.includes(pattern)) constraints.push(label);
    }

    return constraints;
  }

  private _assessRisksForTask(taskType: string, complexity: number): string[] {
    const risks: string[] = [];

    if (complexity > 85) risks.push('高复杂度任务可能需要多次迭代');
    if (taskType === 'novel_creation') risks.push('长篇创作需要保持一致性');

    return risks;
  }

  private _createDefaultChain(): CommandChain {
    const chain = createCommandChain(
      `chain_${randomUUID().slice(0, 8)}`,
      '默认执行链',
      '基本执行流程',
    );

    addCommandToChain(
      chain,
      { commandId: `cmd_${randomUUID().slice(0, 8)}`, commandType: CommandType.ANALYZE, name: '分析', description: '分析任务', agent: 'coordinator', parameters: {} },
    );
    addCommandToChain(
      chain,
      { commandId: `cmd_${randomUUID().slice(0, 8)}`, commandType: CommandType.EXECUTE, name: '执行', description: '执行任务', agent: 'writer', parameters: {} },
    );
    addCommandToChain(
      chain,
      { commandId: `cmd_${randomUUID().slice(0, 8)}`, commandType: CommandType.VERIFY, name: '验证', description: '验证结果', agent: 'critic', parameters: {} },
    );

    return chain;
  }
}
