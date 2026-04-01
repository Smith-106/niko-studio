/**
 * useEditorAI Hook
 *
 * Provides AI capabilities directly in the TipTap editor:
 * - Generate text at cursor
 * - Rewrite selected text
 * - Continue writing from current position
 *
 * Uses streamWritingHelper from the API client to communicate with
 * the gateway's /writing/stream endpoint.
 */

import { useState, useCallback, useRef } from 'react'
import type { Editor } from '@tiptap/react'
import { insertLoadingIndicator, streamTextIntoEditor, replaceRange } from '../components/editor/streamToEditor'
import { streamWritingHelper } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'

export interface UseEditorAIOptions {
  editor: Editor | null
  getStyleInstruction?: () => string
}

export interface UseEditorAIReturn {
  isGenerating: boolean
  generateAtCursor: (instruction: string) => Promise<void>
  rewriteSelection: (instruction: string) => Promise<void>
  continueWriting: () => Promise<void>
  cancel: () => void
}

export function useEditorAI({ editor, getStyleInstruction }: UseEditorAIOptions): UseEditorAIReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const getProviderConfig = useCallback(() => {
    const { settings } = useSettingsStore.getState()
    const provider = settings.llmProviders.find(
      (p) => p.id === settings.primaryProvider && p.enabled && p.apiKey,
    )
    return provider ?? null
  }, [])

  const callStream = useCallback(
    async (prompt: string) => {
      if (!editor) return

      const controller = new AbortController()
      abortRef.current = controller
      setIsGenerating(true)

      // Insert "..." placeholder
      const pos = insertLoadingIndicator(editor)
      if (pos === null) {
        setIsGenerating(false)
        return
      }
      const placeholderLen = 3
      const streamer = streamTextIntoEditor(editor, pos, placeholderLen)

      const provider = getProviderConfig()

      try {
        await streamWritingHelper(
          {
            content: prompt,
            mode: 'generate',
            instruction: getStyleInstruction?.() ?? '',
            model: provider?.defaultModel ?? '',
            provider: provider?.id ?? '',
            api_key: provider?.apiKey ?? '',
            base_url: provider?.baseUrl ?? '',
          },
          {
            onContent: (chunk) => {
              streamer.append(chunk)
            },
            onDone: () => {
              streamer.finish()
            },
            onError: (err) => {
              console.error('AI stream error:', err)
            },
          },
          { signal: controller.signal },
        )
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('AI generation failed:', err)
        }
        // Clean up placeholder on error/abort
        const totalLen = streamer.finish()
        if (totalLen <= placeholderLen) {
          replaceRange(editor, pos, totalLen, '')
        }
      } finally {
        setIsGenerating(false)
        abortRef.current = null
      }
    },
    [editor, getProviderConfig, getStyleInstruction],
  )

  const generateAtCursor = useCallback(
    async (instruction: string) => {
      if (!editor) return
      const { from } = editor.state.selection
      const textBefore = editor.state.doc.textBetween(
        Math.max(0, from - 2000),
        from,
        '\n',
      )
      const prompt = `${instruction}\n\n上下文：\n${textBefore}`
      await callStream(prompt)
    },
    [editor, callStream],
  )

  const rewriteSelection = useCallback(
    async (instruction: string) => {
      if (!editor) return
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, '\n')
      if (!selectedText.trim()) return

      // Delete selected text so stream replaces it
      editor.chain().focus().deleteSelection().run()

      const prompt = `请根据以下指令改写文本：\n\n指令：${instruction}\n\n原文：\n${selectedText}`
      await callStream(prompt)
    },
    [editor, callStream],
  )

  const continueWriting = useCallback(async () => {
    if (!editor) return
    const { from } = editor.state.selection
    const textBefore = editor.state.doc.textBetween(
      Math.max(0, from - 3000),
      from,
      '\n',
    )
    const prompt = `请续写以下内容，保持风格和语气一致：\n\n${textBefore}`
    await callStream(prompt)
  }, [editor, callStream])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setIsGenerating(false)
  }, [])

  return {
    isGenerating,
    generateAtCursor,
    rewriteSelection,
    continueWriting,
    cancel,
  }
}
