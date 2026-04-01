/**
 * Stream-to-Editor Utilities
 *
 * Low-level helpers for streaming AI content into the TipTap editor.
 * Used by useEditorAI hook with chunk-based callbacks.
 */

import type { Editor } from '@tiptap/react'

/**
 * Insert a loading placeholder ("...") at current cursor position.
 * Returns the node position for later replacement.
 */
export function insertLoadingIndicator(editor: Editor): number | null {
  const { from } = editor.state.selection
  const placeholderText = '...'

  editor.chain().focus().insertContent(placeholderText).run()

  return from
}

/**
 * Replace text between `from` and `from + oldLength` with `newText`.
 */
export function replaceRange(editor: Editor, from: number, oldLength: number, newText: string): void {
  const to = from + oldLength
  editor.chain().focus().setTextSelection({ from, to }).insertContent(newText).run()
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
      editor.chain().focus().setTextSelection({ from: endPos, to: endPos }).insertContent(chunk).run()
      // Recalculate end position after insertion
      const { from: currentFrom } = editor.state.selection
      endPos = currentFrom
    },

    finish(): number {
      return endPos - startPos
    },
  }
}
