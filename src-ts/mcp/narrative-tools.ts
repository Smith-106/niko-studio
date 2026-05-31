import type { NarrativeEngine } from '../services/narrative-engine'
import type { KnowledgeBridgeV2 } from '../services/knowledge-bridge-v2'
import type { NarrativeAnalyzer } from '../services/narrative-analyzer'
import { EntityType } from '../graph/graph-manager'
import { DimensionType } from '../memory/sqlite-memory-store'
import { NarrativeRelationType } from '../services/mappers/narrative-relation-mapper'

/** MCP 工具注册表 — 叙事引擎 + 知识桥接 + 叙事分析 */
export function registerNarrativeTools(
  engine: NarrativeEngine,
  bridge: KnowledgeBridgeV2,
  analyzer: NarrativeAnalyzer,
) {
  return {
    // === 叙事实体 ===
    'narrative.add_entity': async (params: { type: string; name: string; description: string; aliases?: string[] }) => {
      const type = EntityType[params.type.toUpperCase() as keyof typeof EntityType] ?? EntityType.CONCEPT
      const id = await engine.addEntity(type, { name: params.name, description: params.description, aliases: params.aliases })
      return { id, type, name: params.name }
    },

    'narrative.get_entity': async (params: { id: string }) => {
      const entity = await engine.getEntity(params.id)
      return entity ?? { error: 'Entity not found' }
    },

    'narrative.query_entities': async (params: { type?: string; name?: string }) => {
      const type = params.type ? EntityType[params.type.toUpperCase() as keyof typeof EntityType] : undefined
      return engine.queryEntities({ type, name: params.name })
    },

    // === 叙事关系 ===
    'narrative.add_relation': async (params: { from: string; to: string; type: string; strength?: number }) => {
      const type = NarrativeRelationType[params.type.toUpperCase() as keyof typeof NarrativeRelationType] ?? NarrativeRelationType.RELATED_TO
      const id = await engine.addRelation(params.from, params.to, type, params.strength)
      return { id }
    },

    // === 六维记忆 ===
    'narrative.add_memory': async (params: { dimension: string; content: string; entityId?: string; importance?: number; chapter?: number }) => {
      const dimension = DimensionType[params.dimension.toUpperCase() as keyof typeof DimensionType] ?? DimensionType.CONTEXT
      const id = await engine.addNarrativeMemory(dimension, params.content, {
        entityId: params.entityId, importance: params.importance, chapter: params.chapter,
      })
      return { id, dimension }
    },

    // === 伏笔追踪 ===
    'narrative.plant_foreshadow': async (params: { entityId: string; hint: string; chapter: number; maxDistance?: number }) => {
      const id = await engine.plantForeshadow(params.entityId, params.hint, params.chapter, {
        maxDistance: params.maxDistance,
      })
      return { id }
    },

    'narrative.get_foreshadow_alerts': async (params: { currentChapter: number }) => {
      return engine.getPendingForeshadows(params.currentChapter)
    },

    // === 叙事分析 ===
    'narrative.analyze_hook': async (params: { text: string; chapter?: number }) => {
      return analyzer.analyzeHook(params.text)
    },

    'narrative.analyze_cliffhanger': async (params: { text: string }) => {
      return analyzer.analyzeCliffhanger(params.text)
    },

    'narrative.analyze_emotion_craft': async (params: { text: string }) => {
      return analyzer.analyzeEmotionCraft(params.text)
    },

    'narrative.analyze_suspense': async (params: { text: string }) => {
      return analyzer.analyzeSuspense(params.text)
    },

    'narrative.quality_report': async (params: { text: string }) => {
      return analyzer.generateQualityReport(params.text)
    },

    // === 知识同步 ===
    'nowledge.sync_from': async () => {
      return bridge.syncFromKnowledgeLayer()
    },

    'nowledge.bridge_status': async () => {
      return bridge.getSyncStatus()
    },

    'nowledge.resolve_conflict': async (params: { index: number; resolution: 'local_wins' | 'remote_wins' }) => {
      bridge.resolveConflict(params.index, params.resolution)
      return { resolved: true }
    },

    // === 写作上下文 ===
    'narrative.writing_context': async (params: { chapter: number; projectId?: string }) => {
      return engine.getWritingContext(params.chapter, params.projectId)
    },
  }
}

export type NarrativeToolRegistry = ReturnType<typeof registerNarrativeTools>
