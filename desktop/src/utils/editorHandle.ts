/**
 * Shared editor handle — allows WritingHelperPanel and AiTextOptimizer
 * to interact with the TipTap editor without prop drilling.
 */

import type { JSONContent } from '@tiptap/react'

export interface EditorHandle {
  insertText: (text: string) => void
  getSelectedText: () => string
  getJSON: () => JSONContent
  isGenerating?: boolean
}

// Module-level ref set by NikoEditor, read by panels
let currentHandle: EditorHandle | null = null

export function setEditorHandle(handle: EditorHandle | null): void {
  currentHandle = handle
}

export function getEditorHandle(): EditorHandle | null {
  return currentHandle
}
