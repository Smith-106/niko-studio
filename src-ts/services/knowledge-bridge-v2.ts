import { NowledgeMemHTTPClient } from './nowledge-mem-http-client'
import { NullNowledgeMemAPI } from './null-nowledge-mem-api'
import { NarrativeEntityMapper, type NarrativeEntityInput } from './mappers/narrative-entity-mapper'
import { DimensionalMemoryMapper, type NarrativeMemoryInput } from './mappers/dimensional-memory-mapper'
import { NarrativeRelationMapper } from './mappers/narrative-relation-mapper'
import { IncrementalSyncEngine } from './sync/incremental-sync-engine'
import { BridgeConflictResolver, type ConflictItem } from './sync/bridge-conflict-resolver'
import type { INowledgeMemService } from '../protocols/nowledge-mem'
import path from 'path'

export interface SyncReport {
  pushed: number
  pulled: number
  conflicts: number
  errors: string[]
}

export interface SyncStatus {
  knowledgeLayerOnline: boolean
  lastSyncAt: number | null
  pendingConflicts: number
  mappingCount: number
}

export class KnowledgeBridgeV2 {
  private api: INowledgeMemService
  private entityMapper: NarrativeEntityMapper
  private memoryMapper: DimensionalMemoryMapper
  private relationMapper: NarrativeRelationMapper
  private syncEngine: IncrementalSyncEngine
  private conflictResolver: BridgeConflictResolver

  constructor(
    private config: { host?: string; port?: number; dataDir: string },
  ) {
    const httpConfig = { host: config.host ?? '127.0.0.1', port: config.port ?? 19828 }
    const httpClient = new NowledgeMemHTTPClient(httpConfig)

    this.api = httpClient
    this.entityMapper = new NarrativeEntityMapper()
    this.memoryMapper = new DimensionalMemoryMapper()
    this.relationMapper = new NarrativeRelationMapper()
    this.syncEngine = new IncrementalSyncEngine(path.join(config.dataDir, 'sync-state.db'))
    this.conflictResolver = new BridgeConflictResolver()

    // 健康检查后降级
    httpClient.checkHealth().then(healthy => {
      if (!healthy) this.api = new NullNowledgeMemAPI()
    })
  }

  // === 推送：引擎层 → 知识层 ===

  async pushEntity(localId: string, input: NarrativeEntityInput): Promise<SyncReport> {
    const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, errors: [] }
    if (!this.isOnline()) { report.errors.push('Knowledge layer offline'); return report }

    try {
      const content = JSON.stringify(input)
      if (!this.syncEngine.hasChanged(localId, content)) return report

      const nowledgeEntity = this.entityMapper.toNowledge(input)
      const remoteId = this.syncEngine.getRemoteId(localId)

      if (remoteId) {
        // 更新已有
        await this.api.addMemory({ content: nowledgeEntity.description, labels: [nowledgeEntity.entity_type, ...nowledgeEntity.aliases] })
      } else {
        // 新增
        const id = await this.api.addMemory({ content: nowledgeEntity.description, labels: [nowledgeEntity.entity_type, ...nowledgeEntity.aliases] })
        this.syncEngine.recordSync(localId, id, content, 'push')
      }
      report.pushed++
    } catch (err) {
      report.errors.push(String(err))
    }
    return report
  }

  async pushMemory(localId: string, input: NarrativeMemoryInput): Promise<SyncReport> {
    const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, errors: [] }
    if (!this.isOnline()) { report.errors.push('Knowledge layer offline'); return report }

    try {
      const content = JSON.stringify(input)
      if (!this.syncEngine.hasChanged(localId, content)) return report

      const nowledgeInput = this.memoryMapper.toNowledge(input)
      const id = await this.api.addMemory({
        content: nowledgeInput.content,
        labels: nowledgeInput.labels,
        importance: nowledgeInput.importance,
      })
      this.syncEngine.recordSync(localId, id, content, 'push')
      report.pushed++
    } catch (err) {
      report.errors.push(String(err))
    }
    return report
  }

  // === 拉取：知识层 → 引擎层 ===

  async pullEntities(entityType?: string): Promise<Array<{ remoteId: string; type: string; name: string; description: string }>> {
    if (!this.isOnline()) return []
    const entities = await this.api.getEntities({ type: entityType })
    return entities.map(e => ({
      remoteId: e.id,
      type: e.entity_type,
      name: e.name,
      description: e.description,
    }))
  }

  async pullContradictions(): Promise<ConflictItem[]> {
    if (!this.isOnline()) return []
    const contradictions = await this.api.getContradictions()
    return contradictions.map(c => ({
      type: 'memory_content' as const,
      localId: c.memory_a,
      remoteId: c.memory_b,
      localValue: null,
      remoteValue: null,
      description: c.description,
    }))
  }

  // === 同步 ===

  async syncFromKnowledgeLayer(): Promise<SyncReport> {
    const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, errors: [] }
    if (!this.isOnline()) { report.errors.push('Knowledge layer offline'); return report }

    try {
      // 拉取矛盾
      const contradictions = await this.pullContradictions()
      for (const c of contradictions) {
        const resolution = this.conflictResolver.resolve(c)
        if (resolution === 'manual') report.conflicts++
      }

      // 拉取实体
      const entities = await this.pullEntities()
      report.pulled = entities.length
    } catch (err) {
      report.errors.push(String(err))
    }
    return report
  }

  async syncToKnowledgeLayer(entities: Array<{ localId: string; input: NarrativeEntityInput }>): Promise<SyncReport> {
    const report: SyncReport = { pushed: 0, pulled: 0, conflicts: 0, errors: [] }
    for (const { localId, input } of entities) {
      const r = await this.pushEntity(localId, input)
      report.pushed += r.pushed
      report.errors.push(...r.errors)
    }
    return report
  }

  // === 状态 ===

  isOnline(): boolean {
    return 'isHealthy' in this.api && (this.api as NowledgeMemHTTPClient).isHealthy
  }

  getSyncStatus(): SyncStatus {
    return {
      knowledgeLayerOnline: this.isOnline(),
      lastSyncAt: null,
      pendingConflicts: this.conflictResolver.getPendingConflicts().length,
      mappingCount: 0,
    }
  }

  getPendingConflicts(): ConflictItem[] {
    return this.conflictResolver.getPendingConflicts()
  }

  resolveConflict(index: number, resolution: 'local_wins' | 'remote_wins') {
    this.conflictResolver.resolveManual(index, resolution)
  }
}
