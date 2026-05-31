/** niko-studio RelationType ↔ Nowledge Mem Relation 映射 */
export enum NarrativeRelationType {
  KNOWS = 'KNOWS',
  LOCATED_IN = 'LOCATED_IN',
  PARTICIPATES = 'PARTICIPATES',
  OWNS = 'OWNS',
  CAUSES = 'CAUSES',
  PRECEDES = 'PRECEDES',
  FOLLOWS = 'FOLLOWS',
  RELATED_TO = 'RELATED_TO',
  FORESHADOWS = 'FORESHADOWS',
  RESOLVES = 'RESOLVES',
  CONFLICTS_WITH = 'CONFLICTS_WITH',
  SERVES = 'SERVES',
  OPPOSES = 'OPPOSES',
}

interface NowledgeRelation {
  type: string
  evolvesKind?: 'Replaces' | 'Enriches' | 'Confirms' | 'Challenges'
  strength?: number
  metadata?: Record<string, unknown>
}

const RELATION_MAP: Record<string, NowledgeRelation> = {
  [NarrativeRelationType.KNOWS]: { type: 'RELATED' },
  [NarrativeRelationType.LOCATED_IN]: { type: 'PART_OF' },
  [NarrativeRelationType.PARTICIPATES]: { type: 'ENABLED' },
  [NarrativeRelationType.OWNS]: { type: 'RELATED' },
  [NarrativeRelationType.CAUSES]: { type: 'CAUSED' },
  [NarrativeRelationType.PRECEDES]: { type: 'PRECEDED' },
  [NarrativeRelationType.FOLLOWS]: { type: 'PRECEDED' },
  [NarrativeRelationType.RELATED_TO]: { type: 'RELATED' },
  [NarrativeRelationType.FORESHADOWS]: { type: 'EVOLVES', evolvesKind: 'Enriches' },
  [NarrativeRelationType.RESOLVES]: { type: 'EVOLVES', evolvesKind: 'Confirms' },
  [NarrativeRelationType.CONFLICTS_WITH]: { type: 'EVOLVES', evolvesKind: 'Challenges' },
  [NarrativeRelationType.SERVES]: { type: 'CAUSED' },
  [NarrativeRelationType.OPPOSES]: { type: 'EVOLVES', evolvesKind: 'Challenges' },
}

const REVERSE_RELATION_MAP: Record<string, NarrativeRelationType> = {
  'RELATED': NarrativeRelationType.RELATED_TO,
  'PART_OF': NarrativeRelationType.LOCATED_IN,
  'ENABLED': NarrativeRelationType.PARTICIPATES,
  'CAUSED': NarrativeRelationType.CAUSES,
  'PRECEDED': NarrativeRelationType.PRECEDES,
}

export class NarrativeRelationMapper {
  /** 引擎层关系 → Nowledge Mem 关系 */
  toNowledge(relationType: string, strength?: number): NowledgeRelation {
    const mapped = RELATION_MAP[relationType]
    if (!mapped) return { type: 'RELATED', metadata: { narrative_type: relationType } }

    const metadata: Record<string, unknown> = {}
    if (relationType === NarrativeRelationType.FORESHADOWS ||
        relationType === NarrativeRelationType.OPPOSES ||
        relationType === NarrativeRelationType.RESOLVES) {
      metadata.narrative_type = relationType.toLowerCase()
    }

    return { ...mapped, strength: strength ?? 0.5, metadata }
  }

  /** Nowledge Mem 关系 → 引擎层关系类型 */
  fromNowledge(relation: NowledgeRelation): NarrativeRelationType {
    if (relation.type === 'EVOLVES' && relation.evolvesKind) {
      switch (relation.evolvesKind) {
        case 'Enriches': return NarrativeRelationType.FORESHADOWS
        case 'Confirms': return NarrativeRelationType.RESOLVES
        case 'Challenges': return NarrativeRelationType.CONFLICTS_WITH
      }
    }
    // 检查 metadata 中的 narrative_type
    if (relation.metadata?.narrative_type) {
      const nt = (relation.metadata.narrative_type as string).toUpperCase()
      if (Object.values(NarrativeRelationType).includes(nt as NarrativeRelationType)) {
        return nt as NarrativeRelationType
      }
    }
    return REVERSE_RELATION_MAP[relation.type] ?? NarrativeRelationType.RELATED_TO
  }
}
