import { describe, expect, it, vi, beforeEach } from 'vitest'

import { downloadAsFile, generateMarkdownReport } from './export-analysis'

describe('export-analysis', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('formats markdown reports with evidence and suggestion sections', () => {
    const report = generateMarkdownReport({
      overallScore: 8.6,
      textLength: 3200,
      dimensions: [
        {
          label: '情节',
          score: 8,
          maxScore: 10,
          evidence: ['冲突递进稳定'],
          suggestions: ['再增加一个反转'],
        },
        {
          label: '角色',
          score: 7,
          maxScore: 10,
          evidence: [],
          suggestions: [],
        },
      ],
    } as {
      overallScore: number
      textLength: number
      dimensions: Array<{
        label: string
        score: number
        maxScore: number
        evidence: string[]
        suggestions: string[]
      }>
    })

    expect(report).toContain('# 写作质量分析报告')
    expect(report).toContain('**综合评分**: 8.6/10')
    expect(report).toContain('**文本长度**: 3200 字')
    expect(report).toContain('## 情节 (8/10)')
    expect(report).toContain('### 检测证据')
    expect(report).toContain('- 冲突递进稳定')
    expect(report).toContain('### 改进建议')
    expect(report).toContain('- 再增加一个反转')
    expect(report).toContain('## 角色 (7/10)')
  })

  it('downloads markdown content through an object url and cleans up the anchor', () => {
    const createObjectURL = vi.fn(() => 'blob:analysis')
    const revokeObjectURL = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
    })

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')

    downloadAsFile('# report', 'analysis.md')

    expect(createObjectURL).toHaveBeenCalledTimes(1)
    expect(appendSpy).toHaveBeenCalledTimes(1)
    const anchor = appendSpy.mock.calls[0][0] as HTMLAnchorElement
    expect(anchor.download).toBe('analysis.md')
    expect(anchor.href).toBe('blob:analysis')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(removeSpy).toHaveBeenCalledWith(anchor)
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:analysis')
  })
})
