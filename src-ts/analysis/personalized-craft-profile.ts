import type { WritingSessionIntelligenceResult } from './writing-session-intelligence-core.js'

export interface PersonalizedRevisionWeakPoint {
  dimensionId: string
  baselineScore: number
  evidence: string[]
}

export interface PersonalizedRevisionSuggestion {
  sourceDimensionId: string
  rationale: string
  expectedOutcome: string
  strategy: string
}

export interface PersonalizedRevisionComparison {
  iterationNumber: number
  resultScores: Record<string, number | undefined>
  delta: Record<string, number | undefined>
}

export interface PersonalizedRevisionIteration {
  weakPoints: PersonalizedRevisionWeakPoint[]
  suggestions: PersonalizedRevisionSuggestion[]
  comparison?: PersonalizedRevisionComparison
}

export interface PersonalizedRevisionSession {
  chapterId: string
  iterations: PersonalizedRevisionIteration[]
  lastComparison?: PersonalizedRevisionComparison
}

export interface PreferenceDimensionSummary {
  dimension: string
  accept: number
  reject: number
  modify: number
  avgValue: number
}

export interface WeaknessTrend {
  dimensionId: string
  occurrences: number
  averageBaselineScore: number
  latestDelta: number
  latestStatus: 'improving' | 'stable' | 'declining'
  supportingEvidence: string[]
}

export interface GrowthTrajectoryPoint {
  label: string
  score: number
  trend: 'up' | 'flat' | 'down'
}

export interface GrowthTrajectory {
  overallTrend: 'improving' | 'stable' | 'declining'
  points: GrowthTrajectoryPoint[]
  summary: string
}

export interface PersonalizedCraftRecommendation {
  id: string
  title: string
  summary: string
  dimensionId: string
  catalogReference: string
  source: 'revision' | 'session' | 'preference'
  evidence: string[]
  confidence: number
}

export interface PersonalizedCraftProfile {
  profileId: string
  generatedAt: string
  dominantWeaknesses: WeaknessTrend[]
  preferenceProfile: PreferenceDimensionSummary[]
  growthTrajectory: GrowthTrajectory
  recommendations: PersonalizedCraftRecommendation[]
  dataCompleteness: 'insufficient' | 'partial' | 'sufficient'
}

export interface PersonalizedCraftProfileInput {
  revisionSessions?: PersonalizedRevisionSession[]
  sessionIntelligence?: WritingSessionIntelligenceResult[]
  preferenceProfile?: Record<string, { accept: number; reject: number; modify: number; avgValue: number }>
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, round(value)))
}

function normalizePreferenceProfile(
  input: PersonalizedCraftProfileInput['preferenceProfile'],
): PreferenceDimensionSummary[] {
  if (!input) return []
  return Object.entries(input)
    .map(([dimension, profile]) => ({
      dimension,
      accept: profile.accept,
      reject: profile.reject,
      modify: profile.modify,
      avgValue: round(profile.avgValue),
    }))
    .sort((a, b) => {
      const deltaA = a.modify + a.reject - a.accept
      const deltaB = b.modify + b.reject - b.accept
      return deltaB - deltaA
    })
}

function buildWeaknessTrends(revisionSessions: PersonalizedRevisionSession[]): WeaknessTrend[] {
  const aggregate = new Map<string, {
    baselines: number[]
    deltas: number[]
    evidence: string[]
    occurrences: number
  }>()

  for (const session of revisionSessions) {
    for (const iteration of session.iterations) {
      for (const weakPoint of iteration.weakPoints) {
        const current = aggregate.get(weakPoint.dimensionId) ?? {
          baselines: [],
          deltas: [],
          evidence: [],
          occurrences: 0,
        }
        current.baselines.push(weakPoint.baselineScore)
        current.evidence.push(...weakPoint.evidence.slice(0, 2))
        current.occurrences += 1
        aggregate.set(weakPoint.dimensionId, current)
      }
      if (iteration.comparison) {
        appendComparisonDelta(aggregate, iteration.comparison, iteration.suggestions)
      }
    }
  }

  return [...aggregate.entries()]
    .map(([dimensionId, item]) => {
      const latestDelta = item.deltas.length > 0 ? item.deltas[item.deltas.length - 1] ?? 0 : 0
      const latestStatus = latestDelta > 0.2
        ? 'improving'
        : latestDelta < -0.2
          ? 'declining'
          : 'stable'
      return {
        dimensionId,
        occurrences: item.occurrences,
        averageBaselineScore: average(item.baselines),
        latestDelta: round(latestDelta),
        latestStatus,
        supportingEvidence: [...new Set(item.evidence)].slice(0, 4),
      } satisfies WeaknessTrend
    })
    .sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences
      return a.averageBaselineScore - b.averageBaselineScore
    })
}

function appendComparisonDelta(
  aggregate: Map<string, { baselines: number[]; deltas: number[]; evidence: string[]; occurrences: number }>,
  comparison: PersonalizedRevisionComparison,
  suggestions: PersonalizedRevisionSuggestion[],
): void {
  for (const [dimensionId, delta] of Object.entries(comparison.delta)) {
    const numericDelta = typeof delta === 'number' ? delta : 0
    const current = aggregate.get(dimensionId) ?? {
      baselines: [],
      deltas: [],
      evidence: [],
      occurrences: 0,
    }
    current.deltas.push(numericDelta)
    const suggestion = suggestions.find((item) => item.sourceDimensionId === dimensionId)
    if (suggestion) {
      current.evidence.push(suggestion.rationale || suggestion.expectedOutcome || suggestion.strategy)
    }
    aggregate.set(dimensionId, current)
  }
}

function buildGrowthTrajectory(
  revisionSessions: PersonalizedRevisionSession[],
  sessionIntelligence: WritingSessionIntelligenceResult[],
): GrowthTrajectory {
  const points: GrowthTrajectoryPoint[] = []

  for (const session of revisionSessions) {
    const comparison = session.lastComparison
    if (!comparison) continue
    const score = average(Object.values(comparison.resultScores).filter((value): value is number => typeof value === 'number'))
    const previous = points.length > 0 ? points[points.length - 1] : undefined
    const trend = previous
      ? score > previous.score + 0.2
        ? 'up'
        : score < previous.score - 0.2
          ? 'down'
          : 'flat'
      : 'flat'
    points.push({
      label: `${session.chapterId}#${comparison.iterationNumber}`,
      score,
      trend,
    })
  }

  for (const intelligence of sessionIntelligence.slice(-3)) {
    const fatigueSignal = intelligence.insights.find((item) => item.pattern === 'fatigue_risk' || item.pattern === 'stalling')
    if (!fatigueSignal) continue
    points.push({
      label: `${intelligence.telemetry.chapterId ?? 'session'}:${intelligence.telemetry.sessionId}`,
      score: round(Math.max(0, 10 - (fatigueSignal.confidence * 5))),
      trend: 'flat',
    })
  }

  const rising = points.filter((point) => point.trend === 'up').length
  const falling = points.filter((point) => point.trend === 'down').length
  const overallTrend = rising > falling
    ? 'improving'
    : falling > rising
      ? 'declining'
      : 'stable'

  const summary = overallTrend === 'improving'
    ? '近期个性化画像显示主要弱项有改善趋势。'
    : overallTrend === 'declining'
      ? '近期个性化画像显示部分弱项有回退，需要集中处理。'
      : '近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。'

  return {
    overallTrend,
    points: points.slice(-6),
    summary,
  }
}

function buildRecommendations(
  weaknessTrends: WeaknessTrend[],
  sessionIntelligence: WritingSessionIntelligenceResult[],
  preferenceProfile: PreferenceDimensionSummary[],
): PersonalizedCraftRecommendation[] {
  const recommendations: PersonalizedCraftRecommendation[] = []

  for (const trend of weaknessTrends.slice(0, 3)) {
    recommendations.push({
      id: `personalized-craft-${trend.dimensionId}`,
      title: `${trend.dimensionId} 个性化改进建议`,
      summary: trend.latestStatus === 'declining'
        ? `近期 ${trend.dimensionId} 呈回退趋势，建议优先针对该维度做小范围修订。`
        : `近期 ${trend.dimensionId} 仍是高频弱项，适合继续做定向打磨。`,
      dimensionId: trend.dimensionId,
      catalogReference: `catalog:personalized.${trend.dimensionId}`,
      source: 'revision',
      evidence: trend.supportingEvidence.slice(0, 3),
      confidence: clampConfidence(Math.min(1, trend.occurrences / 5)),
    })
  }

  for (const preference of preferenceProfile.slice(0, 2)) {
    if (preference.reject === 0 && preference.modify === 0) continue
    recommendations.push({
      id: `preference-${preference.dimension}`,
      title: `${preference.dimension} 偏好提醒`,
      summary: `历史反馈显示你在 ${preference.dimension} 维度上更常修改或拒绝生成结果，建议在本轮写作前主动设定该维度目标。`,
      dimensionId: preference.dimension,
      catalogReference: `catalog:preference.${preference.dimension}`,
      source: 'preference',
      evidence: [
        `accept=${preference.accept}`,
        `reject=${preference.reject}`,
        `modify=${preference.modify}`,
      ],
      confidence: clampConfidence(Math.min(1, (preference.reject + preference.modify) / Math.max(1, preference.accept + preference.reject + preference.modify))),
    })
  }

  const sessionSignal = sessionIntelligence.find((item) => item.insights.some((insight) => insight.pattern !== 'steady_progress'))
  if (sessionSignal) {
    const insight = sessionSignal.insights[0]
    recommendations.push({
      id: `session-${sessionSignal.telemetry.sessionId}`,
      title: '会话节奏提示',
      summary: insight.summary,
      dimensionId: insight.pattern,
      catalogReference: 'catalog:session-intelligence.advisory',
      source: 'session',
      evidence: [insight.suggestion, ...(sessionSignal.telemetry.recentActions.slice(-2))],
      confidence: clampConfidence(insight.confidence),
    })
  }

  return recommendations.slice(0, 5)
}

export function buildPersonalizedCraftProfile(
  input: PersonalizedCraftProfileInput,
): PersonalizedCraftProfile {
  const revisionSessions = input.revisionSessions ?? []
  const sessionIntelligence = input.sessionIntelligence ?? []
  const preferenceProfile = normalizePreferenceProfile(input.preferenceProfile)
  const weaknessTrends = buildWeaknessTrends(revisionSessions)
  const growthTrajectory = buildGrowthTrajectory(revisionSessions, sessionIntelligence)
  const recommendations = buildRecommendations(weaknessTrends, sessionIntelligence, preferenceProfile)
  const signalCount = revisionSessions.length + sessionIntelligence.length + preferenceProfile.length

  return {
    profileId: `personalized-craft-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    dominantWeaknesses: weaknessTrends.slice(0, 5),
    preferenceProfile,
    growthTrajectory,
    recommendations,
    dataCompleteness: signalCount >= 6
      ? 'sufficient'
      : signalCount >= 3
        ? 'partial'
        : 'insufficient',
  }
}
