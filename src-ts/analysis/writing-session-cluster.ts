/**
 * WritingSessionCluster - Cluster writing sessions by multi-dimensional similarity
 *
 * Adapted from CCW SessionClusteringService's 5-dimension similarity,
 * specialized for writing sessions (chapters, scenes, character arcs).
 *
 * Five similarity dimensions (writing-specialized):
 * - Character overlap (0.25): shared character entities
 * - Theme overlap (0.20): keyword Jaccard similarity
 * - Temporal proximity (0.15): chapter order proximity
 * - Plot connectivity (0.25): BFS distance in relation graph
 * - Style similarity (0.15): writing feature vector comparison
 *
 * Uses SQLite for persistent cluster storage (extends Phase 1 schema).
 *
 * @module analysis/writing-session-cluster
 */

import Database from 'better-sqlite3'
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

// ============================================================
// Types
// ============================================================

export type SessionType = 'chapter' | 'scene' | 'character_arc'

export interface WritingSession {
  id: string
  type: SessionType
  /** Character names mentioned */
  characters: string[]
  /** Thematic keywords */
  keywords: string[]
  /** Temporal order (chapter number, scene sequence) */
  order: number
  /** Related entity IDs via graph relations */
  relatedEntities: string[]
  /** Style feature vector (normalized 0-1 values) */
  styleVector: number[]
}

export interface SessionCluster {
  id: string
  name: string
  description: string | null
  intent: string | null
  status: 'active' | 'archived' | 'merged'
  createdAt: string
  updatedAt: string
  members: ClusterMember[]
}

export interface ClusterMember {
  clusterId: string
  sessionId: string
  sessionType: SessionType
  relevanceScore: number
  addedAt: string
}

export interface ClusterConfig {
  /** Per-dimension weights (must sum to 1.0) */
  weights: {
    character: number
    theme: number
    temporal: number
    plot: number
    style: number
  }
  /** Similarity threshold for same-cluster decision (default: 0.6) */
  similarityThreshold: number
  /** Maximum BFS depth for plot connectivity (default: 3) */
  maxPlotDepth: number
}

// ============================================================
// Default config
// ============================================================

const DEFAULT_CONFIG: ClusterConfig = {
  weights: {
    character: 0.25,
    theme: 0.20,
    temporal: 0.15,
    plot: 0.25,
    style: 0.15,
  },
  similarityThreshold: 0.6,
  maxPlotDepth: 3,
}

// ============================================================
// WritingSessionCluster
// ============================================================

export class WritingSessionCluster {
  private readonly db: Database.Database
  private readonly config: ClusterConfig

  constructor(dbPath?: string, config?: Partial<ClusterConfig>) {
    const resolvedPath = dbPath ?? join(homedir(), '.niko', 'writing_clusters.db')
    const dir = dirname(resolvedPath)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    this.db = new Database(resolvedPath)
    this.db.pragma('journal_mode = WAL')
    this.db.pragma('synchronous = NORMAL')
    this.config = { ...DEFAULT_CONFIG, ...config, weights: { ...DEFAULT_CONFIG.weights, ...config?.weights } }

    this._initSchema()
  }

  // ---------- Schema ----------

  private _initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_clusters (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        intent TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS cluster_members (
        cluster_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        session_type TEXT NOT NULL,
        relevance_score REAL DEFAULT 1.0,
        added_at TEXT NOT NULL,
        PRIMARY KEY (cluster_id, session_id),
        FOREIGN KEY (cluster_id) REFERENCES session_clusters(id)
      );
      CREATE INDEX IF NOT EXISTS idx_members_session ON cluster_members(session_id);
      CREATE INDEX IF NOT EXISTS idx_members_type ON cluster_members(session_type);
    `)
  }

  // ---------- Clustering ----------

  /**
   * Cluster a batch of writing sessions into groups.
   * Uses hierarchical agglomerative clustering with the 5-dim similarity.
   */
  clusterSessions(sessions: WritingSession[]): SessionCluster[] {
    if (sessions.length === 0) return []

    // Build similarity matrix
    const n = sessions.length
    const simMatrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0))

    for (let i = 0; i < n; i++) {
      simMatrix[i][i] = 1.0
      for (let j = i + 1; j < n; j++) {
        const sim = this.computeSimilarity(sessions[i], sessions[j])
        simMatrix[i][j] = sim
        simMatrix[j][i] = sim
      }
    }

    // Hierarchical agglomerative clustering (simple single-linkage)
    const clusterAssignments = this.hierarchicalCluster(simMatrix, n)

    // Build cluster objects and persist
    const clusters: SessionCluster[] = []
    const now = new Date().toISOString()

    for (const memberIndices of Object.values(clusterAssignments)) {
      const clusterId = randomUUID()
      const members = memberIndices.map((idx) => sessions[idx])

      // Generate cluster name from common themes
      const clusterName = this.generateClusterName(members)

      // Compute average relevance score
      const avgRelevance = memberIndices.length > 1
        ? memberIndices.reduce((sum, i) => {
            const sims = memberIndices
              .filter((j) => j !== i)
              .map((j) => simMatrix[i][j])
            return sum + (sims.length > 0 ? sims.reduce((a, b) => a + b, 0) / sims.length : 1.0)
          }, 0) / memberIndices.length
        : 1.0

      // Persist cluster
      const transaction = this.db.transaction(() => {
        this.db.prepare(`
          INSERT INTO session_clusters (id, name, description, intent, status, created_at, updated_at)
          VALUES (?, ?, ?, NULL, 'active', ?, ?)
        `).run(clusterId, clusterName, this.generateDescription(members), now, now)

        const insertMember = this.db.prepare(`
          INSERT OR IGNORE INTO cluster_members (cluster_id, session_id, session_type, relevance_score, added_at)
          VALUES (?, ?, ?, ?, ?)
        `)

        for (let k = 0; k < memberIndices.length; k++) {
          const session = sessions[memberIndices[k]]
          const score = k === 0 ? 1.0 : avgRelevance
          insertMember.run(clusterId, session.id, session.type, score, now)
        }
      })
      transaction()

      clusters.push({
        id: clusterId,
        name: clusterName,
        description: this.generateDescription(members),
        intent: null,
        status: 'active',
        createdAt: now,
        updatedAt: now,
        members: memberIndices.map((idx, k) => ({
          clusterId,
          sessionId: sessions[idx].id,
          sessionType: sessions[idx].type,
          relevanceScore: k === 0 ? 1.0 : avgRelevance,
          addedAt: now,
        })),
      })
    }

    return clusters.sort((a, b) => b.members.length - a.members.length)
  }

  /**
   * Incrementally assign a new session to the best existing cluster,
   * or create a new cluster if similarity is below threshold.
   */
  assignToCluster(session: WritingSession, existingSessions: WritingSession[]): {
    clusterId: string
    isNewCluster: boolean
    similarity: number
  } {
    // Load existing active clusters
    const activeClusters = this.db.prepare(
      "SELECT id, name FROM session_clusters WHERE status = 'active'"
    ).all() as Array<{ id: string; name: string }>

    let bestClusterId = ''
    let bestSim = 0

    for (const cluster of activeClusters) {
      // Get member sessions for this cluster
      const memberRows = this.db.prepare(
        "SELECT session_id FROM cluster_members WHERE cluster_id = ?"
      ).all(cluster.id) as Array<{ session_id: string }>

      const memberIds = new Set(memberRows.map((r) => r.session_id))
      const clusterSessions = existingSessions.filter((s) => memberIds.has(s.id))

      // Compute max similarity to any member
      let maxSim = 0
      for (const member of clusterSessions) {
        const sim = this.computeSimilarity(session, member)
        maxSim = Math.max(maxSim, sim)
      }

      if (maxSim > bestSim) {
        bestSim = maxSim
        bestClusterId = cluster.id
      }
    }

    if (bestSim >= this.config.similarityThreshold && bestClusterId) {
      // Assign to existing cluster
      const now = new Date().toISOString()
      this.db.prepare(`
        INSERT OR IGNORE INTO cluster_members (cluster_id, session_id, session_type, relevance_score, added_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(bestClusterId, session.id, session.type, bestSim, now)

      return { clusterId: bestClusterId, isNewCluster: false, similarity: bestSim }
    }

    // Create new cluster
    const newClusterId = randomUUID()
    const now = new Date().toISOString()

    this.db.transaction(() => {
      this.db.prepare(`
        INSERT INTO session_clusters (id, name, description, intent, status, created_at, updated_at)
        VALUES (?, ?, NULL, NULL, 'active', ?, ?)
      `).run(newClusterId, `${session.type}: ${session.id}`, now, now)

      this.db.prepare(`
        INSERT INTO cluster_members (cluster_id, session_id, session_type, relevance_score, added_at)
        VALUES (?, ?, ?, 1.0, ?)
      `).run(newClusterId, session.id, session.type, now)
    })()

    return { clusterId: newClusterId, isNewCluster: true, similarity: 0 }
  }

  /**
   * Get all clusters with their members.
   */
  getClusters(status?: 'active' | 'archived' | 'merged'): SessionCluster[] {
    let sql = 'SELECT * FROM session_clusters'
    const params: unknown[] = []
    if (status) {
      sql += ' WHERE status = ?'
      params.push(status)
    }
    sql += ' ORDER BY updated_at DESC'

    const rows = this.db.prepare(sql).all(...params) as Array<{
      id: string
      name: string
      description: string | null
      intent: string | null
      status: string
      created_at: string
      updated_at: string
    }>

    return rows.map((row) => {
      const members = this.db.prepare(
        'SELECT * FROM cluster_members WHERE cluster_id = ?'
      ).all(row.id) as Array<{
        cluster_id: string
        session_id: string
        session_type: string
        relevance_score: number
        added_at: string
      }>

      return {
        id: row.id,
        name: row.name,
        description: row.description,
        intent: row.intent,
        status: row.status as SessionCluster['status'],
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        members: members.map((m) => ({
          clusterId: m.cluster_id,
          sessionId: m.session_id,
          sessionType: m.session_type as SessionType,
          relevanceScore: m.relevance_score,
          addedAt: m.added_at,
        })),
      }
    })
  }

  // ---------- Similarity ----------

  /**
   * Compute 5-dimensional similarity between two writing sessions.
   */
  computeSimilarity(a: WritingSession, b: WritingSession): number {
    const w = this.config.weights

    const charSim = jaccardSimilarity(new Set(a.characters), new Set(b.characters))
    const themeSim = jaccardSimilarity(new Set(a.keywords), new Set(b.keywords))
    const temporalSim = temporalProximity(a.order, b.order)
    const plotSim = plotConnectivity(a.relatedEntities, b.relatedEntities)
    const styleSim = cosineSimilarity(a.styleVector, b.styleVector)

    return w.character * charSim
      + w.theme * themeSim
      + w.temporal * temporalSim
      + w.plot * plotSim
      + w.style * styleSim
  }

  // ---------- Private helpers ----------

  private hierarchicalCluster(simMatrix: number[][], n: number): Record<string, number[]> {
    // Initialize: each session is its own cluster
    const clusters: Map<number, number[]> = new Map()
    for (let i = 0; i < n; i++) {
      clusters.set(i, [i])
    }

    // Iteratively merge closest clusters (single-linkage)
    while (clusters.size > 1) {
      let bestSim = -1
      let bestI = -1
      let bestJ = -1

      const keys = Array.from(clusters.keys())
      for (let ci = 0; ci < keys.length; ci++) {
        for (let cj = ci + 1; cj < keys.length; cj++) {
          // Single-linkage: max similarity between any pair
          let maxSim = 0
          for (const i of clusters.get(keys[ci])!) {
            for (const j of clusters.get(keys[cj])!) {
              maxSim = Math.max(maxSim, simMatrix[i][j])
            }
          }

          if (maxSim > bestSim) {
            bestSim = maxSim
            bestI = keys[ci]
            bestJ = keys[cj]
          }
        }
      }

      // Stop if best similarity is below threshold
      if (bestSim < this.config.similarityThreshold) break

      // Merge bestJ into bestI
      const merged = [...clusters.get(bestI)!, ...clusters.get(bestJ)!]
      clusters.delete(bestJ)
      clusters.set(bestI, merged)
    }

    // Convert to record
    const result: Record<string, number[]> = {}
    let idx = 0
    for (const members of clusters.values()) {
      result[idx++] = members
    }
    return result
  }

  private generateClusterName(sessions: WritingSession[]): string {
    // Use most common session type + keyword
    const typeCounts: Record<string, number> = {}
    const allKeywords: string[] = []

    for (const s of sessions) {
      typeCounts[s.type] = (typeCounts[s.type] ?? 0) + 1
      allKeywords.push(...s.keywords)
    }

    const dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'mixed'
    const topKeyword = mostFrequent(allKeywords)

    return topKeyword ? `${dominantType}-${topKeyword}` : `${dominantType}-cluster`
  }

  private generateDescription(sessions: WritingSession[]): string {
    const types = [...new Set(sessions.map((s) => s.type))]
    const chars = [...new Set(sessions.flatMap((s) => s.characters))].slice(0, 5)
    return `${sessions.length} sessions (${types.join(', ')}), characters: ${chars.join(', ')}`
  }

  // ---------- Lifecycle ----------

  close(): void {
    this.db.close()
  }
}

// ============================================================
// Utility functions
// ============================================================

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1.0
  if (a.size === 0 || b.size === 0) return 0

  let intersection = 0
  for (const item of a) {
    if (b.has(item)) intersection++
  }

  const union = a.size + b.size - intersection
  return union === 0 ? 0 : intersection / union
}

function temporalProximity(orderA: number, orderB: number): number {
  if (orderA === 0 && orderB === 0) return 1.0
  const distance = Math.abs(orderA - orderB)
  return 1.0 / (1.0 + distance)
}

function plotConnectivity(entitiesA: string[], entitiesB: string[]): number {
  if (entitiesA.length === 0 || entitiesB.length === 0) return 0

  const setB = new Set(entitiesB)
  let overlap = 0
  for (const e of entitiesA) {
    if (setB.has(e)) overlap++
  }

  // Normalize by smaller set size
  const minSize = Math.min(entitiesA.length, entitiesB.length)
  return minSize === 0 ? 0 : overlap / minSize
}

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  if (len === 0) return 0

  let dotProduct = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < len; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB)
  return denominator === 0 ? 0 : dotProduct / denominator
}

function mostFrequent(items: string[]): string | null {
  if (items.length === 0) return null
  const freq: Record<string, number> = {}
  for (const item of items) {
    freq[item] = (freq[item] ?? 0) + 1
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

// ============================================================
// Factory
// ============================================================

export function createWritingSessionCluster(
  dbPath?: string,
  config?: Partial<ClusterConfig>,
): WritingSessionCluster {
  return new WritingSessionCluster(dbPath, config)
}
