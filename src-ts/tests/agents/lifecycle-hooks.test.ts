import { describe, expect, it } from 'vitest';

import {
  LifecycleStage,
  LifecycleHookRegistry,
  type AgentLifecycleHook,
  type AgentContext,
} from '../../agents/lifecycle-hooks';

describe('LifecycleHookRegistry', () => {
  it('registers and executes hooks in order', async () => {
    const registry = new LifecycleHookRegistry();
    const order: string[] = [];

    const hook1: AgentLifecycleHook = async (ctx) => {
      order.push('first');
      return { ...ctx, step1: true };
    };
    const hook2: AgentLifecycleHook = async (ctx) => {
      order.push('second');
      return { ...ctx, step2: true };
    };

    registry.register(LifecycleStage.PERCEPTION, hook1);
    registry.register(LifecycleStage.PERCEPTION, hook2);

    const result = await registry.execute(LifecycleStage.PERCEPTION, {});

    expect(order).toEqual(['first', 'second']);
    expect(result.step1).toBe(true);
    expect(result.step2).toBe(true);
  });

  it('returns context unchanged when no hooks registered', async () => {
    const registry = new LifecycleHookRegistry();
    const ctx: AgentContext = { value: 42 };

    const result = await registry.execute(LifecycleStage.PLANNING, ctx);

    expect(result).toEqual({ value: 42 });
  });

  it('isolates hooks per stage', async () => {
    const registry = new LifecycleHookRegistry();
    const log: string[] = [];

    registry.register(LifecycleStage.PERCEPTION, async (ctx) => {
      log.push('perception');
      return ctx;
    });
    registry.register(LifecycleStage.REFLECTION, async (ctx) => {
      log.push('reflection');
      return ctx;
    });

    await registry.execute(LifecycleStage.PERCEPTION, {});
    await registry.execute(LifecycleStage.REFLECTION, {});

    expect(log).toEqual(['perception', 'reflection']);
  });

  it('chains hook outputs through pipeline', async () => {
    const registry = new LifecycleHookRegistry();

    registry.register(LifecycleStage.EXECUTION, async (ctx) => ({
      ...ctx,
      count: ((ctx.count as number) ?? 0) + 1,
    }));
    registry.register(LifecycleStage.EXECUTION, async (ctx) => ({
      ...ctx,
      count: ((ctx.count as number) ?? 0) * 10,
    }));

    const result = await registry.execute(LifecycleStage.EXECUTION, {});

    expect(result.count).toBe(10);
  });

  it('getHooks returns registered hooks for a stage', () => {
    const registry = new LifecycleHookRegistry();
    const hook: AgentLifecycleHook = async (ctx) => ctx;

    registry.register(LifecycleStage.PLANNING, hook);

    expect(registry.getHooks(LifecycleStage.PLANNING)).toHaveLength(1);
    expect(registry.getHooks(LifecycleStage.PERCEPTION)).toHaveLength(0);
  });

  it('clear removes hooks for specific stage or all', () => {
    const registry = new LifecycleHookRegistry();
    const noop: AgentLifecycleHook = async (ctx) => ctx;

    registry.register(LifecycleStage.PERCEPTION, noop);
    registry.register(LifecycleStage.PLANNING, noop);

    registry.clear(LifecycleStage.PERCEPTION);
    expect(registry.getHooks(LifecycleStage.PERCEPTION)).toHaveLength(0);
    expect(registry.getHooks(LifecycleStage.PLANNING)).toHaveLength(1);

    registry.clear();
    expect(registry.getHooks(LifecycleStage.PLANNING)).toHaveLength(0);
  });
});

describe('LifecycleStage enum', () => {
  it('has four stages with correct values', () => {
    expect(LifecycleStage.PERCEPTION).toBe('perception');
    expect(LifecycleStage.PLANNING).toBe('planning');
    expect(LifecycleStage.EXECUTION).toBe('execution');
    expect(LifecycleStage.REFLECTION).toBe('reflection');
  });
});
