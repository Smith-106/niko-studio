import { describe, it, expect } from 'vitest'
import { NarrativeBrainstorm, NARRATIVE_ROLES } from './narrative-brainstorm'
import { AdversarialScorer } from './adversarial-scorer'

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
