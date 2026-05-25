/**
 * SessionCluster - Session Clustering Management
 *
 * Implements session clustering:
 * 1. SessionCluster: Cluster container for managing related session groups
 * 2. ClusterMember: Cluster member recording a session's role in the cluster
 * 3. ClusterRelation: Cluster relation describing links between clusters
 *
 * Integrates with CoreMemoryStore for semantic similarity-based auto-clustering.
 */

import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import { createLogger } from "../logger/index.js";

const _log = createLogger("session-cluster");

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

/** Cluster member roles. */
export enum MemberRole {
  PRIMARY = "primary",
  SECONDARY = "secondary",
  REFERENCE = "reference",
}

/** Cluster relation types. */
export enum RelationType {
  PARENT_CHILD = "parent_child",
  SIBLING = "sibling",
  RELATED = "related",
  CONTINUES = "continues",
  CONFLICTS = "conflicts",
}

// ---------------------------------------------------------------------------
// ClusterMember
// ---------------------------------------------------------------------------

export class ClusterMember {
  sessionId: string;
  role: MemberRole;
  joinedAt: number;
  contributionScore: number;
  metadata: Record<string, unknown>;

  constructor(params: {
    sessionId: string;
    role?: MemberRole;
    joinedAt?: number;
    contributionScore?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.sessionId = params.sessionId;
    this.role = params.role ?? MemberRole.SECONDARY;
    this.joinedAt = params.joinedAt ?? Date.now() / 1000;
    this.contributionScore = params.contributionScore ?? 0.5;
    this.metadata = params.metadata ?? {};
  }

  toDict(): Record<string, unknown> {
    return {
      sessionId: this.sessionId,
      role: this.role,
      joinedAt: this.joinedAt,
      contributionScore: this.contributionScore,
      metadata: this.metadata,
    };
  }

  static fromDict(data: Record<string, any>): ClusterMember {
    const rawRole = data.role ?? data.role ?? "secondary";
    const role = typeof rawRole === "string" ? (rawRole as MemberRole) : rawRole;

    return new ClusterMember({
      sessionId: data.sessionId ?? data.session_id ?? "",
      role,
      joinedAt: data.joinedAt ?? data.joined_at ?? Date.now() / 1000,
      contributionScore: data.contributionScore ?? data.contribution_score ?? 0.5,
      metadata: data.metadata ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// ClusterRelation
// ---------------------------------------------------------------------------

export class ClusterRelation {
  fromCluster: string;
  toCluster: string;
  relationType: RelationType;
  strength: number;
  createdAt: number;
  metadata: Record<string, unknown>;

  constructor(params: {
    fromCluster: string;
    toCluster: string;
    relationType?: RelationType;
    strength?: number;
    createdAt?: number;
    metadata?: Record<string, unknown>;
  }) {
    this.fromCluster = params.fromCluster;
    this.toCluster = params.toCluster;
    this.relationType = params.relationType ?? RelationType.RELATED;
    this.strength = params.strength ?? 0.5;
    this.createdAt = params.createdAt ?? Date.now() / 1000;
    this.metadata = params.metadata ?? {};
  }

  toDict(): Record<string, unknown> {
    return {
      fromCluster: this.fromCluster,
      toCluster: this.toCluster,
      relationType: this.relationType,
      strength: this.strength,
      createdAt: this.createdAt,
      metadata: this.metadata,
    };
  }

  static fromDict(data: Record<string, any>): ClusterRelation {
    const rawRel = data.relationType ?? data.relation_type ?? "related";
    const relationType = typeof rawRel === "string" ? (rawRel as RelationType) : rawRel;

    return new ClusterRelation({
      fromCluster: data.fromCluster ?? data.from_cluster ?? "",
      toCluster: data.toCluster ?? data.to_cluster ?? "",
      relationType,
      strength: data.strength ?? 0.5,
      createdAt: data.createdAt ?? data.created_at ?? Date.now() / 1000,
      metadata: data.metadata ?? {},
    });
  }
}

// ---------------------------------------------------------------------------
// SessionCluster
// ---------------------------------------------------------------------------

export class SessionCluster {
  clusterId: string;
  name: string;
  description: string;
  members: ClusterMember[];
  relations: ClusterRelation[];
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
  importance: number;
  archived: boolean;

  constructor(params: {
    clusterId: string;
    name: string;
    description?: string;
    members?: ClusterMember[];
    relations?: ClusterRelation[];
    createdAt?: number;
    updatedAt?: number;
    metadata?: Record<string, unknown>;
    importance?: number;
    archived?: boolean;
  }) {
    this.clusterId = params.clusterId;
    this.name = params.name;
    this.description = params.description ?? "";
    this.members = params.members ?? [];
    this.relations = params.relations ?? [];
    this.createdAt = params.createdAt ?? Date.now() / 1000;
    this.updatedAt = params.updatedAt ?? Date.now() / 1000;
    this.metadata = params.metadata ?? {};
    this.importance = params.importance ?? 0.5;
    this.archived = params.archived ?? false;
  }

  toDict(): Record<string, unknown> {
    return {
      clusterId: this.clusterId,
      name: this.name,
      description: this.description,
      members: this.members.map((m) => m.toDict()),
      relations: this.relations.map((r) => r.toDict()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      metadata: this.metadata,
      importance: this.importance,
      archived: this.archived,
    };
  }

  static fromDict(data: Record<string, any>): SessionCluster {
    const members = (data.members ?? []).map((m: any) =>
      m instanceof ClusterMember ? m : ClusterMember.fromDict(m),
    );
    const relations = (data.relations ?? []).map((r: any) =>
      r instanceof ClusterRelation ? r : ClusterRelation.fromDict(r),
    );

    return new SessionCluster({
      clusterId: data.clusterId ?? data.cluster_id ?? "",
      name: data.name ?? "",
      description: data.description ?? "",
      members,
      relations,
      createdAt: data.createdAt ?? data.created_at ?? Date.now() / 1000,
      updatedAt: data.updatedAt ?? data.updated_at ?? Date.now() / 1000,
      metadata: data.metadata ?? {},
      importance: data.importance ?? 0.5,
      archived: data.archived ?? false,
    });
  }

  /** Get member by session ID. */
  getMember(sessionId: string): ClusterMember | null {
    for (const member of this.members) {
      if (member.sessionId === sessionId) return member;
    }
    return null;
  }

  /** Get all primary members. */
  getPrimaryMembers(): ClusterMember[] {
    return this.members.filter((m) => m.role === MemberRole.PRIMARY);
  }

  /** Get all session IDs in cluster. */
  getSessionIds(): string[] {
    return this.members.map((m) => m.sessionId);
  }
}

// ---------------------------------------------------------------------------
// CoreMemoryStore-like type for semantic operations
// ---------------------------------------------------------------------------

export type CoreMemoryStoreLike = {
  search?(query: string, topK?: number): Array<{ id: string; score: number }>;
  [key: string]: unknown;
} | null;

// ---------------------------------------------------------------------------
// SessionClusterManager
// ---------------------------------------------------------------------------

export class SessionClusterManager {
  storagePath: string;
  coreMemoryStore: CoreMemoryStoreLike;
  private _clusters: Map<string, SessionCluster>;
  private _sessionToClusters: Map<string, Set<string>>;

  constructor(
    storagePath: string = ".writing/clusters",
    coreMemoryStore: CoreMemoryStoreLike = null,
  ) {
    this.storagePath = storagePath;
    this.coreMemoryStore = coreMemoryStore;
    this._clusters = new Map();
    this._sessionToClusters = new Map();

    this._ensureStorage();
    this._loadClusters();
  }

  private _ensureStorage(): void {
    fs.mkdirSync(this.storagePath, { recursive: true });
  }

  private _loadClusters(): void {
    const indexPath = path.join(this.storagePath, "index.json");
    if (!fs.existsSync(indexPath)) return;

    try {
      const index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
      for (const clusterId of index.clusters ?? []) {
        const clusterFile = path.join(this.storagePath, `${clusterId}.json`);
        if (fs.existsSync(clusterFile)) {
          const data = JSON.parse(fs.readFileSync(clusterFile, "utf-8"));
          const cluster = SessionCluster.fromDict(data);
          this._clusters.set(clusterId, cluster);

          // Build session index
          for (const member of cluster.members) {
            if (!this._sessionToClusters.has(member.sessionId)) {
              this._sessionToClusters.set(member.sessionId, new Set());
            }
            this._sessionToClusters.get(member.sessionId)!.add(clusterId);
          }
        }
      }
      _log.info(`Loaded ${this._clusters.size} clusters`);
    } catch (e) {
      _log.error(`Failed to load clusters: ${e}`);
    }
  }

  private _saveCluster(cluster: SessionCluster): void {
    const clusterFile = path.join(this.storagePath, `${cluster.clusterId}.json`);
    fs.writeFileSync(clusterFile, JSON.stringify(cluster.toDict(), null, 2), "utf-8");
    this._saveIndex();
  }

  private _saveIndex(): void {
    const index = {
      clusters: Array.from(this._clusters.keys()),
      updatedAt: Date.now() / 1000,
    };
    const indexPath = path.join(this.storagePath, "index.json");
    fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), "utf-8");
  }

  private _generateId(): string {
    const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, "").substring(0, 14);
    const unique = randomUUID().replace(/-/g, "").substring(0, 8);
    return `cluster-${timestamp}-${unique}`;
  }

  // ========== Cluster CRUD ==========

  /**
   * Create a new cluster.
   */
  createCluster(
    name: string,
    description: string = "",
    initialMembers: string[] | null = null,
    importance: number = 0.5,
    metadata: Record<string, unknown> | null = null,
  ): SessionCluster {
    const clusterId = this._generateId();
    const now = Date.now() / 1000;

    const cluster = new SessionCluster({
      clusterId,
      name,
      description,
      members: [],
      relations: [],
      createdAt: now,
      updatedAt: now,
      metadata: metadata ?? {},
      importance,
    });

    // Add initial members
    if (initialMembers) {
      for (let i = 0; i < initialMembers.length; i++) {
        const sessionId = initialMembers[i];
        const role = i === 0 ? MemberRole.PRIMARY : MemberRole.SECONDARY;
        const member = new ClusterMember({ sessionId, role, joinedAt: now });
        cluster.members.push(member);

        if (!this._sessionToClusters.has(sessionId)) {
          this._sessionToClusters.set(sessionId, new Set());
        }
        this._sessionToClusters.get(sessionId)!.add(clusterId);
      }
    }

    this._clusters.set(clusterId, cluster);
    this._saveCluster(cluster);

    _log.info(`Created cluster: ${clusterId} (${name})`);
    return cluster;
  }

  /**
   * Get cluster by ID.
   */
  getCluster(clusterId: string): SessionCluster | null {
    return this._clusters.get(clusterId) ?? null;
  }

  /**
   * Update cluster properties.
   */
  updateCluster(
    clusterId: string,
    updates: {
      name?: string;
      description?: string;
      importance?: number;
      metadata?: Record<string, unknown>;
    },
  ): SessionCluster | null {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return null;

    if (updates.name !== undefined) cluster.name = updates.name;
    if (updates.description !== undefined) cluster.description = updates.description;
    if (updates.importance !== undefined) cluster.importance = updates.importance;
    if (updates.metadata) {
      cluster.metadata = { ...cluster.metadata, ...updates.metadata };
    }

    cluster.updatedAt = Date.now() / 1000;
    this._saveCluster(cluster);

    _log.info(`Updated cluster: ${clusterId}`);
    return cluster;
  }

  /**
   * Delete a cluster.
   */
  deleteCluster(clusterId: string): boolean {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return false;

    // Remove from session index
    for (const member of cluster.members) {
      const set = this._sessionToClusters.get(member.sessionId);
      if (set) set.delete(clusterId);
    }

    // Remove relations referencing this cluster
    for (const otherCluster of this._clusters.values()) {
      otherCluster.relations = otherCluster.relations.filter(
        (r) => r.fromCluster !== clusterId && r.toCluster !== clusterId,
      );
    }

    // Delete from storage
    const clusterFile = path.join(this.storagePath, `${clusterId}.json`);
    if (fs.existsSync(clusterFile)) fs.unlinkSync(clusterFile);

    this._clusters.delete(clusterId);
    this._saveIndex();

    _log.info(`Deleted cluster: ${clusterId}`);
    return true;
  }

  /**
   * Archive a cluster (soft delete).
   */
  archiveCluster(clusterId: string): boolean {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return false;

    cluster.archived = true;
    cluster.updatedAt = Date.now() / 1000;
    this._saveCluster(cluster);

    _log.info(`Archived cluster: ${clusterId}`);
    return true;
  }

  // ========== Member Management ==========

  /**
   * Add a member to cluster.
   */
  addMember(
    clusterId: string,
    sessionId: string,
    role: MemberRole = MemberRole.SECONDARY,
    contributionScore: number = 0.5,
    metadata: Record<string, unknown> | null = null,
  ): ClusterMember | null {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return null;

    // Check if already member
    const existing = cluster.getMember(sessionId);
    if (existing) {
      _log.warn(`Session ${sessionId} already in cluster ${clusterId}`);
      return existing;
    }

    const member = new ClusterMember({
      sessionId,
      role,
      joinedAt: Date.now() / 1000,
      contributionScore,
      metadata: metadata ?? {},
    });

    cluster.members.push(member);
    cluster.updatedAt = Date.now() / 1000;

    if (!this._sessionToClusters.has(sessionId)) {
      this._sessionToClusters.set(sessionId, new Set());
    }
    this._sessionToClusters.get(sessionId)!.add(clusterId);

    this._saveCluster(cluster);

    _log.info(`Added member ${sessionId} to cluster ${clusterId}`);
    return member;
  }

  /**
   * Remove a member from cluster.
   */
  removeMember(clusterId: string, sessionId: string): boolean {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return false;

    const originalCount = cluster.members.length;
    cluster.members = cluster.members.filter((m) => m.sessionId !== sessionId);

    if (cluster.members.length === originalCount) return false;

    cluster.updatedAt = Date.now() / 1000;

    const set = this._sessionToClusters.get(sessionId);
    if (set) set.delete(clusterId);

    this._saveCluster(cluster);

    _log.info(`Removed member ${sessionId} from cluster ${clusterId}`);
    return true;
  }

  /**
   * Update member role.
   */
  updateMemberRole(clusterId: string, sessionId: string, role: MemberRole): boolean {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return false;

    const member = cluster.getMember(sessionId);
    if (!member) return false;

    member.role = role;
    cluster.updatedAt = Date.now() / 1000;
    this._saveCluster(cluster);

    _log.info(`Updated role for ${sessionId} in ${clusterId} to ${role}`);
    return true;
  }

  // ========== Relation Management ==========

  /**
   * Add relation between clusters.
   */
  addRelation(
    fromCluster: string,
    toCluster: string,
    relationType: RelationType = RelationType.RELATED,
    strength: number = 0.5,
    metadata: Record<string, unknown> | null = null,
  ): ClusterRelation | null {
    const source = this._clusters.get(fromCluster);
    const target = this._clusters.get(toCluster);

    if (!source || !target) return null;

    // Check for existing relation
    for (const rel of source.relations) {
      if (rel.toCluster === toCluster) {
        _log.warn(`Relation already exists: ${fromCluster} -> ${toCluster}`);
        return rel;
      }
    }

    const relation = new ClusterRelation({
      fromCluster,
      toCluster,
      relationType,
      strength,
      createdAt: Date.now() / 1000,
      metadata: metadata ?? {},
    });

    source.relations.push(relation);
    source.updatedAt = Date.now() / 1000;
    this._saveCluster(source);

    _log.info(`Added relation: ${fromCluster} -> ${toCluster} (${relationType})`);
    return relation;
  }

  /**
   * Remove relation between clusters.
   */
  removeRelation(fromCluster: string, toCluster: string): boolean {
    const source = this._clusters.get(fromCluster);
    if (!source) return false;

    const originalCount = source.relations.length;
    source.relations = source.relations.filter((r) => r.toCluster !== toCluster);

    if (source.relations.length === originalCount) return false;

    source.updatedAt = Date.now() / 1000;
    this._saveCluster(source);

    _log.info(`Removed relation: ${fromCluster} -> ${toCluster}`);
    return true;
  }

  /**
   * Get clusters related to given cluster.
   */
  getRelatedClusters(
    clusterId: string,
    relationType?: RelationType | null,
  ): SessionCluster[] {
    const cluster = this._clusters.get(clusterId);
    if (!cluster) return [];

    const related: SessionCluster[] = [];
    for (const relation of cluster.relations) {
      if (relationType && relation.relationType !== relationType) continue;
      const target = this._clusters.get(relation.toCluster);
      if (target) related.push(target);
    }

    return related;
  }

  // ========== Cluster Operations ==========

  /**
   * Merge multiple clusters into one.
   */
  mergeClusters(
    clusterIds: string[],
    newName: string,
    newDescription: string = "",
  ): SessionCluster | null {
    if (clusterIds.length < 2) {
      _log.warn("Need at least 2 clusters to merge");
      return null;
    }

    const clusters: SessionCluster[] = [];
    for (const cid of clusterIds) {
      const cluster = this._clusters.get(cid);
      if (cluster) clusters.push(cluster);
    }

    if (clusters.length < 2) {
      _log.warn("Not enough valid clusters to merge");
      return null;
    }

    // Collect all members (deduplicated)
    const allMembers = new Map<string, ClusterMember>();
    for (const cluster of clusters) {
      for (const member of cluster.members) {
        const existing = allMembers.get(member.sessionId);
        if (!existing) {
          allMembers.set(member.sessionId, member);
        } else {
          // Keep higher role
          if (member.role === MemberRole.PRIMARY) {
            allMembers.set(member.sessionId, member);
          } else if (member.contributionScore > existing.contributionScore) {
            allMembers.set(member.sessionId, member);
          }
        }
      }
    }

    // Collect all external relations
    const allRelations: ClusterRelation[] = [];
    const mergedIdSet = new Set(clusterIds);
    for (const cluster of clusters) {
      for (const relation of cluster.relations) {
        if (!mergedIdSet.has(relation.toCluster)) {
          allRelations.push(relation);
        }
      }
    }

    // Calculate importance (max of merged)
    const importance = Math.max(...clusters.map((c) => c.importance));

    // Merge metadata
    const mergedMetadata: Record<string, unknown> = {};
    for (const cluster of clusters) {
      Object.assign(mergedMetadata, cluster.metadata);
    }
    mergedMetadata.mergedFrom = clusterIds;

    // Create new cluster
    let resolvedName = typeof newName === "string" ? newName.trim() : "";
    if (!resolvedName) {
      const clusterNames = clusters.map((c) => c.name).filter((n) => n);
      resolvedName = clusterNames.length > 0 ? `Merged: ${clusterNames.join(" + ")}` : "Merged";
    }

    const newCluster = this.createCluster(resolvedName, newDescription, undefined, importance, mergedMetadata);

    // Add all members
    for (const member of allMembers.values()) {
      this.addMember(newCluster.clusterId, member.sessionId, member.role, member.contributionScore, member.metadata);
    }

    // Add all external relations
    for (const relation of allRelations) {
      this.addRelation(newCluster.clusterId, relation.toCluster, relation.relationType, relation.strength, relation.metadata);
    }

    // Delete old clusters
    for (const cid of clusterIds) {
      this.deleteCluster(cid);
    }

    _log.info(`Merged ${clusters.length} clusters into ${newCluster.clusterId}`);
    return newCluster;
  }

  /**
   * Get all clusters containing a session.
   */
  getClustersForSession(sessionId: string): SessionCluster[] {
    const clusterIds = this._sessionToClusters.get(sessionId);
    if (!clusterIds) return [];

    const results: SessionCluster[] = [];
    for (const cid of clusterIds) {
      const cluster = this._clusters.get(cid);
      if (cluster) results.push(cluster);
    }
    return results;
  }

  /**
   * List all clusters.
   */
  listClusters(includeArchived: boolean = false, limit: number = 100): SessionCluster[] {
    const clusters: SessionCluster[] = [];
    for (const cluster of this._clusters.values()) {
      if (!includeArchived && cluster.archived) continue;
      clusters.push(cluster);
      if (clusters.length >= limit) break;
    }

    clusters.sort((a, b) => b.updatedAt - a.updatedAt);
    return clusters;
  }

  /**
   * Search clusters by name/description.
   */
  searchClusters(query: string, topK: number = 5): SessionCluster[] {
    const queryLower = query.toLowerCase();
    const matches: Array<{ cluster: SessionCluster; score: number }> = [];

    for (const cluster of this._clusters.values()) {
      if (cluster.archived) continue;

      let score = 0;
      if (cluster.name.toLowerCase().includes(queryLower)) score += 2;
      if (cluster.description.toLowerCase().includes(queryLower)) score += 1;

      if (score > 0) matches.push({ cluster, score });
    }

    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, topK).map((m) => m.cluster);
  }

  /** Get cluster statistics. */
  stats(): Record<string, unknown> {
    const activeClusters = Array.from(this._clusters.values()).filter((c) => !c.archived);
    const totalMembers = activeClusters.reduce((sum, c) => sum + c.members.length, 0);
    const totalRelations = activeClusters.reduce((sum, c) => sum + c.relations.length, 0);

    return {
      totalClusters: this._clusters.size,
      activeClusters: activeClusters.length,
      archivedClusters: this._clusters.size - activeClusters.length,
      totalMembers,
      totalRelations,
      uniqueSessions: this._sessionToClusters.size,
    };
  }
}
