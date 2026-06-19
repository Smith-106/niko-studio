import { existsSync, mkdtempSync, rmSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { IndexingService } from '../../services/indexing-service.js';

function createMockEmbedder(dimensions: number = 8): import('../../services/indexing-service.js').Embedder {
  const cache = new Map<string, number[]>();

  return {
    embed(texts: string[]): number[][] {
      return texts.map((text) => {
        if (cache.has(text)) return cache.get(text)!;

        const vec: number[] = [];
        for (let i = 0; i < dimensions; i++) {
          const charCode = text.charCodeAt(i % text.length) || 0;
          vec.push((charCode % 100) / 100.0);
        }
        const norm = Math.sqrt(vec.reduce((sum, value) => sum + value * value, 0)) || 1;
        for (let i = 0; i < vec.length; i++) {
          vec[i] /= norm;
        }
        cache.set(text, vec);
        return vec;
      });
    },
    embeddingSize: dimensions,
  };
}

describe('services/indexing-service branch-gap coverage', () => {
  const services: IndexingService[] = [];
  const workspaces: string[] = [];

  afterEach(() => {
    for (const service of services.splice(0)) {
      try {
        service.close();
      } catch {
        // ignore cleanup errors in tests
      }
    }
    for (const workspace of workspaces.splice(0)) {
      rmSync(workspace, { recursive: true, force: true });
    }
  });

  it('creates missing parent directories for nested database paths', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'niko-indexing-branch-gap-'));
    workspaces.push(workspace);
    const dbPath = join(workspace, 'deep', 'nested', 'index.db');

    expect(existsSync(dirname(dbPath))).toBe(false);

    const service = new IndexingService(dbPath);
    services.push(service);

    expect(existsSync(dirname(dbPath))).toBe(true);
  });

  it('returns zero cosine similarity for mismatched vectors and zero-norm vectors', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'niko-indexing-branch-gap-'));
    workspaces.push(workspace);
    const service = new IndexingService(join(workspace, 'index.db'));
    services.push(service);

    const privateService = service as unknown as {
      _cosineSimilarity: (a: number[], b: number[]) => number;
    };

    expect(privateService._cosineSimilarity([1], [1, 2])).toBe(0);
    expect(privateService._cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('returns an empty result when the backing database file has been removed', () => {
    const workspace = mkdtempSync(join(tmpdir(), 'niko-indexing-branch-gap-'));
    workspaces.push(workspace);
    const dbPath = join(workspace, 'index.db');
    const service = new IndexingService(dbPath);
    services.push(service);
    service.setEmbedder(createMockEmbedder());

    service.close();
    unlinkSync(dbPath);

    expect(service.search('missing db')).toEqual([]);
  });
});
