import { describe, it, expect } from 'vitest'
import { ForeshadowTracker } from '../services/foreshadow-tracker'
import { NarrativeAnalyzer } from '../services/narrative-analyzer'
import { QualityGateLoop } from '../services/quality-gate-loop'
import { NarrativeBrainstorm } from '../services/narrative-brainstorm'
import { AdversarialScorer } from '../services/adversarial-scorer'
import { NarrativeEntityMapper } from '../services/mappers/narrative-entity-mapper'
import { DimensionalMemoryMapper } from '../services/mappers/dimensional-memory-mapper'
import { NarrativeRelationMapper, NarrativeRelationType } from '../services/mappers/narrative-relation-mapper'
import { BridgeConflictResolver } from '../services/sync/bridge-conflict-resolver'
import { EntityType } from '../graph/graph-manager'
import { DimensionType } from '../memory/six-dimensional-memory'

/**
 * 端到端写作工作流测试
 * 模拟完整的写作→分析→评分→修订→伏笔追踪流程
 */
describe('端到端写作工作流', () => {
  const sampleText = `然而，当她推开那扇门时，一切都变了。秘密就藏在房间的最深处——一封从未寄出的信，一个从未兑现的承诺。她不得不做出选择，但真相远比想象中可怕。危险正从黑暗中逼近，而她只剩下不到一天的时间。`

  it('完整工作流：写作 → 质量分析 → 头脑风暴 → 对抗评分 → 修订 → 伏笔追踪', () => {
    // Step 1: 质量快速扫描
    const analyzer = new NarrativeAnalyzer()
    const quickScan = analyzer.generateQualityReport(sampleText)
    expect(quickScan.overall).toBeGreaterThan(0)
    expect(quickScan.dimensions).toHaveProperty('hook')
    expect(quickScan.dimensions).toHaveProperty('suspense')

    // Step 2: 8角色头脑风暴
    const brainstorm = new NarrativeBrainstorm(analyzer)
    const analyses = brainstorm.analyzeWithRoles(sampleText)
    expect(analyses).toHaveLength(8)
    expect(analyses.every(a => a.weightedScore > 0)).toBe(true)

    // Step 3: 交叉审查
    const review = brainstorm.crossReview(analyses)
    expect(review.conflicts.length + review.synergies.length + review.gaps.length).toBeGreaterThanOrEqual(0)

    // Step 4: 对抗评分
    const scorer = new AdversarialScorer(analyzer)
    const adversarialResult = scorer.score(sampleText)
    expect(adversarialResult.finalScore).toBeGreaterThan(0)
    expect(adversarialResult.confirmedDefects.length).toBeLessThanOrEqual(adversarialResult.defects.length)

    // Step 5: 质量门禁
    const gate = new QualityGateLoop(analyzer)
    const gateResult = gate.quickScan(sampleText)
    expect(gateResult.score).toBeGreaterThan(0)
    expect(['PASS', 'WARN', 'FAIL']).toContain(gateResult.result)

    // Step 6: 伏笔追踪
    const tracker = new ForeshadowTracker()
    tracker.plant('f1', 'char-1', '神秘信件', 3, 50, 10)
    tracker.plant('f2', 'char-2', '未兑现的承诺', 5, 30, 8)

    // 当前第 25 章
    const alerts = tracker.getAlerts(25)
    expect(alerts.length).toBeGreaterThan(0)

    // 回收伏笔
    tracker.resolve('f1', 25, '信件揭示真相')
    expect(tracker.getAll().find(f => f.id === 'f1')?.state).toBe('resolved')

    // 检查过期
    const expired = tracker.markExpired(40)
    expect(expired).toBeGreaterThanOrEqual(0)

    // Step 7: 实体映射
    const entityMapper = new NarrativeEntityMapper()
    const nowledgeEntity = entityMapper.toNowledge({
      type: EntityType.CHARACTER, name: '林仙儿', description: '江湖第一美人',
      aliases: ['仙儿'], role: 'antagonist',
    })
    expect(nowledgeEntity.entity_type).toBe('character')

    const reversed = entityMapper.fromNowledge(nowledgeEntity)
    expect(reversed.type).toBe(EntityType.CHARACTER)

    // Step 8: 记忆映射
    const memoryMapper = new DimensionalMemoryMapper()
    const nowledgeMemory = memoryMapper.toNowledge({
      dimension: DimensionType.CHARACTER, content: '林仙儿表面温柔实则心狠手辣',
    })
    expect(nowledgeMemory.unitType).toBe('fact')
    expect(nowledgeMemory.labels).toContain('dimension:character')

    const reversedMem = memoryMapper.fromNowledge(nowledgeMemory)
    expect(reversedMem).toBe(DimensionType.CHARACTER)

    // Step 9: 关系映射
    const relationMapper = new NarrativeRelationMapper()
    const nowledgeRelation = relationMapper.toNowledge(NarrativeRelationType.FORESHADOWS)
    expect(nowledgeRelation.type).toBe('EVOLVES')
    expect(nowledgeRelation.evolvesKind).toBe('Enriches')

    const reversedRel = relationMapper.fromNowledge(nowledgeRelation)
    expect(reversedRel).toBe(NarrativeRelationType.FORESHADOWS)

    // Step 10: 冲突解决
    const conflictResolver = new BridgeConflictResolver()
    const resolution = conflictResolver.resolve({
      type: 'entity_type', localId: '1', remoteId: '2',
      localValue: 'character', remoteValue: 'person', description: 'type mismatch',
    })
    expect(resolution).toBe('local_wins')
  })

  it('修订循环：低质量文本通过修订提升', async () => {
    const gate = new QualityGateLoop()
    const lowQualityText = '今天天气不错。'
    const revisions = [
      '然而，这一切却在一夜之间崩塌了。',
      '然而，这一切却在一夜之间崩塌了。她不得不做出选择，但真相远比想象中可怕。',
    ]
    let revIndex = 0
    const reviseFn = async () => revisions[revIndex++] ?? revisions[revisions.length - 1]
    const result = await gate.revisionLoop(lowQualityText, 'quick', reviseFn)
    expect(result.history.length).toBeGreaterThan(0)
    expect(result.history[result.history.length - 1].score).toBeGreaterThan(result.history[0].score)
  })

  it('低质量文本完整工作流仍能产出结果', () => {
    const analyzer = new NarrativeAnalyzer()
    const text = '好。'
    const report = analyzer.generateQualityReport(text)
    expect(report.overall).toBeLessThan(50)

    const brainstorm = new NarrativeBrainstorm(analyzer)
    const analyses = brainstorm.analyzeWithRoles(text)
    expect(analyses.length).toBe(8)

    const scorer = new AdversarialScorer(analyzer)
    const result = scorer.score(text)
    expect(result.finalScore).toBeLessThan(50)
  })
})
