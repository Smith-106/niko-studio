import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NowledgeMemAdapter } from './nowledge-mem-adapter.js';

vi.mock('node:child_process', () => ({
  execFile: vi.fn(),
}));

import { execFile } from 'node:child_process';

const mockExecFile = vi.mocked(execFile);

function mockStdout(data: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockExecFile as any).mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown, cb: unknown) => {
    const callback = cb as (err: null, result: { stdout: string; stderr: string }) => void;
    callback(null, { stdout: data, stderr: '' });
    return undefined as never;
  });
}

function mockError(message: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (mockExecFile as any).mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown, cb: unknown) => {
    const callback = cb as (err: Error, result: unknown) => void;
    callback(new Error(message), undefined as never);
    return undefined as never;
  });
}

describe('NowledgeMemAdapter', () => {
  let adapter: NowledgeMemAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NowledgeMemAdapter({
      cliPath: 'nmem.cmd',
      mode: 'cli',
    });
  });

  describe('status', () => {
    it('returns connected status when server is reachable', async () => {
      mockStdout(JSON.stringify({ version: '1.0.0', memory_count: 42 }));
      const result = await adapter.status();
      expect(result.connected).toBe(true);
      expect(result.version).toBe('1.0.0');
    });

    it('returns disconnected status when server is unreachable', async () => {
      mockError('Cannot connect');
      const result = await adapter.status();
      expect(result.connected).toBe(false);
    });
  });

  describe('healthCheck', () => {
    it('returns true when server is reachable', async () => {
      mockStdout(JSON.stringify({ version: '1.0.0' }));
      const result = await adapter.healthCheck();
      expect(result).toBe(true);
    });

    it('returns false when server is unreachable', async () => {
      mockError('connection_failed');
      const result = await adapter.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe('addMemory', () => {
    it('calls CLI with correct arguments', async () => {
      mockStdout(JSON.stringify({ id: 'mem-1', content: 'hello world' }));
      const result = await adapter.addMemory('hello world', { labels: ['test'], importance: 5 });
      expect(result.id).toBe('mem-1');
      expect(mockExecFile).toHaveBeenCalled();
      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).toContain('-j');
      expect(args).toContain('memories');
      expect(args).toContain('add');
    });
  });

  describe('searchMemories', () => {
    it('calls CLI search with query', async () => {
      mockStdout(JSON.stringify({ memories: [{ id: 'mem-1', content: 'found' }], total: 1 }));
      const result = await adapter.searchMemories('test query', { limit: 5 });
      expect(result.memories).toHaveLength(1);
      expect(result.memories[0].content).toBe('found');
    });

    it('passes time range filter', async () => {
      mockStdout(JSON.stringify({ memories: [], total: 0 }));
      await adapter.searchMemories('test', { timeRange: 'week' });
      const args = mockExecFile.mock.calls[0][1] as string[];
      expect(args).toContain('--time-range');
      expect(args).toContain('week');
    });
  });

  describe('getMemory', () => {
    it('returns memory when found', async () => {
      mockStdout(JSON.stringify({ id: 'mem-1', content: 'hello' }));
      const result = await adapter.getMemory('mem-1');
      expect(result?.id).toBe('mem-1');
    });

    it('returns null when not found', async () => {
      mockError('not found');
      const result = await adapter.getMemory('mem-999');
      expect(result).toBeNull();
    });
  });

  describe('deleteMemory', () => {
    it('returns true on success', async () => {
      mockStdout('');
      const result = await adapter.deleteMemory('mem-1');
      expect(result).toBe(true);
    });

    it('returns false on failure', async () => {
      mockError('delete failed');
      const result = await adapter.deleteMemory('mem-1');
      expect(result).toBe(false);
    });
  });

  describe('expandGraph', () => {
    it('returns graph neighborhood', async () => {
      mockStdout(JSON.stringify({ memoryId: 'mem-1', relations: [] }));
      const result = await adapter.expandGraph('mem-1');
      expect(result.memoryId).toBe('mem-1');
    });
  });

  describe('searchLibrary', () => {
    it('returns library artifacts', async () => {
      mockStdout(JSON.stringify([{ id: 'lib-1', name: 'doc.pdf', type: 'file' }]));
      const result = await adapter.searchLibrary('pdf');
      expect(result).toHaveLength(1);
    });
  });

  describe('getWorkingMemory', () => {
    it('returns working memory content', async () => {
      mockStdout(JSON.stringify({ date: '2026-05-26', content: '## Focus\n...\n' }));
      const result = await adapter.getWorkingMemory('2026-05-26');
      expect(result.date).toBe('2026-05-26');
    });
  });

  describe('listCommunities', () => {
    it('returns community list', async () => {
      mockStdout(JSON.stringify([{ id: 'c1', name: 'Research', memberCount: 5 }]));
      const result = await adapter.listCommunities(10);
      expect(result).toHaveLength(1);
    });
  });

  describe('getFeed', () => {
    it('returns feed entries', async () => {
      mockStdout(JSON.stringify([{ id: 'f1', type: 'memory_added' }]));
      const result = await adapter.getFeed(7);
      expect(result).toHaveLength(1);
    });
  });

  describe('initialize / shutdown', () => {
    it('initializes by checking status', async () => {
      mockStdout(JSON.stringify({ version: '1.0.0' }));
      await adapter.initialize();
      expect(mockExecFile).toHaveBeenCalled();
    });

    it('shutdown clears state', async () => {
      mockStdout(JSON.stringify({ version: '1.0.0' }));
      await adapter.initialize();
      await adapter.shutdown();
      // After shutdown, health check should still work
      mockStdout(JSON.stringify({ version: '1.0.0' }));
      const result = await adapter.healthCheck();
      expect(result).toBe(true);
    });
  });

  describe('graceful degradation', () => {
    it('handles missing CLI gracefully', async () => {
      const noCliAdapter = new NowledgeMemAdapter({ cliPath: '/nonexistent/nmem' });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockExecFile as any).mockImplementation((_cmd: string, _args: readonly string[], _opts: unknown, cb: unknown) => {
        const callback = cb as (err: Error & { code: string }, result: unknown) => void;
        const err = new Error('ENOENT') as Error & { code: string };
        err.code = 'ENOENT';
        callback(err, undefined as never);
        return undefined as never;
      });
      const result = await noCliAdapter.status();
      expect(result.connected).toBe(false);
    });
  });
});