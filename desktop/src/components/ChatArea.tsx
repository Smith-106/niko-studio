import { useState, useRef, useEffect, useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useMessages, useCurrentConversationId, useWorkflowLevel, useSelectedSkills, useAllowLlmFallback, useQualityGoals } from '../stores/selectors'
import { chat, chatStream, agentRoute, agentWrite, agentRevise, agentGetContext, createCheckpoint, restoreCheckpoint, quickRollbackWorkflow, uploadMemoryFile } from '../api/client'
import type { ChatRequest, StreamDonePayload } from '../api/client'
import { MessageBubble } from './MessageBubble'
import { PromptTemplatePanel, type ApplyTemplatePayload } from './PromptTemplatePanel'
import { ChatAreaInlineActions } from './ChatAreaInlineActions'
import { ChatAreaModeControls } from './ChatAreaModeControls'
import { ChatAreaComposer } from './ChatAreaComposer'
import { ChatAreaStreamStatus } from './ChatAreaStreamStatus'
import { useI18n } from '../i18n'

interface ChatAreaProps {
  onContextUsageChange?: (usage: { usedChars: number; usedK: number; totalK: number; percent: number }) => void
  connectionState?: 'connected' | 'degraded' | 'disconnected' | 'reconnecting'
}

type StreamPhase = 'idle' | 'streaming' | 'done' | 'error' | 'interrupted' | 'recovered'
type StreamTerminal = 'done' | 'error' | 'interrupted' | 'recovered'
type InlineAction = 'continue' | 'revise' | 'generate' | null

interface SelectionMeta {
  messageId: string
}

interface StreamRuntimeMeta {
  terminal: StreamTerminal
  decision?: 'go' | 'soft_go' | 'no_go'
  diagnostics?: {
    fallback_reason?: string | null
    failure_reason?: string | null
    error_type?: string | null
  }
}

export function ChatArea({ onContextUsageChange, connectionState = 'connected' }: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle')
  const [chatMode, setChatMode] = useState<'chat' | 'agent'>('chat')
  const [agentAction, setAgentAction] = useState<'write' | 'revise' | 'context'>('write')
  const [enableModelComparison, setEnableModelComparison] = useState(false)
  const [comparisonModel, setComparisonModel] = useState('')
  const [recoverableCheckpointId, setRecoverableCheckpointId] = useState<string | null>(null)
  const [recoverStatus, setRecoverStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [selectedText, setSelectedText] = useState('')
  const [selectionMeta, setSelectionMeta] = useState<SelectionMeta | null>(null)
  const [inlineAction, setInlineAction] = useState<InlineAction>(null)
  const [quickRollbackPlanId, setQuickRollbackPlanId] = useState('')
  const [quickRollbackCheckpointId, setQuickRollbackCheckpointId] = useState('')
  const [quickRollbackReason, setQuickRollbackReason] = useState('')
  const [quickRollbackStatus, setQuickRollbackStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [uploadStatus, setUploadStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamRequestIdRef = useRef(0)
  const { t, translate } = useI18n()
  const previousConnectionStateRef = useRef<ChatAreaProps['connectionState'] | null>(null)
  const lastContextUsageRef = useRef<{ usedChars: number; usedK: number; totalK: number; percent: number } | null>(null)

  const currentConversationId = useCurrentConversationId()
  const messages = useMessages()
  const workflowLevel = useWorkflowLevel()
  const selectedSkills = useSelectedSkills()
  const allowLlmFallback = useAllowLlmFallback()
  const qualityGoals = useQualityGoals()
  const { settings } = useSettingsStore()
  const {
    toggleTemplateFavorite,
    recordTemplateUsage,
    setTemplateVariablePreset,
  } = useSettingsStore()
  const promptTemplateLibrary = settings.promptTemplateLibrary
  const availableComparisonModels = useMemo(() => {
    const allModels = settings.llmProviders.flatMap((provider) => {
      const models = [...(provider.models ?? []), ...(provider.fetchedModels ?? []), ...(provider.customModels ?? [])]
      return models.filter((model) => Boolean(model && model.trim())).map((model) => model.trim())
    })
    return Array.from(new Set(allModels))
  }, [settings.llmProviders])

  useEffect(() => {
    if (availableComparisonModels.length === 0) {
      setComparisonModel('')
      return
    }
    setComparisonModel((prev) => (prev && availableComparisonModels.includes(prev) ? prev : availableComparisonModels[0]))
  }, [availableComparisonModels])

  useEffect(() => {
    if (!onContextUsageChange) return

    const messageChars = messages.reduce((total, message) => total + message.content.length, 0)
    const usedChars = messageChars + streamingContent.length
    const totalK = 128
    const usedK = Number((usedChars / 1000).toFixed(1))
    const percent = Number(Math.min((usedChars / (totalK * 1000)) * 100, 999).toFixed(1))
    const nextUsage = { usedChars, usedK, totalK, percent }
    const prevUsage = lastContextUsageRef.current

    if (
      prevUsage &&
      prevUsage.usedChars === nextUsage.usedChars &&
      prevUsage.usedK === nextUsage.usedK &&
      prevUsage.totalK === nextUsage.totalK &&
      prevUsage.percent === nextUsage.percent
    ) {
      return
    }

    lastContextUsageRef.current = nextUsage
    onContextUsageChange(nextUsage)
  }, [messages, streamingContent, onContextUsageChange])

  useEffect(() => {
    const previous = previousConnectionStateRef.current
    if (connectionState === previous) {
      return
    }

    if (connectionState === 'reconnecting') {
      setRecoverStatus({ type: 'error', message: t.streamReconnecting })
    } else if (connectionState === 'connected' && previous === 'reconnecting') {
      setRecoverStatus({ type: 'success', message: t.streamRecovered })
    } else if (connectionState === 'disconnected') {
      setRecoverStatus({ type: 'error', message: t.streamInterrupted })
    }

    previousConnectionStateRef.current = connectionState
  }, [connectionState, t])

  const { addMessage, setWorkflowLevel, createConversation } = useAppStore()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCancelStream = () => {
    abortControllerRef.current?.abort()
  }

  const resetInlineState = () => {
    setInlineAction(null)
    setSelectionMeta(null)
    setSelectedText('')
  }

  const runNormalChat = async (request: ChatRequest, checkpointId?: string | null): Promise<StreamPhase> => {
    if (request.comparison?.enabled) {
      setStreamPhase('streaming')
      const response = await chat(request)
      if (response.success && response.data) {
        if (response.data.comparison?.enabled) {
          const comparison = response.data.comparison
          addMessage(
            'assistant',
            response.data.content || comparison.primary.content,
            response.data.skills_used || selectedSkills,
            comparison,
            response.data.writer_metadata
          )
        } else {
          addMessage(
            'assistant',
            response.data.content || t.processingCompleted,
            response.data.skills_used || selectedSkills,
            undefined,
            response.data.writer_metadata
          )
        }
        setRecoverableCheckpointId(null)
        setRecoverStatus(null)
        setStreamPhase('done')
        return 'done'
      }
      addMessage('assistant', response.error || t.serviceUnavailableRetry)
      if (checkpointId) {
        setRecoverStatus({ type: 'error', message: t.streamRestoreHint })
      }
      setStreamPhase('error')
      return 'error'
    }

    let streamFailed = false
    let hasStreamContent = false
    let streamText = ''
    let streamWriterMetadata: StreamDonePayload['writer_metadata']
    let finalPhase: StreamPhase | null = null
    let finalized = false
    let streamDone = false
    let streamMeta: StreamRuntimeMeta | null = null

    const requestId = ++streamRequestIdRef.current
    const abortController = new AbortController()
    abortControllerRef.current = abortController
    setStreamPhase('streaming')

    const finalize = (phase: StreamPhase, meta?: StreamRuntimeMeta) => {
      if (finalized || requestId !== streamRequestIdRef.current) return
      finalized = true
      finalPhase = phase
      streamMeta = meta ?? streamMeta
      setStreamPhase(phase)
    }

    const normalizeTerminal = (payload?: StreamDonePayload): StreamTerminal => {
      if (payload?.terminal === 'done' || payload?.terminal === 'error' || payload?.terminal === 'interrupted' || payload?.terminal === 'recovered') {
        return payload.terminal
      }
      if (payload?.status === 'aborted') {
        return 'interrupted'
      }
      if (payload?.status === 'restored') {
        return 'recovered'
      }
      return 'done'
    }

    const maybeShowGateHint = (payload?: StreamDonePayload) => {
      if (!payload?.decision) return
      if (payload.decision === 'soft_go') {
        setRecoverStatus({ type: 'error', message: t.streamGateSoftGo })
      }
      if (payload.decision === 'no_go') {
        setRecoverStatus({ type: 'error', message: t.streamGateNoGo })
      }
      streamMeta = {
        terminal: normalizeTerminal(payload),
        decision: payload.decision,
        diagnostics: payload.diagnostics,
      }
      if (streamMeta.terminal === 'recovered') {
        setRecoverStatus({ type: 'success', message: t.streamRecovered })
      }
    }

    await chatStream(
      request,
      {
        onContent: (chunk) => {
          hasStreamContent = true
          streamText += chunk
          setStreamingContent(streamText)
        },
        onDone: (payload) => {
          streamDone = true
          streamWriterMetadata = payload.writer_metadata
          maybeShowGateHint(payload)
          const terminal = normalizeTerminal(payload)
          finalize(terminal, { terminal, decision: payload.decision, diagnostics: payload.diagnostics })
        },
        onError: (error, payload) => {
          const terminal = payload?.terminal === 'interrupted' ? 'interrupted' : 'error'
          if (abortController.signal.aborted || terminal === 'interrupted' || error.toLowerCase().includes('abort')) {
            finalize('interrupted', { terminal: 'interrupted', diagnostics: payload?.diagnostics })
            return
          }
          streamFailed = true
          finalize('error', { terminal: 'error', diagnostics: payload?.diagnostics })
        },
      },
      { signal: abortController.signal }
    )

    if (abortControllerRef.current === abortController) {
      abortControllerRef.current = null
    }

    if (!finalized) {
      if (abortController.signal.aborted) {
        finalize('interrupted', { terminal: 'interrupted' })
      } else if (streamDone || hasStreamContent) {
        finalize('done', { terminal: 'done' })
      } else if (streamFailed) {
        finalize('error', { terminal: 'error' })
      } else {
        finalize('error', { terminal: 'error' })
      }
    }

    if ((finalPhase === 'done' || finalPhase === 'recovered') && hasStreamContent) {
      addMessage('assistant', streamText || t.processingCompleted, selectedSkills, undefined, streamWriterMetadata)
      setRecoverableCheckpointId(null)
      if (finalPhase === 'recovered') {
        setRecoverStatus({ type: 'success', message: t.streamRecovered })
      } else {
        setRecoverStatus(null)
      }
      return finalPhase
    }

    if (finalPhase === 'interrupted') {
      addMessage('assistant', t.streamInterrupted)
      return 'interrupted'
    }

    const response = await chat(request)
    if (response.success && response.data) {
      if (response.data.comparison?.enabled) {
        const comparison = response.data.comparison
        addMessage(
          'assistant',
          response.data.content || comparison.primary.content,
          response.data.skills_used || selectedSkills,
          comparison,
          response.data.writer_metadata
        )
      } else {
        addMessage(
          'assistant',
          response.data.content || t.processingCompleted,
          response.data.skills_used || selectedSkills,
          undefined,
          response.data.writer_metadata
        )
      }
      setRecoverableCheckpointId(null)
      setRecoverStatus(null)
      return finalPhase ?? 'done'
    }

    addMessage('assistant', response.error || t.serviceUnavailableRetry)
    if (checkpointId) {
      const streamMetaValue = streamMeta as StreamRuntimeMeta | null
      const diagnosticsText = streamMetaValue?.diagnostics?.fallback_reason || streamMetaValue?.diagnostics?.failure_reason
      const message = diagnosticsText ? `${t.streamRestoreHint}（${diagnosticsText}）` : t.streamRestoreHint
      setRecoverStatus({ type: 'error', message })
    }
    return 'error'
  }

  const runInlineAction = async () => {
    if (!inlineAction || isLoading) return

    const promptText = input.trim()
    setIsLoading(true)
    setStreamingContent('')
    setStreamPhase('streaming')
    setRecoverStatus(null)

    try {
      if (inlineAction === 'revise') {
        if (!selectedText) {
          setRecoverStatus({ type: 'error', message: t.inlineNeedSelection })
          return
        }
        const reviseResult = await agentRevise(selectedText, {
          instruction: promptText || t.inlineReviseDefaultInstruction,
          workflow_level: workflowLevel,
          skills: selectedSkills,
        }, {
          naturalness: qualityGoals.naturalness,
          readability: qualityGoals.readability,
          coherence: qualityGoals.coherence,
          style_consistency: qualityGoals.styleConsistency,
          humanization_preset: qualityGoals.humanizationPreset,
          custom_humanization_instruction: qualityGoals.customHumanizationInstruction,
          sentence_entropy_target: qualityGoals.sentenceEntropyTarget,
          rhythm_variability_target: qualityGoals.rhythmVariabilityTarget,
        })
        if (reviseResult.success && reviseResult.data?.content) {
          setStreamingContent(reviseResult.data.content)
          addMessage('assistant', reviseResult.data.content, selectedSkills)
          setStreamPhase('done')
          resetInlineState()
          return
        }
      } else {
        const task = inlineAction === 'continue'
          ? (promptText || `${t.inlineContinuePromptPrefix}\n${selectedText}`)
          : (promptText || `${t.inlineGeneratePromptPrefix}\n${selectedText || t.inlineGenerateContextFallback}`)

        const writeResult = await agentWrite(
          {
            task,
            scene_type: inlineAction === 'continue' ? 'inline_continue' : 'inline_generate',
            workflow_level: workflowLevel,
            selected_text: selectedText,
            selection_meta: selectionMeta,
          },
          selectedSkills,
          undefined,
          {
            naturalness: qualityGoals.naturalness,
            readability: qualityGoals.readability,
            coherence: qualityGoals.coherence,
            style_consistency: qualityGoals.styleConsistency,
            humanization_preset: qualityGoals.humanizationPreset,
            custom_humanization_instruction: qualityGoals.customHumanizationInstruction,
            sentence_entropy_target: qualityGoals.sentenceEntropyTarget,
            rhythm_variability_target: qualityGoals.rhythmVariabilityTarget,
          }
        )

        if (writeResult.success && writeResult.data?.content) {
          setStreamingContent(writeResult.data.content)
          addMessage('assistant', writeResult.data.content, selectedSkills)
          setStreamPhase('done')
          resetInlineState()
          return
        }
      }

      setStreamPhase('error')
      setRecoverStatus({ type: 'error', message: t.inlineActionFailed })
    } catch {
      setStreamPhase('error')
      setRecoverStatus({ type: 'error', message: t.inlineActionFailed })
    } finally {
      setStreamingContent('')
      setIsLoading(false)
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

    let uploadSessionId = currentConversationId
    if (!uploadSessionId) {
      createConversation()
      uploadSessionId = useAppStore.getState().currentConversationId
    }

    if (!uploadSessionId) {
      setUploadStatus({ type: 'error', message: t.sessionCreateFailedRetry })
      return
    }

    const allowedExtensions = ['txt', 'md', 'pdf', 'docx']
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      setUploadStatus({ type: 'error', message: t.uploadUnsupportedFormat })
      return
    }

    setIsLoading(true)
    setUploadStatus(null)

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index])
      }
      const fileContentBase64 = btoa(binary)

      const response = await uploadMemoryFile({
        file_name: file.name,
        file_content_base64: fileContentBase64,
        session_id: uploadSessionId,
      })

      if (!response.success || !response.data) {
        setUploadStatus({ type: 'error', message: response.error || t.uploadInjectionFailedRetry })
        return
      }

      setUploadStatus({
        type: 'success',
        message: translate('uploadInjectedChunks', { fileName: file.name, chunks: response.data.chunks }),
      })
      addMessage('assistant', translate('uploadInjectedContext', { fileName: file.name, chunks: response.data.chunks }))
    } catch {
      setUploadStatus({ type: 'error', message: t.uploadInjectionFailedRetry })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRestoreToCheckpoint = async () => {
    if (!recoverableCheckpointId || isLoading) return

    try {
      const response = await restoreCheckpoint(recoverableCheckpointId)
      if (response.success) {
        setRecoverStatus({ type: 'success', message: t.streamRestoreBeforeSendSuccess })
        setRecoverableCheckpointId(null)
      } else {
        setRecoverStatus({ type: 'error', message: response.error || t.restoreFailed })
      }
    } catch {
      setRecoverStatus({ type: 'error', message: t.restoreFailed })
    }
  }

  const handleQuickRollback = async () => {
    const planId = quickRollbackPlanId.trim()
    const checkpointId = quickRollbackCheckpointId.trim()

    if (!planId || !checkpointId || isLoading) {
      setQuickRollbackStatus({ type: 'error', message: t.quickRollbackMissingRequired })
      return
    }

    try {
      const response = await quickRollbackWorkflow(planId, checkpointId, quickRollbackReason.trim() || undefined)
      if (response.success) {
        setQuickRollbackStatus({ type: 'success', message: t.quickRollbackSuccess })
      } else {
        setQuickRollbackStatus({ type: 'error', message: response.error || t.quickRollbackFailed })
      }
    } catch {
      setQuickRollbackStatus({ type: 'error', message: t.quickRollbackFailed })
    }
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    if (!currentConversationId) {
      createConversation()
    }

    const userMessage = input.trim()
    setInput('')
    setRecoverStatus(null)

    let checkpointId: string | null = null

    try {
      const checkpointResponse = await createCheckpoint(`before-send:${Date.now()}`)
      checkpointId = checkpointResponse.success && checkpointResponse.data?.checkpoint_id
        ? checkpointResponse.data.checkpoint_id
        : null
      if (checkpointId) {
        setRecoverableCheckpointId(checkpointId)
      }

      addMessage('user', userMessage)
      setIsLoading(true)
      setStreamingContent('')
      setStreamPhase('idle')

      const retrieval = settings.retrieval
      const contextTypes = settings.contextTypes

      const request: ChatRequest = {
        messages: [{ role: 'user', content: userMessage }],
        workflowLevel,
        skills: selectedSkills,
        allowLlmFallback,
        qualityGoals: {
          naturalness: qualityGoals.naturalness,
          readability: qualityGoals.readability,
          coherence: qualityGoals.coherence,
          style_consistency: qualityGoals.styleConsistency,
          humanization_preset: qualityGoals.humanizationPreset,
          custom_humanization_instruction: qualityGoals.customHumanizationInstruction,
          sentence_entropy_target: qualityGoals.sentenceEntropyTarget,
          rhythm_variability_target: qualityGoals.rhythmVariabilityTarget,
        },
        knowledge_retrieval: retrieval.enabled,
        search_mode: retrieval.searchMode,
        profile: retrieval.profile || undefined,
        min_score: retrieval.minScore,
        budget_tokens: retrieval.budgetTokens,
        rerank: retrieval.rerank,
        max_iterations: retrieval.maxIterations,
        confidence_threshold: retrieval.confidenceThreshold,
      }

      if (enableModelComparison && comparisonModel) {
        request.comparison = {
          enabled: true,
          controlModel: comparisonModel,
        }
      }

      if (chatMode === 'agent') {
        let handled = false

        if (agentAction === 'write') {
          const routeResult = await agentRoute(userMessage)
          if (routeResult.success && routeResult.data) {
            const writeResult = await agentWrite(
              {
                task: userMessage,
                scene_type: routeResult.data.scene_type,
                workflow_level: routeResult.data.workflow_level,
                task_assignments: routeResult.data.task_assignments,
              },
              selectedSkills,
              undefined,
              {
                naturalness: qualityGoals.naturalness,
                readability: qualityGoals.readability,
                coherence: qualityGoals.coherence,
                style_consistency: qualityGoals.styleConsistency,
              }
            )
            if (writeResult.success && writeResult.data?.content) {
              addMessage('assistant', writeResult.data.content, selectedSkills)
              setRecoverableCheckpointId(null)
              handled = true
            }
          }
        }

        if (agentAction === 'revise') {
          const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
          const reviseResult = await agentRevise(
            lastAssistantMessage?.content || userMessage,
            {
              instruction: userMessage,
              workflow_level: workflowLevel,
              skills: selectedSkills,
            },
            {
              naturalness: qualityGoals.naturalness,
              readability: qualityGoals.readability,
              coherence: qualityGoals.coherence,
              style_consistency: qualityGoals.styleConsistency,
              humanization_preset: qualityGoals.humanizationPreset,
              custom_humanization_instruction: qualityGoals.customHumanizationInstruction,
              sentence_entropy_target: qualityGoals.sentenceEntropyTarget,
              rhythm_variability_target: qualityGoals.rhythmVariabilityTarget,
            }
          )
          if (reviseResult.success && reviseResult.data?.content) {
            addMessage('assistant', reviseResult.data.content, selectedSkills)
            setRecoverableCheckpointId(null)
            handled = true
          }
        }

        if (agentAction === 'context') {
          const contextResult = await agentGetContext(
            {
              task: userMessage,
              workflow_level: workflowLevel,
            },
            contextTypes
          )
          if (contextResult.success && contextResult.data) {
            addMessage('assistant', `${t.chatAgentContextPrefix}\n\n${JSON.stringify(contextResult.data, null, 2)}`)
            setRecoverableCheckpointId(null)
            handled = true
          }
        }

        if (!handled) {
          await runNormalChat(request, checkpointId)
        }
      } else {
        await runNormalChat(request, checkpointId)
      }
    } catch {
      setStreamPhase('error')
      addMessage('assistant', t.backendConnectionFailed)
      if (checkpointId) {
        setRecoverStatus({ type: 'error', message: t.streamRestoreHint })
      }
    } finally {
      setStreamingContent('')
      setIsLoading(false)
      abortControllerRef.current = null
    }
  }

  const handleAssistantSelection = (payload: { messageId: string; selectedText: string }) => {
    setSelectionMeta({ messageId: payload.messageId })
    setSelectedText(payload.selectedText)
    setInlineAction(null)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleApplyTemplate = ({ text, mode, templateId, variableValues }: ApplyTemplatePayload) => {
    if (mode === 'replace') {
      setInput(text)
    } else {
      setInput((prev) => (prev ? `${prev}\n\n${text}` : text))
    }

    recordTemplateUsage(templateId)
    for (const [variableId, value] of Object.entries(variableValues)) {
      setTemplateVariablePreset(templateId, variableId, value)
    }
    setIsTemplatePanelOpen(false)
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-dark-surface">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">
            <div className="text-6xl mb-4">...</div>
            <h2 className="text-xl font-semibold text-gray-600 dark:text-dark-text mb-2">{t.startWriting}</h2>
            <p className="text-sm text-gray-400 dark:text-dark-text-secondary max-w-md text-center">
              {t.startWritingDesc}
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble key={message.id} message={message} onAssistantSelection={handleAssistantSelection} />
          ))
        )}
        {isLoading && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming-assistant',
              role: 'assistant',
              content: streamingContent,
              timestamp: new Date(),
              skills: selectedSkills,
            }}
          />
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400 dark:text-dark-text-secondary">
            <div className="animate-pulse">
              {streamPhase === 'streaming' ? t.thinking : streamPhase === 'interrupted' ? t.streamInterrupted : t.thinking}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

        <ChatAreaStreamStatus
          recoverStatus={recoverStatus}
          recoverableCheckpointId={recoverableCheckpointId}
          restoreBeforeSendLabel={t.streamRestoreToBeforeSend}
          onRestoreToCheckpoint={handleRestoreToCheckpoint}
          uploadStatus={uploadStatus}
        />

      <div className="px-4 py-2 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface">
        <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary mb-2">{t.quickRollbackTitle}</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={quickRollbackPlanId}
            onChange={(event) => setQuickRollbackPlanId(event.target.value)}
            placeholder={t.quickRollbackPlanIdPlaceholder}
            aria-label={t.quickRollbackPlanIdPlaceholder}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
          <input
            value={quickRollbackCheckpointId}
            onChange={(event) => setQuickRollbackCheckpointId(event.target.value)}
            placeholder={t.quickRollbackCheckpointIdPlaceholder}
            aria-label={t.quickRollbackCheckpointIdPlaceholder}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
          <input
            value={quickRollbackReason}
            onChange={(event) => setQuickRollbackReason(event.target.value)}
            placeholder={t.quickRollbackReasonPlaceholder}
            aria-label={t.quickRollbackReasonPlaceholder}
            className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
        </div>
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={handleQuickRollback}
            type="button"
            className="px-3 py-1 text-xs bg-amber-600 text-white rounded hover:bg-amber-700 disabled:opacity-50"
            disabled={isLoading}
          >
            {t.quickRollbackAction}
          </button>
          {quickRollbackStatus && (
            <span className={`text-xs ${quickRollbackStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {quickRollbackStatus.message}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-dark-border p-4 bg-gray-50 dark:bg-dark-bg">
        {selectionMeta && (
          <ChatAreaInlineActions
            selectedText={selectedText}
            inlineAction={inlineAction}
            selectedTextInfo={translate('inlineSelectedTextInfo', { count: Math.min(selectedText.length, 80) })}
            continueLabel={t.inlineContinue}
            reviseLabel={t.inlineRevise}
            generateLabel={t.inlineGenerate}
            runLabel={t.inlineRun}
            clearSelectionLabel={t.inlineClearSelection}
            runDisabled={!inlineAction || isLoading}
            onSelectAction={setInlineAction}
            onRun={runInlineAction}
            onClear={resetInlineState}
          />
        )}

        <ChatAreaModeControls
          modeLabel={t.chatModeLabel}
          workflowLabel={`${t.workflow}:`}
          selectedSkillsLabel={selectedSkills.length > 0 ? translate('selectedSkills', { count: selectedSkills.length }) : undefined}
          chatMode={chatMode}
          agentAction={agentAction}
          enableModelComparison={enableModelComparison}
          comparisonModel={comparisonModel}
          comparisonModels={availableComparisonModels}
          workflowLevel={workflowLevel}
          chatModeNormalLabel={t.chatModeNormal}
          chatModeAgentLabel={t.chatModeAgent}
          chatModeComparisonLabel={t.chatModeComparison}
          templateLibraryEntryLabel={t.templateLibraryEntry}
          comparisonModelLabel={t.chatComparisonModelLabel}
          chatAgentActionWriteLabel={t.chatAgentActionWrite}
          chatAgentActionReviseLabel={t.chatAgentActionRevise}
          chatAgentActionContextLabel={t.chatAgentActionContext}
          workflowQuickLabel={t.quick}
          workflowLiteLabel={t.lite}
          workflowStandardLabel={t.standard}
          workflowBrainstormLabel={t.brainstorm}
          workflowCoordinatorLabel={t.coordinator}
          onSetChatMode={setChatMode}
          onToggleModelComparison={() => setEnableModelComparison((prev) => !prev)}
          onOpenTemplateLibrary={() => setIsTemplatePanelOpen(true)}
          onSetComparisonModel={setComparisonModel}
          onSetAgentAction={setAgentAction}
          onSetWorkflowLevel={setWorkflowLevel}
        />

        <ChatAreaComposer
          input={input}
          isLoading={isLoading}
          sendDisabled={!input.trim()}
          inputPlaceholder={t.inputPlaceholder}
          uploadLabel={t.composerUpload}
          voiceInputLabel={t.composerVoiceInput}
          sendLabel={t.composerSend}
          cancelLabel={t.cancel}
          fileInputRef={fileInputRef}
          onInputChange={setInput}
          onKeyDown={handleKeyDown}
          onFileUpload={handleFileUpload}
          onOpenFilePicker={() => fileInputRef.current?.click()}
          onCancelStream={handleCancelStream}
          onSend={handleSend}
        />
      </div>
      {isTemplatePanelOpen && promptTemplateLibrary && (
        <PromptTemplatePanel
          templates={promptTemplateLibrary.templates}
          variablePresets={promptTemplateLibrary.variablePresets}
          onToggleFavorite={toggleTemplateFavorite}
          onApplyTemplate={handleApplyTemplate}
          onClose={() => setIsTemplatePanelOpen(false)}
        />
      )}
    </div>
  )
}
