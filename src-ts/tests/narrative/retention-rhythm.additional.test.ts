import { describe, expect, it } from 'vitest'

import { analyzeRetentionRhythm } from '../../narrative/writing-craft/retention-rhythm'

describe('retention-rhythm additional coverage', () => {
  it('marks before and after pay wall proximity around the pay wall chapter', () => {
    const chapters = [
      { chapterIndex: 1, content: '平静的铺垫。' },
      { chapterIndex: 2, content: '揭示真相。' },
      { chapterIndex: 3, content: '后续影响。' },
    ]

    const result = analyzeRetentionRhythm(chapters, 2)

    expect(result.profiles.map((profile) => profile.payWallProximity)).toEqual([
      'before',
      'at',
      'after',
    ])
  })

  it('adds the low pay wall density suggestion when the pay wall chapter lacks momentum', () => {
    const result = analyzeRetentionRhythm(
      [
        { chapterIndex: 1, content: '日常对话。' },
        { chapterIndex: 2, content: '继续铺垫，没有爽点。' },
        { chapterIndex: 3, content: '平淡收尾。' },
      ],
      2,
    )

    expect(result.payWallDensity).toBe(0)
    expect(result.suggestions.some((suggestion) => suggestion.includes('卡点'))).toBe(true)
  })
})
