import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentKnowledgeLayer } from '../../services/knowledge-layer.js';
import type { Embedder as IndexingEmbedder, IndexingService } from '../../services/indexing-service.js';

type PrivateKnowledgeLayer = AgentKnowledgeLayer & {
  _walkDir: (dir: string, ext: string, callback: (filePath: string) => void) => void;
};

class MinimalEmbedder implements IndexingEmbedder {
  embed(texts: string[]): number[][] {
    return texts.map(() => [1, 0, 0]);
  }
}

function getVectorStore(layer: AgentKnowledgeLayer): IndexingService {
  return (layer as unknown as { vectorStore: IndexingService }).vectorStore;
}

describe('services/knowledge-layer additional coverage', () => {
  let tempRoot: string;
  let layer: AgentKnowledgeLayer;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-knowledge-layer-additional-'));
    layer = new AgentKnowledgeLayer(join(tempRoot, 'knowledge.db'));
    getVectorStore(layer).setEmbedder(new MinimalEmbedder());
  });

  afterEach(() => {
    layer.close();
    rmSync(tempRoot, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  it('returns an error result when syncFile receives a directory path', () => {
    const folderPath = join(tempRoot, 'docs');
    mkdirSync(folderPath, { recursive: true });

    const result = layer.syncFile(folderPath);

    expect(result).toMatchObject({
      success: false,
      action: 'error',
    });
    expect(result.message.length).toBeGreaterThan(0);
  });

  it('returns early when walking a directory that does not exist', () => {
    const callback = vi.fn();
    const privateLayer = layer as unknown as PrivateKnowledgeLayer;

    privateLayer._walkDir(join(tempRoot, 'missing'), '.md', callback);

    expect(callback).not.toHaveBeenCalled();
  });

  it('backfills an empty FTS table when entities already exist', () => {
    layer.addEntity('hero', 'Hero', 'Character', 'Backfill target');
    layer.close();

    const reloaded = new AgentKnowledgeLayer(join(tempRoot, 'knowledge.db'));
    getVectorStore(reloaded).setEmbedder(new MinimalEmbedder());

    try {
      const db = (reloaded as unknown as {
        _getDb: () => { prepare: (sql: string) => { get: () => { cnt: number } } };
      })._getDb();
      const count = db.prepare('SELECT count(*) as cnt FROM entities_fts').get().cnt;

      expect(count).toBeGreaterThan(0);
    } finally {
      reloaded.close();
      layer = new AgentKnowledgeLayer(join(tempRoot, 'knowledge.db'));
      getVectorStore(layer).setEmbedder(new MinimalEmbedder());
    }
  });

  it('falls back to the non-token full scan path for punctuation-only queries', () => {
    layer.addEntity('hero', 'Hero', 'Character', 'Fallback branch target');

    const result = layer.queryHybrid('!!!');

    expect(result.entities).toEqual([]);
  });
});
