import { afterEach, describe, expect, it, vi } from 'vitest';

describe('services/knowledge-layer init error branches', () => {
  afterEach(() => {
    vi.doUnmock('better-sqlite3');
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('tolerates FTS table, trigger, and backfill initialization failures', async () => {
    const exec = vi.fn((sql: string) => {
      if (sql.includes('CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts')) {
        throw new Error('fts unavailable');
      }
      if (sql.includes('CREATE TRIGGER IF NOT EXISTS entities_ai')) {
        throw new Error('trigger unavailable');
      }
      return undefined;
    });
    const prepare = vi.fn((sql: string) => {
      if (sql.includes('SELECT count(*) as cnt FROM entities_fts')) {
        throw new Error('fts count unavailable');
      }
      if (sql.includes('SELECT count(*) as cnt FROM entities')) {
        return { get: () => ({ cnt: 1 }) };
      }
      return {
        get: () => ({ cnt: 0 }),
        all: () => [],
        run: () => undefined,
      };
    });
    const close = vi.fn();
    const mockDb = { exec, prepare, close };
    const DatabaseMock = vi.fn(() => mockDb);

    vi.doMock('better-sqlite3', () => ({
      __esModule: true,
      default: DatabaseMock,
    }));

    const { AgentKnowledgeLayer } = await import('../../services/knowledge-layer.js');
    const layer = new AgentKnowledgeLayer('mock-knowledge.db');

    try {
      expect(DatabaseMock).toHaveBeenCalled();
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE IF NOT EXISTS document_chunks'));
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('CREATE VIRTUAL TABLE IF NOT EXISTS entities_fts'));
      expect(exec).toHaveBeenCalledWith(expect.stringContaining('CREATE TRIGGER IF NOT EXISTS entities_ai'));
      expect(prepare).toHaveBeenCalledWith('SELECT count(*) as cnt FROM entities');
      expect(prepare).toHaveBeenCalledWith('SELECT count(*) as cnt FROM entities_fts');
    } finally {
      layer.close();
      expect(close).toHaveBeenCalled();
    }
  });
});
