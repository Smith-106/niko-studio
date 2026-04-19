import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./editorHandle', () => ({
  getEditorHandle: vi.fn(),
}))

import { getEditorHandle } from './editorHandle'
import {
  applyRevisionCandidateToEditor,
  captureMatchedSelectionSnapshot,
  getRevisionCopy,
  insertRevisionAlternativeToEditor,
  undoLastRevisionApplyInEditor,
} from './revisionLoop'

const mockedGetEditorHandle = vi.mocked(getEditorHandle)

describe('revisionLoop utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a matched selection snapshot only when the current selection still matches the source text', () => {
    mockedGetEditorHandle.mockReturnValue({
      captureSelectionSnapshot: vi.fn(() => ({ from: 3, to: 8, text: '原始内容。' })),
    } as never)

    expect(captureMatchedSelectionSnapshot('原始内容。')).toEqual({ from: 3, to: 8, text: '原始内容。' })
    expect(captureMatchedSelectionSnapshot('别的内容')).toBeNull()
  })

  it('applies a revision by replacing the matched selection when possible', () => {
    const copy = getRevisionCopy('zh')
    const replaceSelectionSnapshot = vi.fn(() => true)

    mockedGetEditorHandle.mockReturnValue({
      replaceSelectionSnapshot,
      insertText: vi.fn(),
    } as never)

    const message = applyRevisionCandidateToEditor({
      sourceText: '原始内容。',
      candidateText: '修改结果。',
      selectionSnapshot: { from: 3, to: 8, text: '原始内容。' },
    }, copy)

    expect(replaceSelectionSnapshot).toHaveBeenCalledWith(
      { from: 3, to: 8, text: '原始内容。' },
      '修改结果。',
    )
    expect(message).toBe(copy.replacedMessage)
  })

  it('falls back to plain insert when no selection snapshot exists', () => {
    const copy = getRevisionCopy('zh')
    const insertText = vi.fn()

    mockedGetEditorHandle.mockReturnValue({
      insertText,
    } as never)

    const message = insertRevisionAlternativeToEditor({
      sourceText: '原始内容。',
      candidateText: '修改结果。',
      selectionSnapshot: null,
    }, copy)

    expect(insertText).toHaveBeenCalledWith('修改结果。')
    expect(message).toBe(copy.insertedMessage)
  })

  it('returns undo messages based on the editor outcome', () => {
    const copy = getRevisionCopy('zh')
    const undoLastRevisionApply = vi.fn(() => true)

    mockedGetEditorHandle.mockReturnValue({
      undoLastRevisionApply,
    } as never)

    expect(undoLastRevisionApplyInEditor(copy)).toBe(copy.undoSuccessMessage)

    undoLastRevisionApply.mockReturnValue(false)
    expect(undoLastRevisionApplyInEditor(copy)).toBe(copy.undoFailedMessage)
  })
})
