import { afterEach, describe, expect, it, vi } from 'vitest';

import { AgentType as ContainerAgentType } from '../../container/types';
import { TeamPhase, TEAM_TRANSITIONS } from '../../workflow/team/phase-gate-evaluator.js';

const workflowEngineCtor = vi.hoisted(() => vi.fn());
const workflowRunMock = vi.hoisted(() => vi.fn());

const getAgentMock = vi.hoisted(() => vi.fn());
const registerMockMock = vi.hoisted(() => vi.fn());

const backupManagerCtor = vi.hoisted(() => vi.fn());
const backupCreateMock = vi.hoisted(() => vi.fn());
const backupRestoreMock = vi.hoisted(() => vi.fn());
const backupListMock = vi.hoisted(() => vi.fn());
const backupDeleteMock = vi.hoisted(() => vi.fn());

const fileSyncServiceCtor = vi.hoisted(() => vi.fn());
const fileSyncServiceMethods = vi.hoisted(() => ({
  syncDirectory: vi.fn().mockResolvedValue([]),
  getSyncHistory: vi.fn().mockReturnValue([]),
  getIndexedFiles: vi.fn().mockReturnValue({}),
}));

const llmFallbackChainCtor = vi.hoisted(() => vi.fn());
const executeWithFallbackMock = vi.hoisted(() => vi.fn().mockResolvedValue('fallback-ok'));
const getLatencyStatsMock = vi.hoisted(() => vi.fn().mockReturnValue({}));
const getChainConfigMock = vi.hoisted(() => vi.fn().mockReturnValue({}));

const circuitBreakerRegistryCtor = vi.hoisted(() => vi.fn());

vi.mock('../../workflow/workflow-engine', () => ({
  WorkflowEngine: class {
    _llmService: unknown;
    _phaseOrch: unknown;
    args: unknown[];

    constructor(...args: unknown[]) {
      workflowEngineCtor(...args);
      this.args = args;
      this._llmService = args[2] ?? { id: 'mock-llm-service' };
      this._phaseOrch = args[5] ?? { id: 'mock-phase-orchestrator' };
    }

    run = workflowRunMock;
  },
}));

vi.mock('../../agents/factory', () => ({
  AgentFactory: class {
    getAgent = getAgentMock;
    register = vi.fn();
    registerMock = registerMockMock;
  },
}));

vi.mock('../../services/backup-manager', () => ({
  BackupManager: class {
    constructor() {
      backupManagerCtor();
    }

    createBackup = backupCreateMock;
    restoreBackup = backupRestoreMock;
    listBackups = backupListMock;
    deleteBackup = backupDeleteMock;
  },
}));

vi.mock('../../services/file-sync', () => ({
  FileSyncService: vi.fn().mockImplementation(function FileSyncService(
    this: Record<string, unknown>,
    knowledgeLayer: unknown,
    watchPaths: unknown,
    writingRoot: unknown,
  ) {
    fileSyncServiceCtor(knowledgeLayer, watchPaths, writingRoot);
    Object.assign(this, fileSyncServiceMethods);
  }),
}));

vi.mock('../../services/llm-fallback-chain', () => ({
  LLMFallbackChainImpl: class {
    constructor(...args: unknown[]) {
      llmFallbackChainCtor(...args);
    }

    executeWithFallback = executeWithFallbackMock;
    getLatencyStats = getLatencyStatsMock;
    getChainConfig = getChainConfigMock;
  },
}));

vi.mock('../../services/circuit-breaker', () => ({
  CircuitBreakerRegistry: class {
    constructor(...args: unknown[]) {
      circuitBreakerRegistryCtor(...args);
    }
  },
}));

describe('container/adapters default branch coverage', () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('covers indexed search defaults, unmatched terms, and minimum score fallback', async () => {
    const retriever = {
      hybridSearch: vi.fn()
        .mockResolvedValueOnce([
          {
            id: 'remote-1',
            content: 'remote answer',
            score: 0.61,
            metadata: { layer: 'remote' },
          },
        ])
        .mockResolvedValueOnce([]),
    };

    const { SearchEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new SearchEngineAdapter(retriever as never);

    await adapter.index({ id: 'doc-1', content: 'alpha beta' });
    await adapter.index({ id: 'doc-2', content: 'noise only', metadata: { type: 'note' } });

    await expect(adapter.search('remote query')).resolves.toEqual([
      {
        id: 'remote-1',
        content: 'remote answer',
        score: 0.61,
        metadata: { layer: 'remote' },
      },
    ]);
    expect(retriever.hybridSearch).toHaveBeenNthCalledWith(
      1,
      'remote query',
      'all',
      10,
      undefined,
      0,
      undefined,
      false,
      'hybrid',
      300,
    );

    await expect(
      adapter.search('alpha beta', {
        filters: { type: 123 as never },
      }),
    ).resolves.toEqual([
      {
        id: 'doc-1',
        content: 'alpha beta',
        score: 1,
        metadata: undefined,
      },
    ]);

    await expect(
      adapter.search('alpha beta gamma', {
        limit: 5,
        threshold: 0.8,
      }),
    ).resolves.toEqual([]);
    expect(retriever.hybridSearch).toHaveBeenNthCalledWith(
      2,
      'alpha beta gamma',
      'all',
      5,
      undefined,
      0.8,
      undefined,
      false,
      'hybrid',
      300,
    );
  });

  it('covers workflow default engine construction and stringified execution failures', async () => {
    workflowRunMock.mockRejectedValueOnce('workflow exploded as string');

    const { WorkflowEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new WorkflowEngineAdapter();

    await expect(
      adapter.executeLevel('L1', {
        sessionId: 'session-fallback',
      } as never),
    ).resolves.toEqual({
      success: false,
      error: 'workflow exploded as string',
    });
    expect(workflowEngineCtor).toHaveBeenCalledTimes(1);
    expect(workflowEngineCtor).toHaveBeenCalledWith();
  });

  it('falls back to an empty suggestions list when critic recommendations are absent', async () => {
    const { CriticEngineAdapter } = await import('../../container/adapters.js');
    const adapter = new CriticEngineAdapter({} as never);

    expect(adapter.getSuggestions({
      score: 0,
      issues: [],
      strengths: [],
      recommendations: undefined as unknown as string[],
    })).toEqual([]);
  });

  it('covers generic runtime fallbacks and writer default contracts', async () => {
    const runMock = vi.fn().mockResolvedValue({ currentPosition: 'plot-step' });
    const writeMock = vi.fn().mockResolvedValue({ content: 'draft output' });
    const reviseMock = vi.fn().mockResolvedValue({ content: 'revised output' });

    getAgentMock
      .mockReturnValueOnce({ run: runMock })
      .mockReturnValueOnce({ write: writeMock })
      .mockReturnValueOnce({ revise: reviseMock });

    const { AgentFactoryAdapter } = await import('../../container/adapters.js');
    const adapter = new AgentFactoryAdapter();

    const plotAgent = adapter.getAgent(ContainerAgentType.Plot);
    expect(plotAgent.getName()).toBe(ContainerAgentType.Plot);
    await expect(plotAgent.execute('plot task')).resolves.toEqual({ currentPosition: 'plot-step' });
    expect(runMock).toHaveBeenCalledWith('plot task');

    const writerAgent = adapter.getAgent(ContainerAgentType.Writer);
    await expect(writerAgent.execute('ignored task')).resolves.toEqual({ content: 'draft output' });
    expect(writeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scene_id: 'scene-001',
        chapter_num: 1,
        pov_character: 'protagonist',
        objective: 'advance plot',
        conflict: 'encounter obstacle',
        outcome: '+',
        plot_beat: 'scene progression',
        emotional_arc: 'calm->change',
        sensory_guidance: {},
        character_profiles: [],
        world_settings: {},
        foreshadows_to_plant: [],
        foreshadows_to_harvest: [],
        word_target: 2000,
      }),
      true,
    );

    const reviser = adapter.getAgent(ContainerAgentType.Writer);
    await expect(
      reviser.execute('', {
        mode: 'revise',
      }),
    ).resolves.toEqual({ content: 'revised output' });
    expect(reviseMock).toHaveBeenCalledWith('', {}, true, undefined);
  });

  it('uses backup and restore fallback error messages when services omit details', async () => {
    backupCreateMock.mockReturnValueOnce({ success: false });
    backupRestoreMock.mockReturnValueOnce({ success: false });

    const { BackupManagerAdapter } = await import('../../container/adapters.js');
    const adapter = new BackupManagerAdapter();

    await expect(adapter.createBackup()).rejects.toThrow('Backup failed');
    await expect(adapter.restoreBackup('backup-1')).rejects.toThrow('Restore failed');
    expect(backupManagerCtor).toHaveBeenCalledTimes(1);
  });

  it('covers invalid phase handling and transition fallback lookup', async () => {
    const { PhaseOrchestratorAdapter } = await import('../../container/adapters.js');
    const adapter = new PhaseOrchestratorAdapter();

    expect(adapter.getQualityGates('not-a-phase')).toEqual([]);
    const transitions = TEAM_TRANSITIONS as Map<TeamPhase, readonly { to: TeamPhase; maxRetries: number | null }[]>;
    const saved = transitions.get(TeamPhase.complete);
    transitions.delete(TeamPhase.complete);
    try {
      expect(adapter.getQualityGates(TeamPhase.complete)).toEqual([]);
    } finally {
      if (saved) {
        transitions.set(TeamPhase.complete, saved);
      }
    }
  });

  it('normalizes missing file-sync watch paths to an empty array', async () => {
    const { FileSyncServiceAdapter } = await import('../../container/adapters.js');

    const adapter = new FileSyncServiceAdapter({ id: 'knowledge-layer' } as never);
    expect(adapter).toBeInstanceOf(FileSyncServiceAdapter);
    expect(fileSyncServiceCtor).toHaveBeenCalledWith({ id: 'knowledge-layer' }, [], undefined);
  });

  it('constructs the LLM fallback chain with default registry, provider map, and config', async () => {
    const { LLMFallbackChainAdapter } = await import('../../container/adapters.js');

    const adapter = new LLMFallbackChainAdapter();
    await expect(
      adapter.executeWithFallback(async () => 'unused', 'generate'),
    ).resolves.toBe('fallback-ok');

    expect(circuitBreakerRegistryCtor).toHaveBeenCalledTimes(1);
    expect(circuitBreakerRegistryCtor).toHaveBeenCalledWith();
    expect(llmFallbackChainCtor).toHaveBeenCalledTimes(1);

    const ctorArgs = llmFallbackChainCtor.mock.calls[0];
    expect(ctorArgs?.[0]).toBeDefined();
    expect(ctorArgs?.[1]).toBeInstanceOf(Map);
    expect((ctorArgs?.[1] as Map<unknown, unknown>).size).toBe(0);
    expect(ctorArgs?.[2]).toEqual({});
    expect(ctorArgs?.[3]).toBeUndefined();
  });
});
