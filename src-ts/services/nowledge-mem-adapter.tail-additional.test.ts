import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NowledgeMemAdapter } from './nowledge-mem-adapter.js';

vi.mock('node:child_process', () => {
  const { EventEmitter } = require('events');

  function createMockSpawn(stdout: string, stderr: string, exitCode: number) {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };

    setTimeout(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      child.emit('close', exitCode);
    }, 0);

    return child;
  }

  return {
    spawn: vi.fn((_cmd: string, _args: readonly string[], _opts: unknown) => createMockSpawn('', '', 1)),
  };
});

import { spawn } from 'node:child_process';

const mockSpawn = vi.mocked(spawn);

function mockStdout(data: string, exitCode = 0) {
  const { EventEmitter } = require('events');
  mockSpawn.mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    setTimeout(() => {
      if (data) child.stdout.emit('data', Buffer.from(data));
      child.emit('close', exitCode);
    }, 0);
    return child;
  });
}

function mockError(message: string) {
  const { EventEmitter } = require('events');
  mockSpawn.mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    setTimeout(() => {
      child.stderr.emit('data', Buffer.from(message));
      child.emit('close', 1);
    }, 0);
    return child;
  });
}

function mockTimeout(stdout = '', stderr = '') {
  const { EventEmitter } = require('events');
  mockSpawn.mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    child.kill = vi.fn(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      if (stderr) child.stderr.emit('data', Buffer.from(stderr));
      return true;
    });
    return child;
  });
}

function mockCloseWithNullCode(stdout = '') {
  const { EventEmitter } = require('events');
  mockSpawn.mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    setTimeout(() => {
      if (stdout) child.stdout.emit('data', Buffer.from(stdout));
      child.emit('close', null);
    }, 0);
    return child;
  });
}

describe('NowledgeMemAdapter tail additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('treats empty-stderr timeouts and null close codes as failed status checks', async () => {
    vi.useFakeTimers();

    const timeoutAdapter = new NowledgeMemAdapter({ cliPath: 'nmem.cmd', timeout: 10 });
    mockTimeout('', '');
    const timeoutStatus = timeoutAdapter.status();
    await vi.advanceTimersByTimeAsync(10);
    await expect(timeoutStatus).resolves.toEqual({ connected: false });
    expect(mockSpawn.mock.results.at(-1)?.value.kill).toHaveBeenCalled();

    vi.useRealTimers();

    const nullCloseAdapter = new NowledgeMemAdapter({ cliPath: 'nmem.cmd' });
    mockCloseWithNullCode(JSON.stringify({ connected: true, version: '1.0.0' }));
    await expect(nullCloseAdapter.status()).resolves.toEqual({ connected: false });
  });

  it('covers remaining graph, space, source, library, and feed error fallbacks', async () => {
    const adapter = new NowledgeMemAdapter({ cliPath: 'nmem.cmd' });

    mockError('graph expand failed');
    await expect(adapter.getRelatedMemories('mem-1')).resolves.toEqual([]);

    mockStdout(JSON.stringify([]));
    await expect(
      adapter.searchRelations({
        fromId: 'mem-1',
        toId: 'mem-2',
        limit: 3,
      }),
    ).resolves.toEqual([]);
    let args = mockSpawn.mock.calls.at(-1)?.[1] as string[];
    expect(args).toContain('--from');
    expect(args).toContain('mem-1');
    expect(args).toContain('--to');
    expect(args).toContain('mem-2');
    expect(args).toContain('--limit');
    expect(args).toContain('3');

    mockError('spaces offline');
    await expect(adapter.listSpaces()).resolves.toEqual([]);

    mockError('sources offline');
    await expect(adapter.listSources()).resolves.toEqual([]);

    mockError('chunk search offline');
    await expect(adapter.searchSourceChunks('src-1', 'needle')).resolves.toEqual([]);

    mockError('library add offline');
    await expect(adapter.addToLibrary(['/tmp/a.md'])).resolves.toEqual([]);

    mockError('library search offline');
    await expect(adapter.searchLibrary('hero')).resolves.toEqual([]);

    mockStdout('artifact body');
    await expect(adapter.readArtifact('artifact-1')).resolves.toBe('artifact body');

    const today = new Date().toISOString().slice(0, 10);
    mockError('working memory unavailable');
    await expect(adapter.getWorkingMemory()).resolves.toEqual({
      date: today,
      content: '',
    });

    mockError('communities offline');
    await expect(adapter.listCommunities()).resolves.toEqual([]);

    mockError('feed offline');
    await expect(adapter.getFeed()).resolves.toEqual([]);
  });

  it('covers thread search and fallback title branches', async () => {
    const adapter = new NowledgeMemAdapter({ cliPath: 'nmem.cmd' });

    mockError('thread search offline');
    await expect(adapter.searchThreads('novel')).resolves.toEqual([]);

    mockError('append offline');
    await expect(
      adapter.appendThread('thread-1', [{ role: 'assistant', content: 'retry' }]),
    ).resolves.toBeNull();

    mockStdout('thread-import-raw');
    await expect(
      adapter.importThread({
        file: '/tmp/thread.json',
      }),
    ).resolves.toEqual({
      id: 'thread-import-raw',
      title: '',
    });

    mockStdout('thread-save-raw');
    await expect(adapter.saveThread()).resolves.toEqual({
      id: 'thread-save-raw',
      title: '',
    });
  });
});
