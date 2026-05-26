import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  DelegateBroker,
  DelegateHandle,
  type DelegateCompletion,
  type DelegateRecord,
} from '../../../workflow/delegate/index.js';

describe('DelegateBroker', () => {
  it('submit → complete lifecycle', async () => {
    const broker = new DelegateBroker(async (task, handle) => {
      expect(handle.cancelled).toBe(false);
      return `result: ${task}`;
    });

    const id = await broker.submit({ task: 'test task' });
    expect(id).toBeTruthy();

    const completion = await broker.wait(id, 5000);
    expect(completion.status).toBe('completed');
    expect(completion.result).toBe('result: test task');
  });

  it('submit → fail lifecycle', async () => {
    const broker = new DelegateBroker(async () => {
      throw new Error('something broke');
    });

    const id = await broker.submit({ task: 'failing task' });
    const completion = await broker.wait(id, 5000);
    expect(completion.status).toBe('failed');
    expect(completion.error).toContain('something broke');
  });

  it('cancel stops a running delegate', async () => {
    let cancelled = false;
    const broker = new DelegateBroker(async (task, handle) => {
      // Simulate long work
      await new Promise(r => setTimeout(r, 2000));
      cancelled = handle.cancelled;
      return 'should not reach';
    });

    const id = await broker.submit({ task: 'long task', timeout: 10_000 });
    // Give it a moment to start
    await new Promise(r => setTimeout(r, 100));

    const cancelled_ok = broker.cancel(id);
    expect(cancelled_ok).toBe(true);

    const record = broker.get(id);
    expect(record!.status).toBe('cancelled');
  });

  it('inject message to running delegate', async () => {
    let received: string[] = [];
    const broker = new DelegateBroker(async (task, handle) => {
      await new Promise(r => setTimeout(r, 200));
      // Drain messages
      const msgs = handle.drainMessages();
      received = msgs.map(m => m.content);
      return 'done';
    });

    const id = await broker.submit({ task: 'inject test', timeout: 10_000 });
    await new Promise(r => setTimeout(r, 50));

    const injected = broker.inject(id, 'course correction');
    expect(injected).toBe(true);

    const completion = await broker.wait(id, 5000);
    expect(completion.status).toBe('completed');
    expect(received).toContain('course correction');
  });

  it('timeout kills long-running delegate', async () => {
    const broker = new DelegateBroker(async () => {
      await new Promise(r => setTimeout(r, 10_000)); // 10s
      return 'should not reach';
    });

    const id = await broker.submit({ task: 'timeout test', timeout: 300 });
    const completion = await broker.wait(id, 5000);
    expect(completion.status).toBe('failed');
    expect(completion.error).toContain('Timeout');
  });

  it('list returns all delegates', async () => {
    const broker = new DelegateBroker(async () => 'ok');

    await broker.submit({ task: 'task1' });
    await broker.submit({ task: 'task2' });

    // Wait for both
    await new Promise(r => setTimeout(r, 500));

    const all = broker.list();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('get returns null for unknown id', () => {
    const broker = new DelegateBroker(async () => 'ok');
    expect(broker.get('nonexistent')).toBeNull();
  });

  it('inject returns false for unknown delegate', () => {
    const broker = new DelegateBroker(async () => 'ok');
    expect(broker.inject('nonexistent', 'msg')).toBe(false);
  });

  it('shutdown cancels all running delegates', async () => {
    const broker = new DelegateBroker(async () => {
      await new Promise(r => setTimeout(r, 10_000));
      return 'should not reach';
    });

    const id = await broker.submit({ task: 'shutdown test', timeout: 30_000 });
    await new Promise(r => setTimeout(r, 100));

    await broker.shutdown();

    const record = broker.get(id);
    expect(record!.status).toBe('cancelled');
  });
});

describe('DelegateHandle', () => {
  it('tracks cancellation', () => {
    const handle = new DelegateHandle();
    expect(handle.cancelled).toBe(false);
    handle.cancel();
    expect(handle.cancelled).toBe(true);
  });

  it('drains messages', () => {
    const handle = new DelegateHandle();
    handle.injectMessage('user', 'hello');
    handle.injectMessage('system', 'progress');

    const msgs = handle.drainMessages();
    expect(msgs).toHaveLength(2);
    expect(msgs[0].content).toBe('hello');
    expect(msgs[1].from).toBe('system');

    // Second drain is empty
    expect(handle.drainMessages()).toHaveLength(0);
  });
});
