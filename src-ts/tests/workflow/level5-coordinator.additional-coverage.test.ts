import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import {
  CommandType,
  ExecutionStatus,
  Level5Coordinator,
  createCoordinatorState,
  createExecutionUnit,
  type ISessionManager,
} from '../../workflow/levels/level5-coordinator.js';
import type { BaseState } from '../../workflow/state.js';

function makeState(overrides: Partial<BaseState> = {}): BaseState {
  return {
    session_id: 'l5-additional-coverage',
    user_request: '默认请求',
    metadata: {},
    warnings: [],
    errors: [],
    ...overrides,
  };
}

function createSessionManagerMock(overrides: Partial<ISessionManager> = {}): ISessionManager {
  return {
    init: vi.fn(),
    write: vi.fn(),
    read: vi.fn().mockReturnValue(null),
    ...overrides,
  };
}

function createRetrieverMock() {
  return {
    resolveContext: vi.fn().mockResolvedValue('resolved context'),
    hybridSearch: vi.fn().mockResolvedValue([]),
  };
}

describe('Level5Coordinator additional coverage', () => {
  it('marks execution as failed and persists the failed coordinator state when a phase throws', async () => {
    const sessionManager = createSessionManagerMock();
    const retriever = createRetrieverMock();
    const coordinator = new Level5Coordinator({}, sessionManager, retriever as never);

    const persistSpy = vi
      .spyOn(coordinator, 'persistState')
      .mockResolvedValue('failed-session');
    vi
      .spyOn(coordinator as never, '_analyzeRequirementsPhase' as never)
      .mockImplementation(() => {
        throw new Error('phase exploded');
      });

    const state = await coordinator.execute(makeState({ session_id: 'failed-session' }));
    const coordinatorState = (coordinator as unknown as {
      _coordinatorState: ReturnType<typeof createCoordinatorState>;
    })._coordinatorState;

    expect(state.decision).toBe('FAILED');
    expect(state.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('协调者执行失败: phase exploded')]),
    );
    expect(coordinatorState.phase).toBe('failed');
    expect(coordinatorState.errors).toContain('phase exploded');
    expect(persistSpy).toHaveBeenCalled();
  });

  it('swallows file and session persistence failures and still returns the session id', async () => {
    const persistDirFile = join(tmpdir(), `niko-l5-persist-${randomUUID()}.txt`);
    writeFileSync(persistDirFile, 'occupied', 'utf8');

    try {
      const sessionManager = createSessionManagerMock({
        write: vi.fn(() => {
          throw new Error('session write exploded');
        }),
      });
      const retriever = createRetrieverMock();
      const coordinator = new Level5Coordinator({ persist_dir: persistDirFile }, sessionManager, retriever as never);
      const coordinatorState = createCoordinatorState('persist-session');

      await expect(coordinator.persistState(coordinatorState)).resolves.toBe('persist-session');
      expect(sessionManager.write).toHaveBeenCalledWith(
        'persist-session',
        'state',
        expect.any(String),
      );
    } finally {
      rmSync(persistDirFile, { force: true });
    }
  });

  it('returns null when session restore throws and no persisted file exists', async () => {
    const persistDir = mkdtempSync(join(tmpdir(), 'niko-l5-load-'));

    try {
      const sessionManager = createSessionManagerMock({
        read: vi.fn(() => {
          throw new Error('restore exploded');
        }),
      });
      const retriever = createRetrieverMock();
      const coordinator = new Level5Coordinator({ persist_dir: persistDir }, sessionManager, retriever as never);

      await expect(coordinator.loadState('missing-session')).resolves.toBeNull();
    } finally {
      rmSync(persistDir, { recursive: true, force: true });
    }
  });

  it('reports missing prerequisite state in chain planning and execution helpers', async () => {
    const sessionManager = createSessionManagerMock();
    const retriever = createRetrieverMock();
    const coordinator = new Level5Coordinator({}, sessionManager, retriever as never);
    const coordinatorState = createCoordinatorState('phase-helpers');
    (coordinator as unknown as { _coordinatorState: typeof coordinatorState })._coordinatorState = coordinatorState;

    const recommendState = (coordinator as unknown as {
      _recommendChainPhase: (state: BaseState) => BaseState;
    })._recommendChainPhase(makeState());
    expect(recommendState.errors).toEqual(
      expect.arrayContaining(['需求分析未完成']),
    );

    const executeState = await (coordinator as unknown as {
      _executeChainPhase: (state: BaseState) => Promise<BaseState>;
    })._executeChainPhase(makeState());
    expect(executeState.errors).toEqual(
      expect.arrayContaining(['命令链未生成']),
    );
  });

  it('replaces invalid metadata containers when analyze units return analysis payloads', async () => {
    const sessionManager = createSessionManagerMock();
    const retriever = createRetrieverMock();
    const coordinator = new Level5Coordinator({}, sessionManager, retriever as never);
    const unit = createExecutionUnit('unit-analysis', {
      commandId: 'cmd-analysis',
      commandType: CommandType.ANALYZE,
      name: '分析',
      description: '分析当前请求',
      agent: 'coordinator',
      parameters: {},
    });

    vi
      .spyOn(coordinator as never, '_executeAnalyze' as never)
      .mockResolvedValue({
        analysis: [{ id: 'doc-1', rank: 1 }],
        status: 'completed',
      } as never);

    const state = makeState({ metadata: 'broken-metadata' as never });
    const updated = await (coordinator as unknown as {
      _executeUnit: (unit: typeof unit, state: BaseState) => Promise<BaseState>;
    })._executeUnit(unit, state);

    expect(unit.state).toBe(ExecutionStatus.COMPLETED);
    expect(updated.metadata).toEqual({
      analysis: [{ id: 'doc-1', rank: 1 }],
    });
  });

  it('downgrades analyze retriever failures into warnings with an empty analysis result', async () => {
    const sessionManager = createSessionManagerMock();
    const retriever = {
      resolveContext: vi.fn().mockRejectedValue(new Error('search exploded')),
      hybridSearch: vi.fn(),
    };
    const coordinator = new Level5Coordinator({}, sessionManager, retriever as never);
    const state = makeState();

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
        commandId: 'cmd-analyze-failure',
        commandType: CommandType.ANALYZE,
        name: '分析',
        description: '分析失败路径',
        agent: 'coordinator',
        parameters: {},
      },
      state,
    );

    expect(result).toEqual({
      analysis: [],
      status: 'completed',
    });
    expect(state.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining('L5 分析阶段检索失败')]),
    );
  });
});
