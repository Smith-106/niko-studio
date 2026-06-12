import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockedDeps = vi.hoisted(() => {
  const retriever = {
    hybridSearch: vi.fn(),
    resolveContext: vi.fn(),
  };
  const createIterativeRetriever = vi.fn(() => retriever);
  const sessionManager = {
    init: vi.fn(),
    write: vi.fn(),
    read: vi.fn(),
  };
  const SessionManager = vi.fn(() => sessionManager);

  return {
    retriever,
    createIterativeRetriever,
    sessionManager,
    SessionManager,
  };
});

vi.mock('../../search/index.js', () => ({
  createIterativeRetriever: mockedDeps.createIterativeRetriever,
}));

vi.mock('../../workflow/session/session-manager.js', () => ({
  ContentType: { STATE: 'state' },
  SessionManager: mockedDeps.SessionManager,
}));

import { Level2Lite } from '../../workflow/levels/level2-lite.js';
import {
  CommandType,
  ExecutionStatus,
  Level5Coordinator,
  addCommandToChain,
  canRetryUnit,
  commandChainFromDict,
  commandFromDict,
  coordinatorStateFromDict,
  createCommandChain,
  createCoordinatorState,
  createExecutionUnit,
  executionUnitFromDict,
  failUnit,
  requirementAnalysisFromDict,
} from '../../workflow/levels/level5-coordinator.js';
import { Level3Standard } from '../../workflow/levels/level3-standard.js';
import { Level4Brainstorm } from '../../workflow/levels/level4-brainstorm.js';
import type { BaseState } from '../../workflow/state.js';

function makeState(overrides: Partial<BaseState> = {}): BaseState {
  return {
    session_id: 'l5-whitebox',
    user_request: '默认请求',
    metadata: {},
    warnings: [],
    errors: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockedDeps.retriever.hybridSearch.mockReset();
  mockedDeps.retriever.resolveContext.mockReset();
  mockedDeps.createIterativeRetriever.mockClear();
  mockedDeps.sessionManager.init.mockReset();
  mockedDeps.sessionManager.write.mockReset();
  mockedDeps.sessionManager.read.mockReset();
  mockedDeps.SessionManager.mockClear();
});

describe('Level5Coordinator whitebox additional coverage', () => {
  it('uses default session/retriever adapters on resume and falls back to human review when units remain pending', async () => {
    const persistDir = join(tmpdir(), `niko-l5-whitebox-${randomUUID()}`);
    mockedDeps.sessionManager.init.mockImplementation(() => {
      throw new Error('init exploded');
    });
    mockedDeps.sessionManager.read.mockReturnValue(
      JSON.stringify({
        session_id: 'resume-default',
        created_at: '2026-06-05T00:00:00.000Z',
        updated_at: '2026-06-05T00:00:00.000Z',
        requirement_analysis: null,
        command_chain: null,
        execution_units: [
          {
            unit_id: 'pending-unit',
            command: {
              command_id: 'cmd-pending',
              command_type: CommandType.EXECUTE,
              name: '执行',
              description: '继续执行',
              agent: 'writer',
              parameters: {},
            },
            state: ExecutionStatus.PENDING,
            result: null,
            error: null,
            started_at: null,
            completed_at: null,
            retry_count: 0,
            max_retries: 3,
          },
        ],
        current_unit_index: 0,
        phase: 'executing',
        overall_progress: 33,
        final_result: null,
        errors: [],
      }),
    );

    try {
      const coordinator = new Level5Coordinator({ persist_dir: persistDir });
      const state = await coordinator.execute(makeState({ session_id: undefined as never }));

      expect(mockedDeps.createIterativeRetriever).toHaveBeenCalledWith({
        projectRoot: process.cwd(),
      });
      expect(mockedDeps.SessionManager).toHaveBeenCalledTimes(1);
      expect(mockedDeps.sessionManager.init).toHaveBeenCalledOnce();
      expect((state as Record<string, unknown>).resumed).toBe(true);
      expect(state.decision).toBe('HUMAN_REVIEW');
      expect((state as Record<string, unknown>).requires_human_intervention).toBe(true);
      expect(state.warnings).toEqual(
        expect.arrayContaining([expect.stringContaining('SessionManager 初始化失败')]),
      );
      expect(mockedDeps.sessionManager.write).toHaveBeenCalledWith(
        'resume-default',
        'state',
        expect.any(String),
      );
      const persisted = JSON.parse(
        String(mockedDeps.sessionManager.write.mock.calls.at(-1)?.[2] ?? '{}'),
      ) as Record<string, unknown>;
      expect(persisted.phase).toBe('executing');
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it('adapts the default iterative retriever to analyze commands and preserves serializer defaults', async () => {
    mockedDeps.retriever.resolveContext.mockResolvedValue('resolved-context');
    mockedDeps.retriever.hybridSearch.mockResolvedValue([
      {
        id: 'doc-1',
        source: 'graph',
        score: 0.77,
        content: 'Graph context payload',
      },
    ]);

    const coordinator = new Level5Coordinator();
    const analyzeResult = await (coordinator as unknown as {
      _executeAnalyze: (
        cmd: Record<string, unknown>,
        state: BaseState,
      ) => Promise<Record<string, unknown>>;
    })._executeAnalyze(
      {
        commandId: 'analyze-1',
        commandType: CommandType.ANALYZE,
        name: '分析',
        description: '描述兜底查询',
        agent: 'coordinator',
        parameters: { scope: 'memory', limit: 2, route_mode: 'elastic' },
      },
      makeState({ user_request: '' }),
    );

    expect(mockedDeps.retriever.resolveContext).toHaveBeenCalledWith('描述兜底查询');
    expect(mockedDeps.retriever.hybridSearch).toHaveBeenCalledWith(
      'resolved-context',
      'memory',
      2,
      'coordinator_quality',
      undefined,
      undefined,
      true,
      'elastic',
    );
    expect(analyzeResult).toMatchObject({
      status: 'completed',
      resolved_context: 'resolved-context',
      analysis: [
        {
          rank: 1,
          id: 'doc-1',
          source: 'graph',
          score: 0.77,
          preview: 'Graph context payload',
        },
      ],
    });

    expect(
      commandFromDict({
        command_id: 'cmd-min',
        command_type: CommandType.PLAN,
        name: '计划',
        description: '最小命令',
        agent: 'architect',
      }),
    ).toMatchObject({
      parameters: {},
    });

    expect(
      commandChainFromDict({
        chain_id: 'chain-min',
        name: '最小链',
        description: '最小链描述',
      }),
    ).toMatchObject({
      dependencies: {},
      executionOrder: [],
      estimatedDuration: 0,
    });

    expect(
      executionUnitFromDict({
        unit_id: 'unit-min',
        command: {
          command_id: 'cmd-min',
          command_type: CommandType.EXECUTE,
          name: '执行',
          description: '执行任务',
          agent: 'writer',
        },
        state: ExecutionStatus.PENDING,
      }),
    ).toMatchObject({
      result: null,
      error: null,
      startedAt: null,
      completedAt: null,
      retryCount: 0,
      maxRetries: 3,
    });

    expect(
      coordinatorStateFromDict({
        session_id: 'state-min',
      }),
    ).toMatchObject({
      sessionId: 'state-min',
      requirementAnalysis: null,
      commandChain: null,
      executionUnits: [],
      currentUnitIndex: 0,
      phase: 'init',
      overallProgress: 0,
      finalResult: null,
      errors: [],
    });
  });

  it('covers session adapter defaults, ignored content types, and requirement-analysis fallbacks', async () => {
    mockedDeps.retriever.hybridSearch.mockResolvedValue([]);
    mockedDeps.retriever.resolveContext.mockResolvedValue('adapter-context');
    mockedDeps.sessionManager.read.mockReturnValue('');

    const coordinator = new Level5Coordinator();
    const coordinatorAny = coordinator as unknown as {
      _sessionManager: {
        init: (sessionId: string, options?: { sessionType?: string; domain?: string }) => void;
        write: (sessionId: string, contentType: string, content: string) => void;
        read: (sessionId: string, contentType: string) => string | null;
      };
      _analysisRetriever: {
        hybridSearch: (params: {
          query: string;
          scope?: string;
          limit?: number;
          profile?: string | null;
          minScore?: number | null;
          budgetTokens?: number | null;
          rerank?: boolean;
          routeMode?: string | null;
        }) => Promise<Array<Record<string, unknown>>>;
        resolveContext: (text: string) => Promise<string>;
      };
    };

    coordinatorAny._sessionManager.init('adapter-session');
    expect(mockedDeps.sessionManager.init).toHaveBeenCalledWith(
      'adapter-session',
      'coordinator',
      'workflow',
      'novel',
    );

    coordinatorAny._sessionManager.write('adapter-session', 'notes', 'ignored');
    expect(mockedDeps.sessionManager.write).not.toHaveBeenCalled();

    expect(coordinatorAny._sessionManager.read('adapter-session', 'notes')).toBeNull();
    expect(coordinatorAny._sessionManager.read('adapter-session', 'state')).toBeNull();
    expect(mockedDeps.sessionManager.read).toHaveBeenCalledWith(
      'adapter-session',
      'state',
    );

    await expect(
      coordinatorAny._analysisRetriever.hybridSearch({
        query: 'atlas context',
      }),
    ).resolves.toEqual([]);
    expect(mockedDeps.retriever.hybridSearch).toHaveBeenCalledWith(
      'atlas context',
      'all',
      5,
      undefined,
      undefined,
      undefined,
      true,
      'hybrid',
    );

    await expect(
      coordinatorAny._analysisRetriever.resolveContext('atlas context'),
    ).resolves.toBe('adapter-context');

    expect(requirementAnalysisFromDict({})).toEqual({
      taskType: '',
      complexity: 0,
      estimatedSteps: 0,
      requiredAgents: [],
      suggestedChain: '',
      constraints: [],
      risks: [],
    });
  });

  it('skips blocked dependencies and records terminal unit failures when retries are disabled', async () => {
    const coordinator = new Level5Coordinator(
      {},
      { init: vi.fn(), write: vi.fn(), read: vi.fn() },
      { resolveContext: vi.fn(), hybridSearch: vi.fn() } as never,
    );
    const chain = createCommandChain('chain-deps', '依赖链', '依赖失败跳过');
    addCommandToChain(chain, {
      commandId: 'cmd-first',
      commandType: CommandType.EXECUTE,
      name: '执行一',
      description: '第一步',
      agent: 'writer',
      parameters: {},
    });
    addCommandToChain(
      chain,
      {
        commandId: 'cmd-second',
        commandType: CommandType.VERIFY,
        name: '验证二',
        description: '第二步',
        agent: 'critic',
        parameters: {},
      },
      ['cmd-first'],
    );

    const executeUnitSpy = vi
      .spyOn(coordinator as never, '_executeUnit' as never)
      .mockImplementation(async (unit: Record<string, unknown>, state: BaseState) => {
        unit.state = ExecutionStatus.FAILED;
        unit.error = 'first step failed';
        unit.maxRetries = 0;
        return state;
      });

    const result = await coordinator.executeChain(chain, makeState());

    expect(executeUnitSpy).toHaveBeenCalledTimes(1);
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('单元执行失败: first step failed')]),
    );
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('跳过单元')]),
    );
  });

  it('retries failed units once when retries remain', async () => {
    const coordinator = new Level5Coordinator(
      {},
      { init: vi.fn(), write: vi.fn(), read: vi.fn() },
      { resolveContext: vi.fn(), hybridSearch: vi.fn() } as never,
    );
    const chain = createCommandChain('chain-retry', '重试链', '失败后重试');
    addCommandToChain(chain, {
      commandId: 'cmd-retry',
      commandType: CommandType.EXECUTE,
      name: '执行',
      description: '执行任务',
      agent: 'writer',
      parameters: {},
    });

    const executeUnitSpy = vi
      .spyOn(coordinator as never, '_executeUnit' as never)
      .mockImplementation(async (unit: Record<string, unknown>, state: BaseState) => {
        if ((unit.retryCount as number) === 0) {
          unit.state = ExecutionStatus.FAILED;
          unit.error = 'retry please';
          return state;
        }
        unit.state = ExecutionStatus.COMPLETED;
        return {
          ...state,
          draft_content: 'retried content',
        };
      });

    const result = await coordinator.executeChain(chain, makeState());

    expect(executeUnitSpy).toHaveBeenCalledTimes(2);
    expect(result.errors).toEqual([]);
    expect((coordinator as unknown as { _coordinatorState: { executionUnits: Array<{ retryCount: number }> } })._coordinatorState.executionUnits[0]?.retryCount).toBe(1);
  });

  it('covers heuristic helpers, default chains, and unit retry utilities', async () => {
    const coordinator = new Level5Coordinator(
      {},
      { init: vi.fn(), write: vi.fn(), read: vi.fn() },
      { resolveContext: vi.fn(), hybridSearch: vi.fn() } as never,
    );
    const coordinatorAny = coordinator as unknown as {
      _detectTaskType: (text: string) => string;
      _estimateComplexity: (request: string, context: string) => number;
      _determineRequiredAgents: (taskType: string, complexity: number) => string[];
      _suggestChainTemplate: (taskType: string, complexity: number) => string;
      _extractConstraints: (text: string) => string[];
      _assessRisksForTask: (taskType: string, complexity: number) => string[];
      _checkDependenciesCompleted: (
        depIds: string[],
        units: Array<{ command: { commandId: string }; state: ExecutionStatus }>,
      ) => boolean;
      _allUnitsCompleted: () => boolean;
      _coordinatorState: ReturnType<typeof createCoordinatorState>;
    };

    expect(coordinatorAny._detectTaskType('我要开始小说创作')).toBe('novel_creation');
    expect(coordinatorAny._detectTaskType('请帮我修订这一章')).toBe('chapter_revision');
    expect(coordinatorAny._detectTaskType('做一次头脑风暴讨论')).toBe('brainstorm_synthesis');

    expect(
      coordinatorAny._estimateComplexity(
        '完整详细深入全面系统的多章节规划',
        '上下文'.repeat(300),
      ),
    ).toBe(100);
    expect(coordinatorAny._estimateComplexity('普通请求', '上下文'.repeat(260))).toBe(70);

    expect(
      coordinatorAny._determineRequiredAgents('brainstorm_synthesis', 90),
    ).toEqual(
      expect.arrayContaining([
        'coordinator',
        'architect',
        'writer',
        'critic',
        'researcher',
        'devil_advocate',
        'optimist',
        'realist',
      ]),
    );
    expect(coordinator.getRequiredAgents()).toEqual([
      'coordinator',
      'architect',
      'writer',
      'critic',
    ]);

    expect(coordinatorAny._suggestChainTemplate('unknown-template', 1)).toBe('chapter_revision');
    expect(
      coordinatorAny._extractConstraints('字数不要太多，但必须统一风格'),
    ).toEqual(['字数限制', '排除条件', '必要条件', '风格约束']);
    expect(coordinatorAny._assessRisksForTask('novel_creation', 90)).toEqual([
      '高复杂度任务可能需要多次迭代',
      '长篇创作需要保持一致性',
    ]);

    const fallbackChain = coordinator.recommendChain({
      taskType: 'mystery',
      complexity: 50,
      estimatedSteps: 0,
      requiredAgents: [],
      suggestedChain: 'missing-template',
      constraints: [],
      risks: [],
    });
    expect(fallbackChain.name).toBe('默认执行链');
    expect(fallbackChain.commands.map((command) => command.commandType)).toEqual([
      CommandType.ANALYZE,
      CommandType.EXECUTE,
      CommandType.VERIFY,
    ]);

    const unit = createExecutionUnit('unit-fail', {
      commandId: 'cmd-fail',
      commandType: CommandType.EXECUTE,
      name: '执行',
      description: '失败任务',
      agent: 'writer',
      parameters: {},
    });
    failUnit(unit, 'boom');
    expect(unit.state).toBe(ExecutionStatus.FAILED);
    expect(unit.error).toBe('boom');
    expect(unit.completedAt).not.toBeNull();
    expect(canRetryUnit(unit)).toBe(true);
    unit.retryCount = 3;
    expect(canRetryUnit(unit)).toBe(false);

    coordinatorAny._coordinatorState = createCoordinatorState('dep-state');
    coordinatorAny._coordinatorState.executionUnits = [unit];
    expect(coordinatorAny._allUnitsCompleted()).toBe(false);
    unit.state = ExecutionStatus.SKIPPED;
    expect(coordinatorAny._allUnitsCompleted()).toBe(true);
    expect(
      coordinatorAny._checkDependenciesCompleted(
        ['cmd-fail'],
        [{ command: { commandId: 'cmd-fail' }, state: ExecutionStatus.FAILED }],
      ),
    ).toBe(false);
    expect(
      coordinatorAny._checkDependenciesCompleted(
        ['cmd-fail'],
        [{ command: { commandId: 'cmd-fail' }, state: ExecutionStatus.COMPLETED }],
      ),
    ).toBe(true);
  });

  it('covers revise flow plus plan/write/verify warning branches and citation summaries', async () => {
    const coordinator = new Level5Coordinator(
      {},
      { init: vi.fn(), write: vi.fn(), read: vi.fn() },
      { resolveContext: vi.fn(), hybridSearch: vi.fn() } as never,
    );

    const reviseWriteSpy = vi
      .spyOn(coordinator as never, '_executeWrite' as never)
      .mockResolvedValueOnce({ content: 'rewritten body', status: 'completed' } as never);

    const reviseResult = await (coordinator as unknown as {
      _executeRevise: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
    })._executeRevise(
      {
        commandId: 'cmd-revise',
        commandType: CommandType.REVISE,
        name: '修订',
        description: '修订内容',
        agent: 'writer',
        parameters: {},
      },
      makeState({
        context: '原始上下文',
        feedback_context: '需要补强节奏',
      } as never),
    );

    expect(reviseWriteSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        context: expect.stringContaining('[REVISION_FEEDBACK]'),
      }),
    );
    expect(reviseResult).toEqual({ content: 'rewritten body', status: 'completed' });

    const planState = makeState();
    vi.spyOn(Level3Standard.prototype, '_planPhase').mockImplementation(() => {
      throw new Error('plan exploded');
    });
    expect(
      (coordinator as unknown as {
        _executePlan: (cmd: Record<string, unknown>, state: BaseState) => Record<string, unknown>;
      })._executePlan(
        {
          commandId: 'cmd-plan',
          commandType: CommandType.PLAN,
          name: '计划',
          description: '规划任务',
          agent: 'architect',
          parameters: {},
        },
        planState,
      ),
    ).toEqual({ plan: {}, status: 'completed' });
    expect(planState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L3 规划阶段失败')]),
    );

    vi.restoreAllMocks();

    const liteState = makeState();
    vi.spyOn(Level2Lite.prototype, '_executeLite').mockImplementation(() => {
      throw new Error('lite exploded');
    });
    const liteWrite = await (coordinator as unknown as {
      _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
    })._executeWrite(
      {
        commandId: 'cmd-lite',
        commandType: CommandType.EXECUTE,
        name: '执行',
        description: 'lite 执行',
        agent: 'writer',
        parameters: { workflow_branch: 'lite' },
      },
      liteState,
    );
    expect(liteWrite).toEqual({ content: '', status: 'completed' });
    expect(liteState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L2 执行失败')]),
    );

    vi.restoreAllMocks();

    const brainstormState = makeState();
    vi.spyOn(Level4Brainstorm.prototype, 'execute').mockResolvedValue({
      ...brainstormState,
      final_output: 'brainstorm draft',
    } as never);
    expect(
      await (coordinator as unknown as {
        _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
      })._executeWrite(
        {
          commandId: 'cmd-brainstorm',
          commandType: CommandType.EXECUTE,
          name: '执行',
          description: 'brainstorm 执行',
          agent: 'writer',
          parameters: { workflow_branch: 'brainstorm' },
        },
        brainstormState,
      ),
    ).toEqual({ content: 'brainstorm draft', status: 'completed' });

    vi.restoreAllMocks();

    const brainstormErrorState = makeState();
    vi.spyOn(Level4Brainstorm.prototype, 'execute').mockRejectedValue(
      new Error('brainstorm exploded'),
    );
    expect(
      await (coordinator as unknown as {
        _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
      })._executeWrite(
        {
          commandId: 'cmd-brainstorm-error',
          commandType: CommandType.EXECUTE,
          name: '执行',
          description: 'brainstorm 执行失败',
          agent: 'writer',
          parameters: { workflow_branch: 'brainstorm' },
        },
        brainstormErrorState,
      ),
    ).toEqual({ content: '', status: 'completed' });
    expect(brainstormErrorState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L4 执行失败')]),
    );

    vi.restoreAllMocks();

    const standardState = makeState();
    vi.spyOn(Level3Standard.prototype, '_executePhase').mockImplementation(() => {
      throw new Error('standard exploded');
    });
    expect(
      await (coordinator as unknown as {
        _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
      })._executeWrite(
        {
          commandId: 'cmd-standard',
          commandType: CommandType.EXECUTE,
          name: '执行',
          description: 'standard 执行',
          agent: 'writer',
          parameters: {},
        },
        standardState,
      ),
    ).toEqual({ content: '', status: 'completed' });
    expect(standardState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L3 执行失败')]),
    );

    vi.restoreAllMocks();

    const verifyLiteState = makeState({
      metadata: { citations: ['A', 'B', 'C'] },
    });
    vi.spyOn(Level2Lite.prototype, '_verifyLite').mockReturnValue({
      ...verifyLiteState,
      score: 91,
      feedback_context: '需要微调',
      decision: 'APPROVED',
    } as never);
    expect(
      (coordinator as unknown as {
        _executeVerify: (cmd: Record<string, unknown>, state: BaseState) => Record<string, unknown>;
      })._executeVerify(
        {
          commandId: 'cmd-verify-lite',
          commandType: CommandType.VERIFY,
          name: '验证',
          description: 'lite 验证',
          agent: 'critic',
          parameters: { workflow_branch: 'lite' },
        },
        verifyLiteState,
      ),
    ).toEqual({
      score: 91,
      feedback: '需要微调\n\n引用摘要: A, B, C',
      decision: 'APPROVED',
      status: 'completed',
    });

    vi.restoreAllMocks();

    const verifyLiteErrorState = makeState();
    vi.spyOn(Level2Lite.prototype, '_verifyLite').mockImplementation(() => {
      throw new Error('lite verify exploded');
    });
    expect(
      (coordinator as unknown as {
        _executeVerify: (cmd: Record<string, unknown>, state: BaseState) => Record<string, unknown>;
      })._executeVerify(
        {
          commandId: 'cmd-verify-lite-error',
          commandType: CommandType.VERIFY,
          name: '验证',
          description: 'lite 验证失败',
          agent: 'critic',
          parameters: { workflow_branch: 'lite' },
        },
        verifyLiteErrorState,
      ),
    ).toEqual({
      score: 0,
      feedback: '',
      decision: 'REVISE',
      status: 'completed',
    });
    expect(verifyLiteErrorState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L2 验证失败')]),
    );

    vi.restoreAllMocks();

    const verifyStandardState = makeState();
    vi.spyOn(Level3Standard.prototype, '_criticPhase').mockImplementation(() => {
      throw new Error('critic exploded');
    });
    expect(
      (coordinator as unknown as {
        _executeVerify: (cmd: Record<string, unknown>, state: BaseState) => Record<string, unknown>;
      })._executeVerify(
        {
          commandId: 'cmd-verify-standard',
          commandType: CommandType.VERIFY,
          name: '验证',
          description: 'standard 验证',
          agent: 'critic',
          parameters: {},
        },
        verifyStandardState,
      ),
    ).toEqual({
      score: 0,
      feedback: '',
      decision: 'REVISE',
      status: 'completed',
    });
    expect(verifyStandardState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L3 验证失败')]),
    );
  });

  it('dispatches revise units through _executeUnit and applies revised content to state', async () => {
    const coordinator = new Level5Coordinator(
      {},
      { init: vi.fn(), write: vi.fn(), read: vi.fn() },
      { resolveContext: vi.fn(), hybridSearch: vi.fn() } as never,
    );
    const executeReviseSpy = vi
      .spyOn(coordinator as never, '_executeRevise' as never)
      .mockResolvedValue({
        content: 'revised draft',
        status: 'completed',
      } as never);

    const unit = createExecutionUnit('unit-revise', {
      commandId: 'cmd-revise-dispatch',
      commandType: CommandType.REVISE,
      name: '修订',
      description: '修订调度',
      agent: 'writer',
      parameters: {},
    });
    const result = await (coordinator as unknown as {
      _executeUnit: (
        unit: typeof unit,
        state: BaseState,
      ) => Promise<BaseState>;
    })._executeUnit(unit, makeState());

    expect(executeReviseSpy).toHaveBeenCalledOnce();
    expect(unit.state).toBe(ExecutionStatus.COMPLETED);
    expect(result.draft_content).toBe('revised draft');
    expect(result.final_output).toBe('revised draft');
  });

  it('marks the unit failed when an executor throws inside _executeUnit', async () => {
    const coordinator = new Level5Coordinator(
      {},
      { init: vi.fn(), write: vi.fn(), read: vi.fn() },
      { resolveContext: vi.fn(), hybridSearch: vi.fn() } as never,
    );
    vi.spyOn(coordinator as never, '_executeAnalyze' as never).mockRejectedValue(
      new Error('unit exploded'),
    );

    const unit = createExecutionUnit('unit-catch', {
      commandId: 'cmd-analyze-fail',
      commandType: CommandType.ANALYZE,
      name: '分析',
      description: '触发异常',
      agent: 'coordinator',
      parameters: {},
    });
    const state = await (coordinator as unknown as {
      _executeUnit: (
        unit: typeof unit,
        state: BaseState,
      ) => Promise<BaseState>;
    })._executeUnit(unit, makeState());

    expect(unit.state).toBe(ExecutionStatus.FAILED);
    expect(unit.error).toBe('unit exploded');
    expect(state.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('执行单元 unit-catch 失败: unit exploded')]),
    );
  });
});
