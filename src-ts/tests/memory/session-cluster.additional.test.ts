import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  ClusterMember,
  ClusterRelation,
  MemberRole,
  RelationType,
  SessionCluster,
  SessionClusterManager,
} from '../../memory/session-cluster';

const tempDirs: string[] = [];

function createTempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'niko-session-cluster-additional-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('SessionClusterManager additional coverage', () => {
  it('loads persisted clusters and skips missing cluster files', () => {
    const dir = createTempDir();
    const seed = new SessionCluster({
      clusterId: 'seed-loaded',
      name: 'Loaded',
      members: [new ClusterMember({ sessionId: 'loaded-session', role: MemberRole.PRIMARY })],
      relations: [],
    });

    writeFileSync(join(dir, 'index.json'), JSON.stringify({
      clusters: ['seed-loaded', 'missing-cluster'],
    }));
    writeFileSync(join(dir, 'seed-loaded.json'), JSON.stringify(seed.toDict()));

    const manager = new SessionClusterManager(dir);

    expect(manager.getCluster('seed-loaded')?.name).toBe('Loaded');
    expect(manager.getCluster('missing-cluster')).toBeNull();
    expect(manager.getClustersForSession('loaded-session').map((cluster) => cluster.clusterId)).toEqual([
      'seed-loaded',
    ]);
  });

  it('ignores malformed index files without throwing', () => {
    const dir = createTempDir();
    writeFileSync(join(dir, 'index.json'), '{not-json');

    const manager = new SessionClusterManager(dir);

    expect(manager.listClusters(true)).toEqual([]);
  });

  it('returns null when merge input has fewer than two valid clusters', () => {
    const manager = new SessionClusterManager(createTempDir());
    const only = manager.createCluster('Only');

    expect(manager.mergeClusters([only.clusterId, 'missing-id'], 'Merged')).toBeNull();
  });

  it('deduplicates merged members by primary role and contribution score and auto-names blank merges', () => {
    const manager = new SessionClusterManager(createTempDir());
    const secondaryCluster = manager.createCluster('Secondary First', '', ['secondary-only', 'primary-wins']);
    const primaryCluster = manager.createCluster('Primary', '', ['primary-wins', 'primary-only']);
    const highScoreCluster = manager.createCluster('High Score');
    manager.addMember(highScoreCluster.clusterId, 'shared', MemberRole.SECONDARY, 0.99);
    manager.addMember(highScoreCluster.clusterId, 'score-wins', MemberRole.SECONDARY, 0.3);
    const betterScoreCluster = manager.createCluster('Better Score');
    manager.addMember(betterScoreCluster.clusterId, 'score-wins', MemberRole.SECONDARY, 0.95);

    const merged = manager.mergeClusters(
      [secondaryCluster.clusterId, primaryCluster.clusterId, highScoreCluster.clusterId, betterScoreCluster.clusterId],
      '   ',
    );

    expect(merged).not.toBeNull();
    expect(merged?.name).toMatch(/^Merged: /);
    expect(merged?.metadata.mergedFrom).toEqual([
      secondaryCluster.clusterId,
      primaryCluster.clusterId,
      highScoreCluster.clusterId,
      betterScoreCluster.clusterId,
    ]);
    expect(merged?.getMember('primary-wins')?.role).toBe(MemberRole.PRIMARY);
    expect(merged?.getMember('shared')?.contributionScore).toBe(0.99);
    expect(merged?.getMember('score-wins')?.contributionScore).toBe(0.95);
    expect(merged?.getSessionIds().sort()).toEqual([
      'primary-only',
      'primary-wins',
      'score-wins',
      'secondary-only',
      'shared',
    ]);
  });

  it('covers small false branches for member roles, relations, and missing lookups', () => {
    const manager = new SessionClusterManager(createTempDir());
    const cluster = manager.createCluster('Edges', '', ['known-member']);

    expect(manager.updateMemberRole(cluster.clusterId, 'missing-member', MemberRole.PRIMARY)).toBe(false);
    expect(manager.removeRelation('missing-source', cluster.clusterId)).toBe(false);
    expect(manager.getRelatedClusters('missing-cluster')).toEqual([]);
  });

  it('covers fromDict defaults, snake-case aliases, and instance passthrough', () => {
    const defaultMember = ClusterMember.fromDict({});
    const defaultRelation = ClusterRelation.fromDict({});
    const member = new ClusterMember({ sessionId: 'instance-member', role: MemberRole.REFERENCE });
    const relation = new ClusterRelation({
      fromCluster: 'from',
      toCluster: 'to',
      relationType: RelationType.CONFLICTS,
    });

    expect(defaultMember).toMatchObject({
      sessionId: '',
      role: MemberRole.SECONDARY,
      contributionScore: 0.5,
      metadata: {},
    });
    expect(defaultRelation).toMatchObject({
      fromCluster: '',
      toCluster: '',
      relationType: RelationType.RELATED,
      strength: 0.5,
      metadata: {},
    });
    expect(ClusterMember.fromDict({
      session_id: 'snake-member',
      joined_at: 123,
      contribution_score: 0.75,
    })).toMatchObject({
      sessionId: 'snake-member',
      joinedAt: 123,
      contributionScore: 0.75,
    });
    expect(ClusterRelation.fromDict({
      from_cluster: 'snake-from',
      to_cluster: 'snake-to',
      relation_type: 'continues',
      created_at: 456,
    })).toMatchObject({
      fromCluster: 'snake-from',
      toCluster: 'snake-to',
      relationType: RelationType.CONTINUES,
      createdAt: 456,
    });

    const cluster = SessionCluster.fromDict({
      cluster_id: 'snake-cluster',
      members: [member],
      relations: [relation],
      created_at: 111,
      updated_at: 222,
    });

    expect(cluster).toMatchObject({
      clusterId: 'snake-cluster',
      name: '',
      description: '',
      createdAt: 111,
      updatedAt: 222,
      metadata: {},
      importance: 0.5,
      archived: false,
    });
    expect(cluster.members[0]).toBe(member);
    expect(cluster.relations[0]).toBe(relation);
  });
});
