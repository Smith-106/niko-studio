import { describe, it, expect } from 'vitest'
import { assembleContext } from './contextAssembler'

describe('assembleContext', () => {
  const sampleText = '张三走进房间，看到了李四。他说："你好啊。"'
  const profiles = [
    { name: '张三', description: '主角，年轻的侦探' },
    { name: '李四', description: '配角，张三的朋友' },
    { name: '王五', description: '反派角色' },
  ]

  it('assembles character profiles relevant to current text', () => {
    const result = assembleContext(sampleText, { characterProfiles: profiles })
    expect(result).toContain('张三')
    expect(result).toContain('李四')
    expect(result).toContain('Character Context')
  })

  it('includes story bible excerpts matching entity mentions', () => {
    const textWithMentions = '张三说这是一个好主意。李四想了想，点了点头。'
    const storyBible = '张三是故事的男主角，在第一章登场。\n李四是他的助手。\n天空之城是故事的主要场景。'
    const result = assembleContext(textWithMentions, { storyBible })
    expect(result).toContain('Story Bible References')
    expect(result).toContain('张三')
  })

  it('includes memory entries sorted by relevance', () => {
    const memories = [
      { content: '不太相关的内容', relevance: 0.2 },
      { content: '非常重要的线索', relevance: 0.9 },
      { content: '中等重要的信息', relevance: 0.5 },
    ]
    const result = assembleContext(sampleText, { memoryEntries: memories })
    expect(result).toContain('Relevant Memories')
    const importantIndex = result.indexOf('非常重要的线索')
    const mediumIndex = result.indexOf('中等重要的信息')
    expect(importantIndex).toBeLessThan(mediumIndex)
  })

  it('returns empty string when no options provided', () => {
    const result = assembleContext(sampleText, {})
    expect(result).toBe('')
  })

  it('limits memory entries to top 5', () => {
    const memories = Array.from({ length: 10 }, (_, i) => ({
      content: `Memory ${i}`,
      relevance: i / 10,
    }))
    const result = assembleContext(sampleText, { memoryEntries: memories })
    const memoryCount = (result.match(/- Memory \d/g) || []).length
    expect(memoryCount).toBe(5)
  })

  it('falls back to first 3 profiles when no entity matches found', () => {
    const result = assembleContext('Some unrelated text.', { characterProfiles: profiles })
    expect(result).toContain('张三')
    expect(result).toContain('王五')
  })
})
