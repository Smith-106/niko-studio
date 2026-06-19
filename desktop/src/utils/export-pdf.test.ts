import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadPdfFile, generatePdfHtml } from './export-pdf'

describe('export-pdf utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:pdf-preview'),
      revokeObjectURL: vi.fn(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('generates printable HTML with escaped evidence, score colors, and capped suggestions', () => {
    const html = generatePdfHtml({
      overallScore: 8.4,
      textLength: 2048,
      dimensions: [
        {
          dimension: 'structure',
          label: '结构',
          score: 8,
          maxScore: 10,
          evidence: ['Use <hook> & cliffhanger'],
          suggestions: ['s1', 's2', 's3', 's4', 's5', 's6'],
          details: {},
        },
        {
          dimension: 'emotion',
          label: '情绪',
          score: 5,
          maxScore: 10,
          evidence: [],
          suggestions: ['keep pressure'],
          details: {},
        },
        {
          dimension: 'dialogue',
          label: '对白',
          score: 2,
          maxScore: 10,
          evidence: ['Too much telling'],
          suggestions: [],
          details: {},
        },
      ],
    })

    expect(html).toContain('写作质量分析报告')
    expect(html).toContain('文本长度：2048 字')
    expect(html).toContain('&lt;hook&gt; &amp; cliffhanger')
    expect(html).toContain('background:#059669')
    expect(html).toContain('background:#d97706')
    expect(html).toContain('background:#dc2626')
    expect(html).toContain('<li>s5</li>')
    expect(html).not.toContain('<li>s6</li>')
  })

  it('opens a printable preview window and revokes the blob url later', () => {
    const print = vi.fn()
    const previewWindow = {
      onload: null as null | (() => void),
      print,
    }
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(previewWindow as unknown as Window)

    downloadPdfFile('<html><body>preview</body></html>', 'report')

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1)
    expect(openSpy).toHaveBeenCalledWith('blob:pdf-preview', '_blank')
    expect(typeof previewWindow.onload).toBe('function')

    previewWindow.onload?.()
    expect(print).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-preview')
  })

  it('still revokes the blob url when the browser blocks the preview window', () => {
    vi.spyOn(window, 'open').mockReturnValue(null)

    downloadPdfFile('<html><body>blocked</body></html>', 'report')

    vi.advanceTimersByTime(60_000)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-preview')
  })
})
