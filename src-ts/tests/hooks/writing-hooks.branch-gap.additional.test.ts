import { describe, expect, it, vi } from 'vitest';

import {
  Hook,
  HookPriority,
  HookRegistry,
  HookType,
  WritingHooks,
  createHookContext,
  hookOk,
} from '../../hooks/writing-hooks.js';

type HookRegistryInternals = HookRegistry & {
  _hooks: Map<HookType, Hook[]>;
};

describe('hooks/writing-hooks branch gap coverage', () => {
  it('covers decorator naming fallbacks and missing hook buckets', async () => {
    const registry = new HookRegistry() as HookRegistryInternals;

    const explicitDecorator = registry.register(HookType.PRE_WRITE, HookPriority.NORMAL, 'explicit-name');
    explicitDecorator((ctx) => hookOk(ctx.content));
    expect(registry.listHooks(HookType.PRE_WRITE)).toContain('explicit-name');

    const anonymousLike = ((ctx: ReturnType<typeof createHookContext>) => hookOk(ctx.content)) as (
      ctx: ReturnType<typeof createHookContext>
    ) => ReturnType<typeof hookOk>;
    Object.defineProperty(anonymousLike, 'name', { value: undefined, configurable: true });
    registry.register(HookType.POST_WRITE)(anonymousLike);
    expect(registry.listHooks(HookType.POST_WRITE)).toContain('anonymous');

    registry._hooks.delete(HookType.AFTER_LLM_CALL);
    const missingBucketResult = await registry.execute(
      HookType.AFTER_LLM_CALL,
      createHookContext({ content: 'draft' }),
    );
    expect(missingBucketResult).toEqual(hookOk('draft', {}));
    expect(registry.listHooks(HookType.AFTER_LLM_CALL)).toEqual([]);
  });

  it('covers add remove enable and execute fallbacks around missing buckets and disabled hooks', async () => {
    const registry = new HookRegistry() as HookRegistryInternals;

    registry._hooks.delete(HookType.BEFORE_LLM_CALL);
    registry.addHook(new Hook({
      name: 'restored-bucket',
      hookType: HookType.BEFORE_LLM_CALL,
      func: (ctx) => hookOk(`${ctx.content}-restored`),
    }));
    expect(registry.listHooks(HookType.BEFORE_LLM_CALL)).toEqual(['restored-bucket']);

    registry._hooks.delete(HookType.PRE_EVALUATE);
    expect(registry.removeHook(HookType.PRE_EVALUATE, 'missing')).toBe(false);

    registry._hooks.delete(HookType.POST_EVALUATE);
    expect(registry.enableHook(HookType.POST_EVALUATE, 'missing')).toBe(false);

    const disabledSpy = vi.fn((ctx: ReturnType<typeof createHookContext>) => hookOk(`${ctx.content}-disabled`));
    const enabledSpy = vi.fn((ctx: ReturnType<typeof createHookContext>) => hookOk(`${ctx.content}-enabled`));
    registry.addHook(new Hook({
      name: 'disabled',
      hookType: HookType.ON_ERROR,
      enabled: false,
      func: disabledSpy,
    }));
    registry.addHook(new Hook({
      name: 'enabled',
      hookType: HookType.ON_ERROR,
      func: enabledSpy,
    }));

    const result = await registry.execute(
      HookType.ON_ERROR,
      createHookContext({ content: 'draft' }),
    );
    expect(disabledSpy).not.toHaveBeenCalled();
    expect(enabledSpy).toHaveBeenCalledTimes(1);
    expect(result).toEqual(hookOk('draft-enabled', {}));
  });

  it('uses the default registry when WritingHooks is constructed without one', async () => {
    const hooks = new WritingHooks();

    expect(hooks.registry).toBeInstanceOf(HookRegistry);
    await expect(hooks.preWrite('draft content long enough')).resolves.toEqual(
      hookOk('draft content long enough', {}),
    );
  });
});
