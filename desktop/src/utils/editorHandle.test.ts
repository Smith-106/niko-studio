import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  getCurrentEditorSelectionText,
  getEditorHandle,
  notifyGeneratingChange,
  setEditorHandle,
  setGeneratingListener,
} from './editorHandle'

describe('editorHandle registry', () => {
  beforeEach(() => {
    setEditorHandle(null)
    setGeneratingListener(null)
  })

  it('stores and returns the current editor handle', () => {
    const handle = {
      getSelectedText: () => '',
      getJSON: () => ({}),
      insertText: vi.fn(),
      captureSelectionSnapshot: vi.fn(),
      replaceSelectionSnapshot: vi.fn(),
      insertBelowSelectionSnapshot: vi.fn(),
      undoLastRevisionApply: vi.fn(),
      triggerAIContinue: vi.fn(),
    }

    setEditorHandle(handle as never)

    expect(getEditorHandle()).toBe(handle)
  })

  it('returns a trimmed selection string and falls back to empty text when no handle exists', () => {
    setEditorHandle({
      getSelectedText: () => '  selected text  ',
      getJSON: () => ({}),
      insertText: vi.fn(),
      captureSelectionSnapshot: vi.fn(),
      replaceSelectionSnapshot: vi.fn(),
      insertBelowSelectionSnapshot: vi.fn(),
      undoLastRevisionApply: vi.fn(),
      triggerAIContinue: vi.fn(),
    } as never)

    expect(getCurrentEditorSelectionText()).toBe('selected text')

    setEditorHandle(null)
    expect(getCurrentEditorSelectionText()).toBe('')
  })

  it('notifies the registered generating listener and ignores missing listeners', () => {
    const listener = vi.fn()

    expect(() => notifyGeneratingChange(true)).not.toThrow()

    setGeneratingListener(listener)
    notifyGeneratingChange(true)
    notifyGeneratingChange(false)

    expect(listener).toHaveBeenNthCalledWith(1, true)
    expect(listener).toHaveBeenNthCalledWith(2, false)

    setGeneratingListener(null)
    expect(() => notifyGeneratingChange(true)).not.toThrow()
  })
})
