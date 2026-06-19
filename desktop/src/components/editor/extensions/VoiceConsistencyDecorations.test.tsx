import { act, render, waitFor } from '@testing-library/react'
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

function createEditor() {
  const textBetween = vi.fn(() => '段落一\n段落二')
  const editor = {
    getText: vi.fn(() => '角色对白'),
    state: {
      doc: {
        textBetween,
        content: { size: 16 },
      },
    },
  } as unknown as Editor

  return { editor, textBetween }
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

  it('does nothing when disabled', () => {
    const { editor } = createEditor()
    const { container } = render(<VoiceConsistencyDecorations editor={editor} enabled={false} />)

    expect(container).toBeEmptyDOMElement()
    expect(analyzeVoiceConsistencyMock).not.toHaveBeenCalled()
  })

  it('runs analysis and reads the document text when a successful result arrives', async () => {
    const { editor, textBetween } = createEditor()
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

    await waitFor(() => {
      expect(editor.getText).toHaveBeenCalledTimes(1)
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledWith('角色对白')
      expect(textBetween).toHaveBeenCalledWith(0, 16, '\n')
    })
  })

  it('falls back to an empty warnings list when the payload omits warnings', async () => {
    const { editor, textBetween } = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        fingerprints: [],
        voiceDistinctness: 0.64,
        suggestions: [],
      },
    })

    render(<VoiceConsistencyDecorations editor={editor} enabled />)

    await waitFor(() => {
      expect(textBetween).toHaveBeenCalledWith(0, 16, '\n')
    })
  })

  it('returns early when the backend response is unsuccessful or has no data', async () => {
    const first = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: false,
      error: 'gateway unavailable',
    })

    const { unmount } = render(<VoiceConsistencyDecorations editor={first.editor} enabled />)

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledWith('角色对白')
    })
    expect(first.textBetween).not.toHaveBeenCalled()

    unmount()

    const second = createEditor()
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({ success: true })
    render(<VoiceConsistencyDecorations editor={second.editor} enabled />)

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledTimes(2)
    })
    expect(second.textBetween).not.toHaveBeenCalled()
  })

  it('stops before applying warnings after unmount', async () => {
    const { editor, textBetween } = createEditor()
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

    expect(textBetween).not.toHaveBeenCalled()
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
