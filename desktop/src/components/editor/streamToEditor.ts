/**
 * Stream-to-Editor Utilities
 *
 * Low-level helpers for streaming AI content into the TipTap editor.
 * Used by useEditorAI hook with chunk-based callbacks.
 */

import type { Editor } from '@tiptap/react'

interface PlainTextContent {
  type: 'text'
  text: string
}

function toPlainTextContent(text: string): PlainTextContent {
  return { type: 'text', text }
}

function getInsertPayload(editor: Editor, text: string): string | PlainTextContent {
  // Some lightweight test doubles only model string insertion. Production TipTap
  // editors expose extensionManager, so prefer explicit text nodes when available.
  return 'extensionManager' in editor ? toPlainTextContent(text) : text
}

export function insertPlainText(editor: Editor, text: string): void {
  if (!text) return
  editor.chain().focus().insertContent(getInsertPayload(editor, text)).run()
}

/**
 * Insert a loading placeholder ("...") at current cursor position.
 * Returns the node position for later replacement.
 */
export function insertLoadingIndicator(editor: Editor): number | null {
  const { from } = editor.state.selection
  const placeholderText = '...'

  insertPlainText(editor, placeholderText)

  return from
}

/**
 * Replace text between `from` and `from + oldLength` with `newText`.
 */
export function replaceRange(editor: Editor, from: number, oldLength: number, newText: string): void {
  const to = from + oldLength
  const chain = editor.chain().focus().setTextSelection({ from, to })
  if (!newText) {
    chain.insertContent('').run()
    return
  }
  chain.insertContent(getInsertPayload(editor, newText)).run()
}

/**
 * Stream text into the editor chunk-by-chunk.
 * Uses ProseMirror document positions (not plain text length) for accuracy.
 * Returns append/finish controls for the caller to feed content.
 */
export function streamTextIntoEditor(
  editor: Editor,
  startPos: number,
  initialLength: number,
): { append: (chunk: string) => void; finish: () => number } {
  let endPos = startPos + initialLength

  return {
    append(chunk: string) {
      if (!chunk) {
        return
      }
      editor
        .chain()
        .focus()
        .setTextSelection({ from: endPos, to: endPos })
        .insertContent(getInsertPayload(editor, chunk))
        .run()
      // Recalculate end position after insertion
      const { from: currentFrom } = editor.state.selection
      endPos = currentFrom
    },

    finish(): number {
      return endPos - startPos
    },
  }
}
