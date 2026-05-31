import type { NarrativeEngine } from './narrative-engine'
import type { KnowledgeBridgeV2 } from './knowledge-bridge-v2'
import type { DimensionType } from '../memory/sqlite-memory-store'
import type { EntityType } from '../graph/graph-manager'
import type { ForeshadowAlert } from './narrative-engine'

/** 写作上下文 — 聚合三层知识供写作 Agent 使用 */
export interface WritingContext {
  // 引擎层
  entities: Array<{
    id: string
    type: EntityType
    name: string
    description: string
    tags: string[]
  }>
  recentMemories: Array<{
    dimension: DimensionType
    content: string
    importance: number
  }>
  pendingForeshadows: ForeshadowAlert[]

  // 知识层
  crystalPages: Array<{
    slug: string
    title: string
    tags: string[]
  }>
  contradictions: Array<{
    description: string
  }>

  // 分析层
  lastQualityScore: number | null
  suggestions: string[]
}

/** 从 NarrativeEngine + KnowledgeBridge 聚合写作上下文 */
export async function aggregateWritingContext(
  engine: NarrativeEngine,
  bridge: KnowledgeBridgeV2,
  chapter: number,
  lastText?: string,
): Promise<WritingContext> {
  const [entities, foreshadows, syncStatus] = await Promise.all([
    engine.queryEntities({}).catch(() => []),
    engine.getPendingForeshadows(chapter).catch(() => []),
    Promise.resolve(bridge.getSyncStatus()),
  ])

  // 拉取知识层数据
  let crystalPages: WritingContext['crystalPages'] = []
  let contradictions: WritingContext['contradictions'] = []
  if (bridge.isOnline()) {
    const [crystals, conflicts] = await Promise.all([
      (bridge as any).api?.listCrystals?.().catch(() => []) ?? [],
      bridge.pullContradictions().catch(() => []),
    ])
    crystalPages = crystals.map?.((c: any) => ({
      slug: c.slug ?? c.id,
      title: c.title ?? c.name,
      tags: c.tags ?? [],
    })) ?? []
    contradictions = conflicts.map(c => ({ description: c.description }))
  }

  // 叙事分析
  let lastQualityScore: number | null = null
  let suggestions: string[] = []
  if (lastText && lastText.length > 50) {
    const report = await engine.generateQualityReport(lastText).catch(() => null)
    if (report) {
      lastQualityScore = report.overall
      suggestions = report.suggestions
    }
  }

  // 获取最近记忆
  const recentMemories = (await (engine as any).memoryStore?.getRecentMemories?.({ limit: 15 }) ?? [])
    .map((m: any) => ({
      dimension: m.dimension ?? DimensionType.CONTEXT,
      content: m.content,
      importance: m.importance ?? 0.5,
    }))

  return {
    entities,
    recentMemories,
    pendingForeshadows: foreshadows,
    crystalPages,
    contradictions,
    lastQualityScore,
    suggestions,
  }
}
