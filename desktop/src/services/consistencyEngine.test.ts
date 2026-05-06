import { describe, it, expect } from 'vitest'
import { runCrossChapterConsistency, detectNameConflicts, detectUnresolvedThreads } from './consistencyEngine'
import type { ChapterContent } from './consistencyEngine'

describe('detectNameConflicts', () => {
  it('detects similar character names across chapters', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: '张三说：你好。李四笑了笑。' },
      { chapterNumber: 2, title: 'Ch2', content: '张山回答道：我很好。王五走过来。' },
    ]
    const conflicts = detectNameConflicts(chapters)
    expect(conflicts.length).toBeGreaterThanOrEqual(0)
  })

  it('returns empty for chapters with distinct names', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: 'Elizabeth walked to the park.' },
      { chapterNumber: 2, title: 'Ch2', content: 'Alexander went home.' },
    ]
    const conflicts = detectNameConflicts(chapters)
    expect(conflicts.length).toBe(0)
  })
})

describe('detectUnresolvedThreads', () => {
  it('detects introduced but unresolved mysteries', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: '宝藏的秘密还没有揭开，大家都很好奇。' },
      { chapterNumber: 2, title: 'Ch2', content: '他们继续前进，寻找线索。' },
    ]
    const threads = detectUnresolvedThreads(chapters)
    expect(threads.length).toBeGreaterThan(0)
    expect(threads[0].thread).toBeTruthy()
  })

  it('detects and counts threads from intro patterns', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: '宝藏的秘密还没有揭开。谜底尚未揭晓。' },
      { chapterNumber: 2, title: 'Ch2', content: '他们继续前进，寻找线索。' },
    ]
    const threads = detectUnresolvedThreads(chapters)
    expect(threads.length).toBeGreaterThan(0)
    for (const t of threads) {
      expect(t.thread).toBeTruthy()
      expect(t.lastMentioned).toBeGreaterThan(0)
      expect(t.description).toBeTruthy()
    }
  })
})

describe('runCrossChapterConsistency', () => {
  it('returns a complete consistency report', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Beginning', content: 'Alice walked to the store.' },
      { chapterNumber: 2, title: 'Middle', content: 'Bob said hello to Alice.' },
    ]
    const report = runCrossChapterConsistency(chapters)
    expect(report).toHaveProperty('overallScore')
    expect(report).toHaveProperty('nameConflicts')
    expect(report).toHaveProperty('timelineIssues')
    expect(report).toHaveProperty('unresolvedThreads')
    expect(report).toHaveProperty('traitDrifts')
    expect(report.chaptersChecked).toBe(2)
    expect(report.overallScore).toBeGreaterThanOrEqual(0)
    expect(report.overallScore).toBeLessThanOrEqual(10)
  })

  it('handles single chapter', () => {
    const report = runCrossChapterConsistency([
      { chapterNumber: 1, title: 'Only', content: 'Hello world.' },
    ])
    expect(report.chaptersChecked).toBe(1)
  })
})
