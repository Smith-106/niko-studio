import { describe, expect, it, vi } from 'vitest';

import {
  Level5Coordinator,
  CommandType,
  createCommandChain,
  addCommandToChain,
  type ISessionManager,
} from '../../workflow/levels/level5-coordinator.js';
import { Level2Lite } from '../../workflow/levels/level2-lite.js';
import { Level3Standard } from '../../workflow/levels/level3-standard.js';
import { Level4Brainstorm } from '../../workflow/levels/level4-brainstorm.js';
import type { BaseState } from '../../workflow/state.js';

describe('Level5Coordinator', () => {
  it('uses analysis retriever output instead of placeholder analysis', async () => {
    const sessionManager: ISessionManager = {
      init: vi.fn(),
      write: vi.fn(),
      read: vi.fn().mockReturnValue(null),
    };
    const analysisRetriever = {
      resolveContext: vi.fn().mockResolvedValue('resolved task context'),
      hybridSearch: vi.fn().mockResolvedValue([
        { id: 'doc-1', source: 'memory', score: 0.91, content: 'Important memory context' },
        { id: 'doc-2', source: 'file', score: 0.75, content: 'Relevant file context' },
      ]),
    };

    const coordinator = new Level5Coordinator(
      { retrieval_profile: 'coordinator_quality' },
      sessionManager,
      analysisRetriever,
    );

    const chain = createCommandChain('chain-1', 'Analyze only', 'single analyze command');
    addCommandToChain(chain, {
      commandId: 'cmd-analyze',
      commandType: CommandType.ANALYZE,
      name: '分析',
      description: '分析任务',
      agent: 'coordinator',
      parameters: { limit: 2, scope: 'all' },
    });

    const state: BaseState = {
      session_id: 'session-1',
      user_request: 'analyze this chapter revision',
      metadata: {},
      warnings: [],
      errors: [],
    };

    const updated = await coordinator.executeChain(chain, state);

    expect(analysisRetriever.resolveContext).toHaveBeenCalledWith('analyze this chapter revision');
    expect(analysisRetriever.hybridSearch).toHaveBeenCalledWith({
      query: 'resolved task context',
      scope: 'all',
      limit: 2,
      profile: 'coordinator_quality',
      rerank: true,
      routeMode: 'hybrid',
    });
    expect(updated.metadata).toMatchObject({
      analysis: [
        { rank: 1, id: 'doc-1', source: 'memory', score: 0.91, preview: 'Important memory context' },
        { rank: 2, id: 'doc-2', source: 'file', score: 0.75, preview: 'Relevant file context' },
      ],
    });
  });

  it('persists and restores coordinator state through the session manager interface', async () => {
    let storedPayload = '';
    const sessionManager: ISessionManager = {
      init: vi.fn(),
      write: vi.fn((_sessionId, _contentType, content) => {
        storedPayload = content;
      }),
      read: vi.fn(() => storedPayload),
    };
    const analysisRetriever = {
      resolveContext: vi.fn().mockResolvedValue('resolved task context'),
      hybridSearch: vi.fn().mockResolvedValue([]),
    };

    const coordinator = new Level5Coordinator({}, sessionManager, analysisRetriever);
    const state: BaseState = {
      session_id: 'session-restore',
      user_request: 'draft a new arc',
      metadata: {},
      warnings: [],
      errors: [],
    };

    await coordinator.execute(state);
    const restored = await coordinator.loadState('session-restore');

    expect(sessionManager.init).toHaveBeenCalled();
    expect(sessionManager.write).toHaveBeenCalled();
    expect(restored?.sessionId).toBe('session-restore');
    expect(restored?.phase).toBe('completed');
  });

  it('routes execute commands to lite, brainstorm, and standard branches', async () => {
    const liteSpy = vi.spyOn(Level2Lite.prototype, '_executeLite').mockImplementation((state) => ({
      ...state,
      draft_content: 'lite-content',
    }));
    const standardSpy = vi.spyOn(Level3Standard.prototype, '_executePhase').mockImplementation((state) => ({
      ...state,
      draft_content: 'standard-content',
    }));
    const brainstormSpy = vi.spyOn(Level4Brainstorm.prototype, 'execute').mockImplementation((state) => ({
      ...state,
      final_output: 'brainstorm-content',
    }));

    const coordinator = new Level5Coordinator(
      {},
      {
        init: vi.fn(),
        write: vi.fn(),
        read: vi.fn().mockReturnValue(null),
      },
      {
        resolveContext: vi.fn().mockResolvedValue('ctx'),
        hybridSearch: vi.fn().mockResolvedValue([]),
      },
    );

    const makeState = (): BaseState => ({
      session_id: 'branch-session',
      user_request: 'branch test',
      metadata: {},
      warnings: [],
      errors: [],
    });

    const liteChain = createCommandChain('lite-chain', 'Lite', 'lite execute');
    addCommandToChain(liteChain, {
      commandId: 'cmd-lite',
      commandType: CommandType.EXECUTE,
      name: '执行',
      description: 'lite execute',
      agent: 'writer',
      parameters: { workflow_branch: 'lite' },
    });

    const brainstormChain = createCommandChain('brainstorm-chain', 'Brainstorm', 'brainstorm execute');
    addCommandToChain(brainstormChain, {
      commandId: 'cmd-brainstorm',
      commandType: CommandType.EXECUTE,
      name: '执行',
      description: 'brainstorm execute',
      agent: 'writer',
      parameters: { workflow_branch: 'brainstorm' },
    });

    const standardChain = createCommandChain('standard-chain', 'Standard', 'standard execute');
    addCommandToChain(standardChain, {
      commandId: 'cmd-standard',
      commandType: CommandType.EXECUTE,
      name: '执行',
      description: 'standard execute',
      agent: 'writer',
      parameters: {},
    });

    const liteResult = await coordinator.executeChain(liteChain, makeState());
    const brainstormResult = await coordinator.executeChain(brainstormChain, makeState());
    const standardResult = await coordinator.executeChain(standardChain, makeState());

    expect(liteSpy).toHaveBeenCalled();
    expect(brainstormSpy).toHaveBeenCalled();
    expect(standardSpy).toHaveBeenCalled();
    expect(liteResult.draft_content).toBe('lite-content');
    expect(brainstormResult.final_output).toBe('brainstorm-content');
    expect(standardResult.draft_content).toBe('standard-content');
  });

  it('routes verify commands to lite and standard verification paths', async () => {
    const liteVerifySpy = vi.spyOn(Level2Lite.prototype, '_verifyLite').mockImplementation((state) => ({
      ...state,
      decision: 'APPROVED',
      score: 72,
    }));
    const standardVerifySpy = vi.spyOn(Level3Standard.prototype, '_criticPhase').mockImplementation((state) => ({
      ...state,
      decision: 'REVISE',
      score: 81,
    }));

    const coordinator = new Level5Coordinator(
      {},
      {
        init: vi.fn(),
        write: vi.fn(),
        read: vi.fn().mockReturnValue(null),
      },
      {
        resolveContext: vi.fn().mockResolvedValue('ctx'),
        hybridSearch: vi.fn().mockResolvedValue([]),
      },
    );

    const makeState = (): BaseState => ({
      session_id: 'verify-session',
      user_request: 'verify branch test',
      draft_content: 'draft',
      metadata: {},
      warnings: [],
      errors: [],
    });

    const liteChain = createCommandChain('lite-verify-chain', 'Lite verify', 'lite verify');
    addCommandToChain(liteChain, {
      commandId: 'cmd-lite-verify',
      commandType: CommandType.VERIFY,
      name: '验证',
      description: 'lite verify',
      agent: 'critic',
      parameters: { workflow_branch: 'lite' },
    });

    const standardChain = createCommandChain('standard-verify-chain', 'Standard verify', 'standard verify');
    addCommandToChain(standardChain, {
      commandId: 'cmd-standard-verify',
      commandType: CommandType.VERIFY,
      name: '验证',
      description: 'standard verify',
      agent: 'critic',
      parameters: {},
    });

    const liteResult = await coordinator.executeChain(liteChain, makeState());
    const standardResult = await coordinator.executeChain(standardChain, makeState());

    expect(liteVerifySpy).toHaveBeenCalled();
    expect(standardVerifySpy).toHaveBeenCalled();
    expect(liteResult.decision).toBe('APPROVED');
    expect(liteResult.score).toBe(72);
    expect(standardResult.decision).toBe('REVISE');
    expect(standardResult.score).toBe(81);
  });
});
