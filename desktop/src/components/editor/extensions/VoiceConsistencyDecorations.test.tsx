import { act, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const analyzeVoiceConsistencyMock = vi.hoisted(() => vi.fn())

vi.mock('../../../api/writing-craft', () => ({
  analyzeVoiceConsistency: analyzeVoiceConsistencyMock,
}))

import type { Editor } from '@tiptap/react'

import {
  VoiceConsistencyDecorations,
  voiceConsistencyStyles,
} from './VoiceConsistencyDecorations'

type DescendantNode = {
  type: { name: string }
  textContent: string
  nodeSize: number
}

function createEditor(entries?: Array<{ node: DescendantNode; pos: number }>) {
  const setTextSelection = vi.fn()
  const setVoiceConsistency = vi.fn()
  const unsetVoiceConsistency = vi.fn()
  const defaultEntries = entries ?? [
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '沈墨说：你先别急。',
        nodeSize: 12,
      },
      pos: 0,
    },
    {
      node: {
        type: { name: 'heading' },
        textContent: '忽略标题',
        nodeSize: 6,
      },
      pos: 15,
    },
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '   ',
        nodeSize: 4,
      },
      pos: 25,
    },
    {
      node: {
        type: { name: 'paragraph' },
        textContent: '林晚说：我知道了。',
        nodeSize: 12,
      },
      pos: 35,
    },
  ]

  const editor = {
    getText: vi.fn(() => '沈墨说：你先别急。\n林晚说：我知道了。'),
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
      setVoiceConsistency,
      unsetVoiceConsistency,
    },
  } as unknown as Editor

  return {
    editor,
    setTextSelection,
    setVoiceConsistency,
    unsetVoiceConsistency,
  }
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((res) => {
    resolve = res
  })
  return { promise, resolve }
}

describe('VoiceConsistencyDecorations', () => {
  beforeEach(() => {
    analyzeVoiceConsistencyMock.mockReset()
  })

  it('clears existing marks and returns null when disabled', () => {
    const { editor, unsetVoiceConsistency } = createEditor()
    const { container } = render(<VoiceConsistencyDecorations editor={editor} enabled={false} />)

    expect(container).toBeEmptyDOMElement()
    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
    expect(analyzeVoiceConsistencyMock).not.toHaveBeenCalled()
  })

  it('analyzes text, applies marks for matching warnings, and restores the prior selection', async () => {
    const { editor, setTextSelection, setVoiceConsistency, unsetVoiceConsistency } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 0.91,
        warnings: [
          {
            character: '沈墨',
            line: '你先别急。',
            issue: '语气偏离',
            severity: 'medium',
          },
        ],
        suggestions: [],
      },
    })

    render(<VoiceConsistencyDecorations editor={editor} enabled />)

    expect(screen.getByText('分析中...')).toBeInTheDocument()

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledWith('沈墨说：你先别急。\n林晚说：我知道了。')
    })

    await waitFor(() => {
      expect(screen.getByText('发现 1 处语气偏离')).toBeInTheDocument()
    })

    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
    expect(setTextSelection.mock.calls).toEqual([
      [{ from: 1, to: 11 }],
      [{ from: 90, to: 95 }],
    ])
    expect(setVoiceConsistency.mock.calls).toEqual([['medium']])
    expect(screen.queryByText('分析中...')).not.toBeInTheDocument()
  })

  it('applies multiple warnings across different paragraphs', async () => {
    const { editor, setTextSelection, setVoiceConsistency, unsetVoiceConsistency } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 0.85,
        warnings: [
          {
            character: '沈墨',
            line: '你先别急。',
            issue: '语气偏离',
            severity: 'medium',
          },
          {
            character: '林晚',
            line: '我知道了。',
            issue: '用词异常',
            severity: 'high',
          },
        ],
        suggestions: [],
      },
    })

    render(<VoiceConsistencyDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(screen.getByText('发现 2 处语气偏离')).toBeInTheDocument()
    })

    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
    expect(setVoiceConsistency.mock.calls).toEqual([['medium'], ['high']])
  })

  it('shows "语气一致" when no warnings are found', async () => {
    const { editor, unsetVoiceConsistency } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 0.95,
        warnings: [],
        suggestions: [],
      },
    })

    render(<VoiceConsistencyDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(screen.getByText('语气一致')).toBeInTheDocument()
    })

    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
  })

  it('keeps the overlay visible but skips marks when analysis fails or returns no data', async () => {
    const first = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: false,
      error: 'gateway unavailable',
    })

    const { unmount } = render(<VoiceConsistencyDecorations editor={first.editor} enabled />)

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledWith('沈墨说：你先别急。\n林晚说：我知道了。')
    })
    expect(first.setVoiceConsistency).not.toHaveBeenCalled()
    // After failure, isAnalyzing becomes false; overlay shows legend but no status text
    expect(screen.queryByText('分析中...')).not.toBeInTheDocument()

    unmount()

    const second = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({ success: true })
    render(<VoiceConsistencyDecorations editor={second.editor} enabled />)

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledTimes(2)
    })
    expect(second.setVoiceConsistency).not.toHaveBeenCalled()
  })

  it('stops before applying marks after unmount', async () => {
    const { editor, setTextSelection, setVoiceConsistency } = createEditor()
    const deferred = createDeferred<{
      success: boolean
      data: {
        fingerprints: []
        voiceDistinctness: number
        warnings: []
        suggestions: []
      }
    }>()
    analyzeVoiceConsistencyMock.mockReturnValue(deferred.promise)

    const { unmount } = render(<VoiceConsistencyDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledTimes(1)
    })

    unmount()

    await act(async () => {
      deferred.resolve({
        success: true,
        data: {
          fingerprints: [],
          voiceDistinctness: 0.7,
          warnings: [],
          suggestions: [],
        },
      })
      await Promise.resolve()
    })

    expect(setTextSelection).not.toHaveBeenCalled()
    expect(setVoiceConsistency).not.toHaveBeenCalled()
  })

  it('applies marks with different severity levels (low, medium, high)', async () => {
    const { editor, setVoiceConsistency, unsetVoiceConsistency } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 0.6,
        warnings: [
          { character: '沈墨', line: '你先别急。', issue: '语气偏离', severity: 'low' },
          { character: '林晚', line: '我知道了。', issue: '用词异常', severity: 'high' },
        ],
        suggestions: [],
      },
    })

    render(<VoiceConsistencyDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(screen.getByText('发现 2 处语气偏离')).toBeInTheDocument()
    })

    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
    expect(setVoiceConsistency.mock.calls).toEqual([['low'], ['high']])
  })

  it('calls unsetVoiceConsistency when disabled prop changes from true to false', async () => {
    const { editor, unsetVoiceConsistency } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: { fingerprints: [], voiceDistinctness: 0.95, warnings: [], suggestions: [] },
    })

    const { rerender } = render(<VoiceConsistencyDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(screen.getByText('语气一致')).toBeInTheDocument()
    })

    // Reset the mock to clearly count the disable call
    unsetVoiceConsistency.mockClear()
    rerender(<VoiceConsistencyDecorations editor={editor} enabled={false} />)

    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
  })

  it('works alongside ShowTell without conflicts', async () => {
    const { editor, setVoiceConsistency, unsetVoiceConsistency } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 0.7,
        warnings: [
          { character: '沈墨', line: '你先别急。', issue: '语气偏离', severity: 'medium' },
        ],
        suggestions: [],
      },
    })

    // Simulate ShowTell being active by adding a mock showTell command
    const editorWithShowTell = {
      ...editor,
      commands: {
        ...editor.commands,
        setShowTell: vi.fn(),
        unsetShowTell: vi.fn(),
      },
    } as unknown as Editor

    render(<VoiceConsistencyDecorations editor={editorWithShowTell} enabled />)

    await waitFor(() => {
      expect(screen.getByText('发现 1 处语气偏离')).toBeInTheDocument()
    })

    expect(unsetVoiceConsistency).toHaveBeenCalledTimes(1)
    expect(setVoiceConsistency).toHaveBeenCalledWith('medium')
    // ShowTell commands should not interfere
    expect((editorWithShowTell.commands as unknown as { setShowTell: ReturnType<typeof vi.fn> }).setShowTell).not.toHaveBeenCalled()
  })

  it('exports severity styles for downstream renderers', () => {
    expect(voiceConsistencyStyles.colorForSeverity('high')).toBe('#dc2626')
    expect(voiceConsistencyStyles.colorForSeverity('medium')).toBe('#d97706')
    expect(voiceConsistencyStyles.colorForSeverity('low')).toBe('#94a3b8')
    expect(voiceConsistencyStyles.underlineStyle('medium')).toBe(
      'text-decoration: underline wavy #d97706; text-underline-offset: 3px;',
    )
  })
})
