/**
 * Shared editor handle — allows WritingHelperPanel and AiTextOptimizer
 * to interact with the TipTap editor without prop drilling.
 */

import type { JSONContent } from '@tiptap/react'

export interface EditorSelectionSnapshot {
  from: number
  to: number
  text: string
}

export interface EditorHandle {
  insertText: (text: string) => void
  getSelectedText: () => string
  getJSON: () => JSONContent
  captureSelectionSnapshot: () => EditorSelectionSnapshot | null
  replaceSelectionSnapshot: (snapshot: EditorSelectionSnapshot, text: string) => boolean
  insertBelowSelectionSnapshot: (snapshot: EditorSelectionSnapshot, text: string) => boolean
  undoLastRevisionApply: () => boolean
  isGenerating?: boolean
}

// Module-level ref set by NikoEditor, read by panels
let currentHandle: EditorHandle | null = null

// AI generating 状态回调，由 DocumentEditor 注册，NikoEditor 触发
let generatingListener: ((generating: boolean) => void) | null = null

export function setEditorHandle(handle: EditorHandle | null): void {
  currentHandle = handle
}

export function getEditorHandle(): EditorHandle | null {
  return currentHandle
}

/** 注册 AI generating 状态变化回调（替代 500ms 轮询） */
export function setGeneratingListener(listener: ((generating: boolean) => void) | null): void {
  generatingListener = listener
}

/** 触发 AI generating 状态变化通知 */
export function notifyGeneratingChange(generating: boolean): void {
  if (generatingListener) {
    generatingListener(generating)
  }
}

export function getCurrentEditorSelectionText(): string {
  return getEditorHandle()?.getSelectedText().trim() ?? ''
}
