import { EntityType } from '../graph/graph-manager'

/** niko-studio EntityType ↔ Nowledge Mem entity_type 映射 */
const ENTITY_TYPE_MAP: Record<EntityType, string> = {
  [EntityType.CHARACTER]: 'character',
  [EntityType.LOCATION]: 'location',
  [EntityType.EVENT]: 'event',
  [EntityType.OBJECT]: 'object',
  [EntityType.CONCEPT]: 'concept',
  [EntityType.TIMELINE]: 'timeline',
}

const REVERSE_MAP: Record<string, EntityType> = Object.fromEntries(
  Object.entries(ENTITY_TYPE_MAP).map(([k, v]) => [v, k as EntityType])
)

export interface NowledgeEntity {
  id: string
  entity_type: string
  name: string
  description: string
  aliases: string[]
  metadata?: Record<string, unknown>
}

export interface NarrativeEntityInput {
  type: EntityType
  name: string
  description: string
  aliases?: string[]
  role?: string
  firstAppearance?: number
  foreshadowMaxDistance?: number
  reminderThreshold?: number
}

export class NarrativeEntityMapper {
  /** 引擎层实体 → Nowledge Mem 实体 */
  toNowledge(input: NarrativeEntityInput): NowledgeEntity {
    const metadata: Record<string, unknown> = {}
    if (input.role) metadata.role = input.role
    if (input.firstAppearance != null) metadata.first_chapter = input.firstAppearance
    if (input.foreshadowMaxDistance != null) metadata.foreshadow_max_distance = input.foreshadowMaxDistance
    if (input.reminderThreshold != null) metadata.reminder_threshold = input.reminderThreshold

    // FORESHADOW / PLOT_THREAD 降级为 concept + labels
    let entityType = ENTITY_TYPE_MAP[input.type]
    const labels: string[] = []
    if (input.type === EntityType.CONCEPT) {
      // niko-studio 没有 FORESHADOW enum，但如果有自定义类型会走这里
      if (input.foreshadowMaxDistance != null) {
        entityType = 'concept'
        labels.push('foreshadow', 'narrative-device')
      }
    }

    return {
      id: '', // 由 Nowledge Mem 分配
      entity_type: entityType,
      name: input.name,
      description: input.description,
      aliases: input.aliases ?? [],
      metadata: { ...metadata, labels },
    }
  }

  /** Nowledge Mem 实体 → 引擎层实体类型 */
  fromNowledge(entity: NowledgeEntity): { type: EntityType; metadata: Record<string, unknown> } {
    const type = REVERSE_MAP[entity.entity_type] ?? EntityType.CONCEPT
    const metadata = entity.metadata ?? {}
    return { type, metadata }
  }
}
