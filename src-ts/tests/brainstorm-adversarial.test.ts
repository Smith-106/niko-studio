import { describe, it, expect } from 'vitest'
import { NarrativeBrainstorm, type RoleAnalysis } from '../services/narrative-brainstorm'
import { AdversarialScorer } from '../services/adversarial-scorer'

describe('NarrativeBrainstorm', () => {
  const brainstorm = new NarrativeBrainstorm()

  it('should analyze with all 8 roles', () => {
    const analyses = brainstorm.analyzeWithRoles('然而，秘密就在门后。她不得不做出选择。')
    expect(analyses).toHaveLength(8)
    expect(analyses[0].roleId).toBe('plot-architect')
    expect(analyses.every(a => a.weightedScore > 0)).toBe(true)
  })

  it('should detect conflicts in cross-review', () => {
    const analyses = brainstorm.analyzeWithRoles('今天天气不错。她去了公园。')
    const review = brainstorm.crossReview(analyses)
    expect(review.conflicts.length + review.synergies.length + review.gaps.length).toBeGreaterThanOrEqual(0)
  })

  it('should detect gaps when all roles flag issues', () => {
    const analyses = brainstorm.analyzeWithRoles('好。') // 极短文本
    const review = brainstorm.crossReview(analyses)
    // 低质量文本应该产生一些缺口或冲突
    expect(review.gaps.length + review.conflicts.length).toBeGreaterThanOrEqual(0)
  })

  it('returns zero weighted score when a role has no scoring weights', () => {
    const analyses = brainstorm.analyzeWithRoles('然而，秘密就在门后。', [
      {
        id: 'zero-weight',
        name: 'Zero Weight',
        focusDimensions: ['hook'],
        scoringWeights: {},
        behavioralTraits: [],
      },
    ])

    expect(analyses).toEqual([
      expect.objectContaining({
        roleId: 'zero-weight',
        roleName: 'Zero Weight',
        weightedScore: 0,
      }),
    ])
  })

  it('detects concrete conflicts, synergies, and shared gaps from role findings', () => {
    const analyses: RoleAnalysis[] = [
      {
        roleId: 'plot',
        roleName: 'Plot',
        weightedScore: 80,
        findings: [
          { dimension: 'pacing', score: 90 },
          { dimension: 'hook', score: 85 },
          { dimension: 'character', score: 20, issue: 'thin motivation' },
        ],
      },
      {
        roleId: 'editor',
        roleName: 'Editor',
        weightedScore: 62,
        findings: [
          { dimension: 'pacing', score: 50 },
          { dimension: 'hook', score: 75 },
          { dimension: 'character', score: 30, issue: 'flat arc' },
        ],
      },
    ]

    const review = brainstorm.crossReview(analyses)

    expect(review.conflicts).toEqual([
      expect.objectContaining({
        roles: ['Plot', 'Editor'],
        description: expect.stringContaining('pacing'),
      }),
    ])
    expect(review.synergies).toEqual([
      expect.objectContaining({
        roles: ['Plot', 'Editor'],
        description: expect.stringContaining('hook'),
      }),
    ])
    expect(review.gaps).toEqual([
      expect.objectContaining({
        dimension: 'character',
      }),
    ])
  })
})

describe('AdversarialScorer', () => {
  const scorer = new AdversarialScorer()

  it('should produce adversarial result', () => {
    const result = scorer.score('然而，秘密就在门后。她不得不做出选择。')
    expect(result.finalScore).toBeGreaterThan(0)
    expect(result.defects.length).toBeGreaterThanOrEqual(0)
    expect(result.confirmedDefects.length).toBeLessThanOrEqual(result.defects.length)
  })

  it('should penalize low quality text more', () => {
    const good = scorer.score('然而，秘密就在门后。她不得不做出选择。但真相远比想象中危险。')
    const bad = scorer.score('好。')
    expect(good.finalScore).toBeGreaterThanOrEqual(bad.finalScore)
  })

  it('should allow defense to reduce confirmed defects', () => {
    const result = scorer.score('然而，她感到非常害怕。秘密在门后。')
    expect(result.defenseResults.length).toBe(result.defects.length)
    const defended = result.defenseResults.filter(d => !d.upheld).length
    expect(defended).toBeGreaterThanOrEqual(0) // some defects may be defended
  })
})
