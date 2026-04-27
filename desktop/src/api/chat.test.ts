import { describe, expect, it } from 'vitest'
import {
  toPublishRecommendation,
  buildConsistencyGovernanceMetadata,
  mergeWriterMetadataGovernance,
  type WriterMetadata,
  type ConsistencyGovernanceMetadata,
} from './chat'

// ---------------------------------------------------------------------------
// toPublishRecommendation
// ---------------------------------------------------------------------------

describe('toPublishRecommendation', () => {
  it('maps go to pass', () => {
    expect(toPublishRecommendation('go')).toBe('pass')
  })

  it('maps soft_go to revise', () => {
    expect(toPublishRecommendation('soft_go')).toBe('revise')
  })

  it('maps no_go to block', () => {
    expect(toPublishRecommendation('no_go')).toBe('block')
  })

  it('returns undefined for undefined decision', () => {
    expect(toPublishRecommendation(undefined)).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// buildConsistencyGovernanceMetadata
// ---------------------------------------------------------------------------

describe('buildConsistencyGovernanceMetadata', () => {
  it('returns undefined when no decision, no score, no feedback', () => {
    const result = buildConsistencyGovernanceMetadata({})
    expect(result).toBeUndefined()
  })

  it('returns undefined when evaluation has no meaningful values', () => {
    const result = buildConsistencyGovernanceMetadata({
      evaluation: { score: 0, feedback: '' },
    })
    expect(result).toBeUndefined()
  })

  it('returns undefined when score is NaN', () => {
    const result = buildConsistencyGovernanceMetadata({
      evaluation: { score: NaN, feedback: '' },
    })
    expect(result).toBeUndefined()
  })

  it('returns metadata with decision and publish_recommendation when decision provided', () => {
    const result = buildConsistencyGovernanceMetadata({
      decision: 'go',
    })
    expect(result).toEqual({
      decision: 'go',
      publish_recommendation: 'pass',
      score: undefined,
      feedback: undefined,
    })
  })

  it('returns full object with decision, score, and feedback', () => {
    const result = buildConsistencyGovernanceMetadata({
      decision: 'soft_go',
      evaluation: { score: 7.5, feedback: 'Needs minor revisions' },
    })
    expect(result).toEqual({
      decision: 'soft_go',
      publish_recommendation: 'revise',
      score: 7.5,
      feedback: 'Needs minor revisions',
    })
  })

  it('includes score only when it is a positive finite number', () => {
    const result = buildConsistencyGovernanceMetadata({
      decision: 'no_go',
      evaluation: { score: 3, feedback: 'Critical issues' },
    })
    expect(result).toBeDefined()
    expect(result!.score).toBe(3)
    expect(result!.publish_recommendation).toBe('block')
  })

  it('omits score when score is 0', () => {
    const result = buildConsistencyGovernanceMetadata({
      decision: 'go',
      evaluation: { score: 0, feedback: 'Some feedback' },
    })
    expect(result).toBeDefined()
    expect(result!.score).toBeUndefined()
  })

  it('trims feedback whitespace', () => {
    const result = buildConsistencyGovernanceMetadata({
      evaluation: { feedback: '  useful feedback  ' },
    })
    expect(result).toBeDefined()
    expect(result!.feedback).toBe('useful feedback')
  })

  it('returns undefined for empty trimmed feedback without other fields', () => {
    const result = buildConsistencyGovernanceMetadata({
      evaluation: { feedback: '   ' },
    })
    expect(result).toBeUndefined()
  })

  it('handles null evaluation gracefully', () => {
    const result = buildConsistencyGovernanceMetadata({
      decision: 'go',
      evaluation: null,
    })
    expect(result).toEqual({
      decision: 'go',
      publish_recommendation: 'pass',
      score: undefined,
      feedback: undefined,
    })
  })
})

// ---------------------------------------------------------------------------
// mergeWriterMetadataGovernance
// ---------------------------------------------------------------------------

describe('mergeWriterMetadataGovernance', () => {
  it('returns original metadata when governance is undefined', () => {
    const writerMetadata: WriterMetadata = {
      canon_context: {
        available: true,
        reason: null,
        total_pages: 5,
        match_count: 2,
        injected: true,
        matches: [],
      },
    }
    const result = mergeWriterMetadataGovernance(writerMetadata, undefined)
    expect(result).toBe(writerMetadata)
  })

  it('returns undefined when both arguments are undefined', () => {
    const result = mergeWriterMetadataGovernance(undefined, undefined)
    expect(result).toBeUndefined()
  })

  it('returns undefined when writerMetadata is undefined and governance is undefined', () => {
    const result = mergeWriterMetadataGovernance(undefined, undefined)
    expect(result).toBeUndefined()
  })

  it('creates new object with governance when writerMetadata is undefined', () => {
    const governance: ConsistencyGovernanceMetadata = {
      decision: 'go',
      publish_recommendation: 'pass',
      score: 8,
      feedback: 'Good quality',
    }
    const result = mergeWriterMetadataGovernance(undefined, governance)
    expect(result).toEqual({
      consistency_governance: governance,
    })
  })

  it('merges governance into existing writerMetadata', () => {
    const writerMetadata: WriterMetadata = {
      warnings: ['minor issue'],
    }
    const governance: ConsistencyGovernanceMetadata = {
      decision: 'soft_go',
      publish_recommendation: 'revise',
    }
    const result = mergeWriterMetadataGovernance(writerMetadata, governance)

    expect(result).toBeDefined()
    expect(result!.warnings).toEqual(['minor issue'])
    expect(result!.consistency_governance).toEqual(
      expect.objectContaining({
        decision: 'soft_go',
        publish_recommendation: 'revise',
      }),
    )
  })

  it('merges into existing consistency_governance without overwriting other fields', () => {
    const writerMetadata: WriterMetadata = {
      consistency_governance: {
        decision: 'go',
        score: 5,
      },
    }
    const governance: ConsistencyGovernanceMetadata = {
      publish_recommendation: 'pass',
      feedback: 'Updated feedback',
    }
    const result = mergeWriterMetadataGovernance(writerMetadata, governance)

    // Should merge: existing fields + new fields
    expect(result!.consistency_governance).toEqual({
      decision: 'go',
      score: 5,
      publish_recommendation: 'pass',
      feedback: 'Updated feedback',
    })
  })
})

// ---------------------------------------------------------------------------
// Type shape verification (compile-time + runtime sanity)
// ---------------------------------------------------------------------------

describe('type exports', () => {
  it('WriterMetadata accepts valid shapes', () => {
    const meta: WriterMetadata = {
      canon_context: {
        available: false,
        reason: 'No canon configured',
        total_pages: 0,
        match_count: 0,
        injected: false,
        matches: [],
      },
      warnings: ['test warning'],
      knowledge_retrieved: {
        entities_count: 1,
        relations_count: 2,
        memories_count: 3,
      },
    }
    expect(meta.canon_context!.available).toBe(false)
    expect(meta.warnings).toHaveLength(1)
    expect(meta.knowledge_retrieved!.entities_count).toBe(1)
  })

  it('WriterMetadata allows arbitrary extra keys', () => {
    const meta: WriterMetadata = {
      custom_field: 'value',
    }
    expect((meta as Record<string, unknown>)['custom_field']).toBe('value')
  })

  it('ConsistencyGovernanceMetadata has optional fields', () => {
    const minimal: ConsistencyGovernanceMetadata = {}
    expect(minimal.decision).toBeUndefined()
    expect(minimal.publish_recommendation).toBeUndefined()
    expect(minimal.score).toBeUndefined()
    expect(minimal.feedback).toBeUndefined()
  })
})
