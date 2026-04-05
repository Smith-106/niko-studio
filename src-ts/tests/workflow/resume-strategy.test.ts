import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  buildContextPrefix,
  checkpointStateFromDict,
  checkpointStateToDict,
  ContextFormat,
  conversationTurnFromDict,
  conversationTurnToDict,
  createStrategy,
  determineResumeStrategy,
  HybridStrategy,
  NativeResumeStrategy,
  PromptConcatStrategy,
  ResumeMode,
  sessionContextFromDict,
  sessionContextToDict,
} from '../../workflow/session/resume-strategy';

const tempDirs: string[] = [];

function createBasePath(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niko-resume-'));
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
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir && fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('workflow/session/resume-strategy', () => {
  it('roundtrips conversation turns, session contexts, and checkpoints', () => {
    const turn = createTurn('user', '继续这个章节', '2026-04-04T00:00:00.000Z');
    const checkpoint = {
      checkpoint_id: 'cp-1',
      session_id: 'session-1',
      created_at: '2026-04-04T00:00:01.000Z',
      workflow_step: 'draft',
      state_data: { score: 80 },
      history_snapshot: [turn],
    };
    const context = {
      session_id: 'session-1',
      history: [turn],
      last_state: { score: 80 },
      resumed_at: '2026-04-04T00:00:02.000Z',
      resume_mode: ResumeMode.PROMPT_CONCAT,
      checkpoint_id: 'cp-1',
      metadata: { format: 'yaml' },
    };

    expect(conversationTurnFromDict(conversationTurnToDict(turn))).toEqual(turn);
    expect(checkpointStateFromDict(checkpointStateToDict(checkpoint))).toEqual(
      checkpoint,
    );
    expect(sessionContextFromDict(sessionContextToDict(context))).toEqual(context);
  });

  it('saves and resumes native sessions when a mapping and checkpoint exist', () => {
    const basePath = createBasePath();
    const strategy = new NativeResumeStrategy(basePath, 'codex');

    strategy.registerNativeSession('session-1', 'native-123');
    const checkpointId = strategy.saveCheckpoint('session-1', {
      current_step: 'draft',
      history: [createTurn('assistant', '上一轮输出', '2026-04-04T00:01:00.000Z')],
      score: 88,
    });

    expect(strategy.canResume('session-1')).toBe(true);
    expect(strategy.getNativeSessionId('session-1')).toBe('native-123');

    const resumed = strategy.resume('session-1');

    expect(resumed.resume_mode).toBe(ResumeMode.NATIVE);
    expect(resumed.checkpoint_id).toBe(checkpointId);
    expect(resumed.history).toHaveLength(1);
    expect(resumed.metadata).toMatchObject({
      native_session_id: 'native-123',
      tool: 'codex',
      resume_command: '--resume native-123',
    });
  });

  it('truncates history in prompt-concat mode and builds plain, yaml, and json prefixes', () => {
    const basePath = createBasePath();
    const strategy = new PromptConcatStrategy(basePath, ContextFormat.YAML, 2);
    strategy.saveCheckpoint('session-2', {
      current_step: 'rewrite',
      history: [
        createTurn('user', '一', '2026-04-04T00:00:00.000Z'),
        createTurn('assistant', '二', '2026-04-04T00:00:01.000Z'),
        createTurn('user', '三', '2026-04-04T00:00:02.000Z'),
      ],
    });

    const resumed = strategy.resume('session-2');

    expect(resumed.resume_mode).toBe(ResumeMode.PROMPT_CONCAT);
    expect(resumed.history).toHaveLength(2);
    expect(resumed.metadata).toMatchObject({
      format: ContextFormat.YAML,
      history_count: 2,
      truncated: true,
    });
    expect(strategy.buildContextPrefix(resumed, ContextFormat.PLAIN)).toContain(
      '=== PREVIOUS CONVERSATION ===',
    );
    expect(strategy.buildContextPrefix(resumed, ContextFormat.YAML)).toContain(
      'previous_conversation',
    );
    expect(strategy.buildContextPrefix(resumed, ContextFormat.JSON)).toContain(
      '```json',
    );
  });

  it('uses native resume when available and concat fallback for hybrid scenarios', () => {
    const basePath = createBasePath();
    const native = new NativeResumeStrategy(basePath, 'gemini');

    native.registerNativeSession('session-3', 'native-789');
    const strategy = new HybridStrategy(basePath, 'gemini');
    strategy.saveCheckpoint('session-3', {
      current_step: 'critic',
      history: [createTurn('assistant', '点评', '2026-04-04T00:10:00.000Z')],
    });

    const nativeResumed = strategy.resume('session-3');

    expect(nativeResumed.resume_mode).toBe(ResumeMode.NATIVE);
    expect(nativeResumed.metadata?.native_session_id).toBe('native-789');

    const fallbackBasePath = createBasePath();
    const fallbackStrategy = new HybridStrategy(fallbackBasePath, 'unsupported-tool');
    fallbackStrategy.saveCheckpoint('session-4', {
      current_step: 'rewrite',
      history: [createTurn('user', '继续', '2026-04-04T00:11:00.000Z')],
    });

    const fallbackResumed = fallbackStrategy.resume('session-4');

    expect(fallbackResumed.resume_mode).toBe(ResumeMode.PROMPT_CONCAT);
    expect(fallbackResumed.metadata).toMatchObject({
      fallback_used: true,
      original_mode: ResumeMode.NATIVE,
    });
  });

  it('resolves strategy decisions and creates helper strategies consistently', () => {
    const nativeDecision = determineResumeStrategy(
      'codex',
      ['session-1'],
      null,
      () => 'native-123',
      () => 'codex',
    );
    const crossToolDecision = determineResumeStrategy(
      'codex',
      ['session-1'],
      null,
      () => 'native-123',
      () => 'claude',
    );
    const mergeDecision = determineResumeStrategy('codex', ['a', 'b']);
    const forkDecision = determineResumeStrategy('codex', ['a'], 'fork-1');

    expect(nativeDecision.strategy).toBe(ResumeMode.NATIVE);
    expect(crossToolDecision.strategy).toBe(ResumeMode.PROMPT_CONCAT);
    expect(mergeDecision.strategy).toBe(ResumeMode.HYBRID);
    expect(forkDecision.strategy).toBe(ResumeMode.PROMPT_CONCAT);

    expect(
      buildContextPrefix([createTurn('user', '继续', '2026-04-04T00:00:00.000Z')], 'json'),
    ).toContain('```json');

    expect(createStrategy(ResumeMode.NATIVE, createBasePath(), 'codex')).toBeInstanceOf(
      NativeResumeStrategy,
    );
    expect(
      createStrategy(ResumeMode.PROMPT_CONCAT, createBasePath(), 'gemini', {
        format: ContextFormat.PLAIN,
        maxHistoryTurns: 5,
      }),
    ).toBeInstanceOf(PromptConcatStrategy);
    expect(createStrategy(ResumeMode.HYBRID, createBasePath(), 'gemini')).toBeInstanceOf(
      HybridStrategy,
    );
    expect(() =>
      createStrategy(ResumeMode.DISABLED, createBasePath(), 'gemini'),
    ).toThrow('Unsupported resume mode');
  });
});
