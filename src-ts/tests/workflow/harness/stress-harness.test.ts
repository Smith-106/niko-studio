/**
 * Stress Harness Smoke Tests
 *
 * Verifies each export's contract in isolation, before higher-level
 * L4/L5 stress tests build on top of it.
 */
import * as fs from 'node:fs';

import { describe, test, expect, afterEach } from 'vitest';

import {
  createMockContainer,
  createTempSessionRoot,
  withTimeout,
  validateNoUnhandledRejections,
  assertSessionState,
} from './stress-harness.js';
import {
  l4SequentialRounds,
  l5ThreeStepChain,
  concurrentL4Sessions,
} from './scenarios.js';

describe('createMockContainer', () => {
  test('returns object with .getAgent', () => {
    const container = createMockContainer({ responses: {} });
    expect(typeof container.getAgent).toBe('function');
  });

  test('.getAgent returns agent with .generate', () => {
    const container = createMockContainer({ responses: {} });
    const agent = container.getAgent('writer');
    expect(typeof agent.generate).toBe('function');
  });

  test('.generate returns mapped response when type is in responses', async () => {
    const container = createMockContainer({ responses: { writer: 'canned-output' } });
    const agent = container.getAgent('writer');
    const result = await agent.generate('any prompt');
    expect(result).toBe('canned-output');
  });

  test('.generate falls back to mock-${type}-response when not mapped', async () => {
    const container = createMockContainer({ responses: {} });
    const agent = container.getAgent('critic');
    const result = await agent.generate('any prompt');
    expect(result).toBe('mock-critic-response');
  });

  test('.generate respects latency option', async () => {
    const container = createMockContainer({ responses: {}, latency: 20 });
    const agent = container.getAgent('writer');
    const start = Date.now();
    await agent.generate('prompt');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(15);
  });
});

describe('createTempSessionRoot', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      try {
        cleanup?.();
      } catch {
        // ignore
      }
    }
  });

  test('creates a real directory', () => {
    const root = createTempSessionRoot();
    cleanups.push(root.cleanup);
    expect(fs.existsSync(root.path)).toBe(true);
    expect(fs.statSync(root.path).isDirectory()).toBe(true);
  });

  test('returns unique paths across calls', () => {
    const a = createTempSessionRoot();
    const b = createTempSessionRoot();
    cleanups.push(a.cleanup, b.cleanup);
    expect(a.path).not.toBe(b.path);
  });

  test('cleanup removes the directory', () => {
    const root = createTempSessionRoot();
    expect(fs.existsSync(root.path)).toBe(true);
    root.cleanup();
    expect(fs.existsSync(root.path)).toBe(false);
  });
});

describe('withTimeout', () => {
  test('resolves when promise settles before deadline', async () => {
    const fast = new Promise<string>(resolve => setTimeout(() => resolve('ok'), 5));
    const result = await withTimeout(fast, 100, 'fast-op');
    expect(result).toBe('ok');
  });

  test('rejects after ms with label in message', async () => {
    const slow = new Promise<string>(resolve => setTimeout(() => resolve('late'), 200));
    await expect(withTimeout(slow, 20, 'slow-op')).rejects.toThrow(/Timeout: slow-op after 20ms/);
  });
});

describe('validateNoUnhandledRejections', () => {
  test('stop returns pass=true and empty errors when no rejection', () => {
    const guard = validateNoUnhandledRejections();
    const result = guard.stop();
    expect(result.pass).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('stop removes the listener', () => {
    const before = process.listenerCount('unhandledRejection');
    const guard = validateNoUnhandledRejections();
    expect(process.listenerCount('unhandledRejection')).toBe(before + 1);
    guard.stop();
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });
});

describe('assertSessionState', () => {
  test('returns silently when all expected keys are present', () => {
    const fakeMgr = {
      read: () => JSON.stringify({ user_request: 'x', domain: 'novel' }),
    };
    expect(() => assertSessionState(fakeMgr, 'sid', { user_request: '', domain: '' })).not.toThrow();
  });

  test('throws when an expected key is missing', () => {
    const fakeMgr = {
      read: () => JSON.stringify({ user_request: 'x' }),
    };
    expect(() => assertSessionState(fakeMgr, 'sid', { user_request: '', domain: '' })).toThrow(/missing key 'domain'/);
  });

  test('throws on invalid JSON in state', () => {
    const fakeMgr = {
      read: () => 'not-json{',
    };
    expect(() => assertSessionState(fakeMgr, 'sid', { user_request: '' })).toThrow(/invalid JSON/);
  });

  test('treats empty string as empty object (missing keys still throw)', () => {
    const fakeMgr = {
      read: () => '',
    };
    expect(() => assertSessionState(fakeMgr, 'sid', { user_request: '' })).toThrow(/missing key 'user_request'/);
  });
});

describe('scenarios', () => {
  test('l4SequentialRounds(n) returns n rounds with carry-forward context', () => {
    const rounds = l4SequentialRounds(3);
    expect(rounds).toHaveLength(3);
    expect(rounds[0].user_request).toBe('topic-0');
    expect(rounds[0].context).toBe('');
    expect(rounds[1].context).toBe('round-0-output');
    expect(rounds[2].context).toBe('round-1-output');
  });

  test('l4SequentialRounds(0) returns empty array', () => {
    expect(l4SequentialRounds(0)).toEqual([]);
  });

  test('l5ThreeStepChain returns analyze/plan/execute state with uuid session_id', () => {
    const state = l5ThreeStepChain();
    expect(state.user_request).toBe('analyze plan execute');
    expect(state.domain).toBe('novel');
    expect(typeof state.session_id).toBe('string');
    expect(state.session_id.length).toBeGreaterThan(0);
  });

  test('concurrentL4Sessions(count) returns count states with unique session_ids', () => {
    const states = concurrentL4Sessions(4);
    expect(states).toHaveLength(4);
    const ids = new Set(states.map(s => s.session_id));
    expect(ids.size).toBe(4);
  });
});
