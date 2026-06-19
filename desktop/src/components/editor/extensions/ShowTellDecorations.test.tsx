import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const analyzeShowTellMock = vi.hoisted(() => vi.fn())

vi.mock('../../../api/writing-craft', () => ({
  analyzeShowTell: analyzeShowTellMock,
}))

import type { Editor } from '@tiptap/react'

import { ShowTellDecorations } from './ShowTellDecorations'

type DescendantNode = {
  type: { name: string }
  textContent: string
  nodeSize: number
}

function createEditor(entries?: Array<{ node: DescendantNode; pos: number }>) {
  const setTextSelection = vi.fn()
  const setShowTell = vi.fn()
  const unsetShowTell = vi.fn()
  const defaultEntries = entries ?? [
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '第一段',
        nodeSize: 6,
      },
      pos: 0,
    },
    {
      node: {
        type: { name: 'heading' },
        textContent: '忽略标题',
        nodeSize: 6,
      },
      pos: 10,
    },
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '   ',
        nodeSize: 4,
      },
      pos: 20,
    },
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '第二段',
        nodeSize: 7,
      },
      pos: 30,
    },
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '第三段',
        nodeSize: 8,
      },
      pos: 45,
    },
  ]

  const editor = {
    getText: vi.fn(() => '第一段\n第二段\n第三段'),
    state: {
      selection: { from: 90, to: 95 },
      doc: {
        descendants: (callback: (node: DescendantNode, pos: number) => void) => {
          defaultEntries.forEach(({ node, pos }) => callback(node, pos))
        },
      },
    },
    commands: {
      setTextSelection,
      setShowTell,
      unsetShowTell,
    },
  } as unknown as Editor

  return {
    editor,
    setTextSelection,
    setShowTell,
    unsetShowTell,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('ShowTellDecorations', () => {
  beforeEach(() => {
    analyzeShowTellMock.mockReset()
  })

  it('clears existing show-tell marks and returns null when disabled', () => {
    const { editor, unsetShowTell } = createEditor()
    const { container } = render(<ShowTellDecorations editor={editor} enabled={false} />)

    expect(container).toBeEmptyDOMElement()
    expect(unsetShowTell).toHaveBeenCalledTimes(1)
    expect(analyzeShowTellMock).not.toHaveBeenCalled()
  })

  it('analyzes text, applies clamped paragraph marks, and restores the prior selection', async () => {
    const { editor, setTextSelection, setShowTell, unsetShowTell } = createEditor()
    analyzeShowTellMock.mockResolvedValue({
      success: true,
      data: {
        showTellRatio: 0.65,
        showCount: 6,
        tellCount: 4,
        sensoryCoverage: {
          visual: 1,
          auditory: 1,
          tactile: 1,
          olfactory: 1,
          gustatory: 1,
          overall: 1,
        },
        abstractVsConcrete: 0.5,
        heatMap: [
          { paragraphIndex: 0, showCount: 2, tellCount: 0, ratio: 1.2, dominantSense: 'visual' },
          { paragraphIndex: 1, showCount: 0, tellCount: 2, ratio: -0.25, dominantSense: 'auditory' },
          { paragraphIndex: 2, showCount: 1, tellCount: 1, ratio: 0.5, dominantSense: 'tactile' },
        ],
        suggestions: [],
      },
    })

    render(<ShowTellDecorations editor={editor} enabled />)

    expect(screen.getByText('分析中...')).toBeInTheDocument()

    await waitFor(() => {
      expect(analyzeShowTellMock).toHaveBeenCalledWith('第一段\n第二段\n第三段')
    })

    await waitFor(() => {
      expect(screen.getByText('比例：Show 65% / Tell 35%')).toBeInTheDocument()
    })

    expect(unsetShowTell).toHaveBeenCalledTimes(1)
    expect(setTextSelection.mock.calls).toEqual([
      [{ from: 1, to: 5 }],
      [{ from: 31, to: 36 }],
      [{ from: 46, to: 52 }],
      [{ from: 90, to: 95 }],
    ])
    expect(setShowTell.mock.calls).toEqual([[ 'show' ], [ 'tell' ], [ 'neutral' ]])
    expect(screen.queryByText('分析中...')).not.toBeInTheDocument()
  })

  it('keeps the lightweight overlay visible but skips marks when analysis fails or returns no data', async () => {
    const first = createEditor()
    analyzeShowTellMock.mockResolvedValueOnce({
      success: false,
      error: 'gateway unavailable',
    })

    const { unmount } = render(<ShowTellDecorations editor={first.editor} enabled />)

    await waitFor(() => {
      expect(analyzeShowTellMock).toHaveBeenCalledWith('第一段\n第二段\n第三段')
    })
    expect(first.setShowTell).not.toHaveBeenCalled()
    expect(screen.getByText('分析中...')).toBeInTheDocument()

    unmount()

    const second = createEditor()
    analyzeShowTellMock.mockResolvedValueOnce({ success: true })
    render(<ShowTellDecorations editor={second.editor} enabled />)

    await waitFor(() => {
      expect(analyzeShowTellMock).toHaveBeenCalledTimes(2)
    })
    expect(second.setShowTell).not.toHaveBeenCalled()
  })

  it('stops before applying marks after unmount', async () => {
    const { editor, setTextSelection, setShowTell } = createEditor()
    const deferred = createDeferred<{
      success: boolean
      data: {
        showTellRatio: number
        showCount: number
        tellCount: number
        sensoryCoverage: {
          visual: number
          auditory: number
          tactile: number
          olfactory: number
          gustatory: number
          overall: number
        }
        abstractVsConcrete: number
        heatMap: []
        suggestions: []
      }
    }>()
    analyzeShowTellMock.mockReturnValue(deferred.promise)

    const { unmount } = render(<ShowTellDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(analyzeShowTellMock).toHaveBeenCalledTimes(1)
    })

    unmount()

    await act(async () => {
      deferred.resolve({
        success: true,
        data: {
          showTellRatio: 0.4,
          showCount: 2,
          tellCount: 3,
          sensoryCoverage: {
            visual: 0,
            auditory: 0,
            tactile: 0,
            olfactory: 0,
            gustatory: 0,
            overall: 0,
          },
          abstractVsConcrete: 0.3,
          heatMap: [],
          suggestions: [],
        },
      })
      await Promise.resolve()
    })

    expect(setTextSelection).not.toHaveBeenCalled()
    expect(setShowTell).not.toHaveBeenCalled()
  })

  it('skips paragraphs that have no matching heat-map entry or no selectable text range', async () => {
    const { editor, setTextSelection, setShowTell, unsetShowTell } = createEditor([
      {
        node: {
          type: { name: 'paragraph' },
          textContent: '短段落',
          nodeSize: 1,
        },
        pos: 0,
      },
      {
        node: {
          type: { name: 'paragraph' },
          textContent: '第二段',
          nodeSize: 7,
        },
        pos: 10,
      },
    ])

    analyzeShowTellMock.mockResolvedValueOnce({
      success: true,
      data: {
        showTellRatio: 0.5,
        showCount: 1,
        tellCount: 1,
        sensoryCoverage: {
          visual: 0,
          auditory: 0,
          tactile: 0,
          olfactory: 0,
          gustatory: 0,
          overall: 0,
        },
        abstractVsConcrete: 0.5,
        heatMap: [
          { paragraphIndex: 0, showCount: 1, tellCount: 0, ratio: 0.9, dominantSense: 'visual' },
        ],
        suggestions: [],
      },
    })

    render(<ShowTellDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(screen.getByText('比例：Show 50% / Tell 50%')).toBeInTheDocument()
    })

    expect(unsetShowTell).toHaveBeenCalledTimes(1)
    expect(setShowTell).not.toHaveBeenCalled()
    expect(setTextSelection.mock.calls).toEqual([[{ from: 90, to: 95 }]])
  })
})
