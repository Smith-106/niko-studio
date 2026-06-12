import { describe, expect, it } from 'vitest'

import { analyzeEmotionLayers } from '../../narrative/writing-craft/emotion-craft'

describe('emotion-craft additional coverage', () => {
  it('covers the medium depth classification branch', () => {
    const text = `${'场景铺垫'.repeat(28)}他心想也许一切还有转机。${'细节'.repeat(16)}`

    const result = analyzeEmotionLayers(text)

    expect(result.overallRichness).toBeGreaterThanOrEqual(4)
    expect(result.overallRichness).toBeLessThan(8)
    expect(result.depthLevel).toBe('中')
  })
})
