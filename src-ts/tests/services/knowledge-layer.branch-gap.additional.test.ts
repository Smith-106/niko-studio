import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentKnowledgeLayer } from '../../services/knowledge-layer.js';
import type { Embedder as IndexingEmbedder, IndexingService } from '../../services/indexing-service.js';

class MinimalEmbedder implements IndexingEmbedder {
  embed(texts: string[]): number[][] {
    return texts.map(() => [1, 0, 0]);
  }
}

function getVectorStore(layer: AgentKnowledgeLayer): IndexingService {
  return (layer as unknown as { vectorStore: IndexingService }).vectorStore;
}

function getDb(layer: AgentKnowledgeLayer): {
  exec: (sql: string) => void;
  prepare: (sql: string) => { get: () => { cnt: number } };
} {
  return (layer as unknown as {
    _getDb: () => {
      exec: (sql: string) => void;
      prepare: (sql: string) => { get: () => { cnt: number } };
    };
  })._getDb();
}

describe('services/knowledge-layer branch-gap coverage', () => {
  let tempRoot: string;
  let dbPath: string;
  let layer: AgentKnowledgeLayer;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-knowledge-layer-branch-gap-'));
    dbPath = join(tempRoot, 'knowledge.db');
    layer = new AgentKnowledgeLayer(dbPath);
    getVectorStore(layer).setEmbedder(new MinimalEmbedder());
  });

  afterEach(() => {
    layer.close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('backfills entities_fts when entities exist but the FTS table is empty', () => {
    layer.addEntity('hero', 'Hero', 'Character', 'Backfill target');
    getDb(layer).exec('DELETE FROM entities_fts');
    layer.close();

    const reloaded = new AgentKnowledgeLayer(dbPath);
    getVectorStore(reloaded).setEmbedder(new MinimalEmbedder());

    try {
      const count = getDb(reloaded).prepare('SELECT count(*) as cnt FROM entities_fts').get().cnt;
      expect(count).toBeGreaterThan(0);
    } finally {
      reloaded.close();
      layer = new AgentKnowledgeLayer(dbPath);
      getVectorStore(layer).setEmbedder(new MinimalEmbedder());
    }
  });

  it('syncs files when patterns are passed as raw extensions without the star prefix', () => {
    const notesFile = join(tempRoot, 'notes.txt');
    const ignoredFile = join(tempRoot, 'notes.md');
    writeFileSync(notesFile, 'plain text note', 'utf8');
    writeFileSync(ignoredFile, 'markdown note', 'utf8');

    const results = layer.syncDirectory(tempRoot, ['.txt']);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      success: true,
      action: 'synced',
      message: 'Synced as document',
      path: notesFile,
    });
  });
});
