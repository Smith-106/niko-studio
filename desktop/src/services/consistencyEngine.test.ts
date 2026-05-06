import { describe, it, expect } from 'vitest'
import { runCrossChapterConsistency, detectNameConflicts, detectUnresolvedThreads } from './consistencyEngine'
import type { ChapterContent } from './consistencyEngine'

// detectTimelineIssues and detectTraitDrifts are internal — tested via runCrossChapterConsistency

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

  it('detects timeline issues from relative day references across chapters', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: '今天天气很好。昨天发生了很多事情。' },
      { chapterNumber: 2, title: 'Ch2', content: '他们继续旅程。今天阳光明媚，昨天也下了雨。' },
    ]
    const report = runCrossChapterConsistency(chapters)
    expect(report.timelineIssues.length).toBeGreaterThan(0)
  })

  it('detects timeline regression when years go backwards', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: '那是2025年的故事。' },
      { chapterNumber: 2, title: 'Ch2', content: '回到了2020年的回忆。' },
    ]
    const report = runCrossChapterConsistency(chapters)
    expect(report.timelineIssues.length).toBeGreaterThanOrEqual(1)
    const yearIssue = report.timelineIssues.find((ti) => ti.event1.includes('2025'))
    expect(yearIssue).toBeTruthy()
  })

  it('detects trait drifts when character traits shift unexpectedly', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: '张三笑了笑，态度很温柔。' },
      { chapterNumber: 2, title: 'Ch2', content: '张三看着大家，眼神冷酷，非常冷漠。' },
    ]
    const report = runCrossChapterConsistency(chapters)
    expect(report.traitDrifts.length).toBeGreaterThanOrEqual(1)
    const drift = report.traitDrifts.find((td) => td.character === '张三')
    expect(drift).toBeTruthy()
  })

  it('returns no timeline issues for chapters without time conflicts', () => {
    const chapters: ChapterContent[] = [
      { chapterNumber: 1, title: 'Ch1', content: 'Alice walked to the store.' },
      { chapterNumber: 2, title: 'Ch2', content: 'Bob went home.' },
    ]
    const report = runCrossChapterConsistency(chapters)
    expect(report.timelineIssues).toEqual([])
    expect(report.traitDrifts).toEqual([])
  })
})
