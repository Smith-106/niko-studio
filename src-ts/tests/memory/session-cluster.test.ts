/**
 * SessionCluster Tests
 *
 * Comprehensive test coverage for cluster CRUD, member management,
 * relation management, cluster operations, and serialization.
 */

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  SessionCluster,
  SessionClusterManager,
  ClusterMember,
  ClusterRelation,
  MemberRole,
  RelationType,
} from '../../memory/session-cluster';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), 'niko-session-cluster-'));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClusterMember', () => {
  it('constructs with defaults', () => {
    const member = new ClusterMember({ sessionId: 'sess-1' });
    expect(member.sessionId).toBe('sess-1');
    expect(member.role).toBe(MemberRole.SECONDARY);
    expect(member.contributionScore).toBe(0.5);
    expect(member.metadata).toEqual({});
  });

  it('accepts all parameters', () => {
    const member = new ClusterMember({
      sessionId: 'sess-2',
      role: MemberRole.PRIMARY,
      contributionScore: 0.9,
      metadata: { tag: 'main' },
    });
    expect(member.role).toBe(MemberRole.PRIMARY);
    expect(member.contributionScore).toBe(0.9);
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new ClusterMember({
      sessionId: 'sess-3',
      role: MemberRole.REFERENCE,
      contributionScore: 0.7,
      metadata: { key: 'val' },
    });
    const dict = original.toDict();
    const restored = ClusterMember.fromDict(dict);
    expect(restored.sessionId).toBe('sess-3');
    expect(restored.role).toBe(MemberRole.REFERENCE);
    expect(restored.contributionScore).toBe(0.7);
  });

  it('handles legacy field names in fromDict', () => {
    const dict = { session_id: 'legacy-sess', role: 'primary', contribution_score: 0.8 };
    const restored = ClusterMember.fromDict(dict);
    expect(restored.sessionId).toBe('legacy-sess');
    expect(restored.role).toBe(MemberRole.PRIMARY);
    expect(restored.contributionScore).toBe(0.8);
  });
});

describe('ClusterRelation', () => {
  it('constructs with defaults', () => {
    const rel = new ClusterRelation({ fromCluster: 'c1', toCluster: 'c2' });
    expect(rel.fromCluster).toBe('c1');
    expect(rel.toCluster).toBe('c2');
    expect(rel.relationType).toBe(RelationType.RELATED);
    expect(rel.strength).toBe(0.5);
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new ClusterRelation({
      fromCluster: 'c1',
      toCluster: 'c2',
      relationType: RelationType.PARENT_CHILD,
      strength: 0.8,
      metadata: { note: 'child' },
    });
    const dict = original.toDict();
    const restored = ClusterRelation.fromDict(dict);
    expect(restored.fromCluster).toBe('c1');
    expect(restored.relationType).toBe(RelationType.PARENT_CHILD);
    expect(restored.strength).toBe(0.8);
  });
});

describe('SessionCluster', () => {
  it('constructs with all fields', () => {
    const cluster = new SessionCluster({
      clusterId: 'cl-1',
      name: 'Test Cluster',
      description: 'A test cluster',
      members: [new ClusterMember({ sessionId: 's1' })],
      relations: [],
      importance: 0.9,
      archived: false,
    });
    expect(cluster.clusterId).toBe('cl-1');
    expect(cluster.name).toBe('Test Cluster');
    expect(cluster.importance).toBe(0.9);
    expect(cluster.archived).toBe(false);
  });

  it('round-trips through toDict and fromDict', () => {
    const original = new SessionCluster({
      clusterId: 'cl-rt',
      name: 'Round Trip',
      description: 'test',
      members: [
        new ClusterMember({ sessionId: 's1', role: MemberRole.PRIMARY }),
        new ClusterMember({ sessionId: 's2', role: MemberRole.SECONDARY }),
      ],
      relations: [
        new ClusterRelation({ fromCluster: 'cl-rt', toCluster: 'cl-other', relationType: RelationType.SIBLING }),
      ],
      importance: 0.7,
    });
    const dict = original.toDict();
    const restored = SessionCluster.fromDict(dict);
    expect(restored.clusterId).toBe('cl-rt');
    expect(restored.name).toBe('Round Trip');
    expect(restored.members.length).toBe(2);
    expect(restored.relations.length).toBe(1);
    expect(restored.members[0].role).toBe(MemberRole.PRIMARY);
    expect(restored.relations[0].relationType).toBe(RelationType.SIBLING);
  });

  it('getMember returns correct member or null', () => {
    const cluster = new SessionCluster({
      clusterId: 'cl-gm',
      name: 'Test',
      members: [new ClusterMember({ sessionId: 's1' }), new ClusterMember({ sessionId: 's2' })],
    });
    expect(cluster.getMember('s1')?.sessionId).toBe('s1');
    expect(cluster.getMember('s3')).toBeNull();
  });

  it('getPrimaryMembers returns only primary members', () => {
    const cluster = new SessionCluster({
      clusterId: 'cl-pm',
      name: 'Test',
      members: [
        new ClusterMember({ sessionId: 's1', role: MemberRole.PRIMARY }),
        new ClusterMember({ sessionId: 's2', role: MemberRole.SECONDARY }),
        new ClusterMember({ sessionId: 's3', role: MemberRole.PRIMARY }),
      ],
    });
    const primaries = cluster.getPrimaryMembers();
    expect(primaries.length).toBe(2);
    expect(primaries.every((m) => m.role === MemberRole.PRIMARY)).toBe(true);
  });

  it('getSessionIds returns all session IDs', () => {
    const cluster = new SessionCluster({
      clusterId: 'cl-sids',
      name: 'Test',
      members: [
        new ClusterMember({ sessionId: 'a' }),
        new ClusterMember({ sessionId: 'b' }),
      ],
    });
    expect(cluster.getSessionIds()).toEqual(['a', 'b']);
  });
});

describe('SessionClusterManager', () => {
  let tempDir: string;
  let manager: SessionClusterManager;

  beforeEach(() => {
    tempDir = createTempDir();
    manager = new SessionClusterManager(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('createCluster', () => {
    it('creates a cluster with name and description', () => {
      const cluster = manager.createCluster('Novel Chapters', 'Chapter-related sessions');
      expect(cluster.name).toBe('Novel Chapters');
      expect(cluster.description).toBe('Chapter-related sessions');
      expect(cluster.clusterId).toBeTruthy();
      expect(cluster.members).toEqual([]);
    });

    it('creates a cluster with initial members', () => {
      const cluster = manager.createCluster('Work', '', ['sess-1', 'sess-2', 'sess-3']);
      expect(cluster.members.length).toBe(3);
      expect(cluster.members[0].role).toBe(MemberRole.PRIMARY);
      expect(cluster.members[1].role).toBe(MemberRole.SECONDARY);
      expect(cluster.members[2].role).toBe(MemberRole.SECONDARY);
    });

    it('persists cluster to disk', () => {
      const cluster = manager.createCluster('Persisted');
      const retrieved = manager.getCluster(cluster.clusterId);
      expect(retrieved).not.toBeNull();
      expect(retrieved!.name).toBe('Persisted');
    });
  });

  describe('getCluster', () => {
    it('returns null for non-existent cluster', () => {
      expect(manager.getCluster('non-existent')).toBeNull();
    });
  });

  describe('updateCluster', () => {
    it('updates cluster name and description', () => {
      const cluster = manager.createCluster('Old Name', 'Old desc');
      const updated = manager.updateCluster(cluster.clusterId, {
        name: 'New Name',
        description: 'New desc',
        importance: 0.9,
      });
      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('New Name');
      expect(updated!.description).toBe('New desc');
      expect(updated!.importance).toBe(0.9);
    });

    it('merges metadata', () => {
      const cluster = manager.createCluster('Meta', '', null, 0.5, { key1: 'val1' });
      const updated = manager.updateCluster(cluster.clusterId, {
        metadata: { key2: 'val2' },
      });
      expect(updated!.metadata).toEqual({ key1: 'val1', key2: 'val2' });
    });

    it('returns null for non-existent cluster', () => {
      expect(manager.updateCluster('missing', { name: 'X' })).toBeNull();
    });
  });

  describe('deleteCluster', () => {
    it('deletes a cluster', () => {
      const cluster = manager.createCluster('Delete Me');
      expect(manager.deleteCluster(cluster.clusterId)).toBe(true);
      expect(manager.getCluster(cluster.clusterId)).toBeNull();
    });

    it('returns false for non-existent cluster', () => {
      expect(manager.deleteCluster('non-existent')).toBe(false);
    });

    it('cleans up relations referencing deleted cluster', () => {
      const c1 = manager.createCluster('C1');
      const c2 = manager.createCluster('C2');
      manager.addRelation(c1.clusterId, c2.clusterId);
      manager.deleteCluster(c2.clusterId);
      const refreshed = manager.getCluster(c1.clusterId);
      expect(refreshed!.relations.length).toBe(0);
    });
  });

  describe('archiveCluster', () => {
    it('archives a cluster', () => {
      const cluster = manager.createCluster('Archive Me');
      expect(manager.archiveCluster(cluster.clusterId)).toBe(true);
      const archived = manager.getCluster(cluster.clusterId);
      expect(archived!.archived).toBe(true);
    });

    it('returns false for non-existent cluster', () => {
      expect(manager.archiveCluster('non-existent')).toBe(false);
    });
  });

  describe('addMember', () => {
    it('adds a member to a cluster', () => {
      const cluster = manager.createCluster('With Members');
      const member = manager.addMember(cluster.clusterId, 'sess-x', MemberRole.SECONDARY, 0.8);
      expect(member).not.toBeNull();
      expect(member!.sessionId).toBe('sess-x');
      expect(member!.role).toBe(MemberRole.SECONDARY);
      expect(member!.contributionScore).toBe(0.8);
    });

    it('returns existing member if already in cluster', () => {
      const cluster = manager.createCluster('Dup', '', ['sess-y']);
      const existing = manager.addMember(cluster.clusterId, 'sess-y');
      expect(existing).not.toBeNull();
      expect(existing!.sessionId).toBe('sess-y');
    });

    it('returns null for non-existent cluster', () => {
      expect(manager.addMember('missing', 'sess-x')).toBeNull();
    });
  });

  describe('removeMember', () => {
    it('removes a member from cluster', () => {
      const cluster = manager.createCluster('Rm', '', ['sess-z']);
      expect(manager.removeMember(cluster.clusterId, 'sess-z')).toBe(true);
      expect(manager.getCluster(cluster.clusterId)!.members.length).toBe(0);
    });

    it('returns false when member not in cluster', () => {
      const cluster = manager.createCluster('Rm2');
      expect(manager.removeMember(cluster.clusterId, 'not-here')).toBe(false);
    });

    it('returns false for non-existent cluster', () => {
      expect(manager.removeMember('missing', 'sess')).toBe(false);
    });
  });

  describe('updateMemberRole', () => {
    it('updates member role', () => {
      const cluster = manager.createCluster('Role', '', ['sess-r']);
      expect(manager.updateMemberRole(cluster.clusterId, 'sess-r', MemberRole.REFERENCE)).toBe(true);
      expect(manager.getCluster(cluster.clusterId)!.getMember('sess-r')!.role).toBe(MemberRole.REFERENCE);
    });

    it('returns false for non-existent cluster or member', () => {
      expect(manager.updateMemberRole('missing', 'sess', MemberRole.PRIMARY)).toBe(false);
    });
  });

  describe('addRelation / removeRelation', () => {
    it('adds a relation between clusters', () => {
      const c1 = manager.createCluster('Parent');
      const c2 = manager.createCluster('Child');
      const rel = manager.addRelation(c1.clusterId, c2.clusterId, RelationType.PARENT_CHILD, 0.8);
      expect(rel).not.toBeNull();
      expect(rel!.relationType).toBe(RelationType.PARENT_CHILD);
      expect(rel!.strength).toBe(0.8);
    });

    it('returns existing relation if duplicate', () => {
      const c1 = manager.createCluster('A');
      const c2 = manager.createCluster('B');
      const r1 = manager.addRelation(c1.clusterId, c2.clusterId);
      const r2 = manager.addRelation(c1.clusterId, c2.clusterId);
      expect(r1).toBe(r2);
    });

    it('returns null if either cluster missing', () => {
      const c1 = manager.createCluster('Only');
      expect(manager.addRelation(c1.clusterId, 'missing')).toBeNull();
      expect(manager.addRelation('missing', c1.clusterId)).toBeNull();
    });

    it('removes a relation', () => {
      const c1 = manager.createCluster('X');
      const c2 = manager.createCluster('Y');
      manager.addRelation(c1.clusterId, c2.clusterId);
      expect(manager.removeRelation(c1.clusterId, c2.clusterId)).toBe(true);
      expect(manager.getCluster(c1.clusterId)!.relations.length).toBe(0);
    });

    it('removeRelation returns false if relation not found', () => {
      const c1 = manager.createCluster('Z');
      expect(manager.removeRelation(c1.clusterId, 'missing')).toBe(false);
    });
  });

  describe('getRelatedClusters', () => {
    it('returns related clusters filtered by type', () => {
      const c1 = manager.createCluster('Hub');
      const c2 = manager.createCluster('Sibling');
      const c3 = manager.createCluster('Child');
      manager.addRelation(c1.clusterId, c2.clusterId, RelationType.SIBLING);
      manager.addRelation(c1.clusterId, c3.clusterId, RelationType.PARENT_CHILD);

      const siblings = manager.getRelatedClusters(c1.clusterId, RelationType.SIBLING);
      expect(siblings.length).toBe(1);
      expect(siblings[0].clusterId).toBe(c2.clusterId);

      const allRelated = manager.getRelatedClusters(c1.clusterId);
      expect(allRelated.length).toBe(2);
    });
  });

  describe('mergeClusters', () => {
    it('merges two clusters into one', () => {
      const c1 = manager.createCluster('Part A', '', ['s1', 's2']);
      const c2 = manager.createCluster('Part B', '', ['s3', 's4']);
      const merged = manager.mergeClusters([c1.clusterId, c2.clusterId], 'Merged');
      expect(merged).not.toBeNull();
      expect(merged!.name).toBe('Merged');
      expect(merged!.members.length).toBe(4);
      // Original clusters should be deleted
      expect(manager.getCluster(c1.clusterId)).toBeNull();
      expect(manager.getCluster(c2.clusterId)).toBeNull();
    });

    it('requires at least 2 clusters', () => {
      expect(manager.mergeClusters(['single-id'], 'Merged')).toBeNull();
    });

    it('preserves external relations', () => {
      const c1 = manager.createCluster('M1', '', ['s1']);
      const c2 = manager.createCluster('M2', '', ['s2']);
      const c3 = manager.createCluster('External');
      manager.addRelation(c1.clusterId, c3.clusterId);
      manager.addRelation(c2.clusterId, c3.clusterId);
      const merged = manager.mergeClusters([c1.clusterId, c2.clusterId], 'Combined');
      expect(merged!.relations.length).toBe(1);
    });

    it('uses max importance of merged clusters', () => {
      const c1 = manager.createCluster('Low', '', null, 0.3);
      const c2 = manager.createCluster('High', '', null, 0.9);
      const merged = manager.mergeClusters([c1.clusterId, c2.clusterId], 'Max');
      expect(merged!.importance).toBe(0.9);
    });
  });

  describe('getClustersForSession', () => {
    it('returns clusters containing a session', () => {
      const c1 = manager.createCluster('Contains', '', ['sess-lookup']);
      const c2 = manager.createCluster('Also Contains', '', ['sess-lookup']);
      const results = manager.getClustersForSession('sess-lookup');
      expect(results.length).toBe(2);
    });

    it('returns empty for session not in any cluster', () => {
      expect(manager.getClustersForSession('no-such-session')).toEqual([]);
    });
  });

  describe('listClusters', () => {
    it('lists all non-archived clusters', () => {
      manager.createCluster('Active 1');
      manager.createCluster('Active 2');
      const c3 = manager.createCluster('Archived');
      manager.archiveCluster(c3.clusterId);

      const list = manager.listClusters(false);
      expect(list.length).toBe(2);
    });

    it('includes archived when includeArchived=true', () => {
      manager.createCluster('A1');
      const archived = manager.createCluster('A2');
      manager.archiveCluster(archived.clusterId);

      const list = manager.listClusters(true);
      expect(list.length).toBe(2);
    });

    it('respects limit', () => {
      manager.createCluster('L1');
      manager.createCluster('L2');
      manager.createCluster('L3');
      const list = manager.listClusters(false, 2);
      expect(list.length).toBe(2);
    });
  });

  describe('searchClusters', () => {
    it('finds clusters by name match', () => {
      manager.createCluster('Novel Writing Sessions', 'about novels');
      const results = manager.searchClusters('Novel');
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Novel Writing Sessions');
    });

    it('finds clusters by description match', () => {
      manager.createCluster('Sessions', 'about dragons and magic');
      const results = manager.searchClusters('dragons');
      expect(results.length).toBe(1);
    });

    it('returns empty for no matches', () => {
      manager.createCluster('ABC');
      expect(manager.searchClusters('xyz')).toEqual([]);
    });

    it('skips archived clusters', () => {
      const c = manager.createCluster('Searchable');
      manager.archiveCluster(c.clusterId);
      expect(manager.searchClusters('Searchable')).toEqual([]);
    });

    it('ranks name matches higher than description matches', () => {
      manager.createCluster('Dragon Story', 'about knights');
      manager.createCluster('Knight Story', 'about dragons');
      const results = manager.searchClusters('Dragon');
      // Both match, but name match should rank first
      expect(results[0].name).toBe('Dragon Story');
    });
  });

  describe('stats', () => {
    it('returns correct statistics', () => {
      const c1 = manager.createCluster('Stat 1', '', ['s1']);
      const c2 = manager.createCluster('Stat 2', '', ['s2', 's3']);
      manager.archiveCluster(c1.clusterId);
      manager.addRelation(c2.clusterId, 'nonexistent'); // will return null but not error

      const stats = manager.stats();
      expect(stats.totalClusters).toBe(2);
      expect(stats.activeClusters).toBe(1);
      expect(stats.archivedClusters).toBe(1);
      expect(stats.uniqueSessions).toBe(3);
    });
  });
});
