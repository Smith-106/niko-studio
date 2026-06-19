import { describe, expect, it } from 'vitest'
import { extractItemSummary } from './useStoryContext'

describe('useStoryContext extractItemSummary extra2 branch coverage', () => {
  // Line 21: `String(item.name ?? item.title ?? '')`
  it('uses name when present', () => {
    expect(extractItemSummary({ name: 'Alice', description: 'Hero' })).toBe('Alice: Hero')
  })

  it('falls back to title when name is missing', () => {
    expect(extractItemSummary({ title: 'BobTitle', description: 'Sidekick' })).toBe('BobTitle: Sidekick')
  })

  it('falls back to empty string when both name and title are missing', () => {
    expect(extractItemSummary({})).toBe('')
  })

  // Line 22: `String(item.description ?? item.role ?? item.content ?? item.summary ?? '')`
  it('falls back through description fields', () => {
    expect(extractItemSummary({ name: 'Charlie', role: 'RoleX' })).toBe('Charlie: RoleX')
    expect(extractItemSummary({ name: 'Dave', content: 'ContentX' })).toBe('Dave: ContentX')
    expect(extractItemSummary({ name: 'Eve', summary: 'SummaryX' })).toBe('Eve: SummaryX')
  })
})
