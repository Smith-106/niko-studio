import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  WritingSessionCluster,
  createWritingSessionCluster,
  type WritingSession,
} from '../../analysis/writing-session-cluster.js';

function createTempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-writing-session-cluster-'));
  return join(dir, 'cluster.db');
}

function buildSession(overrides: Partial<WritingSession> = {}): WritingSession {
  return {
    id: 'session-1',
    type: 'chapter',
    characters: ['Alice'],
    keywords: ['artifact', 'archive'],
    order: 1,
    relatedEntities: ['Alice', 'archive'],
    styleVector: [1, 0.8, 0.2],
    ...overrides,
  };
}

const cleanupPaths: string[] = [];
const openClusters: Array<{ close: () => void }> = [];

describe('analysis/writing-session-cluster', () => {
  afterEach(() => {
    for (const cluster of openClusters.splice(0)) {
      cluster.close();
    }
    for (const path of cleanupPaths.splice(0)) {
      rmSync(join(path, '..'), { recursive: true, force: true });
    }
  });

  it('clusters similar sessions, persists them, and exposes the stored members', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = createWritingSessionCluster(dbPath);
    openClusters.push(cluster);

    const result = cluster.clusterSessions([
      buildSession({ id: 's1' }),
      buildSession({
        id: 's2',
        order: 2,
        styleVector: [1, 0.75, 0.25],
      }),
      buildSession({
        id: 's3',
        type: 'scene',
        characters: ['Carol'],
        keywords: ['storm'],
        order: 20,
        relatedEntities: ['Carol'],
        styleVector: [0.1, 0.2, 0.9],
      }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: 'chapter-artifact',
      status: 'active',
    });
    expect(result[0]?.members).toHaveLength(2);
    expect(result[1]?.members).toHaveLength(1);

    const persisted = cluster.getClusters();
    expect(persisted).toHaveLength(2);
    expect(persisted.map((item) => item.members.length).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('assigns a new session to the best active cluster when similarity passes the threshold', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = new WritingSessionCluster(dbPath);
    openClusters.push(cluster);

    const existing = [
      buildSession({ id: 's1' }),
      buildSession({ id: 's2', order: 2, styleVector: [1, 0.7, 0.3] }),
    ];
    const created = cluster.clusterSessions(existing);

    const assigned = cluster.assignToCluster(
      buildSession({ id: 's3', order: 3, styleVector: [1, 0.72, 0.28] }),
      existing,
    );

    expect(assigned).toMatchObject({
      clusterId: created[0]?.id,
      isNewCluster: false,
    });
    expect(assigned.similarity).toBeGreaterThanOrEqual(0.6);
    expect(cluster.getClusters()[0]?.members).toHaveLength(3);
  });

  it('creates a fresh cluster when no existing cluster is similar enough', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = new WritingSessionCluster(dbPath, {
      similarityThreshold: 0.95,
    });
    openClusters.push(cluster);

    cluster.clusterSessions([buildSession({ id: 's1' })]);

    const assigned = cluster.assignToCluster(
      buildSession({
        id: 's9',
        characters: ['Zed'],
        keywords: ['volcano'],
        order: 99,
        relatedEntities: ['Zed'],
        styleVector: [0.2, 0.1, 0.95],
      }),
      [buildSession({ id: 's1' })],
    );

    expect(assigned).toMatchObject({
      isNewCluster: true,
      similarity: 0,
    });
    expect(cluster.getClusters()).toHaveLength(2);
  });

  it('covers edge-case similarity math for empty vectors and zero orders', () => {
    const dbPath = createTempDbPath();
    cleanupPaths.push(dbPath);
    const cluster = new WritingSessionCluster(dbPath);
    openClusters.push(cluster);

    const similarity = cluster.computeSimilarity(
      buildSession({
        id: 'edge-a',
        characters: [],
        keywords: [],
        order: 0,
        relatedEntities: [],
        styleVector: [],
      }),
      buildSession({
        id: 'edge-b',
        characters: [],
        keywords: [],
        order: 0,
        relatedEntities: [],
        styleVector: [],
      }),
    );

    expect(similarity).toBe(0.6);
  });
});
