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
import type { Language } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import { useAppStore } from '../stores/appStore'
import { logger } from '../utils/logger'
import {
  buildEditorAIPayload,
  type EditorAIGenerateAction,
  type EditorAIPayload,
  type EditorAIRequest,
  type EditorAIRewriteVariant,
} from './editorAIPromptPolicy'

export interface UseEditorAIOptions {
  editor: Editor | null
  language: Language
  getStyleRequirements?: () => string | null | undefined
}

interface StreamRecoveryOptions {
  replaceFrom?: number
  fallbackText?: string
}

export type EditorAIRequestOwner = 'slash' | 'bubble'

export interface EditorAIRequestOptions {
  owner?: EditorAIRequestOwner
  allowRestart?: boolean
  beforeRequestStart?: () => void
}

interface ActiveEditorAIRequest {
  owner: EditorAIRequestOwner | null
  requestId: number
  controller: AbortController | null
  completion: Promise<void>
  resolveCompletion: () => void
}

export interface UseEditorAIReturn {
  isGenerating: boolean
  errorMessage: string | null
  clearError: () => void
  runRequest: (request: EditorAIRequest, options?: EditorAIRequestOptions) => Promise<void>
  generateAtCursor: (action?: EditorAIGenerateAction) => Promise<void>
  rewriteSelection: (variant: EditorAIRewriteVariant) => Promise<void>
  continueWriting: () => Promise<void>
  cancel: (owner?: EditorAIRequestOwner) => void
}

export function useEditorAI({
  editor,
  language,
  getStyleRequirements,
}: UseEditorAIOptions): UseEditorAIReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const activeRequestRef = useRef<ActiveEditorAIRequest | null>(null)
  const requestIdRef = useRef(0)

  const getProviderConfig = useCallback(() => {
    const { settings } = useSettingsStore.getState()
    const provider = settings.llmProviders.find(
      (p) => p.id === settings.primaryProvider && p.enabled && p.apiKey,
    )
    return provider ?? null
  }, [])

  const getSelectedSkillIds = useCallback(() => useAppStore.getState().selectedSkills, [])

  const clearError = useCallback(() => {
    setErrorMessage(null)
  }, [])

  const releaseRequest = useCallback((requestId: number) => {
    const activeRequest = activeRequestRef.current
    if (!activeRequest || activeRequest.requestId !== requestId) {
      return
    }

    activeRequest.resolveCompletion()
    activeRequestRef.current = null
    setIsGenerating(false)
  }, [])

  const claimRequest = useCallback(
    async (options?: EditorAIRequestOptions) => {
      const owner = options?.owner ?? null

      while (true) {
        const activeRequest = activeRequestRef.current
        if (!activeRequest) {
          let resolveCompletion = () => {}
          const completion = new Promise<void>((resolve) => {
            resolveCompletion = resolve
          })
          const nextRequest: ActiveEditorAIRequest = {
            owner,
            requestId: requestIdRef.current + 1,
            controller: null,
            completion,
            resolveCompletion,
          }

          requestIdRef.current = nextRequest.requestId
          activeRequestRef.current = nextRequest
          setIsGenerating(true)
          setErrorMessage(null)
          return nextRequest
        }

        const canRestart =
          Boolean(owner) &&
          options?.allowRestart === true &&
          activeRequest.owner === owner

        if (!canRestart) {
          return null
        }

        if (activeRequest.controller) {
          activeRequest.controller.abort()
        } else {
          releaseRequest(activeRequest.requestId)
        }

        await activeRequest.completion
      }
    },
    [releaseRequest],
  )

  const callStream = useCallback(
    async (
      requestId: number,
      payload: EditorAIPayload,
      recovery?: StreamRecoveryOptions,
    ) => {
      if (!editor) return

      const activeRequest = activeRequestRef.current
      if (!activeRequest || activeRequest.requestId !== requestId) {
        return
      }

      const controller = new AbortController()
      activeRequest.controller = controller
      const isCurrentRequest = () =>
        activeRequestRef.current?.requestId === requestId

      const pos = insertLoadingIndicator(editor)
      if (pos === null) {
        releaseRequest(requestId)
        return
      }

      const placeholderLen = 3
      const streamer = streamTextIntoEditor(editor, pos, placeholderLen)

      const provider = getProviderConfig()
      const skillIds = getSelectedSkillIds()
      let streamError: string | null = null
      let hasStreamedContent = false

      try {
        await streamWritingHelper(
          {
            content: payload.prompt,
            mode: 'generate',
            instruction: payload.styleInstruction,
            skill_ids: skillIds,
            model: provider?.defaultModel ?? '',
            provider: provider?.id ?? '',
            api_key: provider?.apiKey ?? '',
            base_url: provider?.baseUrl ?? '',
          },
          {
            onContent: (chunk) => {
              if (!isCurrentRequest() || controller.signal.aborted) {
                return
              }
              if (chunk.length > 0) {
                hasStreamedContent = true
              }
              streamer.append(chunk)
            },
            onDone: () => {
              if (!isCurrentRequest() || controller.signal.aborted) {
                return
              }
              streamer.finish()
            },
            onError: (err) => {
              if (!isCurrentRequest() || controller.signal.aborted) {
                return
              }
              streamError = err
              logger.error('AI stream error:', err)
            },
          },
          { signal: controller.signal },
        )
      } catch (error) {
        if (!isCurrentRequest() || controller.signal.aborted) {
          return
        }

        streamError = error instanceof Error ? error.message : String(error)
        logger.error('AI stream error:', error)
      } finally {
        if (!isCurrentRequest()) {
          return
        }

        const totalLen = streamer.finish()
        const shouldRestoreRewrite = Boolean(
          recovery?.fallbackText !== undefined &&
            recovery.replaceFrom !== undefined &&
            !hasStreamedContent,
        )

        if (streamError) {
          if (shouldRestoreRewrite) {
            replaceRange(
              editor,
              recovery?.replaceFrom ?? pos,
              totalLen,
              recovery?.fallbackText ?? '',
            )
          } else if (!hasStreamedContent && totalLen <= placeholderLen) {
            replaceRange(editor, pos, totalLen, '')
          }
          setErrorMessage(streamError)
        } else if (controller.signal.aborted) {
          if (shouldRestoreRewrite) {
            replaceRange(
              editor,
              recovery?.replaceFrom ?? pos,
              totalLen,
              recovery?.fallbackText ?? '',
            )
          } else if (!hasStreamedContent && totalLen <= placeholderLen) {
            replaceRange(editor, pos, totalLen, '')
          }
        }

        releaseRequest(requestId)
      }
    },
    [editor, getProviderConfig, getSelectedSkillIds, releaseRequest],
  )

  const runRequest = useCallback(
    async (request: EditorAIRequest, options?: EditorAIRequestOptions) => {
      if (!editor) return

      const claimedRequest = await claimRequest(options)
      if (!claimedRequest) {
        return
      }
      const isClaimedRequestActive = () =>
        activeRequestRef.current?.requestId === claimedRequest.requestId

      try {
        options?.beforeRequestStart?.()
      } catch (error) {
        releaseRequest(claimedRequest.requestId)
        throw error
      }

      if (!isClaimedRequestActive()) {
        return
      }

      const rawStyleRequirements = getStyleRequirements?.() ?? null

      if (request.action === 'rewrite') {
        const { from, to } = editor.state.selection
        const selectedText = editor.state.doc.textBetween(from, to, '\n')
        if (!selectedText.trim()) {
          releaseRequest(claimedRequest.requestId)
          return
        }

        editor.chain().focus().deleteSelection().run()

        await callStream(
          claimedRequest.requestId,
          buildEditorAIPayload({
            request,
            language,
            selectedText,
            rawStyleRequirements,
          }),
          {
            replaceFrom: from,
            fallbackText: selectedText,
          },
        )
        return
      }

      const { from } = editor.state.selection
      const contextWindow = request.action === 'continue' ? 3000 : 2000
      const contextBefore = editor.state.doc.textBetween(
        Math.max(0, from - contextWindow),
        from,
        '\n',
      )

      await callStream(
        claimedRequest.requestId,
        buildEditorAIPayload({
          request,
          language,
          contextBefore,
          rawStyleRequirements,
        }),
      )
    },
    [editor, language, getStyleRequirements, claimRequest, callStream, releaseRequest],
  )

  const cancel = useCallback(
    (owner?: EditorAIRequestOwner) => {
      const activeRequest = activeRequestRef.current
      if (!activeRequest) {
        return
      }

      if (owner && activeRequest.owner !== owner) {
        return
      }

      if (activeRequest.controller) {
        activeRequest.controller.abort()
        return
      }

      releaseRequest(activeRequest.requestId)
    },
    [releaseRequest],
  )

  const generateAtCursor = useCallback(
    async (action: EditorAIGenerateAction = 'generate') => {
      await runRequest({ action })
    },
    [runRequest],
  )

  const rewriteSelection = useCallback(
    async (variant: EditorAIRewriteVariant) => {
      await runRequest({ action: 'rewrite', variant })
    },
    [runRequest],
  )

  const continueWriting = useCallback(async () => {
    await runRequest({ action: 'continue' })
  }, [runRequest])

  return {
    isGenerating,
    errorMessage,
    clearError,
    runRequest,
    generateAtCursor,
    rewriteSelection,
    continueWriting,
    cancel,
  }
}
