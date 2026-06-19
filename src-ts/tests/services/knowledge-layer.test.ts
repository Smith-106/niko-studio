import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AgentKnowledgeLayer } from '../../services/knowledge-layer.js';
import type { Embedder as IndexingEmbedder, IndexingService } from '../../services/indexing-service.js';

class KeywordEmbedder implements IndexingEmbedder {
  embed(texts: string[]): number[][] {
    return texts.map((text) => {
      const lower = text.toLowerCase();
      if (lower.includes('alice')) return [1, 0, 0];
      if (lower.includes('citation')) return [0, 1, 0];
      if (lower.includes('memory')) return [0, 0, 1];
      return [0.5, 0.5, 0.5];
    });
  }
}

function getVectorStore(layer: AgentKnowledgeLayer): IndexingService {
  return (layer as unknown as { vectorStore: IndexingService }).vectorStore;
}

function getDb(layer: AgentKnowledgeLayer): { exec: (sql: string) => void } {
  return (layer as unknown as { _getDb: () => { exec: (sql: string) => void } })._getDb();
}

describe('services/knowledge-layer', () => {
  let tempRoot: string;
  let dbPath: string;
  let layer: AgentKnowledgeLayer;

  beforeEach(() => {
    tempRoot = mkdtempSync(join(tmpdir(), 'niko-knowledge-layer-'));
    dbPath = join(tempRoot, 'knowledge.db');
    layer = new AgentKnowledgeLayer(dbPath);
    getVectorStore(layer).setEmbedder(new KeywordEmbedder());
  });

  afterEach(() => {
    layer.close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  it('indexes chunks, stores graph data, applies entity filters, and returns neighbors', () => {
    layer.addDocument('doc-alice', 'Alice guards the archive key.', 'scene');
    layer.addEntity('alice', 'Alice', 'Character', 'Lead guard', { faction: 'archive' });
    layer.addEntity('vault', 'Vault', 'Location', 'Hidden vault');
    layer.addRelation('alice', 'vault', 'GUARDS', { urgency: 'high' });

    const hybrid = layer.queryHybrid('Alice', ['vault'], 5);
    const neighbors = layer.getNeighbors('alice');

    expect(hybrid.chunks).toEqual([
      expect.objectContaining({
        id: 'doc-alice',
        source_type: 'scene',
      }),
    ]);
    expect(hybrid.entities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'alice',
          name: 'Alice',
          type: 'Character',
        }),
        expect.objectContaining({
          id: 'vault',
          name: 'Vault',
          type: 'Location',
        }),
      ]),
    );
    expect(neighbors).toEqual([
      {
        rel_type: 'GUARDS',
        target_name: 'Vault',
        target_type: 'Location',
        description: 'Hidden vault',
      },
    ]);
  });

  it('falls back to a full scan when the FTS table is unavailable', () => {
    layer.addEntity('hero', 'Hero', 'Character', 'Fallback target');
    getDb(layer).exec('DROP TABLE entities_fts');

    const hybrid = layer.queryHybrid('Hero');

    expect(hybrid.entities).toEqual([
      expect.objectContaining({
        id: 'hero',
        name: 'Hero',
      }),
    ]);
  });

  it('syncs single files and directories, classifies source types, and handles missing paths', () => {
    const citationsDir = join(tempRoot, 'citations');
    const memoriesDir = join(tempRoot, 'memories');
    const docsDir = join(tempRoot, 'docs', 'nested');
    mkdirSync(citationsDir, { recursive: true });
    mkdirSync(memoriesDir, { recursive: true });
    mkdirSync(docsDir, { recursive: true });

    const citationFile = join(citationsDir, 'artifact.md');
    const memoryFile = join(memoriesDir, 'session-note.txt');
    const docFile = join(docsDir, 'overview.json');
    const ignoredFile = join(docsDir, 'skip.png');

    writeFileSync(citationFile, 'citation archive note', 'utf8');
    writeFileSync(memoryFile, 'memory archive note', 'utf8');
    writeFileSync(docFile, '{"title":"general archive doc"}', 'utf8');
    writeFileSync(ignoredFile, 'binary-ish', 'utf8');

    const missing = layer.syncFile(join(tempRoot, 'missing.md'));
    const missingDir = layer.syncDirectory(join(tempRoot, 'absent'));
    const citationResult = layer.syncFile(citationFile);
    const syncResults = layer.syncDirectory(tempRoot);

    const vectorStore = getVectorStore(layer);
    const citationSearch = vectorStore.search('citation', 5, 0);
    const memorySearch = vectorStore.search('memory', 5, 0);
    const documentSearch = vectorStore.search('general', 5, 0);

    expect(missing).toEqual({
      success: false,
      action: 'error',
      message: 'File not found',
    });
    expect(missingDir).toEqual([]);
    expect(citationResult).toMatchObject({
      success: true,
      action: 'synced',
      message: 'Synced as citation',
      content_hash: expect.any(String),
      doc_id: expect.any(String),
    });
    expect(syncResults).toHaveLength(3);
    expect(syncResults.map((item) => item.path).sort()).toEqual([
      citationFile,
      docFile,
      memoryFile,
    ]);
    expect(citationSearch[0]).toMatchObject({
      source_type: 'citation',
    });
    expect(memorySearch[0]).toMatchObject({
      source_type: 'memory',
    });
    expect(documentSearch[0]).toMatchObject({
      source_type: 'document',
    });
  });
});
