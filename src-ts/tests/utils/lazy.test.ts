import { describe, it, expect } from 'vitest';
import { Lazy, AsyncLazy } from '../../utils/lazy.js';

describe('Lazy', () => {
  it('initializes on first get()', () => {
    let calls = 0;
    const lazy = new Lazy(() => {
      calls += 1;
      return 'hello';
    });

    expect(lazy.isInitialized).toBe(false);
    expect(lazy.get()).toBe('hello');
    expect(lazy.isInitialized).toBe(true);
    expect(calls).toBe(1);
  });

  it('returns same instance on subsequent get()', () => {
    let calls = 0;
    const lazy = new Lazy(() => {
      calls += 1;
      return { x: 1 };
    });

    const a = lazy.get();
    const b = lazy.get();
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });

  it('set() overrides factory', () => {
    const lazy = new Lazy(() => 'factory');
    lazy.set('manual');

    expect(lazy.get()).toBe('manual');
    expect(lazy.isInitialized).toBe(true);
  });

  it('reset() allows re-initialization', () => {
    let calls = 0;
    const lazy = new Lazy(() => {
      calls += 1;
      return calls;
    });

    expect(lazy.get()).toBe(1);
    lazy.reset();
    expect(lazy.isInitialized).toBe(false);
    expect(lazy.get()).toBe(2);
  });
});

describe('AsyncLazy', () => {
  it('initializes on first get()', async () => {
    let calls = 0;
    const lazy = new AsyncLazy(async () => {
      calls += 1;
      return 'async-hello';
    });

    expect(lazy.isInitialized).toBe(false);
    expect(await lazy.get()).toBe('async-hello');
    expect(lazy.isInitialized).toBe(true);
    expect(calls).toBe(1);
  });

  it('concurrent callers share same promise', async () => {
    let calls = 0;
    const lazy = new AsyncLazy(async () => {
      calls += 1;
      await new Promise(r => setTimeout(r, 50));
      return 'shared';
    });

    const [a, b, c] = await Promise.all([lazy.get(), lazy.get(), lazy.get()]);
    expect(a).toBe('shared');
    expect(b).toBe('shared');
    expect(c).toBe('shared');
    expect(calls).toBe(1);
  });

  it('set() overrides factory', async () => {
    const lazy = new AsyncLazy(async () => 'factory');
    lazy.set('manual');

    expect(await lazy.get()).toBe('manual');
    expect(lazy.isInitialized).toBe(true);
  });

  it('reset() allows re-initialization', async () => {
    let calls = 0;
    const lazy = new AsyncLazy(async () => {
      calls += 1;
      return calls;
    });

    expect(await lazy.get()).toBe(1);
    lazy.reset();
    expect(lazy.isInitialized).toBe(false);
    expect(await lazy.get()).toBe(2);
  });

  it('failed init allows retry', async () => {
    let attempts = 0;
    const lazy = new AsyncLazy(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error('not ready');
      return 'ok';
    });

    await expect(lazy.get()).rejects.toThrow('not ready');
    expect(lazy.isInitialized).toBe(false);

    await expect(lazy.get()).rejects.toThrow('not ready');
    expect(lazy.isInitialized).toBe(false);

    expect(await lazy.get()).toBe('ok');
    expect(lazy.isInitialized).toBe(true);
  });
});
