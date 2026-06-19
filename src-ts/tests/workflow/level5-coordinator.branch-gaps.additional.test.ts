import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Level2Lite } from '../../workflow/levels/level2-lite.js';
import { Level3Standard } from '../../workflow/levels/level3-standard.js';
import { Level4Brainstorm } from '../../workflow/levels/level4-brainstorm.js';
import {
  CHAIN_TEMPLATES,
  CommandType,
  ExecutionStatus,
  Level5Coordinator,
  createCommandChain,
  createExecutionUnit,
  failUnit,
  type ISessionManager,
  type RequirementAnalysis,
} from '../../workflow/levels/level5-coordinator.js';
import type { BaseState } from '../../workflow/state.js';

function makeState(overrides: Partial<BaseState> = {}): BaseState {
  return {
    session_id: 'l5-branch-gaps',
    user_request: 'default request',
    metadata: {},
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function createSessionManager(overrides: Partial<ISessionManager> = {}): ISessionManager {
  return {
    init: vi.fn(),
    write: vi.fn(),
    read: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function createRequirementAnalysis(overrides: Partial<RequirementAnalysis> = {}): RequirementAnalysis {
  return {
    taskType: 'chapter_revision',
    complexity: 60,
    estimatedSteps: 4,
    requiredAgents: ['coordinator', 'architect', 'writer', 'critic'],
    suggestedChain: 'chapter_revision',
    constraints: [],
    risks: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Level5Coordinator branch-gap additional coverage', () => {
  it('falls back to chapter revision metrics when a suggested template is missing and handles very large requests', () => {
    const coordinator = new Level5Coordinator();
    const coordinatorAny = coordinator as unknown as {
      _suggestChainTemplate: (taskType: string, complexity: number) => string;
      _estimateComplexity: (request: string, context: string) => number;
    };

    expect(coordinatorAny._suggestChainTemplate('unknown_task', 42)).toBe('chapter_revision');
    expect(coordinatorAny._estimateComplexity('a'.repeat(2001), '')).toBe(80);

    const suggestSpy = vi
      .spyOn(coordinatorAny, '_suggestChainTemplate')
      .mockReturnValue('missing_template');

    const analysis = coordinator.analyzeRequirements({
      user_request: undefined,
      context: undefined,
    });

    expect(suggestSpy).toHaveBeenCalled();
    expect(analysis.estimatedSteps).toBe(CHAIN_TEMPLATES.chapter_revision.commands.length);
    expect(analysis.taskType).toBe('chapter_revision');
  });

  it('keeps unresolved dependency ids when remapping a template chain', () => {
    const templateName = 'codex_branch_gap_template';
    CHAIN_TEMPLATES[templateName] = {
      chainId: 'tpl_branch_gap',
      name: 'Branch gap template',
      description: 'template with an unresolved dependency',
      commands: [
        {
          commandId: 'cmd_known',
          commandType: CommandType.EXECUTE,
          name: 'Execute',
          description: 'execute step',
          agent: 'writer',
          parameters: {},
        },
      ],
      dependencies: {
        cmd_known: ['cmd_missing'],
      },
      executionOrder: ['cmd_known'],
      estimatedDuration: 0,
    };

    try {
      const coordinator = new Level5Coordinator();
      const chain = coordinator.recommendChain(createRequirementAnalysis({
        suggestedChain: templateName,
      }));

      expect(chain.commands).toHaveLength(1);
      expect(Object.values(chain.dependencies)).toEqual([['cmd_missing']]);
    } finally {
      delete CHAIN_TEMPLATES[templateName];
    }
  });

  it('records init and phase failures even when warnings and errors are initially absent', async () => {
    const coordinator = new Level5Coordinator(
      {},
      createSessionManager({
        init: vi.fn(() => {
          throw 'init failed';
        }),
      }),
    );
    vi
      .spyOn(coordinator as never, '_analyzeRequirementsPhase' as never)
      .mockImplementation(() => {
        throw 'phase failed';
      });

    const state = await coordinator.execute(makeState({
      warnings: undefined as never,
      errors: undefined as never,
    }));

    expect(state.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('SessionManager')]),
    );
    expect(state.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('phase failed')]),
    );
    expect(state.decision).toBe('FAILED');
  });

  it('uses dependency fallbacks, skips blocked units, and appends terminal errors without pre-existing arrays', async () => {
    const coordinator = new Level5Coordinator();
    const chain = createCommandChain('chain-deps', 'deps', 'dependency gaps');
    chain.commands = [
      {
        commandId: 'cmd-first',
        commandType: CommandType.EXECUTE,
        name: 'first',
        description: 'first step',
        agent: 'writer',
        parameters: {},
      },
      {
        commandId: 'cmd-second',
        commandType: CommandType.EXECUTE,
        name: 'second',
        description: 'second step',
        agent: 'writer',
        parameters: {},
      },
    ];
    chain.executionOrder = ['cmd-first', 'cmd-second'];
    chain.dependencies = {
      'cmd-second': ['cmd-first'],
    };

    vi
      .spyOn(coordinator as never, '_executeUnit' as never)
      .mockImplementation(async (unit: {
        command: { commandId: string };
        maxRetries: number;
        retryCount: number;
        state: ExecutionStatus;
        error: string | null;
      }, state: BaseState) => {
        if (unit.command.commandId === 'cmd-first') {
          unit.maxRetries = 0;
          failUnit(unit as never, 'first unit failed');
        }
        return state;
      });

    const state = await coordinator.executeChain(chain, makeState({
      warnings: undefined as never,
      errors: undefined as never,
    }));

    expect(state.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('first unit failed')]),
    );
    expect(state.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('跳过单元')]),
    );
  });

  it('falls back to command names and default analysis fields when retrieval items are sparse', async () => {
    const retriever = {
      resolveContext: vi.fn().mockResolvedValue('resolved'),
      hybridSearch: vi.fn().mockResolvedValue([{}]),
    };
    const coordinator = new Level5Coordinator({}, createSessionManager(), retriever as never);

    const result = await (coordinator as unknown as {
      _executeAnalyze: (
        cmd: {
          commandId: string;
          commandType: CommandType;
          name: string;
          description: string;
          agent: string;
          parameters: Record<string, unknown>;
        },
        state: BaseState,
      ) => Promise<Record<string, unknown>>;
    })._executeAnalyze(
      {
        commandId: 'cmd-analyze',
        commandType: CommandType.ANALYZE,
        name: 'fallback-name',
        description: '',
        agent: 'coordinator',
        parameters: {},
      },
      makeState({ user_request: '' }),
    );

    expect(retriever.resolveContext).toHaveBeenCalledWith('fallback-name');
    expect(result).toEqual({
      analysis: [
        {
          rank: 1,
          id: 'analysis-1',
          source: 'unknown',
          score: 0,
          preview: '',
        },
      ],
      resolved_context: 'resolved',
      status: 'completed',
    });
  });

  it('keeps an empty plan and records a warning when the planner throws', () => {
    vi
      .spyOn(Level3Standard.prototype, '_planPhase')
      .mockImplementation(() => {
        throw 'plan failed';
      });

    const coordinator = new Level5Coordinator();
    const state = makeState({ warnings: undefined as never });
    const result = (coordinator as unknown as {
      _executePlan: (
        cmd: {
          commandId: string;
          commandType: CommandType;
          name: string;
          description: string;
          agent: string;
          parameters: Record<string, unknown>;
        },
        state: BaseState,
      ) => Record<string, unknown>;
    })._executePlan(
      {
        commandId: 'cmd-plan',
        commandType: CommandType.PLAN,
        name: 'plan',
        description: 'plan',
        agent: 'architect',
        parameters: {},
      },
      state,
    );

    expect(result).toEqual({ plan: {}, status: 'completed' });
    expect(state.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('plan failed')]),
    );
  });

  it('records branch-specific write failures for lite, brainstorm, and standard execution', async () => {
    vi.spyOn(Level2Lite.prototype, '_executeLite').mockImplementation(() => {
      throw 'lite failed';
    });
    vi.spyOn(Level4Brainstorm.prototype, 'execute').mockImplementation(async () => {
      throw 'brainstorm failed';
    });
    vi.spyOn(Level3Standard.prototype, '_executePhase').mockImplementation(() => {
      throw 'standard failed';
    });

    const coordinator = new Level5Coordinator();
    (coordinator as unknown as {
      _coordinatorState: { requirementAnalysis: RequirementAnalysis | null };
    })._coordinatorState = {
      requirementAnalysis: createRequirementAnalysis({
        taskType: 'brainstorm_synthesis',
      }),
    } as never;

    const liteState = makeState({ warnings: undefined as never, draft_content: 'seed-lite' });
    const liteResult = await (coordinator as unknown as {
      _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
    })._executeWrite(
      {
        commandId: 'cmd-lite',
        commandType: CommandType.EXECUTE,
        name: 'lite',
        description: 'lite',
        agent: 'writer',
        parameters: { workflow_branch: 'lite' },
      },
      liteState,
    );

    const brainstormState = makeState({ warnings: undefined as never, draft_content: 'seed-brainstorm' });
    const brainstormResult = await (coordinator as unknown as {
      _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
    })._executeWrite(
      {
        commandId: 'cmd-brainstorm',
        commandType: CommandType.EXECUTE,
        name: 'brainstorm',
        description: 'brainstorm',
        agent: 'writer',
        parameters: {},
      },
      brainstormState,
    );

    (coordinator as unknown as {
      _coordinatorState: { requirementAnalysis: RequirementAnalysis | null };
    })._coordinatorState = {
      requirementAnalysis: createRequirementAnalysis({
        taskType: 'chapter_revision',
      }),
    } as never;
    const standardState = makeState({ warnings: undefined as never, draft_content: 'seed-standard' });
    const standardResult = await (coordinator as unknown as {
      _executeWrite: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
    })._executeWrite(
      {
        commandId: 'cmd-standard',
        commandType: CommandType.EXECUTE,
        name: 'standard',
        description: 'standard',
        agent: 'writer',
        parameters: {},
      },
      standardState,
    );

    expect(liteResult).toEqual({ content: 'seed-lite', status: 'completed' });
    expect(brainstormResult).toEqual({ content: 'seed-brainstorm', status: 'completed' });
    expect(standardResult).toEqual({ content: 'seed-standard', status: 'completed' });
    expect(liteState.warnings).toEqual(expect.arrayContaining([expect.stringContaining('lite failed')]));
    expect(brainstormState.warnings).toEqual(expect.arrayContaining([expect.stringContaining('brainstorm failed')]));
    expect(standardState.warnings).toEqual(expect.arrayContaining([expect.stringContaining('standard failed')]));
  });

  it('records verify failures for both lite and standard branches and appends citation summaries only when present', () => {
    vi.spyOn(Level2Lite.prototype, '_verifyLite').mockImplementation(() => {
      throw 'lite verify failed';
    });
    vi.spyOn(Level3Standard.prototype, '_criticPhase').mockImplementation(() => {
      throw 'standard verify failed';
    });

    const coordinator = new Level5Coordinator();
    const liteState = makeState({ warnings: undefined as never });
    const liteResult = (coordinator as unknown as {
      _executeVerify: (cmd: Record<string, unknown>, state: BaseState) => Record<string, unknown>;
    })._executeVerify(
      {
        commandId: 'cmd-lite-verify',
        commandType: CommandType.VERIFY,
        name: 'verify-lite',
        description: 'verify-lite',
        agent: 'critic',
        parameters: { workflow_branch: 'lite' },
      },
      liteState,
    );

    const standardState = makeState({
      warnings: undefined as never,
      metadata: { citations: ['c1', 'c2'] } as never,
      feedback_context: 'feedback body',
      score: 88,
      decision: 'APPROVED',
    });
    const standardResult = (coordinator as unknown as {
      _executeVerify: (cmd: Record<string, unknown>, state: BaseState) => Record<string, unknown>;
    })._executeVerify(
      {
        commandId: 'cmd-standard-verify',
        commandType: CommandType.VERIFY,
        name: 'verify-standard',
        description: 'verify-standard',
        agent: 'critic',
        parameters: {},
      },
      standardState,
    );

    expect(liteResult).toEqual({
      score: 0,
      feedback: '',
      decision: 'REVISE',
      status: 'completed',
    });
    expect(standardState.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('standard verify failed')]),
    );
    expect(standardResult).toEqual({
      score: 88,
      feedback: 'feedback body\n\n引用摘要: c1, c2',
      decision: 'APPROVED',
      status: 'completed',
    });
  });

  it('falls back when revision context pieces and result content are missing, and reports completion false without coordinator state', async () => {
    const coordinator = new Level5Coordinator();
    vi
      .spyOn(coordinator as never, '_executeWrite' as never)
      .mockResolvedValue({ status: 'completed' });

    const result = await (coordinator as unknown as {
      _executeRevise: (cmd: Record<string, unknown>, state: BaseState) => Promise<Record<string, unknown>>;
      _allUnitsCompleted: () => boolean;
      _coordinatorState: unknown;
    })._executeRevise(
      {
        commandId: 'cmd-revise',
        commandType: CommandType.REVISE,
        name: 'revise',
        description: 'revise',
        agent: 'writer',
        parameters: {},
      },
      makeState({
        context: undefined as never,
        feedback_context: undefined as never,
      }),
    );

    (coordinator as unknown as { _coordinatorState: unknown })._coordinatorState = null;

    expect(result).toEqual({ content: '', status: 'completed' });
    expect((coordinator as unknown as { _allUnitsCompleted: () => boolean })._allUnitsCompleted()).toBe(false);
  });

  it('falls back to empty request text during requirement analysis when the state omits it', () => {
    const coordinator = new Level5Coordinator();
    const analyzeSpy = vi.spyOn(coordinator, 'analyzeRequirements');

    const state = (coordinator as unknown as {
      _analyzeRequirementsPhase: (state: BaseState) => BaseState;
    })._analyzeRequirementsPhase(makeState({
      user_request: undefined as never,
      context: undefined as never,
    }));

    expect(analyzeSpy).toHaveBeenCalledWith({
      user_request: '',
      context: '',
    });
    expect((state as Record<string, unknown>).requirement_analysis).toBeTruthy();
  });

  it('initializes missing errors arrays in recommend and execute-chain fallback phases', async () => {
    const coordinator = new Level5Coordinator();
    (coordinator as unknown as {
      _coordinatorState: {
        requirementAnalysis: RequirementAnalysis | null;
        commandChain: ReturnType<typeof createCommandChain> | null;
      };
    })._coordinatorState = {
      requirementAnalysis: null,
      commandChain: null,
    } as never;

    const recommendState = (coordinator as unknown as {
      _recommendChainPhase: (state: BaseState) => BaseState;
    })._recommendChainPhase(makeState({
      errors: undefined as never,
    }));

    const executeState = await (coordinator as unknown as {
      _executeChainPhase: (state: BaseState) => Promise<BaseState>;
    })._executeChainPhase(makeState({
      errors: undefined as never,
    }));

    expect(recommendState.errors).toHaveLength(1);
    expect(executeState.errors).toHaveLength(1);
  });

  it('stores feedback context when a unit result includes feedback payloads', async () => {
    const coordinator = new Level5Coordinator();
    const unit = createExecutionUnit('unit-feedback', {
      commandId: 'cmd-feedback',
      commandType: CommandType.VERIFY,
      name: 'verify',
      description: 'verify',
      agent: 'critic',
      parameters: {},
    });

    vi
      .spyOn(coordinator as never, '_executeVerify' as never)
      .mockReturnValue({
        feedback: 'feedback from unit',
        status: 'completed',
      });

    const state = await (coordinator as unknown as {
      _executeUnit: (unit: typeof unit, state: BaseState) => Promise<BaseState>;
    })._executeUnit(unit, makeState());

    expect((state as Record<string, unknown>).feedback_context).toBe('feedback from unit');
    expect(unit.state).toBe(ExecutionStatus.COMPLETED);
  });

  it('converts Error instances and initializes missing errors when unit execution throws', async () => {
    const coordinator = new Level5Coordinator();
    const unit = createExecutionUnit('unit-error', {
      commandId: 'cmd-plan-error',
      commandType: CommandType.PLAN,
      name: 'plan',
      description: 'plan',
      agent: 'architect',
      parameters: {},
    });

    vi
      .spyOn(coordinator as never, '_executePlan' as never)
      .mockImplementation(() => {
        throw new Error('plan error instance');
      });

    const state = await (coordinator as unknown as {
      _executeUnit: (unit: typeof unit, state: BaseState) => Promise<BaseState>;
    })._executeUnit(unit, makeState({
      errors: undefined as never,
    }));

    expect(unit.state).toBe(ExecutionStatus.FAILED);
    expect(unit.error).toBe('plan error instance');
    expect(state.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('plan error instance')]),
    );
  });

  it('stringifies non-Error throw values from unit execution', async () => {
    const coordinator = new Level5Coordinator();
    const unit = createExecutionUnit('unit-string-error', {
      commandId: 'cmd-plan-string-error',
      commandType: CommandType.PLAN,
      name: 'plan',
      description: 'plan',
      agent: 'architect',
      parameters: {},
    });

    vi
      .spyOn(coordinator as never, '_executePlan' as never)
      .mockImplementation(() => {
        throw 'plain string failure';
      });

    const state = await (coordinator as unknown as {
      _executeUnit: (unit: typeof unit, state: BaseState) => Promise<BaseState>;
    })._executeUnit(unit, makeState());

    expect(unit.state).toBe(ExecutionStatus.FAILED);
    expect(unit.error).toBe('plain string failure');
    expect(state.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('plain string failure')]),
    );
  });

  it('initializes missing warnings when analyze retrieval fails before search results are built', async () => {
    const retriever = {
      resolveContext: vi.fn().mockRejectedValue(new Error('resolve failed without warnings')),
      hybridSearch: vi.fn(),
    };
    const coordinator = new Level5Coordinator({}, createSessionManager(), retriever as never);

    const result = await (coordinator as unknown as {
      _executeAnalyze: (
        cmd: {
          commandId: string;
          commandType: CommandType;
          name: string;
          description: string;
          agent: string;
          parameters: Record<string, unknown>;
        },
        state: BaseState,
      ) => Promise<Record<string, unknown>>;
    })._executeAnalyze(
      {
        commandId: 'cmd-analyze-warning-gap',
        commandType: CommandType.ANALYZE,
        name: 'analyze-fallback',
        description: '',
        agent: 'coordinator',
        parameters: {},
      },
      makeState({
        warnings: undefined as never,
      }),
    );

    expect(result).toEqual({
      analysis: [],
      status: 'completed',
    });
  });
});
