import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  checkpointStateFromDict,
  ContextFormat,
  HybridStrategy,
  NativeResumeStrategy,
  PromptConcatStrategy,
  ResumeMode,
  ResumeStrategyResolver,
  buildContextPrefix,
  createStrategy,
  determineResumeStrategy,
  sessionContextFromDict,
} from '../../workflow/session/resume-strategy';

const tempDirs: string[] = [];

function createBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-resume-extra-'));
  tempDirs.push(dir);
  return dir;
}

function createTurn(role: string, content: string, timestamp: string) {
  return {
    role,
    content,
    timestamp,
    tool_calls: null,
    metadata: null,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('workflow/session/resume-strategy additional coverage', () => {
  it('fills default values when deserializing partial session contexts and checkpoints', () => {
    expect(
      sessionContextFromDict({
        session_id: 'session-defaults',
      } as Record<string, unknown>),
    ).toEqual({
      session_id: 'session-defaults',
      history: [],
      last_state: null,
      resumed_at: null,
      resume_mode: ResumeMode.NATIVE,
      checkpoint_id: null,
      metadata: null,
    });

    expect(
      checkpointStateFromDict({
        checkpoint_id: 'cp-defaults',
        session_id: 'session-defaults',
        created_at: '2026-06-05T00:00:00.000Z',
        workflow_step: 'draft',
        state_data: {},
      } as Record<string, unknown>),
    ).toEqual({
      checkpoint_id: 'cp-defaults',
      session_id: 'session-defaults',
      created_at: '2026-06-05T00:00:00.000Z',
      workflow_step: 'draft',
      state_data: {},
      history_snapshot: [],
    });
  });

  it('handles malformed mapping and checkpoint files and rejects missing native or concat resumes', () => {
    const basePath = createBasePath();
    fs.mkdirSync(path.join(basePath, '.checkpoints'), { recursive: true });
    fs.writeFileSync(path.join(basePath, '.native_mapping.json'), '{broken json', 'utf-8');
    fs.writeFileSync(path.join(basePath, '.checkpoints', 'broken.json'), '{broken json', 'utf-8');

    const nativeStrategy = new NativeResumeStrategy(basePath, 'codex');
    expect(nativeStrategy.listCheckpoints('broken')).toEqual([]);
    expect(() => nativeStrategy.resume('broken')).toThrow(
      'Cannot resume session broken with native strategy',
    );

    const concatStrategy = new PromptConcatStrategy(basePath, ContextFormat.YAML, 5);
    expect(() => concatStrategy.resume('missing')).toThrow(
      'No checkpoint found for session missing',
    );

    const unsupportedNative = new NativeResumeStrategy(basePath, 'python');
    expect(unsupportedNative.supportsNative()).toBe(false);
    expect(unsupportedNative.canResume('broken')).toBe(false);
  });

  it('treats missing checkpoint containers as empty when loading and appending', () => {
    const basePath = createBasePath();
    const checkpointDir = path.join(basePath, '.checkpoints');
    fs.mkdirSync(checkpointDir, { recursive: true });

    fs.writeFileSync(path.join(checkpointDir, 'session-load.json'), '{}', 'utf-8');
    const loadStrategy = new NativeResumeStrategy(basePath, 'codex');
    expect(loadStrategy.listCheckpoints('session-load')).toEqual([]);

    fs.writeFileSync(path.join(checkpointDir, 'session-append.json'), '{}', 'utf-8');
    const appendStrategy = new PromptConcatStrategy(basePath, ContextFormat.YAML, 5);
    const checkpointId = appendStrategy.saveCheckpoint('session-append', {
      current_step: 'append',
      history: [],
    });

    const stored = JSON.parse(
      fs.readFileSync(path.join(checkpointDir, 'session-append.json'), 'utf-8'),
    ) as { checkpoints: Array<Record<string, unknown>> };
    expect(stored.checkpoints).toHaveLength(1);
    expect(stored.checkpoints[0]?.['checkpoint_id']).toBe(checkpointId);
  });

  it('overwrites malformed checkpoint containers and normalizes non-object history items', () => {
    const basePath = createBasePath();
    const checkpointDir = path.join(basePath, '.checkpoints');
    fs.mkdirSync(checkpointDir, { recursive: true });
    fs.writeFileSync(path.join(checkpointDir, 'session-1.json'), '{broken json', 'utf-8');

    const strategy = new PromptConcatStrategy(basePath, ContextFormat.PLAIN, 10);
    const checkpointId = strategy.saveCheckpoint('session-1', {
      current_step: 'rewrite',
      history: ['bad-history-item'],
    });

    const stored = JSON.parse(
      fs.readFileSync(path.join(checkpointDir, 'session-1.json'), 'utf-8'),
    ) as { checkpoints: Array<Record<string, unknown>> };
    expect(stored.checkpoints).toHaveLength(1);
    expect(stored.checkpoints[0]?.['checkpoint_id']).toBe(checkpointId);

    const resumed = strategy.resume('session-1');
    expect(resumed.history).toHaveLength(1);
    expect(resumed.history[0]).toEqual({
      role: undefined,
      content: undefined,
      timestamp: null,
      tool_calls: null,
      metadata: null,
    });
  });

  it('covers native and concat checkpoint defaults plus implicit format selection', () => {
    const basePath = createBasePath();
    const nativeStrategy = new NativeResumeStrategy(basePath, 'codex');
    const promptStrategy = new PromptConcatStrategy(basePath, ContextFormat.JSON, 5);

    nativeStrategy.registerNativeSession('native-defaults', 'native-id');
    const nativeCheckpointId = nativeStrategy.saveCheckpoint('native-defaults', {});
    const nativeResumed = nativeStrategy.resume('native-defaults');
    expect(nativeResumed.checkpoint_id).toBe(nativeCheckpointId);
    expect(nativeResumed.history).toEqual([]);
    expect(nativeResumed.last_state).toEqual({});

    const nativeStored = nativeStrategy.getLatestCheckpoint('native-defaults');
    expect(nativeStored).toMatchObject({
      workflow_step: 'unknown',
      history_snapshot: [],
    });

    const promptCheckpointId = promptStrategy.saveCheckpoint('prompt-defaults', {});
    const promptResumed = promptStrategy.resume('prompt-defaults');
    expect(promptResumed.checkpoint_id).toBe(promptCheckpointId);
    expect(promptResumed.history).toEqual([]);
    expect(promptResumed.metadata).toMatchObject({
      format: ContextFormat.JSON,
      history_count: 0,
      truncated: false,
    });

    const promptStored = promptStrategy.getLatestCheckpoint('prompt-defaults');
    expect(promptStored).toMatchObject({
      workflow_step: 'unknown',
      history_snapshot: [],
    });

    const implicitPrefix = promptStrategy.buildContextPrefix(promptResumed);
    expect(implicitPrefix).toContain('```json');
  });

  it('survives native resume when the checkpoint lookup turns null after canResume passes', () => {
    const basePath = createBasePath();
    const strategy = new NativeResumeStrategy(basePath, 'codex') as unknown as {
      canResume: (sessionId: string) => boolean;
      getLatestCheckpoint: (sessionId: string) => null;
      getNativeSessionId: (sessionId: string) => string | null;
      resume: (sessionId: string) => {
        history: unknown[];
        last_state: Record<string, unknown> | null;
        checkpoint_id: string | null;
      };
    };

    vi.spyOn(strategy, 'canResume').mockReturnValue(true);
    vi.spyOn(strategy, 'getLatestCheckpoint').mockReturnValue(null);
    vi.spyOn(strategy, 'getNativeSessionId').mockReturnValue('native-fallback');

    expect(strategy.resume('session-race')).toMatchObject({
      history: [],
      last_state: null,
      checkpoint_id: null,
    });
  });

  it('falls back to concat when native resume throws and rejects sessions that no strategy can resume', () => {
    const basePath = createBasePath();
    const strategy = new HybridStrategy(basePath, 'codex');
    const strategyAny = strategy as any;

    vi.spyOn(strategyAny.nativeStrategy, 'canResume').mockReturnValue(true);
    vi.spyOn(strategyAny.nativeStrategy, 'resume').mockImplementation(() => {
      throw new Error('native resume exploded');
    });
    vi.spyOn(strategyAny.concatStrategy, 'canResume').mockReturnValue(true);
    vi.spyOn(strategyAny.concatStrategy, 'resume').mockReturnValue({
      session_id: 'session-fallback',
      history: [],
      last_state: { ok: true },
      resumed_at: '2026-06-05T00:00:00.000Z',
      resume_mode: ResumeMode.PROMPT_CONCAT,
      checkpoint_id: 'cp-1',
      metadata: { format: ContextFormat.YAML },
    });

    const resumed = strategy.resume('session-fallback');
    expect(resumed.metadata).toMatchObject({
      format: ContextFormat.YAML,
      fallback_used: true,
      original_mode: ResumeMode.NATIVE,
    });

    vi.spyOn(strategyAny.nativeStrategy, 'canResume').mockReturnValue(false);
    vi.spyOn(strategyAny.concatStrategy, 'canResume').mockReturnValue(false);
    expect(() => strategy.resume('session-none')).toThrow(
      'Cannot resume session session-none with any strategy',
    );
  });

  it('adds fallback metadata even when concat resume returns null metadata', () => {
    const basePath = createBasePath();
    const strategy = new HybridStrategy(basePath, 'codex');
    const strategyAny = strategy as any;

    vi.spyOn(strategyAny.nativeStrategy, 'canResume').mockReturnValue(true);
    vi.spyOn(strategyAny.nativeStrategy, 'resume').mockImplementation(() => {
      throw new Error('native resume exploded');
    });
    vi.spyOn(strategyAny.concatStrategy, 'canResume').mockReturnValue(true);
    vi.spyOn(strategyAny.concatStrategy, 'resume').mockReturnValue({
      session_id: 'session-null-meta',
      history: [],
      last_state: null,
      resumed_at: '2026-06-05T00:00:00.000Z',
      resume_mode: ResumeMode.PROMPT_CONCAT,
      checkpoint_id: null,
      metadata: null,
    });

    expect(strategy.resume('session-null-meta').metadata).toEqual({
      fallback_used: true,
      original_mode: ResumeMode.NATIVE,
    });
  });

  it('merges session checkpoints in timestamp order and rejects empty merge requests', () => {
    const basePath = createBasePath();
    const strategy = new HybridStrategy(basePath, 'gemini');

    strategy.saveCheckpoint('session-a', {
      current_step: 'draft',
      history: [createTurn('assistant', 'later', '2026-06-05T10:00:00.000Z')],
      scoreA: 1,
    });
    strategy.saveCheckpoint('session-b', {
      current_step: 'review',
      history: [createTurn('user', 'earlier', '2026-06-05T09:00:00.000Z')],
      scoreB: 2,
    });

    const merged = strategy.mergeSessions(['session-a', 'session-b'], 'merged-session');
    expect(merged.session_id).toBe('merged-session');
    expect(merged.history.map((turn) => turn.content)).toEqual(['earlier', 'later']);
    expect(merged.last_state).toMatchObject({ scoreA: 1, scoreB: 2 });
    expect(merged.metadata).toMatchObject({
      merged_from: ['session-a', 'session-b'],
      merge_count: 2,
    });

    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 0, 2, 3, 4, 5));
      const defaultTarget = strategy.mergeSessions(['session-a']);
      expect(defaultTarget.session_id).toBe('merged-20260102-030405');
    } finally {
      vi.useRealTimers();
    }

    expect(() => strategy.mergeSessions([])).toThrow('No sessions to merge');
  });

  it('sorts merged histories even when timestamps are missing', () => {
    const basePath = createBasePath();
    const strategy = new HybridStrategy(basePath, 'gemini');

    strategy.saveCheckpoint('session-null-a', {
      current_step: 'draft',
      history: [{ ...createTurn('assistant', 'no timestamp', '2026-06-05T10:00:00.000Z'), timestamp: null }],
    });
    strategy.saveCheckpoint('session-null-b', {
      current_step: 'review',
      history: [createTurn('user', 'has timestamp', '2026-06-05T09:00:00.000Z')],
    });

    const merged = strategy.mergeSessions(['session-null-a', 'session-null-b'], 'merged-null-ts');
    expect(merged.history.map((turn) => turn.content)).toEqual(['no timestamp', 'has timestamp']);
  });

  it('sorts merged histories when every timestamp is missing', () => {
    const basePath = createBasePath();
    const strategy = new HybridStrategy(basePath, 'gemini');

    strategy.saveCheckpoint('session-missing-a', {
      current_step: 'draft',
      history: [{ ...createTurn('assistant', 'missing-a', '2026-06-05T10:00:00.000Z'), timestamp: null }],
    });
    strategy.saveCheckpoint('session-missing-b', {
      current_step: 'review',
      history: [
        {
          ...createTurn('user', 'missing-b', '2026-06-05T09:00:00.000Z'),
          timestamp: undefined as unknown as null,
        },
      ],
    });

    const merged = strategy.mergeSessions(
      ['session-missing-a', 'session-missing-b'],
      'merged-all-missing-ts',
    );

    expect(merged.history.map((turn) => turn.content)).toEqual(['missing-a', 'missing-b']);
  });

  it('returns disabled and unsupported-tool fallback decisions from the resolver helpers', () => {
    const resolver = new ResumeStrategyResolver();

    expect(resolver.determineStrategy('codex', [])).toEqual({
      strategy: ResumeMode.DISABLED,
      is_latest: true,
      context_format: ContextFormat.YAML,
      reason: 'No resume IDs provided',
    });

    expect(determineResumeStrategy('python', ['session-1'])).toEqual({
      strategy: ResumeMode.PROMPT_CONCAT,
      is_latest: true,
      context_format: ContextFormat.YAML,
      fallback_strategy: null,
      reason: 'Native ID not found, using prompt-concat',
    });
  });

  it('covers resolver native, cross-tool, fork, merge, and default decisions', () => {
    const resolver = new ResumeStrategyResolver();

    expect(
      resolver.determineStrategy(
        'codex',
        ['session-1'],
        null,
        () => 'native-1',
      ),
    ).toEqual({
      strategy: ResumeMode.NATIVE,
      native_session_id: 'native-1',
      is_latest: true,
      context_format: ContextFormat.YAML,
      reason: 'Single session append with native support',
    });

    expect(
      resolver.determineStrategy(
        'codex',
        ['session-1'],
        null,
        null,
        () => 'gemini',
      ),
    ).toMatchObject({
      strategy: ResumeMode.PROMPT_CONCAT,
      reason: 'Cross-tool resume: gemini -> codex',
    });

    expect(resolver.determineStrategy('codex', ['session-1'], 'forked')).toMatchObject({
      strategy: ResumeMode.PROMPT_CONCAT,
      primary_conversation_id: 'session-1',
      reason: 'Fork scenario: creating new session forked',
    });

    expect(resolver.determineStrategy('codex', ['a', 'b'])).toMatchObject({
      strategy: ResumeMode.HYBRID,
      primary_conversation_id: 'a',
      reason: 'Multi-session merge: 2 sessions',
    });

    const malformedResumeIds = {
      length: undefined,
      0: 'session-weird',
    } as unknown as string[];
    expect(resolver.determineStrategy('codex', malformedResumeIds)).toMatchObject({
      strategy: ResumeMode.PROMPT_CONCAT,
      reason: 'Default fallback',
    });
  });

  it('builds context prefixes and creates strategy aliases for supported modes', () => {
    const turns = [createTurn('user', 'continue draft', '2026-06-05T09:00:00.000Z')];

    expect(buildContextPrefix(turns, 'json')).toContain('```json');
    expect(buildContextPrefix(turns, 'plain')).toContain('[USER]:');
    expect(buildContextPrefix(turns)).toContain('"previous_conversation"');

    const basePath = createBasePath();
    expect(createStrategy(ResumeMode.NATIVE, basePath, 'codex')).toBeInstanceOf(NativeResumeStrategy);
    expect(createStrategy(ResumeMode.PROMPT_CONCAT, basePath, 'codex')).toBeInstanceOf(PromptConcatStrategy);
    expect(createStrategy(ResumeMode.HYBRID, basePath, 'codex')).toBeInstanceOf(HybridStrategy);
    expect(() => createStrategy(ResumeMode.DISABLED, basePath, 'codex')).toThrow(
      'Unsupported resume mode: disabled',
    );
  });
});
