/**
 * NarrativePatternDetector - Detect narrative patterns in knowledge graph entities
 *
 * Adapted from CCW PatternDetector's cosine clustering approach,
 * specialized for narrative analysis scenarios.
 *
 * Detection dimensions:
 * - structure: three-act rise, five-act, etc.
 * - character: character arcs, foil pairs, mentor-student
 * - theme: recurring motifs, symbolic echoes
 * - pacing: tension curves, rhythm patterns
 *
 * @module analysis/narrative-pattern-detector
 */

import { randomUUID } from 'node:crypto'

// ============================================================
// Types
// ============================================================

export type PatternCategory = 'structure' | 'character' | 'theme' | 'pacing'

export interface PatternOccurrence {
  /** Entity ID (scene/chapter) where pattern was detected */
  entityId: string
  /** Entity name for display */
  entityName: string
  /** Detection confidence 0-1 */
  confidence: number
  /** Matched context text */
  context: string
}

export interface NarrativePattern {
  id: string
  name: string
  category: PatternCategory
  occurrences: PatternOccurrence[]
  /** Overall confidence 0-1 */
  confidence: number
  /** Average cosine similarity across occurrences */
  avgSimilarity: number
}

export interface PatternTemplate {
  name: string
  category: PatternCategory
  /** Keywords that indicate this pattern (Chinese + English) */
  keywords: string[]
  /** Minimum occurrences to consider as a pattern */
  minOccurrences: number
  /** Confidence threshold for auto-suggestion */
  confidenceThreshold: number
}

export interface PatternDetectionConfig {
  /** Minimum similarity for clustering (default: 0.85) */
  similarityThreshold: number
  /** Minimum occurrences to flag as a candidate pattern (default: 3) */
  minPatternOccurrences: number
  /** Auto-suggest confidence threshold (default: 0.8) */
  autoSuggestThreshold: number
}

// ============================================================
// Built-in pattern templates
// ============================================================

const PATTERN_TEMPLATES: PatternTemplate[] = [
  // Structure patterns
  {
    name: 'three-act-rise',
    category: 'structure',
    keywords: ['开端', '发展', '高潮', '结局', 'setup', 'rising action', 'climax', 'resolution'],
    minOccurrences: 3,
    confidenceThreshold: 0.8,
  },
  {
    name: 'foreshadow-payoff',
    category: 'structure',
    keywords: ['伏笔', '回收', '铺垫', '呼应', 'foreshadow', 'payoff', 'plant', 'harvest'],
    minOccurrences: 3,
    confidenceThreshold: 0.8,
  },
  {
    name: 'circular-return',
    category: 'structure',
    keywords: ['回归', '首尾呼应', '循环', 'callback', 'return', 'echo', 'mirror'],
    minOccurrences: 2,
    confidenceThreshold: 0.75,
  },
  // Character patterns
  {
    name: 'character-arc',
    category: 'character',
    keywords: ['转变', '成长', '觉醒', '堕落', 'redemption', 'fall', 'growth', 'transformation', 'arc'],
    minOccurrences: 2,
    confidenceThreshold: 0.8,
  },
  {
    name: 'foil-pair',
    category: 'character',
    keywords: ['对比', '镜像', '反衬', 'foil', 'mirror', 'contrast', 'parallel'],
    minOccurrences: 2,
    confidenceThreshold: 0.75,
  },
  {
    name: 'mentor-student',
    category: 'character',
    keywords: ['师徒', '教导', '传承', 'mentor', 'student', 'guide', ' apprentice'],
    minOccurrences: 2,
    confidenceThreshold: 0.75,
  },
  // Theme patterns
  {
    name: 'recurring-motif',
    category: 'theme',
    keywords: ['象征', '意象', '主题', 'motif', 'symbol', 'theme', 'recurrence'],
    minOccurrences: 3,
    confidenceThreshold: 0.8,
  },
  {
    name: 'echo-chamber',
    category: 'theme',
    keywords: ['回声', '重复', '再现', 'echo', 'repeat', 'reprise', 'variation'],
    minOccurrences: 3,
    confidenceThreshold: 0.8,
  },
  // Pacing patterns
  {
    name: 'tension-curve',
    category: 'pacing',
    keywords: ['紧张', '冲突', '悬念', '舒缓', 'tension', 'conflict', 'suspense', 'release'],
    minOccurrences: 3,
    confidenceThreshold: 0.75,
  },
  {
    name: 'rhythm-alternation',
    category: 'pacing',
    keywords: ['快', '慢', '节奏', '起伏', 'fast', 'slow', 'rhythm', 'pace', 'alternation'],
    minOccurrences: 3,
    confidenceThreshold: 0.75,
  },
]

// ============================================================
// NarrativePatternDetector
// ============================================================

const DEFAULT_CONFIG: PatternDetectionConfig = {
  similarityThreshold: 0.85,
  minPatternOccurrences: 3,
  autoSuggestThreshold: 0.8,
}

/**
 * Detect narrative patterns from knowledge graph entities.
 *
 * Uses keyword matching + semantic similarity clustering to find
 * recurring patterns in scene/chapter entities.
 *
 * Usage:
 *   const detector = new NarrativePatternDetector(store)
 *   const patterns = await detector.detectAll()
 */
export class NarrativePatternDetector {
  private readonly config: PatternDetectionConfig

  /**
   * @param store - KnowledgeGraphStore instance (from Phase 1)
   * @param config - Optional detection configuration
   */
  constructor(
    private readonly store: NarrativeStoreProvider,
    config?: Partial<PatternDetectionConfig>,
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * Detect all narrative patterns across all categories.
   */
  async detectAll(): Promise<NarrativePattern[]> {
    const entities = await this.store.getEntitiesByTypes(['Scene', 'Chapter', 'Event'])
    if (entities.length === 0) return []

    const patterns: NarrativePattern[] = []

    for (const template of PATTERN_TEMPLATES) {
      const detected = this.detectPattern(entities, template)
      if (detected) patterns.push(detected)
    }

    return patterns.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Detect patterns in a specific category.
   */
  async detectByCategory(category: PatternCategory): Promise<NarrativePattern[]> {
    const entities = await this.store.getEntitiesByTypes(['Scene', 'Chapter', 'Event'])
    if (entities.length === 0) return []

    const patterns: NarrativePattern[] = []
    const templates = PATTERN_TEMPLATES.filter((t) => t.category === category)

    for (const template of templates) {
      const detected = this.detectPattern(entities, template)
      if (detected) patterns.push(detected)
    }

    return patterns.sort((a, b) => b.confidence - a.confidence)
  }

  /**
   * Detect a single pattern from a template.
   */
  private detectPattern(
    entities: Array<{ id: string; name: string; observations: string[] }>,
    template: PatternTemplate,
  ): NarrativePattern | null {
    const occurrences: PatternOccurrence[] = []

    for (const entity of entities) {
      const match = this.matchEntity(entity, template)
      if (match) occurrences.push(match)
    }

    if (occurrences.length < template.minOccurrences) return null

    // Cluster similar occurrences using cosine similarity on keyword vectors
    const clustered = this.clusterOccurrences(occurrences, template)

    if (clustered.length < template.minOccurrences) return null

    // Calculate overall confidence
    const avgConfidence = clustered.reduce((sum, o) => sum + o.confidence, 0) / clustered.length
    const frequencyBoost = Math.min(1.0, clustered.length / (template.minOccurrences * 2))
    const confidence = avgConfidence * 0.7 + frequencyBoost * 0.3

    // Calculate average similarity
    const avgSimilarity = clustered.length > 1
      ? this.computeAvgSimilarity(clustered)
      : 1.0

    return {
      id: randomUUID(),
      name: template.name,
      category: template.category,
      occurrences: clustered,
      confidence: Math.round(confidence * 1000) / 1000,
      avgSimilarity: Math.round(avgSimilarity * 1000) / 1000,
    }
  }

  /**
   * Match an entity against a pattern template's keywords.
   */
  private matchEntity(
    entity: { id: string; name: string; observations: string[] },
    template: PatternTemplate,
  ): PatternOccurrence | null {
    const text = [entity.name, ...entity.observations].join(' ').toLowerCase()
    let matchedKeywords = 0
    const matchedContexts: string[] = []

    for (const keyword of template.keywords) {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords++
        // Extract context around the keyword
        const idx = text.indexOf(keyword.toLowerCase())
        const start = Math.max(0, idx - 30)
        const end = Math.min(text.length, idx + keyword.length + 30)
        matchedContexts.push(text.slice(start, end))
      }
    }

    if (matchedKeywords === 0) return null

    const confidence = Math.min(1.0, matchedKeywords / Math.max(template.keywords.length * 0.3, 1))

    return {
      entityId: entity.id,
      entityName: entity.name,
      confidence,
      context: matchedContexts.join(' | '),
    }
  }

  /**
   * Cluster occurrences by cosine similarity of their keyword vectors.
   * Adapted from CCW PatternDetector's clustering algorithm.
   */
  private clusterOccurrences(
    occurrences: PatternOccurrence[],
    template: PatternTemplate,
  ): PatternOccurrence[] {
    if (occurrences.length <= 1) return occurrences

    // Build keyword vectors for each occurrence
    const vectors = occurrences.map((o) =>
      this.buildKeywordVector(o.context, template.keywords),
    )

    // Simple greedy clustering
    const used = new Set<number>()
    const clusters: Array<{ indices: number[]; centroid: number[] }> = []

    for (let i = 0; i < occurrences.length; i++) {
      if (used.has(i)) continue

      const cluster: number[] = [i]
      used.add(i)

      for (let j = i + 1; j < occurrences.length; j++) {
        if (used.has(j)) continue

        const similarity = cosineSimilarity(vectors[i], vectors[j])
        if (similarity >= this.config.similarityThreshold) {
          cluster.push(j)
          used.add(j)
        }
      }

      clusters.push({ indices: cluster, centroid: vectors[i] })
    }

    // Return occurrences from the largest cluster
    const largest = clusters.sort((a, b) => b.indices.length - a.indices.length)[0]
    return largest.indices.map((i) => occurrences[i])
  }

  /**
   * Build a binary keyword presence vector.
   */
  private buildKeywordVector(text: string, keywords: string[]): number[] {
    const lower = text.toLowerCase()
    return keywords.map((kw) => (lower.includes(kw.toLowerCase()) ? 1 : 0))
  }

  /**
   * Compute average pairwise cosine similarity.
   */
  private computeAvgSimilarity(occurrences: PatternOccurrence[]): number {
    if (occurrences.length <= 1) return 1.0

    let totalSim = 0
    let pairs = 0

    for (let i = 0; i < occurrences.length; i++) {
      for (let j = i + 1; j < occurrences.length; j++) {
        totalSim += Math.min(occurrences[i].confidence, occurrences[j].confidence)
        pairs++
      }
    }

    return pairs > 0 ? totalSim / pairs : 0
  }
}

// ============================================================
// Store provider interface (DI)
// ============================================================

/**
 * Minimal interface that KnowledgeGraphStore must satisfy.
 * Uses the entity types from memory-mcp.
 */
export interface NarrativeStoreProvider {
  getEntitiesByTypes(types: string[]): Promise<Array<{
    id: string
    name: string
    observations: string[]
  }>>
}

// ============================================================
// Cosine similarity utility
// ============================================================

function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
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

// ============================================================
// Factory
// ============================================================

export function createNarrativePatternDetector(
  store: NarrativeStoreProvider,
  config?: Partial<PatternDetectionConfig>,
): NarrativePatternDetector {
  return new NarrativePatternDetector(store, config)
}
