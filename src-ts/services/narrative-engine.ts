import type { KnowledgeBridgeV2, SyncReport, SyncStatus } from './knowledge-bridge-v2'
import type { NarrativeEntityInput } from './mappers/narrative-entity-mapper'
import type { NarrativeMemoryInput } from './mappers/dimensional-memory-mapper'
import { NarrativeRelationType } from './mappers/narrative-relation-mapper'
import { EntityType } from '../graph/graph-manager'
import { DimensionType } from '../memory/sqlite-memory-store'
import { ForeshadowTracker, type ForeshadowRecord } from './foreshadow-tracker'
import { NarrativeAnalyzer, type HookResult, type CliffhangerResult, type EmotionCraftResult, type SuspenseResult, type QualityReport } from './narrative-analyzer'

// === 类型定义 ===

export type { EntityType, DimensionType, NarrativeRelationType, ForeshadowRecord }
export type { HookResult, CliffhangerResult, EmotionCraftResult, SuspenseResult, QualityReport }

export interface NarrativeEntity {
  id: string
  type: EntityType
  name: string
  description: string
  aliases: string[]
  role?: string
  firstAppearance?: number
  tags: string[]
}

export interface ForeshadowAlert {
  foreshadowId: string
  hint: string
  plantedAt: number
  currentChapter: number
  chaptersUntilDue: number
  urgency: 'approaching' | 'due' | 'overdue'
}

export interface HookAnalysis {
  score: number
  type: string
  strength: number
  suggestion?: string
}

export interface CliffhangerScore {
  score: number
  dimensions: { tension: number; uncertainty: number; emotional: number; curiosity: number }
}

export interface WritingContext {
  entities: NarrativeEntity[]
  recentMemories: Array<{ dimension: DimensionType; content: string }>
  pendingForeshadows: ForeshadowAlert[]
  contradictions: Array<{ description: string }>
}

// === NarrativeEngine 统一门面 ===

export class NarrativeEngine {
  private foreshadowTracker: ForeshadowTracker
  private narrativeAnalyzer: NarrativeAnalyzer

  constructor(
    private graphManager: any,
    private memoryStore: any,
    private bridge: KnowledgeBridgeV2,
  ) {
    this.foreshadowTracker = new ForeshadowTracker()
    this.narrativeAnalyzer = new NarrativeAnalyzer()
  }

  // === 叙事实体 ===

  async addEntity(type: EntityType, props: Omit<NarrativeEntityInput, 'type'>): Promise<string> {
    const id = await this.graphManager.addEntity(type, props.name, props.description, props)
    // 异步推送到知识层
    this.bridge.pushEntity(id, { type, ...props }).catch(() => {})
    return id
  }

  async getEntity(id: string): Promise<NarrativeEntity | null> {
    const entity = await this.graphManager.getEntity(id)
    return entity ?? null
  }

  async queryEntities(filter: { type?: EntityType; name?: string }): Promise<NarrativeEntity[]> {
    return this.graphManager.queryEntities(filter)
  }

  // === 叙事关系 ===

  async addRelation(from: string, to: string, type: NarrativeRelationType, strength?: number): Promise<string> {
    return this.graphManager.addRelation(from, to, type, { strength })
  }

  async traverse(start: string, opts: { depth?: number; relationTypes?: NarrativeRelationType[] }): Promise<any> {
    return this.graphManager.traverse(start, opts)
  }

  // === 六维记忆 ===

  async addNarrativeMemory(dimension: DimensionType, content: string, opts?: { entityId?: string; importance?: number; chapter?: number }): Promise<string> {
    const id = await this.memoryStore.addMemory(dimension, content, opts)
    // 异步推送到知识层
    this.bridge.pushMemory(id, { dimension, content, ...opts }).catch(() => {})
    return id
  }

  async queryNarrativeMemory(dimension: DimensionType, query: string, opts?: { limit?: number }): Promise<any[]> {
    return this.memoryStore.searchMemories(query, { dimension, ...opts })
  }

  // === 伏笔追踪 ===

  async plantForeshadow(fromEntityId: string, hint: string, chapter: number, opts?: { maxDistance?: number; reminderThreshold?: number }): Promise<string> {
    const id = crypto.randomUUID()
    this.foreshadowTracker.plant(id, fromEntityId, hint, chapter, opts?.maxDistance, opts?.reminderThreshold)
    if (this.graphManager) {
      await this.graphManager.addRelation(fromEntityId, id, NarrativeRelationType.FORESHADOWS).catch(() => {})
    }
    return id
  }

  async resolveForeshadow(id: string, chapter: number, resolution: string): Promise<void> {
    this.foreshadowTracker.resolve(id, chapter, resolution)
  }

  async getPendingForeshadows(currentChapter: number): Promise<ForeshadowAlert[]> {
    this.foreshadowTracker.markExpired(currentChapter)
    return this.foreshadowTracker.getAlerts(currentChapter)
  }

  // === 叙事分析 ===

  async analyzeHook(text: string, _chapter?: number): Promise<HookResult> {
    return this.narrativeAnalyzer.analyzeHook(text)
  }

  async analyzeCliffhanger(text: string): Promise<CliffhangerResult> {
    return this.narrativeAnalyzer.analyzeCliffhanger(text)
  }

  async analyzeEmotionCraft(text: string): Promise<EmotionCraftResult> {
    return this.narrativeAnalyzer.analyzeEmotionCraft(text)
  }

  async analyzeSuspense(text: string): Promise<SuspenseResult> {
    return this.narrativeAnalyzer.analyzeSuspense(text)
  }

  async generateQualityReport(text: string): Promise<QualityReport> {
    return this.narrativeAnalyzer.generateQualityReport(text)
  }

  // === 知识同步 ===

  async syncFromKnowledgeLayer(): Promise<SyncReport> {
    return this.bridge.syncFromKnowledgeLayer()
  }

  async syncToKnowledgeLayer(entities: Array<{ localId: string; input: NarrativeEntityInput }>): Promise<SyncReport> {
    return this.bridge.syncToKnowledgeLayer(entities)
  }

  getSyncStatus(): SyncStatus {
    return this.bridge.getSyncStatus()
  }

  // === 写作上下文聚合 ===

  async getWritingContext(chapter: number, projectId?: string): Promise<WritingContext> {
    const [entities, memories, foreshadows, contradictions] = await Promise.all([
      this.queryEntities({}),
      this.memoryStore.getRecentMemories({ limit: 20 }),
      this.getPendingForeshadows(chapter),
      this.bridge.getPendingConflicts(),
    ])

    return {
      entities,
      recentMemories: memories.map((m: any) => ({ dimension: m.dimension ?? DimensionType.CONTEXT, content: m.content })),
      pendingForeshadows: foreshadows,
      contradictions: contradictions.map(c => ({ description: c.description })),
    }
  }
}
