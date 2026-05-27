import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NowledgeMemAdapter } from './nowledge-mem-adapter.js';

// Mock child_process.spawn with EventEmitter-based mock
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
    spawn: vi.fn((_cmd: string, _args: string[], _opts: unknown) => {
      return createMockSpawn('', '', 1);
    }),
  };
});

import { spawn } from 'node:child_process';

const mockSpawn = vi.mocked(spawn);

function mockStdout(data: string, exitCode = 0) {
  const { EventEmitter } = require('events');
  (mockSpawn as any).mockImplementation((_cmd: string, _args: string[], _opts: unknown) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    setTimeout(() => {
      child.stdout.emit('data', Buffer.from(data));
      child.emit('close', exitCode);
    }, 0);
    return child;
  });
}

function mockError(message: string) {
  const { EventEmitter } = require('events');
  (mockSpawn as any).mockImplementation((_cmd: string, _args: string[], _opts: unknown) => {
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

function mockENOENT() {
  const { EventEmitter } = require('events');
  (mockSpawn as any).mockImplementation((_cmd: string, _args: string[], _opts: unknown) => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = { write: vi.fn(), end: vi.fn() };
    setTimeout(() => {
      const err = new Error('not found');
      (err as any).code = 'ENOENT';
      child.emit('error', err);
    }, 0);
    return child;
  });
}

describe('NowledgeMemAdapter', () => {
  let adapter: NowledgeMemAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NowledgeMemAdapter({ cliPath: 'nmem.cmd' });
  });

  describe('status', () => {
    it('returns connected status when server is reachable', async () => {
      mockStdout(JSON.stringify({ connected: true, version: '1.0.0', stats: { memoryCount: 42 } }));
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
      mockStdout(JSON.stringify({ connected: true, version: '1.0.0' }));
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
      const result = await adapter.addMemory('hello world', { labels: ['test'], importance: 0.8 });
      expect(result.id).toBe('mem-1');
      expect(mockSpawn).toHaveBeenCalled();
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('memories');
      expect(args).toContain('add');
      expect(args).toContain('hello world');
    });

    it('passes new fields: title, unitType, when, spaceId', async () => {
      mockStdout(JSON.stringify({ id: 'mem-2', content: 'decision' }));
      await adapter.addMemory('decision', {
        title: 'Architecture Decision',
        unitType: 'decision',
        when: '2026-05-27',
        importance: 0.9,
        spaceId: 'work',
        labels: ['arch'],
      });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--title');
      expect(args).toContain('Architecture Decision');
      expect(args).toContain('--unit-type');
      expect(args).toContain('decision');
      expect(args).toContain('--when');
      expect(args).toContain('2026-05-27');
      expect(args).toContain('--space');
      expect(args).toContain('work');
    });

    it('passes bitemporal fields: eventStart, eventEnd', async () => {
      mockStdout(JSON.stringify({ id: 'mem-3', content: 'event' }));
      await adapter.addMemory('event', {
        eventStart: '2026-01-01',
        eventEnd: '2026-06-30',
      });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--event-start');
      expect(args).toContain('2026-01-01');
      expect(args).toContain('--event-end');
      expect(args).toContain('2026-06-30');
    });

    it('throws on failure', async () => {
      mockError('add failed');
      await expect(adapter.addMemory('test')).rejects.toThrow('Failed to add memory');
    });
  });

  describe('searchMemories', () => {
    it('calls CLI search with query', async () => {
      mockStdout(JSON.stringify({ memories: [{ id: 'mem-1', content: 'found' }], total: 1 }));
      const result = await adapter.searchMemories('test query', { limit: 5 });
      expect(result.memories).toHaveLength(1);
    });

    it('passes time range filter', async () => {
      mockStdout(JSON.stringify({ memories: [], total: 0 }));
      await adapter.searchMemories('test', { timeRange: 'week' });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--time-range');
      expect(args).toContain('week');
    });

    it('passes temporal filters: eventFrom, eventTo, recordedFrom', async () => {
      mockStdout(JSON.stringify({ memories: [], total: 0 }));
      await adapter.searchMemories('test', {
        eventFrom: '2026-01-01',
        eventTo: '2026-06-30',
        recordedFrom: '2026-05-01',
      });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--event-from');
      expect(args).toContain('--event-to');
      expect(args).toContain('--recorded-from');
    });

    it('returns empty result on error', async () => {
      mockError('search failed');
      const result = await adapter.searchMemories('test');
      expect(result.memories).toHaveLength(0);
      expect(result.total).toBe(0);
    });
  });

  describe('searchByTimeRange', () => {
    it('returns memories within time range', async () => {
      mockStdout(JSON.stringify({ memories: [{ id: 'mem-1' }], total: 1 }));
      const result = await adapter.searchByTimeRange({
        eventFrom: '2026-01-01',
        eventTo: '2026-06-30',
      });
      expect(result.memories).toHaveLength(1);
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--event-from');
      expect(args).toContain('--event-to');
    });

    it('passes recordedFrom and recordedTo', async () => {
      mockStdout(JSON.stringify({ memories: [], total: 0 }));
      await adapter.searchByTimeRange({
        recordedFrom: '2026-05-01',
        recordedTo: '2026-05-27',
      });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--recorded-from');
      expect(args).toContain('--recorded-to');
    });

    it('passes labels, unitType, spaceId', async () => {
      mockStdout(JSON.stringify({ memories: [], total: 0 }));
      await adapter.searchByTimeRange({
        labels: ['decision'],
        unitType: 'decision',
        spaceId: 'work',
        limit: 5,
      });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--labels');
      expect(args).toContain('--unit-type');
      expect(args).toContain('--space');
      expect(args).toContain('--limit');
    });

    it('returns empty on error', async () => {
      mockError('failed');
      const result = await adapter.searchByTimeRange({ eventFrom: '2026-01-01' });
      expect(result.memories).toHaveLength(0);
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

  describe('listMemories', () => {
    it('returns memory list with filters', async () => {
      mockStdout(JSON.stringify([{ id: 'mem-1', content: 'test' }]));
      const result = await adapter.listMemories({ type: 'decision', limit: 10 });
      expect(result).toHaveLength(1);
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--type');
      expect(args).toContain('--limit');
    });

    it('returns empty on error', async () => {
      mockError('failed');
      const result = await adapter.listMemories();
      expect(result).toHaveLength(0);
    });
  });

  describe('updateMemory', () => {
    it('updates memory with new fields', async () => {
      mockStdout(JSON.stringify({ id: 'mem-1', content: 'updated' }));
      const result = await adapter.updateMemory('mem-1', {
        content: 'updated',
        title: 'New Title',
        importance: 0.9,
      });
      expect(result?.id).toBe('mem-1');
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--content');
      expect(args).toContain('--title');
    });

    it('returns null on error', async () => {
      mockError('failed');
      const result = await adapter.updateMemory('mem-1', { content: 'x' });
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

  describe('moveMemory', () => {
    it('returns true on success', async () => {
      mockStdout('');
      const result = await adapter.moveMemory('mem-1', 'work');
      expect(result).toBe(true);
    });

    it('returns false on failure', async () => {
      mockError('failed');
      const result = await adapter.moveMemory('mem-1', 'work');
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

  describe('createRelation', () => {
    it('creates typed relation with options', async () => {
      mockStdout('');
      await adapter.createRelation('mem-1', 'mem-2', {
        type: 'EVOLVES' as any,
        evolvesKind: 'Enriches' as any,
        strength: 0.8,
      });
      expect(mockSpawn).toHaveBeenCalled();
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('graph');
      expect(args).toContain('add-relation');
      expect(args).toContain('--evolves-kind');
      expect(args).toContain('--strength');
    });

    it('throws on failure', async () => {
      mockError('relation failed');
      await expect(adapter.createRelation('mem-1', 'mem-2', { type: 'EVOLVES' as any }))
        .rejects.toThrow('Failed to create relation');
    });
  });

  describe('searchRelations', () => {
    it('returns relations filtered by type', async () => {
      mockStdout(JSON.stringify([{ from: 'mem-1', to: 'mem-2', type: 'EVOLVES' }]));
      const result = await adapter.searchRelations({ type: 'EVOLVES' as any });
      expect(result).toHaveLength(1);
    });

    it('returns empty on error', async () => {
      mockError('failed');
      const result = await adapter.searchRelations({});
      expect(result).toHaveLength(0);
    });
  });

  describe('getEvolvesChain', () => {
    it('returns version chain', async () => {
      mockStdout(JSON.stringify([{ id: 'mem-1' }, { id: 'mem-2' }]));
      const result = await adapter.getEvolvesChain('mem-1');
      expect(result).toHaveLength(2);
    });

    it('passes evolvesKind option', async () => {
      mockStdout(JSON.stringify([{ id: 'mem-1' }]));
      await adapter.getEvolvesChain('mem-1', { evolvesKind: 'Enriches' as any });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--evolves-kind');
    });

    it('returns empty on error', async () => {
      mockError('failed');
      const result = await adapter.getEvolvesChain('mem-1');
      expect(result).toHaveLength(0);
    });
  });

  describe('Source operations', () => {
    it('addSource creates a source entry', async () => {
      mockStdout(JSON.stringify({ id: 'src-1', type: 'file', name: 'doc.pdf' }));
      const result = await adapter.addSource('/path/to/doc.pdf', { type: 'file' });
      expect(result.id).toBe('src-1');
      expect(result.type).toBe('file');
    });

    it('addSource throws on failure', async () => {
      mockError('add failed');
      await expect(adapter.addSource('/path')).rejects.toThrow('Failed to add source');
    });

    it('listSources returns source list', async () => {
      mockStdout(JSON.stringify([{ id: 'src-1', name: 'doc.pdf', type: 'file' }]));
      const result = await adapter.listSources({ limit: 10 });
      expect(result).toHaveLength(1);
    });

    it('getSource returns source by ID', async () => {
      mockStdout(JSON.stringify({ id: 'src-1', name: 'doc.pdf', type: 'file' }));
      const result = await adapter.getSource('src-1');
      expect(result?.id).toBe('src-1');
    });

    it('getSource returns null on error', async () => {
      mockError('not found');
      const result = await adapter.getSource('src-999');
      expect(result).toBeNull();
    });

    it('deleteSource returns true on success', async () => {
      mockStdout('');
      const result = await adapter.deleteSource('src-1');
      expect(result).toBe(true);
    });

    it('ingestSource extracts knowledge', async () => {
      mockStdout(JSON.stringify({ memoryIds: ['mem-1', 'mem-2'], extractedEntities: 5 }));
      const result = await adapter.ingestSource('src-1');
      expect(result.memoryIds).toHaveLength(2);
      expect(result.extractedEntities).toBe(5);
    });

    it('searchSourceChunks searches within a source', async () => {
      mockStdout(JSON.stringify([{ content: 'relevant chunk', score: 0.9 }]));
      const result = await adapter.searchSourceChunks('src-1', 'query', { limit: 3 });
      expect(result).toHaveLength(1);
    });
  });

  describe('Space operations', () => {
    it('createSpace creates a space', async () => {
      mockStdout(JSON.stringify({ id: 'space-1', name: 'Work' }));
      const result = await adapter.createSpace('Work', { description: 'Work space' });
      expect(result.id).toBe('space-1');
      expect(result.name).toBe('Work');
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('spaces');
      expect(args).toContain('create');
      expect(args).toContain('--description');
    });

    it('createSpace throws on failure', async () => {
      mockError('create failed');
      await expect(adapter.createSpace('Bad')).rejects.toThrow('Failed to create space');
    });

    it('listSpaces returns space list', async () => {
      mockStdout(JSON.stringify([{ id: 'space-1', name: 'Work' }]));
      const result = await adapter.listSpaces();
      expect(result).toHaveLength(1);
    });

    it('getSpace returns space by ID', async () => {
      mockStdout(JSON.stringify({ id: 'space-1', name: 'Work' }));
      const result = await adapter.getSpace('space-1');
      expect(result?.id).toBe('space-1');
    });

    it('getSpace returns null on error', async () => {
      mockError('not found');
      const result = await adapter.getSpace('space-999');
      expect(result).toBeNull();
    });

    it('switchSpace returns true on success', async () => {
      mockStdout('');
      const result = await adapter.switchSpace('space-1');
      expect(result).toBe(true);
    });

    it('switchSpace returns false on failure', async () => {
      mockError('failed');
      const result = await adapter.switchSpace('space-1');
      expect(result).toBe(false);
    });

    it('addSpaceMember returns true on success', async () => {
      mockStdout('');
      const result = await adapter.addSpaceMember('space-1', 'entity-1');
      expect(result).toBe(true);
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('add-member');
    });

    it('removeSpaceMember returns true on success', async () => {
      mockStdout('');
      const result = await adapter.removeSpaceMember('space-1', 'entity-1');
      expect(result).toBe(true);
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('remove-member');
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

  describe('summarizeMemories', () => {
    it('returns summary', async () => {
      mockStdout(JSON.stringify({ summary: 'combined insights' }));
      const result = await adapter.summarizeMemories(['mem-1', 'mem-2']);
      expect(result).toBe('combined insights');
    });

    it('throws on failure', async () => {
      mockError('summarize failed');
      await expect(adapter.summarizeMemories(['mem-1'])).rejects.toThrow('Failed to summarize');
    });
  });

  describe('Thread operations', () => {
    it('addThread creates thread with options', async () => {
      mockStdout(JSON.stringify({ id: 'thread-1', title: 'Test Thread' }));
      const result = await adapter.addThread([{ role: 'user', content: 'hello' }], {
        title: 'Test Thread',
        source: 'claude',
      });
      expect(result.id).toBe('thread-1');
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('threads');
      expect(args).toContain('add');
      expect(args).toContain('--stdin');
    });

    it('addThread writes messages to stdin', async () => {
      mockStdout(JSON.stringify({ id: 'thread-1', title: 'Test' }));
      await adapter.addThread([{ role: 'user', content: 'hello' }]);
      const child = mockSpawn.mock.results[0].value;
      expect(child.stdin.write).toHaveBeenCalledWith(JSON.stringify([{ role: 'user', content: 'hello' }]));
    });

    it('addThread throws on failure', async () => {
      mockError('add failed');
      await expect(adapter.addThread([{ role: 'user', content: 'hi' }]))
        .rejects.toThrow('Failed to add thread');
    });

    it('searchThreads returns matching threads', async () => {
      mockStdout(JSON.stringify([{ id: 'thread-1', title: 'Test' }]));
      const result = await adapter.searchThreads('test', { limit: 5 });
      expect(result).toHaveLength(1);
    });

    it('getThread returns thread by ID', async () => {
      mockStdout(JSON.stringify({ id: 'thread-1', title: 'Test', messages: [] }));
      const result = await adapter.getThread('thread-1');
      expect(result?.id).toBe('thread-1');
    });

    it('getThread returns null on error', async () => {
      mockError('not found');
      const result = await adapter.getThread('thread-999');
      expect(result).toBeNull();
    });

    it('appendThread adds messages to existing thread', async () => {
      mockStdout(JSON.stringify({ id: 'thread-1', title: 'Test' }));
      const result = await adapter.appendThread('thread-1', [{ role: 'assistant', content: 'response' }]);
      expect(result?.id).toBe('thread-1');
    });

    it('appendThread passes idempotencyKey', async () => {
      mockStdout(JSON.stringify({ id: 'thread-1', title: 'Test' }));
      await adapter.appendThread('thread-1', [{ role: 'assistant', content: 'response' }], {
        idempotencyKey: 'key-123',
      });
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('--idempotency-key');
    });

    it('importThread creates thread from messages', async () => {
      mockStdout(JSON.stringify({ id: 'thread-2', title: 'Imported' }));
      const result = await adapter.importThread({
        messages: [{ role: 'user', content: 'imported' }],
        title: 'Imported',
        source: 'chatgpt',
      });
      expect(result.id).toBe('thread-2');
    });

    it('saveThread saves current session thread', async () => {
      mockStdout(JSON.stringify({ id: 'thread-saved', title: 'Saved' }));
      const result = await adapter.saveThread({ title: 'Saved', source: 'claude', spaceId: 'work' });
      expect(result.id).toBe('thread-saved');
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('threads');
      expect(args).toContain('save');
      expect(args).toContain('--title');
      expect(args).toContain('--source');
      expect(args).toContain('--space');
    });

    it('saveThread throws on failure', async () => {
      mockError('save failed');
      await expect(adapter.saveThread()).rejects.toThrow('Failed to save thread');
    });

    it('reconcileTail reconciles overlapping messages', async () => {
      mockStdout(JSON.stringify({ reconciled: true, mergedCount: 2 }));
      const result = await adapter.reconcileTail('thread-1', { strategy: 'merge', maxOverlap: 10 });
      expect(result.reconciled).toBe(true);
      expect(result.mergedCount).toBe(2);
      const args = mockSpawn.mock.calls[0][1] as string[];
      expect(args).toContain('threads');
      expect(args).toContain('reconcile-tail');
      expect(args).toContain('--strategy');
      expect(args).toContain('merge');
      expect(args).toContain('--max-overlap');
    });

    it('reconcileTail returns reconciled:false on error', async () => {
      mockError('reconcile failed');
      const result = await adapter.reconcileTail('thread-1');
      expect(result.reconciled).toBe(false);
    });
  });

  describe('importFromLibrary', () => {
    it('returns import result', async () => {
      mockStdout(JSON.stringify({ imported: 3, skipped: 1, errors: [], ids: ['mem-a', 'mem-b', 'mem-c'] }));
      const result = await adapter.importFromLibrary('/path/to/file.pdf');
      expect(result.imported).toBe(3);
      expect(result.ids).toHaveLength(3);
    });

    it('returns zeroed result on error', async () => {
      mockError('import failed');
      const result = await adapter.importFromLibrary('/bad/path');
      expect(result.imported).toBe(0);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('initialize / shutdown', () => {
    it('initializes by checking status', async () => {
      mockStdout(JSON.stringify({ connected: true, version: '1.0.0' }));
      await adapter.initialize();
      expect(adapter.available).toBe(true);
    });

    it('shutdown clears state', async () => {
      mockStdout(JSON.stringify({ connected: true, version: '1.0.0' }));
      await adapter.initialize();
      await adapter.shutdown();
      expect(adapter.available).toBe(false);
    });
  });

  describe('graceful degradation', () => {
    it('handles missing CLI gracefully', async () => {
      mockENOENT();
      const result = await adapter.status();
      expect(result.connected).toBe(false);
    });
  });

  describe('stdin support', () => {
    it('setWorkingMemory writes content to stdin', async () => {
      mockStdout('');
      await adapter.setWorkingMemory('## Focus\nToday I will...');
      const child = mockSpawn.mock.results[0].value;
      expect(child.stdin.write).toHaveBeenCalledWith('## Focus\nToday I will...');
      expect(child.stdin.end).toHaveBeenCalled();
    });
  });
});
