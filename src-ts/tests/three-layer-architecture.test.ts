import { describe, it, expect } from 'vitest'
import { ForeshadowTracker } from '../services/foreshadow-tracker'
import { NarrativeAnalyzer } from '../services/narrative-analyzer'
import { NarrativeEntityMapper } from '../services/mappers/narrative-entity-mapper'
import { DimensionalMemoryMapper } from '../services/mappers/dimensional-memory-mapper'
import { NarrativeRelationMapper, NarrativeRelationType } from '../services/mappers/narrative-relation-mapper'
import { BridgeConflictResolver } from '../services/sync/bridge-conflict-resolver'
import { EntityType } from '../graph/graph-manager'
import { DimensionType } from '../memory/six-dimensional-memory'

describe('ForeshadowTracker', () => {
  it('should plant and resolve foreshadows', () => {
    const tracker = new ForeshadowTracker()
    tracker.plant('f1', 'char1', '神秘信件', 3, 50, 10)
    const resolved = tracker.resolve('f1', 20, '信件揭示真相')
    expect(resolved).toBe(true)
    expect(tracker.getAll()[0].state).toBe('resolved')
  })

  it('should detect approaching foreshadows', () => {
    const tracker = new ForeshadowTracker()
    tracker.plant('f1', 'char1', '伏笔A', 1, 50, 10)
    tracker.plant('f2', 'char2', '伏笔B', 10, 30, 10)

    const alerts = tracker.getAlerts(25) // f1 距离50-24=26(approaching), f2 距离30-15=15(approaching)
    expect(alerts.length).toBe(2)
  })

  it('should detect due foreshadows', () => {
    const tracker = new ForeshadowTracker()
    tracker.plant('f1', 'char1', '紧急伏笔', 1, 20, 10)
    const alerts = tracker.getAlerts(12) // 距离 20-11=9, < reminder=10
    expect(alerts[0].urgency).toBe('due')
  })

  it('should mark expired foreshadows', () => {
    const tracker = new ForeshadowTracker()
    tracker.plant('f1', 'char1', '过期伏笔', 1, 10, 5)
    const expired = tracker.markExpired(15)
    expect(expired).toBe(1)
    expect(tracker.getAll()[0].state).toBe('expired')
  })
})

describe('NarrativeAnalyzer', () => {
  const analyzer = new NarrativeAnalyzer()

  it('should detect hook in conflict opening', () => {
    const result = analyzer.analyzeHook('然而，这一切却在一夜之间崩塌了。她不得不做出选择。')
    expect(result.score).toBeGreaterThan(40)
    expect(result.hookType).toBe('stakes')
  })

  it('should give low score to flat opening', () => {
    const result = analyzer.analyzeHook('今天天气不错。')
    expect(result.score).toBeLessThan(30)
  })

  it('should detect cliffhanger', () => {
    const result = analyzer.analyzeCliffhanger('她推开门，却发现里面空无一人。真相究竟是什么？')
    expect(result.score).toBeGreaterThan(40)
    expect(result.curiosity).toBeGreaterThan(50)
  })

  it('should analyze show-don\'t-tell', () => {
    const result = analyzer.analyzeEmotionCraft('她的手指微微颤抖，指尖冰凉，胸口像被什么堵住了。')
    expect(result.showTellRatio).toBeGreaterThan(0.5)
  })

  it('should detect low show-tell ratio', () => {
    const result = analyzer.analyzeEmotionCraft('她感到非常悲伤，心情很低落。')
    expect(result.showTellRatio).toBeLessThan(0.5)
  })

  it('should generate quality report', () => {
    const report = analyzer.generateQualityReport('然而，秘密就在那扇门后。她不得不推开门。')
    expect(report.overall).toBeGreaterThan(0)
    expect(report.dimensions).toHaveProperty('hook')
    expect(report.dimensions).toHaveProperty('suspense')
  })
})

describe('NarrativeEntityMapper', () => {
  const mapper = new NarrativeEntityMapper()

  it('should map CHARACTER to nowledge entity', () => {
    const result = mapper.toNowledge({
      type: EntityType.CHARACTER,
      name: '林仙儿',
      description: '江湖第一美人',
      aliases: ['仙儿'],
      role: 'antagonist',
    })
    expect(result.entity_type).toBe('character')
    expect(result.name).toBe('林仙儿')
  })

  it('should reverse map nowledge entity type', () => {
    const result = mapper.fromNowledge({ id: '1', entity_type: 'location', name: '洛阳', description: '', aliases: [] })
    expect(result.type).toBe(EntityType.LOCATION)
  })
})

describe('DimensionalMemoryMapper', () => {
  const mapper = new DimensionalMemoryMapper()

  it('should map timeline dimension', () => {
    const result = mapper.toNowledge({ dimension: DimensionType.TIMELINE, content: '事件发生' })
    expect(result.unitType).toBe('event')
    expect(result.labels).toContain('dimension:timeline')
  })

  it('should reverse map from nowledge labels', () => {
    const result = mapper.fromNowledge({ unitType: 'fact', labels: ['dimension:character', 'char:123'] })
    expect(result).toBe(DimensionType.CHARACTER)
  })
})

describe('NarrativeRelationMapper', () => {
  const mapper = new NarrativeRelationMapper()

  it('should map FORESHADOWS to EVOLVES+Enriches', () => {
    const result = mapper.toNowledge(NarrativeRelationType.FORESHADOWS)
    expect(result.type).toBe('EVOLVES')
    expect(result.evolvesKind).toBe('Enriches')
  })

  it('should reverse map EVOLVES+Challenges to CONFLICTS_WITH', () => {
    const result = mapper.fromNowledge({ type: 'EVOLVES', evolvesKind: 'Challenges' })
    expect(result).toBe(NarrativeRelationType.CONFLICTS_WITH)
  })
})

describe('BridgeConflictResolver', () => {
  const resolver = new BridgeConflictResolver()

  it('should resolve entity_type conflicts with local_wins', () => {
    const result = resolver.resolve({
      type: 'entity_type', localId: '1', remoteId: '2',
      localValue: 'character', remoteValue: 'person', description: 'type mismatch',
    })
    expect(result).toBe('local_wins')
  })

  it('should resolve memory_content conflicts with remote_wins', () => {
    const result = resolver.resolve({
      type: 'memory_content', localId: '1', remoteId: '2',
      localValue: 'old', remoteValue: 'new', description: 'content updated',
    })
    expect(result).toBe('remote_wins')
  })

  it('should queue relation_type conflicts for manual review', () => {
    const result = resolver.resolve({
      type: 'relation_type', localId: '1', remoteId: '2',
      localValue: 'KNOWS', remoteValue: 'PART_OF', description: 'relation mismatch',
    })
    expect(result).toBe('manual')
    expect(resolver.getPendingConflicts()).toHaveLength(1)
  })
})
