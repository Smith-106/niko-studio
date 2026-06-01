import { DimensionType } from '../../memory/six-dimensional-memory'

/** niko-studio DimensionType ↔ Nowledge Mem unit_type + labels 映射 */
const DIMENSION_MAP: Record<DimensionType, { unitType: string; labels: string[] }> = {
  [DimensionType.TIMELINE]: { unitType: 'event', labels: ['dimension:timeline'] },
  [DimensionType.CONTEXT]: { unitType: 'context', labels: ['dimension:context'] },
  [DimensionType.CHARACTER]: { unitType: 'fact', labels: ['dimension:character'] },
  [DimensionType.WORLDVIEW]: { unitType: 'fact', labels: ['dimension:worldview'] },
  [DimensionType.PREFERENCE]: { unitType: 'preference', labels: ['dimension:preference'] },
  [DimensionType.EXPERIENCE]: { unitType: 'learning', labels: ['dimension:experience'] },
}

const REVERSE_DIMENSION_MAP: Record<string, DimensionType> = {}
for (const [dim, { unitType }] of Object.entries(DIMENSION_MAP)) {
  REVERSE_DIMENSION_MAP[unitType] = dim as DimensionType
}

export interface NowledgeMemoryInput {
  content: string
  unitType: string
  labels: string[]
  importance?: number
  temporalContext?: 'past' | 'present' | 'future' | 'timeless'
  eventStart?: string
  eventEnd?: string
  metadata?: Record<string, unknown>
}

export interface NarrativeMemoryInput {
  dimension: DimensionType
  content: string
  entityId?: string
  importance?: number
  eventStart?: string
  eventEnd?: string
  chapter?: number
}

export class DimensionalMemoryMapper {
  /** 引擎层六维记忆 → Nowledge Mem 记忆 */
  toNowledge(input: NarrativeMemoryInput): NowledgeMemoryInput {
    const mapping = DIMENSION_MAP[input.dimension]
    const labels = [...mapping.labels]
    if (input.entityId) labels.push(`char:${input.entityId}`)
    if (input.chapter != null) labels.push(`chapter:${input.chapter}`)

    let temporalContext: NowledgeMemoryInput['temporalContext']
    if (input.dimension === DimensionType.TIMELINE) temporalContext = 'past'

    return {
      content: input.content,
      unitType: mapping.unitType,
      labels,
      importance: input.importance,
      temporalContext,
      eventStart: input.eventStart,
      eventEnd: input.eventEnd,
    }
  }

  /** Nowledge Mem 记忆 → 引擎层维度类型 */
  fromNowledge(memory: { unitType: string; labels: string[] }): DimensionType {
    // 优先从 labels 中的 dimension:xxx 解析
    const dimLabel = memory.labels.find(l => l.startsWith('dimension:'))
    if (dimLabel) {
      const dim = dimLabel.replace('dimension:', '')
      if (Object.values(DimensionType).includes(dim as DimensionType)) {
        return dim as DimensionType
      }
    }
    // 降级到 unit_type 映射
    return REVERSE_DIMENSION_MAP[memory.unitType] ?? DimensionType.CONTEXT
  }
}
