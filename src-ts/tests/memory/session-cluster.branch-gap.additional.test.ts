import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ClusterMember,
  ClusterRelation,
  SessionCluster,
  SessionClusterManager,
} from '../../memory/session-cluster';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-session-cluster-branch-gap-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('SessionCluster branch gap coverage', () => {
  it('keeps non-string role and relation values in fromDict', () => {
    const opaqueRole = { kind: 'custom-role' };
    const opaqueRelation = { kind: 'custom-relation' };

    const member = ClusterMember.fromDict({
      sessionId: 'opaque-member',
      role: opaqueRole,
    });
    const relation = ClusterRelation.fromDict({
      fromCluster: 'from',
      toCluster: 'to',
      relationType: opaqueRelation,
    });

    expect(member.role).toBe(opaqueRole);
    expect(relation.relationType).toBe(opaqueRelation);
  });

  it('uses constructor defaults when members are omitted', () => {
    const cluster = new SessionCluster({
      clusterId: 'default-members',
      name: 'Default Members',
    });

    expect(cluster.members).toEqual([]);
  });

  it('reuses member and relation instances and legacy timestamp aliases in fromDict', () => {
    const member = new ClusterMember({ sessionId: 'instance-member' });
    const relation = new ClusterRelation({ fromCluster: 'left', toCluster: 'right' });

    const cluster = SessionCluster.fromDict({
      cluster_id: 'legacy-cluster',
      name: 'Legacy Cluster',
      members: [member],
      relations: [relation],
      created_at: 123,
      updated_at: 456,
    });

    expect(cluster.clusterId).toBe('legacy-cluster');
    expect(cluster.members[0]).toBe(member);
    expect(cluster.relations[0]).toBe(relation);
    expect(cluster.createdAt).toBe(123);
    expect(cluster.updatedAt).toBe(456);
  });

  it('falls back to empty identifiers, arrays, and current timestamps in fromDict', () => {
    const before = Date.now() / 1000;
    const cluster = SessionCluster.fromDict({
      name: 'Fallback Cluster',
    });
    const after = Date.now() / 1000;

    expect(cluster.clusterId).toBe('');
    expect(cluster.members).toEqual([]);
    expect(cluster.relations).toEqual([]);
    expect(cluster.createdAt).toBeGreaterThanOrEqual(before);
    expect(cluster.createdAt).toBeLessThanOrEqual(after);
    expect(cluster.updatedAt).toBeGreaterThanOrEqual(before);
    expect(cluster.updatedAt).toBeLessThanOrEqual(after);
  });

  it('ignores persisted indexes without a clusters array', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.json'), JSON.stringify({ updatedAt: 1 }), 'utf8');

    const manager = new SessionClusterManager(dir);

    expect(manager.listClusters(true)).toEqual([]);
  });

  it('falls back to a generic merged name when merge input name is non-string and source names are blank', () => {
    const manager = new SessionClusterManager(createTempDir());
    const left = manager.createCluster('', '', ['left-member']);
    const right = manager.createCluster('', '', ['right-member']);

    const merged = manager.mergeClusters(
      [left.clusterId, right.clusterId],
      null as unknown as string,
    );

    expect(merged?.name).toBe('Merged');
  });
});
