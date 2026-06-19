import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  WritingSessionCluster,
  type WritingSession,
} from '../../analysis/writing-session-cluster.js';

function createTempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-writing-session-cluster-extra-'));
  return join(dir, 'cluster.db');
}

function buildSession(
  id: string,
  overrides: Partial<WritingSession> = {},
): WritingSession {
  return {
    id,
    type: 'chapter',
    characters: ['Alice'],
    keywords: ['artifact'],
    order: 1,
    relatedEntities: ['Alice'],
    styleVector: [1, 0.5, 0.2],
    ...overrides,
  };
}

const cleanupPaths: string[] = [];
const openClusters: Array<{ close: () => void }> = [];

describe('analysis/writing-session-cluster additional coverage', () => {
  afterEach(() => {
    vi.doUnmock('node:os');
    vi.resetModules();
    for (const cluster of openClusters.splice(0)) {
      cluster.close();
    }
    for (const path of cleanupPaths.splice(0)) {
      rmSync(join(path, '..'), { recursive: true, force: true });
    }
  });

  it('filters clusters by status when a status argument is provided', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = new WritingSessionCluster(dbPath);
    openClusters.push(cluster);

    const created = cluster.clusterSessions([buildSession('s-1')]);
    const clusterId = created[0]?.id ?? '';

    ((cluster as unknown as { db: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } }).db)
      .prepare("UPDATE session_clusters SET status = 'archived' WHERE id = ?")
      .run(clusterId);

    expect(cluster.getClusters('active')).toEqual([]);
    expect(cluster.getClusters('archived')).toHaveLength(1);
  });

  it('uses the home-based default path and returns an empty result for empty batches', async () => {
    const tempHome = mkdtempSync(join(tmpdir(), 'niko-writing-session-home-'));
    cleanupPaths.push(join(tempHome, 'placeholder'));

    vi.resetModules();
    vi.doMock('node:os', async () => {
      const actual = await vi.importActual<typeof import('node:os')>('node:os');
      return {
        ...actual,
        homedir: () => tempHome,
      };
    });

    const { WritingSessionCluster: DefaultPathCluster } = await import(
      '../../analysis/writing-session-cluster.js'
    );
    const cluster = new DefaultPathCluster();
    openClusters.push(cluster);

    expect(cluster.clusterSessions([])).toEqual([]);
    expect(existsSync(join(tempHome, '.niko', 'writing_clusters.db'))).toBe(true);
  });

  it('falls back to mixed-cluster naming and handles degenerate similarity inputs', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = new WritingSessionCluster(dbPath);
    openClusters.push(cluster);

    const privateApi = cluster as unknown as {
      generateClusterName: (sessions: WritingSession[]) => string;
    };

    expect(privateApi.generateClusterName([])).toBe('mixed-cluster');

    const similarity = cluster.computeSimilarity(
      buildSession('degenerate-a', {
        characters: [],
        keywords: ['artifact'],
        relatedEntities: [],
        order: 1,
        styleVector: [0, 0],
      }),
      buildSession('degenerate-b', {
        characters: ['Bob'],
        keywords: [],
        relatedEntities: ['Bob'],
        order: 2,
        styleVector: [0, 0],
      }),
    );

    expect(similarity).toBeCloseTo(0.075, 6);
  });

  it('uses the avg-relevance fallback when a whitebox cluster assignment duplicates the same member index', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = new WritingSessionCluster(dbPath) as unknown as {
      clusterSessions: (sessions: WritingSession[]) => Array<{ members: Array<{ relevanceScore: number }> }>;
      hierarchicalCluster: () => Record<string, number[]>;
    };
    openClusters.push(cluster as unknown as { close: () => void });

    cluster.hierarchicalCluster = () => ({
      duplicate: [0, 0],
    });

    const result = cluster.clusterSessions([buildSession('duplicate-member')]);

    expect(result).toHaveLength(1);
    expect(result[0]?.members).toHaveLength(2);
    expect(result[0]?.members.map((member) => member.relevanceScore)).toEqual([1, 1]);
  });
});
