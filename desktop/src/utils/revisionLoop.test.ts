import { beforeEach, describe, expect, it, vi } from 'vitest'

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
      captureSelectionSnapshot: vi.fn(() => ({ from: 3, to: 8, text: 'Original text' })),
    } as never)

    expect(captureMatchedSelectionSnapshot('Original text')).toEqual({
      from: 3,
      to: 8,
      text: 'Original text',
    })
    expect(captureMatchedSelectionSnapshot('Different text')).toBeNull()
  })

  it('returns null when there is no active editor handle or no selection snapshot', () => {
    mockedGetEditorHandle.mockReturnValue(null)
    expect(captureMatchedSelectionSnapshot('source text')).toBeNull()

    mockedGetEditorHandle.mockReturnValue({
      captureSelectionSnapshot: vi.fn(() => null),
    } as never)
    expect(captureMatchedSelectionSnapshot('source text')).toBeNull()
  })

  it('applies a revision by replacing the matched selection when possible', () => {
    const copy = getRevisionCopy('en')
    const replaceSelectionSnapshot = vi.fn(() => true)

    mockedGetEditorHandle.mockReturnValue({
      replaceSelectionSnapshot,
      insertText: vi.fn(),
    } as never)

    const message = applyRevisionCandidateToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: { from: 3, to: 8, text: 'Original text' },
    }, copy)

    expect(replaceSelectionSnapshot).toHaveBeenCalledWith(
      { from: 3, to: 8, text: 'Original text' },
      'Candidate text',
    )
    expect(message).toBe(copy.replacedMessage)
  })

  it('returns selection-changed feedback or null when replace-based apply cannot proceed', () => {
    const copy = getRevisionCopy('en')
    mockedGetEditorHandle.mockReturnValue({
      replaceSelectionSnapshot: vi.fn(() => false),
      insertText: vi.fn(),
    } as never)

    expect(applyRevisionCandidateToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: { from: 1, to: 5, text: 'Original text' },
    }, copy)).toBe(copy.selectionChangedMessage)

    mockedGetEditorHandle.mockReturnValue(null)
    expect(applyRevisionCandidateToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: null,
    }, copy)).toBeNull()
  })

  it('falls back to plain insert when applying without a selection snapshot', () => {
    const copy = getRevisionCopy('en')
    const insertText = vi.fn()

    mockedGetEditorHandle.mockReturnValue({
      insertText,
    } as never)

    const message = applyRevisionCandidateToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: null,
    }, copy)

    expect(insertText).toHaveBeenCalledWith('Candidate text')
    expect(message).toBe(copy.insertedMessage)
  })

  it('inserts alternatives below the selection when possible and reports changed selections otherwise', () => {
    const copy = getRevisionCopy('en')
    const insertBelowSelectionSnapshot = vi.fn(() => true)

    mockedGetEditorHandle.mockReturnValue({
      insertBelowSelectionSnapshot,
      insertText: vi.fn(),
    } as never)

    expect(insertRevisionAlternativeToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: { from: 1, to: 5, text: 'Original text' },
    }, copy)).toBe(copy.alternativeMessage)

    insertBelowSelectionSnapshot.mockReturnValue(false)
    expect(insertRevisionAlternativeToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: { from: 1, to: 5, text: 'Original text' },
    }, copy)).toBe(copy.selectionChangedMessage)
  })

  it('falls back to plain insert when no selection snapshot exists for alternatives', () => {
    const copy = getRevisionCopy('en')
    const insertText = vi.fn()

    mockedGetEditorHandle.mockReturnValue({
      insertText,
    } as never)

    const message = insertRevisionAlternativeToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: null,
    }, copy)

    expect(insertText).toHaveBeenCalledWith('Candidate text')
    expect(message).toBe(copy.insertedMessage)
  })

  it('returns null when alternative insertion has no editor handle', () => {
    const copy = getRevisionCopy('en')
    mockedGetEditorHandle.mockReturnValue(null)

    expect(insertRevisionAlternativeToEditor({
      sourceText: 'Original text',
      candidateText: 'Candidate text',
      selectionSnapshot: null,
    }, copy)).toBeNull()
  })

  it('returns undo messages based on the editor outcome', () => {
    const copy = getRevisionCopy('en')
    const undoLastRevisionApply = vi.fn(() => true)

    mockedGetEditorHandle.mockReturnValue({
      undoLastRevisionApply,
    } as never)

    expect(undoLastRevisionApplyInEditor(copy)).toBe(copy.undoSuccessMessage)

    undoLastRevisionApply.mockReturnValue(false)
    expect(undoLastRevisionApplyInEditor(copy)).toBe(copy.undoFailedMessage)
  })

  it('returns null when undo is requested without an editor handle', () => {
    const copy = getRevisionCopy('en')
    mockedGetEditorHandle.mockReturnValue(null)

    expect(undoLastRevisionApplyInEditor(copy)).toBeNull()
  })
})
