import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  Hook,
  HookPriority,
  HookRegistry,
  HookType,
  WritingHooks,
  createHookContext,
  getDefaultWritingHooks,
  hookFail,
  hookOk,
  hookSkip,
  withContent,
} from '../../hooks/writing-hooks.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('hooks/writing-hooks', () => {
  it('creates canonical hook result helpers and immutable content updates', () => {
    expect(hookOk('next', { source: 'test' })).toEqual({
      success: true,
      modifiedContent: 'next',
      metadata: { source: 'test' },
      error: null,
      shouldContinue: true,
    });
    expect(hookSkip()).toEqual({
      success: true,
      modifiedContent: null,
      metadata: {},
      error: null,
      shouldContinue: true,
    });

    const error = new Error('boom');
    expect(hookFail(error, true)).toEqual({
      success: false,
      modifiedContent: null,
      metadata: {},
      error,
      shouldContinue: true,
    });

    const context = createHookContext({
      content: 'draft',
      skillId: 'skill-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      metadata: { step: 1 },
      error,
    });
    expect(context).toEqual({
      content: 'draft',
      skillId: 'skill-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      metadata: { step: 1 },
      error,
    });

    const updated = withContent(context, 'revised');
    expect(updated).toEqual({
      content: 'revised',
      skillId: 'skill-1',
      agentId: 'agent-1',
      sessionId: 'session-1',
      metadata: { step: 1 },
      error,
    });
    expect(updated.metadata).not.toBe(context.metadata);
  });

  it('executes sync and async hooks, skips disabled hooks, and converts thrown errors', async () => {
    const syncHook = new Hook({
      name: 'sync',
      hookType: HookType.PRE_WRITE,
      func: (ctx) => hookOk(`${ctx.content}-sync`, { phase: 'sync' }),
    });
    const asyncHook = new Hook({
      name: 'async',
      hookType: HookType.PRE_WRITE,
      func: async (ctx) => hookOk(`${ctx.content}-async`, { phase: 'async' }),
      priority: HookPriority.HIGH,
    });
    const disabledHook = new Hook({
      name: 'disabled',
      hookType: HookType.PRE_WRITE,
      func: () => hookOk('never'),
      enabled: false,
    });
    const throwingHook = new Hook({
      name: 'throwing',
      hookType: HookType.PRE_WRITE,
      func: () => {
        throw new Error('hook exploded');
      },
    });

    expect(syncHook.priority).toBe(HookPriority.NORMAL);
    expect(await syncHook.execute(createHookContext({ content: 'draft' }))).toEqual({
      success: true,
      modifiedContent: 'draft-sync',
      metadata: { phase: 'sync' },
      error: null,
      shouldContinue: true,
    });
    expect(await asyncHook.execute(createHookContext({ content: 'draft' }))).toEqual({
      success: true,
      modifiedContent: 'draft-async',
      metadata: { phase: 'async' },
      error: null,
      shouldContinue: true,
    });
    expect(await disabledHook.execute(createHookContext({ content: 'draft' }))).toEqual(hookSkip());

    const failed = await throwingHook.execute(createHookContext({ content: 'draft' }));
    expect(failed.success).toBe(false);
    expect(failed.error?.message).toBe('hook exploded');
    expect(failed.shouldContinue).toBe(true);
  });

  it('registers hooks by priority, supports listing, enabling, removing, and clearing', () => {
    const registry = new HookRegistry();

    const decorator = registry.register(HookType.PRE_WRITE, HookPriority.LOW);
    const decorated = decorator(function namedHook(ctx) {
      return hookOk(ctx.content);
    });

    expect(typeof decorated).toBe('function');
    expect(registry.listHooks(HookType.PRE_WRITE)).toEqual(['namedHook']);
    expect(registry.listHooks()).toContain('namedHook');

    registry.addHook(new Hook({
      name: 'critical-hook',
      hookType: HookType.PRE_WRITE,
      priority: HookPriority.CRITICAL,
      func: (ctx) => hookOk(ctx.content),
    }));

    expect(registry.listHooks(HookType.PRE_WRITE)).toEqual(['critical-hook', 'namedHook']);
    expect(registry.enableHook(HookType.PRE_WRITE, 'namedHook', false)).toBe(true);
    expect(registry.enableHook(HookType.PRE_WRITE, 'missing')).toBe(false);
    expect(registry.removeHook(HookType.PRE_WRITE, 'namedHook')).toBe(true);
    expect(registry.removeHook(HookType.PRE_WRITE, 'missing')).toBe(false);

    registry.clear(HookType.PRE_WRITE);
    expect(registry.listHooks(HookType.PRE_WRITE)).toEqual([]);

    registry.addHook(new Hook({
      name: 'post-hook',
      hookType: HookType.POST_WRITE,
      func: (ctx) => hookOk(ctx.content),
    }));
    registry.clear();
    expect(registry.listHooks()).toEqual([]);
  });

  it('chains registry execution, merges metadata, stops on failure, and respects short-circuit signals', async () => {
    const registry = new HookRegistry();

    registry.addHook(new Hook({
      name: 'prefix',
      hookType: HookType.PRE_WRITE,
      priority: HookPriority.CRITICAL,
      func: (ctx) => hookOk(`A:${ctx.content}`, { first: true }),
    }));
    registry.addHook(new Hook({
      name: 'stopper',
      hookType: HookType.PRE_WRITE,
      priority: HookPriority.HIGH,
      func: (ctx) => ({
        success: true,
        modifiedContent: `${ctx.content}:B`,
        metadata: { stopped: true },
        error: null,
        shouldContinue: false,
      }),
    }));
    registry.addHook(new Hook({
      name: 'never-run',
      hookType: HookType.PRE_WRITE,
      priority: HookPriority.NORMAL,
      func: () => hookOk('unreachable'),
    }));

    const shortCircuit = await registry.execute(
      HookType.PRE_WRITE,
      createHookContext({ content: 'draft' }),
    );
    expect(shortCircuit).toEqual({
      success: true,
      modifiedContent: 'A:draft:B',
      metadata: { first: true, stopped: true },
      error: null,
      shouldContinue: true,
    });

    registry.clear(HookType.PRE_WRITE);
    registry.addHook(new Hook({
      name: 'mutate',
      hookType: HookType.PRE_WRITE,
      func: (ctx) => hookOk(`${ctx.content}-ok`, { mutate: true }),
    }));
    registry.addHook(new Hook({
      name: 'fail',
      hookType: HookType.PRE_WRITE,
      func: () => hookFail(new Error('registry failed')),
    }));

    const failed = await registry.execute(
      HookType.PRE_WRITE,
      createHookContext({ content: 'draft' }),
    );
    expect(failed.success).toBe(false);
    expect(failed.error?.message).toBe('registry failed');
    expect(failed.metadata).toEqual({ mutate: true });
    expect(failed.modifiedContent).toBe('draft-ok');
    expect(failed.shouldContinue).toBe(false);
  });

  it('routes WritingHooks helper methods through the registry with context defaults', async () => {
    const registry = new HookRegistry();
    const hooks = new WritingHooks(registry);

    registry.addHook(new Hook({
      name: 'pre',
      hookType: HookType.PRE_WRITE,
      func: (ctx) => hookOk(`${ctx.content}-pre`, { skillId: ctx.skillId }),
    }));
    registry.addHook(new Hook({
      name: 'post',
      hookType: HookType.POST_WRITE,
      func: (ctx) => hookOk(`${ctx.content}-post`, { agentId: ctx.agentId }),
    }));
    registry.addHook(new Hook({
      name: 'error',
      hookType: HookType.ON_ERROR,
      func: (ctx) => hookOk(ctx.content, { errorMessage: ctx.error?.message }),
    }));
    registry.addHook(new Hook({
      name: 'evaluate',
      hookType: HookType.POST_EVALUATE,
      func: (ctx) => hookOk(ctx.content, ctx.metadata),
    }));

    expect(await hooks.preWrite('draft body', 'skill-a', 'agent-a', { step: 1 })).toEqual({
      success: true,
      modifiedContent: 'draft body-pre',
      metadata: { skillId: 'skill-a' },
      error: null,
      shouldContinue: true,
    });
    expect(await hooks.postWrite('draft body', 'skill-b', 'agent-b')).toEqual({
      success: true,
      modifiedContent: 'draft body-post',
      metadata: { agentId: 'agent-b' },
      error: null,
      shouldContinue: true,
    });

    const handled = await hooks.onError(
      new Error('broken'),
      'draft body',
      'skill-c',
      'agent-c',
      { step: 2 },
    );
    expect(handled.metadata).toEqual({ errorMessage: 'broken' });

    expect(await hooks.preEvaluate('evaluate me', { before: true })).toEqual({
      success: true,
      modifiedContent: 'evaluate me',
      metadata: {},
      error: null,
      shouldContinue: true,
    });

    const postEvaluate = await hooks.postEvaluate(
      'done',
      { quality: 88 },
      { phase: 'post' },
    );
    expect(postEvaluate.metadata).toEqual({
      phase: 'post',
      scores: { quality: 88 },
    });
  });

  it('provides default writing hooks for validation and error handling', async () => {
    const hooks = getDefaultWritingHooks();

    const shortContent = await hooks.preWrite('short');
    expect(shortContent.success).toBe(false);
    expect(shortContent.error?.message).toBe('Content too short (min 10 chars)');

    const longContent = await hooks.preWrite('a'.repeat(100001));
    expect(longContent.success).toBe(false);
    expect(longContent.error?.message).toBe('Content too long (max 100000 chars)');

    const valid = await hooks.preWrite('This content is definitely long enough.');
    expect(valid).toEqual({
      success: true,
      modifiedContent: 'This content is definitely long enough.',
      metadata: {},
      error: null,
      shouldContinue: true,
    });

    const bufferSpy = vi.spyOn(Buffer, 'from').mockImplementationOnce(() => {
      throw new Error('invalid encoding');
    });
    const encodingFailure = await hooks.preWrite('This content is definitely long enough.');
    expect(encodingFailure.success).toBe(false);
    expect(encodingFailure.error?.message).toBe('invalid encoding');
    bufferSpy.mockRestore();

    const onError = await hooks.onError(new Error('log me'), 'draft', 'skill-z', 'agent-z');
    expect(onError).toEqual({
      success: true,
      modifiedContent: 'draft',
      metadata: {},
      error: null,
      shouldContinue: true,
    });
  });
});
