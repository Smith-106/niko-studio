/**
 * IterativeRetriever - GAM (Generate-then-Aggregate-then-Mine) Retrieval Engine
 *
 * Migrated from src/search/iterative_retriever.py (839 lines).
 *
 * Core features:
 * 1. Hybrid search (vector + keyword + graph) with 4-stage pipeline
 * 2. Iterative retrieval with dynamic query expansion
 * 3. @-reference context resolution
 * 4. Score fusion with configurable weights (dense/sparse/graph)
 * 5. Budget-based token trimming and source quotas
 * 6. Reranking integration via factory pattern
 */

import { readdir, readFile } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { performance } from 'node:perf_hooks'

import { RerankerFactory } from '../services/reranker/factory'
import type { RankedDocument } from '../services/reranker/models'

import { rrfMerge, heatDecayScore, type RrfSource, DEFAULT_RRF_K } from './utils/rrf-fusion'

import type {
  CollectStageTrace,
  ContextType,
  ElasticSearchAdapter,
  GraphSearchProvider,
  IterativeRetrieveResult,
  MemorySearchProvider,
  RerankStageTrace,
  RetrievalProfile,
  RetrievalTrace,
  ResolvedReference,
  SearchResult,
  RouteMode,
  SkillProvider,
  TrimStageTrace,
} from './retrieval-types'

// ============================================================
// Constants
// ============================================================

/** Regex patterns for @-reference parsing */
const CONTEXT_PATTERNS: Record<ContextType, RegExp> = {
  character: /@character:(\w+)/g,
  scene: /@scene:(\w+)/g,
  chapter: /@chapter:(\d+)/g,
  memory: /@memory:(\w+)/g,
  timeline: /@timeline:(\w+)/g,
  foreshadow: /@foreshadow:(\w+)/g,
  style: /@style:(\w+)/g,
}

/** Default file extensions scanned during file search */
const DEFAULT_FILE_EXTENSIONS = new Set(['.md', '.txt'])

/** Valid route modes */
const VALID_ROUTE_MODES = new Set<RouteMode>(['legacy', 'elastic', 'hybrid'])

// ============================================================
// Built-in Profiles
// ============================================================

const DEFAULT_PROFILE: RetrievalProfile = {
  name: 'default',
  sourceWeights: { memory: 1.0, graph: 1.0, file: 1.0 },
  thresholds: { min_score: null },
  budget: { budget_tokens: null },
  rerank: { enabled: false, topK: 20 },
  sourceQuota: {},
  fusion: { enabled: false, mode: 'rrf', dense: 0.65, sparse: 0.20, graph: 0.15 },
}

const BUILT_IN_PROFILES: Record<string, RetrievalProfile> = {
  default: DEFAULT_PROFILE,

  lite_low_cost: {
    name: 'lite_low_cost',
    sourceWeights: { memory: 1.0, graph: 0.8, file: 0.6 },
    thresholds: { min_score: null },
    budget: { budget_tokens: 900 },
    rerank: { enabled: false, topK: 10 },
    sourceQuota: { memory: 8, graph: 4, file: 3 },
    fusion: { enabled: true, mode: 'rrf', dense: 0.70, sparse: 0.20, graph: 0.10 },
  },

  standard_balanced: {
    name: 'standard_balanced',
    sourceWeights: { memory: 1.0, graph: 0.9, file: 0.8 },
    thresholds: { min_score: null },
    budget: { budget_tokens: 1400 },
    rerank: { enabled: true, topK: 20 },
    sourceQuota: { memory: 10, graph: 6, file: 5 },
    fusion: { enabled: true, mode: 'rrf', dense: 0.65, sparse: 0.20, graph: 0.15 },
  },

  brainstorm_quality: {
    name: 'brainstorm_quality',
    sourceWeights: { memory: 1.0, graph: 1.0, file: 0.9 },
    thresholds: { min_score: null },
    budget: { budget_tokens: 2200 },
    rerank: { enabled: true, topK: 30 },
    sourceQuota: { memory: 12, graph: 8, file: 6 },
    fusion: { enabled: true, mode: 'rrf', dense: 0.60, sparse: 0.20, graph: 0.20 },
  },

  coordinator_quality: {
    name: 'coordinator_quality',
    sourceWeights: { memory: 1.0, graph: 1.0, file: 1.0 },
    thresholds: { min_score: null },
    budget: { budget_tokens: 2600 },
    rerank: { enabled: true, topK: 35 },
    sourceQuota: { memory: 14, graph: 10, file: 8 },
    fusion: { enabled: true, mode: 'rrf', dense: 0.58, sparse: 0.20, graph: 0.22 },
  },
}

// ============================================================
// IterativeRetriever
// ============================================================

export interface IterativeRetrieverConfig {
  /** Project root directory for file search */
  projectRoot?: string
  /** File extensions to scan */
  fileExtensions?: Set<string>
  /** Memory engine (lazy if omitted) */
  memoryEngine?: MemorySearchProvider
  /** Graph engine (lazy if omitted) */
  graphEngine?: GraphSearchProvider
  /** ElasticSearch adapter (plugged in later) */
  elasticAdapter?: ElasticSearchAdapter
  /** Whether elasticsearch is enabled */
  elasticsearchEnabled?: boolean
  /** Skill engine for @style: resolution */
  skillEngine?: SkillProvider
}

export class IterativeRetriever {
  private _memoryEngine: MemorySearchProvider | null | undefined
  private _graphEngine: GraphSearchProvider | null | undefined
  private _skillEngine: SkillProvider | undefined
  private readonly _projectRoot: string
  private readonly _fileExtensions: Set<string>
  private readonly _elasticAdapter: ElasticSearchAdapter | undefined
  private readonly _elasticsearchEnabled: boolean
  private _lastTrace: RetrievalTrace | null = null

  constructor(config: IterativeRetrieverConfig = {}) {
    this._memoryEngine = config.memoryEngine
    this._graphEngine = config.graphEngine
    this._skillEngine = config.skillEngine
    this._projectRoot = config.projectRoot ?? process.cwd()
    this._fileExtensions = config.fileExtensions ?? DEFAULT_FILE_EXTENSIONS
    this._elasticAdapter = config.elasticAdapter
    this._elasticsearchEnabled = config.elasticsearchEnabled ?? false
  }

  // ------------------------------------------------------------------
  // Lazy dependency accessors
  // ------------------------------------------------------------------

  /** Memory engine (lazy-loaded from container when first accessed) */
  get memoryEngine(): MemorySearchProvider {
    if (this._memoryEngine === null || this._memoryEngine === undefined) {
      // Dynamic import avoids hard coupling; container must be bootstrapped
      const { UnifiedMemoryEngine } = require('../memory/unified-memory') as {
        UnifiedMemoryEngine: new () => MemorySearchProvider
      }
      this._memoryEngine = new UnifiedMemoryEngine()
    }
    return this._memoryEngine
  }

  /** Graph engine (lazy-loaded from container when first accessed) */
  get graphEngine(): GraphSearchProvider {
    if (this._graphEngine === null || this._graphEngine === undefined) {
      const { GraphEngine } = require('../graph/graph-engine') as {
        GraphEngine: new () => GraphSearchProvider
      }
      this._graphEngine = new GraphEngine()
    }
    return this._graphEngine
  }

  /** Returns a shallow copy of the most recent trace */
  get lastTrace(): RetrievalTrace | null {
    return this._lastTrace ? { ...this._lastTrace } : null
  }

  // ==================================================================
  // hybridSearch - 4-stage pipeline: collect -> rerank -> trim -> return
  // ==================================================================

  async hybridSearch(
    query: string,
    scope = 'all',
    limit = 10,
    profile?: string,
    minScore?: number,
    budgetTokens?: number,
    rerank = false,
    routeMode: RouteMode | string = 'legacy',
    elasticTimeoutMs = 300,
  ): Promise<Array<Omit<SearchResult, 'score'> & { score: number }>> {
    const started = performance.now()
    const activeProfile = await this.resolveProfile(profile)
    const trace: Record<string, unknown> = {
      profile: activeProfile.name,
      cacheHit: false,
      stages: {},
    }

    // ---- Stage 1: Collect ----
    const collectStarted = performance.now()
    let candidates = await this.collectCandidates(query, scope, limit, activeProfile)
    const legacyCandidates = candidates
    let elasticCandidates: SearchResult[] = []

    const normalizedRoute = normalizeRouteMode(routeMode)

    if (normalizedRoute === 'elastic' || normalizedRoute === 'hybrid') {
      elasticCandidates = await this.collectElasticCandidates(
        query,
        scope,
        limit,
        elasticTimeoutMs,
      )
      if (normalizedRoute === 'elastic' && elasticCandidates.length > 0) {
        candidates = elasticCandidates
      } else if (normalizedRoute === 'hybrid' && elasticCandidates.length > 0) {
        candidates = this.mergeResultCandidates(legacyCandidates, elasticCandidates, limit * 2)
      }
    }

    const collectTrace: CollectStageTrace = {
      durationMs: roundMs(performance.now() - collectStarted),
      candidates: candidates.length,
      routeMode: normalizedRoute,
      legacyCandidates: legacyCandidates.length,
      elasticCandidates: elasticCandidates.length,
    }
    trace.stages = { ...(trace.stages as Record<string, unknown>), collect: collectTrace }

    // ---- Stage 2: Rerank ----
    const rerankStarted = performance.now()
    const rerankEnabled = Boolean(rerank || activeProfile.rerank.enabled)
    let rerankFallback = false
    let reranked = candidates

    if (rerankEnabled && candidates.length > 0) {
      try {
        reranked = await this.rerankCandidates(query, candidates, activeProfile.rerank.topK)
      } catch (exc) {
        rerankFallback = true
        console.warn('Rerank failed, fallback to original order:', exc)
        reranked = candidates
      }
    }

    const rerankTrace: RerankStageTrace = {
      durationMs: roundMs(performance.now() - rerankStarted),
      enabled: rerankEnabled,
      fallback: rerankFallback,
      candidates: reranked.length,
    }
    ;(trace.stages as Record<string, unknown>).rerank = rerankTrace

    // ---- Stage 3: Trim ----
    const trimStarted = performance.now()
    const effectiveMinScore = minScore ?? activeProfile.thresholds.min_score ?? null
    const effectiveBudget = budgetTokens ?? activeProfile.budget.budget_tokens ?? null

    const { trimmed, droppedByThreshold } = this.trimResults(
      reranked,
      limit,
      effectiveMinScore,
      effectiveBudget,
      activeProfile.sourceQuota,
    )

    const trimTrace: TrimStageTrace = {
      durationMs: roundMs(performance.now() - trimStarted),
      droppedByThreshold,
      finalResults: trimmed.length,
      budgetTokens: effectiveBudget,
    }
    ;(trace.stages as Record<string, unknown>).trim = trimTrace

    // ---- Finalize trace ----
    this._lastTrace = {
      query,
      scope,
      limit,
      profile: activeProfile.name,
      cacheHit: false,
      stages: trace.stages as RetrievalTrace['stages'],
      totalDurationMs: roundMs(performance.now() - started),
    }

    return trimmed.map(r => ({
      id: r.id,
      content: r.content,
      source: r.source,
      score: round4(r.score),
      metadata: r.metadata,
    }))
  }

  // ==================================================================
  // iterativeRetrieve - GAM pattern
  // ==================================================================

  async iterativeRetrieve(
    query: string,
    maxIterations = 3,
    confidenceThreshold = 0.8,
    profile?: string,
    minScore?: number,
    budgetTokens?: number,
    rerank = false,
  ): Promise<IterativeRetrieveResult> {
    const allResults: Array<Omit<SearchResult, 'score'> & { score: number }> = []
    const usedQueries = [query]
    let iteration = 0
    let currentQuery = query
    let bestConfidence = 0.0
    const traces: RetrievalTrace[] = []

    while (iteration < maxIterations && bestConfidence < confidenceThreshold) {
      iteration++

      const results = await this.hybridSearch(
        currentQuery,
        'all',
        10,
        profile,
        minScore,
        budgetTokens,
        rerank,
        'legacy',
      )

      traces.push(this._lastTrace!)

      if (results.length === 0) break

      const existingIds = new Set(allResults.map(r => r.id))
      for (const r of results) {
        if (!existingIds.has(r.id)) {
          allResults.push(r)
          existingIds.add(r.id)
        }
      }

      bestConfidence = Math.max(...results.map(r => r.score), 0.0)
      if (bestConfidence >= confidenceThreshold) break

      const newKeywords = this.extractKeywords(results)
      const expansion = newKeywords.slice(0, 3).join(' ')

      if (expansion && !usedQueries.includes(expansion)) {
        currentQuery = `${query} ${expansion}`
        usedQueries.push(expansion)
      } else {
        break
      }
    }

    allResults.sort((a, b) => b.score - a.score)

    return {
      results: allResults.slice(0, 10),
      iterations: iteration,
      confidence: bestConfidence,
      queriesUsed: usedQueries,
      retrievalTrace: traces,
    }
  }

  // ==================================================================
  // resolveContext - @-reference resolution
  // ==================================================================

  async resolveContext(text: string): Promise<string> {
    let resolvedText = text
    const contextParts: string[] = []

    for (const [contextType, pattern] of Object.entries(CONTEXT_PATTERNS) as Array<[ContextType, RegExp]>) {
      // Reset lastIndex for global regex
      const regex = new RegExp(pattern.source, pattern.flags)
      let match: RegExpExecArray | null

      while ((match = regex.exec(text)) !== null) {
        const refValue = match[1]
        const fullMatch = match[0]

        const context = await this.resolveReference(contextType, refValue)

        if (context) {
          contextParts.push(`[${contextType}:${refValue}]\n${context}`)
          resolvedText = resolvedText.replace(fullMatch, `[${contextType}:${refValue}]`)
        }
      }
    }

    if (contextParts.length > 0) {
      return `=== \u4e0a\u4e0b\u6587 ===\n${contextParts.join('\n\n')}\n\n=== \u539f\u6587 ===\n${resolvedText}`
    }

    return text
  }

  // ==================================================================
  // Private: collect stage
  // ==================================================================

  private async collectCandidates(
    query: string,
    scope: string,
    limit: number,
    profile: RetrievalProfile,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const queryTerms = extractQueryTerms(query)

    // 1. Memory search
    if (scope === 'all' || scope === 'memory') {
      const memoryResults = await this.memoryEngine.search(query, { limit })
      for (const r of memoryResults) {
        const baseScore = Number(r.score ?? 0.0)
        const fusedScore = this.fuseScore(
          baseScore,
          'memory',
          String(r.content ?? ''),
          queryTerms,
          profile,
        )
        results.push({
          id: String(r.id),
          content: String(r.content ?? ''),
          source: 'memory',
          score: fusedScore,
          metadata: {
            layer: r.layer ?? undefined,
            dimension: r.dimension ?? undefined,
          },
        })
      }
    }

    // 2. Graph search
    if (scope === 'all' || scope === 'graph') {
      const entities = await this.searchGraph(query, limit)
      for (const e of entities) {
        const baseScore = Number(e.score ?? 0.5)
        const graphContent = `${e.type}: ${e.name} - ${JSON.stringify(e.properties ?? {})}`
        const fusedScore = this.fuseScore(
          baseScore,
          'graph',
          graphContent,
          queryTerms,
          profile,
        )
        results.push({
          id: String(e.id),
          content: graphContent,
          source: 'graph',
          score: fusedScore,
          metadata: { type: e.type, name: e.name },
        })
      }
    }

    // 3. File search
    if (scope === 'all' || scope === 'files') {
      const fileResults = await this.searchFiles(query, limit)
      for (const r of fileResults) {
        r.score = this.fuseScore(r.score, 'file', r.content, queryTerms, profile)
      }
      results.push(...fileResults)
    }

    return results
  }

  // ==================================================================
  // Private: elastic candidates
  // ==================================================================

  private async collectElasticCandidates(
    query: string,
    scope: string,
    limit: number,
    timeoutMs: number,
  ): Promise<SearchResult[]> {
    if (!this._elasticsearchEnabled || !this._elasticAdapter) return []

    const timeoutSeconds = Math.max(timeoutMs / 1000, 0.05)

    let response: Array<Record<string, unknown>>
    try {
      const result = await Promise.race([
        this._elasticAdapter.search(query, scope, limit),
        rejectAfter(timeoutSeconds),
      ])
      response = result
    } catch (exc) {
      console.warn('Elasticsearch route failed, fallback to legacy search:', exc)
      return []
    }

    const candidates: SearchResult[] = []
    for (const item of response ?? []) {
      const itemId = String(item.id ?? '')
      const content = String(item.content ?? '')
      if (!itemId || !content) continue

      const metadata = item.metadata
      candidates.push({
        id: itemId,
        content,
        source: 'elastic',
        score: Number(item.score ?? 0.0),
        metadata: metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? metadata as Record<string, unknown>
          : {},
      })
    }
    return candidates
  }

  // ==================================================================
  // Private: merge candidates (dedup by score rank)
  // ==================================================================

  private mergeResultCandidates(
    primary: SearchResult[],
    secondary: SearchResult[],
    limit: number,
  ): SearchResult[] {
    const merged: SearchResult[] = []
    const seenIds = new Set<string>()

    const sorted = [...primary, ...secondary].sort((a, b) => b.score - a.score)
    for (const item of sorted) {
      if (seenIds.has(item.id)) continue
      seenIds.add(item.id)
      merged.push(item)
      if (merged.length >= limit) break
    }

    return merged
  }

  // ==================================================================
  // Private: score fusion (linear + RRF modes)
  // ==================================================================

  private fuseScore(
    baseScore: number,
    source: string,
    content: string,
    queryTerms: Set<string>,
    profile: RetrievalProfile,
    heatScore?: number,
  ): number {
    const sourceWeight = profile.sourceWeights[source] ?? 1.0
    const weightedBase = baseScore * sourceWeight

    if (!profile.fusion.enabled) return weightedBase

    const fusionMode = profile.fusion.mode ?? 'linear'

    if (fusionMode === 'rrf') {
      return this.rrfFuseScore(weightedBase, source, content, queryTerms, profile, heatScore)
    }

    // Legacy linear fusion (fallback)
    return this.linearFuseScore(weightedBase, source, content, queryTerms, profile)
  }

  /**
   * RRF-style fusion: treats each signal (dense, sparse, graph, heat) as
   * a separate ranked source and combines via Reciprocal Rank Fusion.
   */
  private rrfFuseScore(
    weightedBase: number,
    source: string,
    content: string,
    queryTerms: Set<string>,
    profile: RetrievalProfile,
    heatScore?: number,
  ): number {
    // Build ranked sources for RRF
    const sources: RrfSource[] = []

    // Dense source (vector similarity)
    sources.push({
      name: 'dense',
      weight: profile.fusion.dense,
      items: [{ id: 'doc', score: weightedBase }],
    })

    // Sparse source (keyword hit ratio)
    const sparseHit = this.computeSparseHit(content, queryTerms)
    sources.push({
      name: 'sparse',
      weight: profile.fusion.sparse,
      items: [{ id: 'doc', score: sparseHit }],
    })

    // Graph source (only for graph entities)
    if (source === 'graph') {
      sources.push({
        name: 'graph',
        weight: profile.fusion.graph,
        items: [{ id: 'doc', score: 0.5 }],
      })
    }

    // Heat source (popularity decay)
    if (heatScore !== undefined && heatScore > 0 && profile.fusion.heat !== undefined) {
      sources.push({
        name: 'heat',
        weight: profile.fusion.heat,
        items: [{ id: 'doc', score: heatScore }],
      })
    }

    const merged = rrfMerge(sources)
    return Math.max(0.0, Math.min(1.0, merged[0]?.score ?? weightedBase))
  }

  /**
   * Legacy linear weighted sum fusion (original behavior).
   * Rollback: set fusion.mode = 'linear' in profile.
   */
  private linearFuseScore(
    weightedBase: number,
    source: string,
    content: string,
    queryTerms: Set<string>,
    profile: RetrievalProfile,
  ): number {
    const sparseHit = this.computeSparseHit(content, queryTerms)
    const graphW = source === 'graph' ? profile.fusion.graph : 0.0
    const fused = profile.fusion.dense * weightedBase + profile.fusion.sparse * sparseHit + graphW
    return Math.max(0.0, Math.min(1.0, fused))
  }

  /** Compute sparse/keyword hit ratio */
  private computeSparseHit(content: string, queryTerms: Set<string>): number {
    if (queryTerms.size === 0 || !content) return 0
    const lower = content.toLowerCase()
    let matched = 0
    for (const term of queryTerms) {
      if (lower.includes(term)) matched++
    }
    return matched / Math.max(queryTerms.size, 1)
  }

  // ==================================================================
  // Private: rerank via factory
  // ==================================================================

  private async rerankCandidates(
    query: string,
    candidates: SearchResult[],
    topK: number,
  ): Promise<SearchResult[]> {
    const reranker = RerankerFactory.fromEnv()
    const docs = candidates.map(c => c.content)
    const docIds = candidates.map(c => c.id)
    const metadataList = candidates.map(c => ({
      source: c.source,
      ...(c.metadata ?? {}),
    }))

    const reranked: RankedDocument[] = await reranker.rerank(query, docs, Math.min(topK, candidates.length), {
      documentIds: docIds,
      metadataList,
    })

    const byId = new Map(candidates.map(c => [c.id, c]))
    const results: SearchResult[] = []

    for (const item of reranked) {
      const original = byId.get(item.id)
      if (!original) continue

      results.push({
        id: original.id,
        content: original.content,
        source: original.source,
        score: item.score,
        metadata: {
          ...(original.metadata ?? {}),
          ...(item.metadata ?? {}),
          reranked: true,
        },
      })
    }

    return results.length > 0 ? results : candidates
  }

  // ==================================================================
  // Private: trim (dedup + threshold + quota + budget)
  // ==================================================================

  private trimResults(
    results: SearchResult[],
    limit: number,
    minScore: number | null,
    budgetTokens: number | null,
    sourceQuota: Record<string, number> | undefined,
  ): { trimmed: SearchResult[]; droppedByThreshold: number } {
    // Dedup by id, keeping highest score first
    const seenIds = new Set<string>()
    let deduped: SearchResult[] = []
    for (const item of [...results].sort((a, b) => b.score - a.score)) {
      if (seenIds.has(item.id)) continue
      seenIds.add(item.id)
      deduped.push(item)
    }

    // Threshold filter
    let droppedByThreshold = 0
    if (minScore !== null) {
      const thresholded: SearchResult[] = []
      for (const item of deduped) {
        if (item.score >= minScore) {
          thresholded.push(item)
        } else {
          droppedByThreshold++
        }
      }
      deduped = thresholded
    }

    // Source quota
    if (sourceQuota && Object.keys(sourceQuota).length > 0) {
      const perSource: Record<string, number> = {}
      const quotaTrimmed: SearchResult[] = []
      for (const item of deduped) {
        const quota = sourceQuota[item.source]
        if (quota === undefined) {
          quotaTrimmed.push(item)
          continue
        }
        const current = perSource[item.source] ?? 0
        if (current >= quota) continue
        perSource[item.source] = current + 1
        quotaTrimmed.push(item)
      }
      deduped = quotaTrimmed
    }

    // Budget trimming
    if (budgetTokens !== null && budgetTokens > 0) {
      let consumed = 0
      const budgetTrimmed: SearchResult[] = []
      for (const item of deduped) {
        const estimated = estimateTokens(item.content)
        if (consumed + estimated > budgetTokens) continue
        consumed += estimated
        budgetTrimmed.push(item)
      }
      deduped = budgetTrimmed
    }

    return { trimmed: deduped.slice(0, limit), droppedByThreshold }
  }

  // ==================================================================
  // Private: graph search
  // ==================================================================

  private async searchGraph(
    query: string,
    limit: number,
  ): Promise<Array<Record<string, unknown>>> {
    const words = query.match(/[\w\u4e00-\u9fff]+/g) ?? []
    const results: Array<Record<string, unknown>> = []

    for (const word of words.slice(0, 5)) {
      try {
        const entities = await this.graphEngine.searchEntitiesByName(
          'Character',
          `%${word}%`,
        )
        for (const e of entities) {
          if (e && typeof e === 'object' && !('error' in e)) {
            results.push({ ...e, score: 0.7 })
          }
        }
      } catch {
        // Silently skip graph errors
      }
    }

    return results.slice(0, limit)
  }

  // ==================================================================
  // Private: file search
  // ==================================================================

  private async searchFiles(
    query: string,
    limit: number,
  ): Promise<SearchResult[]> {
    const results: SearchResult[] = []
    const keywords = query.toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}/g)
      ?? [query.toLowerCase().trim()]

    for (const ext of this._fileExtensions) {
      const pattern = new RegExp(`\\${ext}$`, 'i')
      let entries: string[]

      try {
        entries = await walkDir(this._projectRoot)
      } catch {
        continue
      }

      for (const filePath of entries) {
        if (!pattern.test(filePath)) continue

        let content: string
        try {
          content = await readFile(filePath, 'utf-8')
        } catch {
          continue
        }

        const contentLower = content.toLowerCase()
        let matchCount = 0
        for (const kw of keywords) {
          let idx = contentLower.indexOf(kw)
          while (idx !== -1) {
            matchCount++
            idx = contentLower.indexOf(kw, idx + 1)
          }
        }

        if (matchCount > 0) {
          const score = Math.min(0.9, 0.3 + matchCount * 0.1)
          const snippet = extractSnippet(content, keywords, 200)

          let relativePath: string
          try {
            relativePath = relative(this._projectRoot, filePath)
          } catch {
            relativePath = filePath
          }

          results.push({
            id: relativePath,
            content: snippet,
            source: 'file',
            score,
            metadata: {
              path: filePath,
              extension: ext,
              matchCount,
            },
          })
        }
      }
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  // ==================================================================
  // Private: resolve profile
  // ==================================================================

  private async resolveProfile(profileName?: string): Promise<RetrievalProfile> {
    if (!profileName) return BUILT_IN_PROFILES.default

    if (profileName in BUILT_IN_PROFILES) return BUILT_IN_PROFILES[profileName]

    // Try loading from memory engine
    const getter = this.memoryEngine.getRetrievalProfile
    if (typeof getter === 'function') {
      const data = getter(profileName)
      if (data && typeof data === 'object' && data.enabled !== false) {
        return {
          name: profileName,
          sourceWeights: (data.source_weights_json ?? data.source_weights ?? { memory: 1.0, graph: 1.0, file: 1.0 }) as Record<string, number>,
          thresholds: (data.thresholds_json ?? data.thresholds ?? { min_score: null }) as Record<string, number | null>,
          budget: (data.budget_json ?? data.budget ?? { budget_tokens: null }) as Record<string, number | null>,
          rerank: (data.rerank ?? { enabled: false, topK: 20 }) as RetrievalProfile['rerank'],
          sourceQuota: (data.source_quota ?? {}) as Record<string, number>,
          fusion: (data.fusion ?? { enabled: false, dense: 0.65, sparse: 0.20, graph: 0.15 }) as RetrievalProfile['fusion'],
        }
      }
    }

    return BUILT_IN_PROFILES.default
  }

  // ==================================================================
  // Private: keyword extraction for iterative expansion
  // ==================================================================

  private extractKeywords(
    results: Array<{ content?: string }>,
  ): string[] {
    const keywords: string[] = []

    for (const r of results.slice(0, 5)) {
      const content = r.content ?? ''
      const words = content.match(/[\u4e00-\u9fff]{2,}|[a-zA-Z]{3,}/g)
      if (words) keywords.push(...words)
    }

    // Count frequency
    const freq: Record<string, number> = {}
    for (const w of keywords) {
      freq[w] = (freq[w] ?? 0) + 1
    }

    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word)
  }

  // ==================================================================
  // Private: @-reference resolution
  // ==================================================================

  private async resolveReference(
    contextType: ContextType,
    refValue: string,
  ): Promise<string | null> {
    try {
      switch (contextType) {
        case 'character': {
          const char = await this.graphEngine.getCharacter(refValue)
          if (!('error' in char)) {
            const props = (char.properties ?? {}) as Record<string, unknown>
            return `\u540d\u79f0: ${char.name}\n\u5c5e\u6027: ${JSON.stringify(props)}`
          }
          return null
        }

        case 'scene': {
          const results = await this.memoryEngine.search(
            `\u573a\u666f ${refValue}`,
            { dimensions: ['context'], limit: 1 },
          )
          if (results.length > 0) return String(results[0].content ?? '')
          return null
        }

        case 'chapter': {
          const results = await this.memoryEngine.search(
            `\u7b2c${refValue}\u7ae0`,
            { dimensions: ['context'], limit: 3 },
          )
          if (results.length > 0) return results.map(r => String(r.content ?? '')).join('\n')
          return null
        }

        case 'memory': {
          const results = await this.memoryEngine.search(refValue, { limit: 1 })
          if (results.length > 0) return String(results[0].content ?? '')
          return null
        }

        case 'timeline': {
          const results = await this.memoryEngine.search(
            refValue,
            { dimensions: ['timeline'], limit: 5 },
          )
          if (results.length > 0) {
            return results.map(r => `- ${r.content ?? ''}`).join('\n')
          }
          return null
        }

        case 'foreshadow': {
          const foreshadows = await this.graphEngine.getForeshadows()
          for (const f of foreshadows) {
            const name = String(f.name ?? '')
            if (name.toLowerCase().includes(refValue.toLowerCase())) {
              const props = (f.properties ?? {}) as Record<string, unknown>
              return [
                `\u4f0f\u7b14: ${name}`,
                `\u72b6\u6001: ${props.status ?? 'pending'}`,
                `\u63cf\u8ff0: ${props.description ?? ''}`,
              ].join('\n')
            }
          }
          return null
        }

        case 'style': {
          if (!this._skillEngine) return null
          try {
            const skill = await this._skillEngine.load(refValue)
            return `\u6280\u80fd\u5305: ${skill.name}\n\u63cf\u8ff0: ${skill.description}`
          } catch {
            return null
          }
        }

        default:
          return null
      }
    } catch (exc) {
      console.warn(`Failed to resolve reference @${contextType}:${refValue}:`, exc)
      return null
    }
  }
}

// ==================================================================
// Module-level utility functions
// ==================================================================

/** Extract query terms (Chinese 2+ chars or alphanumeric 2+ chars) */
function extractQueryTerms(query: string): Set<string> {
  const terms = query.toLowerCase().match(/[\u4e00-\u9fff]{2,}|[a-zA-Z0-9_]{2,}/g) ?? []
  return new Set(terms.filter(Boolean))
}

/** Rough token estimation: ~4 chars per token */
function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.max(1, Math.floor(text.length / 4))
}

/** Round a number to 4 decimal places */
function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

/** Round milliseconds to 2 decimal places */
function roundMs(ms: number): number {
  return Math.round(ms * 100) / 100
}

/** Normalize and validate a route mode string */
function normalizeRouteMode(mode: string): RouteMode {
  const lowered = (mode ?? 'legacy').trim().toLowerCase()
  if (VALID_ROUTE_MODES.has(lowered as RouteMode)) return lowered as RouteMode
  return 'legacy'
}

/** Extract a snippet around the first keyword occurrence */
function extractSnippet(
  content: string,
  keywords: string[],
  maxLen = 200,
): string {
  const contentLower = content.toLowerCase()

  let firstPos = content.length
  for (const kw of keywords) {
    const pos = contentLower.indexOf(kw)
    if (pos !== -1 && pos < firstPos) firstPos = pos
  }

  if (firstPos === content.length) {
    const sliced = content.slice(0, maxLen).trim()
    return content.length > maxLen ? `${sliced}...` : sliced
  }

  const start = Math.max(0, firstPos - 50)
  const end = Math.min(content.length, firstPos + maxLen - 50)

  let snippet = content.slice(start, end).trim()
  if (start > 0) snippet = `...${snippet}`
  if (end < content.length) snippet = `${snippet}...`

  return snippet
}

/** Create a timeout rejection promise */
function rejectAfter(seconds: number): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Timeout')), seconds * 1000),
  )
}

/** Recursively walk a directory and return all file paths */
async function walkDir(dir: string): Promise<string[]> {
  const results: string[] = []
  let entries

  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return results
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      const sub = await walkDir(fullPath)
      results.push(...sub)
    } else if (entry.isFile()) {
      results.push(fullPath)
    }
  }

  return results
}

// ==================================================================
// Convenience factory
// ==================================================================

/**
 * Create an IterativeRetriever instance with the given config
 */
export function createIterativeRetriever(
  config: IterativeRetrieverConfig = {},
): IterativeRetriever {
  return new IterativeRetriever(config)
}
