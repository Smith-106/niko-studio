import { useState, useEffect, useMemo, useRef } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useMessages, useCurrentConversationId, useWorkflowLevel, useSelectedSkills, useAllowLlmFallback, useQualityGoals } from '../stores/selectors'
import { chat, agentRoute, agentWrite, agentRevise, agentGetContext, quickRollbackWorkflow } from '../api/client'
import type { ChatRequest, StreamDonePayload } from '../api/client'
import { MessageBubble } from './MessageBubble'
import { PromptTemplatePanel, type ApplyTemplatePayload } from './PromptTemplatePanel'
import { ChatAreaInlineActions } from './ChatAreaInlineActions'
import { ChatAreaModeControls } from './ChatAreaModeControls'
import { ChatAreaComposer } from './ChatAreaComposer'
import { ChatAreaStreamStatus } from './ChatAreaStreamStatus'
import { useI18n } from '../i18n'
import { useChatRequestBuilder } from '../hooks/useChatRequestBuilder'
import { useChatStreaming } from '../hooks/useChatStreaming'
import { useChatRecovery } from '../hooks/useChatRecovery'
import { useMemoryUpload } from '../hooks/useMemoryUpload'
import { useInlineActions } from '../hooks/useInlineActions'

interface ChatAreaProps {
  onContextUsageChange?: (usage: { usedChars: number; usedK: number; totalK: number; percent: number }) => void
  connectionState?: 'connected' | 'degraded' | 'disconnected' | 'reconnecting'
}

type StreamPhase = 'idle' | 'streaming' | 'done' | 'error' | 'interrupted' | 'recovered'
type StreamTerminal = 'done' | 'error' | 'interrupted' | 'recovered'

interface StreamRuntimeMeta {
  terminal: StreamTerminal
  decision?: 'go' | 'soft_go' | 'no_go'
  diagnostics?: {
    fallback_reason?: string | null
    failure_reason?: string | null
    error_type?: string | null
  }
}

interface RecoverStatus {
  type: 'error' | 'success' | 'info'
  message: string
  detail?: string
}

interface RetryPayload {
  message: string
  chatMode: 'chat' | 'agent'
  agentAction: 'write' | 'revise' | 'context'
  workflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  selectedSkills: string[]
  enableModelComparison: boolean
  comparisonModel: string
}

export function ChatArea({ onContextUsageChange, connectionState = 'connected' }: ChatAreaProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamPhase, setStreamPhase] = useState<StreamPhase>('idle')
  const [chatMode, setChatMode] = useState<'chat' | 'agent'>('chat')
  const [agentAction, setAgentAction] = useState<'write' | 'revise' | 'context'>('write')
  const [enableModelComparison, setEnableModelComparison] = useState(false)
  const [comparisonModel, setComparisonModel] = useState('')
  const { streamingContent, setStreamingContent, startStream, cancelStream } = useChatStreaming()
  const {
    selectedText,
    selectionMeta,
    inlineAction,
    setInlineAction,
    resetInlineState,
    handleAssistantSelection,
    runDisabled,
  } = useInlineActions({ isLoading })
  const [quickRollbackPlanId, setQuickRollbackPlanId] = useState('')
  const [quickRollbackCheckpointId, setQuickRollbackCheckpointId] = useState('')
  const [quickRollbackReason, setQuickRollbackReason] = useState('')
  const [showQuickRollbackAdvanced, setShowQuickRollbackAdvanced] = useState(false)
  const [quickRollbackStatus, setQuickRollbackStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const { t, translate } = useI18n()
  const {
    recoverableCheckpointId,
    setRecoverableCheckpointId,
    recoverStatus,
    setRecoverStatus,
    createBeforeSendCheckpoint,
    restoreToCheckpoint,
  } = useChatRecovery({
    connectionState,
    t: {
      streamReconnecting: t.streamReconnecting,
      streamRecovered: t.streamRecovered,
      streamInterrupted: t.streamInterrupted,
      streamRestoreBeforeSendSuccess: t.streamRestoreBeforeSendSuccess,
      restoreFailed: t.restoreFailed,
    },
  })
  const currentConversationId = useCurrentConversationId()
  const messages = useMessages()
  const workflowLevel = useWorkflowLevel()
  const selectedSkills = useSelectedSkills()
  const allowLlmFallback = useAllowLlmFallback()
  const qualityGoals = useQualityGoals()
  const { settings } = useSettingsStore()
  const promptTemplateLibrary = settings.promptTemplateLibrary
  const {
    toggleTemplateFavorite,
    recordTemplateUsage,
    setTemplateVariablePreset,
  } = useSettingsStore()

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastRetryPayloadRef = useRef<RetryPayload | null>(null)
  const lastContextUsageRef = useRef<{ usedChars: number; usedK: number; totalK: number; percent: number } | null>(null)

  const { addMessage, setWorkflowLevel, createConversation } = useAppStore()

  const {
    uploadStatus,
    fileInputRef,
    openPicker,
    handleFileUpload,
  } = useMemoryUpload({
    t: {
      sessionCreateFailedRetry: t.sessionCreateFailedRetry,
      uploadUnsupportedFormat: t.uploadUnsupportedFormat,
      uploadStageReading: t.uploadStageReading,
      uploadStageUploading: t.uploadStageUploading,
      uploadStageInjecting: t.uploadStageInjecting,
      uploadErrorFormat: t.uploadErrorFormat,
      uploadErrorSize: t.uploadErrorSize,
      uploadErrorNetwork: t.uploadErrorNetwork,
      uploadErrorService: t.uploadErrorService,
    },
    translate: (key, vars) => translate(key, vars),
    currentConversationId,
    createConversation,
    getCurrentConversationId: () => useAppStore.getState().currentConversationId,
    addMessage,
  })
  const modePresets = useMemo(() => ([
    { id: 'focusWriting' as const, label: t.modePresetFocusWriting },
    { id: 'agentDiagnose' as const, label: t.modePresetAgentDiagnose },
    { id: 'compareReview' as const, label: t.modePresetCompareReview },
  ]), [t])
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

  const { buildChatRequest } = useChatRequestBuilder({
    allowLlmFallback,
    qualityGoals,
    retrieval: settings.retrieval,
  })

  const makeRecoverError = (message: string, detail?: string): RecoverStatus => ({
    type: 'error',
    message,
    detail,
  })



  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleCancelStream = () => {
    cancelStream()
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
        setRecoverStatus(makeRecoverError(t.streamRestoreHint, response.error || t.serviceUnavailableRetry))
      }
      setStreamPhase('error')
      return 'error'
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

    let streamMeta: StreamRuntimeMeta | null = null
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

    const { phase, meta } = await startStream(request, {
      t: {
        processingCompleted: t.processingCompleted,
        streamRecovered: t.streamRecovered,
      },
      normalizeTerminal,
      maybeShowGateHint,
      onStreamPhase: setStreamPhase,
      onRecoverStatus: (status) => {
        if (!status) {
          setRecoverStatus(null)
          return
        }
        setRecoverStatus(status)
      },
      onCommitAssistantMessage: ({ content, writerMetadata }) => {
        addMessage('assistant', content, selectedSkills, undefined, writerMetadata)
        setRecoverableCheckpointId(null)
      },
      onInterrupted: () => {
        addMessage('assistant', t.streamInterrupted)
      },
    })

    if (phase === 'done' || phase === 'recovered') {
      return phase
    }

    if (phase === 'interrupted') {
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
      return phase
    }

    addMessage('assistant', response.error || t.serviceUnavailableRetry)
    if (checkpointId) {
      const diagnosticsText = meta?.diagnostics?.fallback_reason || meta?.diagnostics?.failure_reason
      const detail = response.error || diagnosticsText || t.serviceUnavailableRetry
      const message = diagnosticsText ? `${t.streamRestoreHint}（${diagnosticsText}）` : t.streamRestoreHint
      setRecoverStatus(makeRecoverError(message, detail))
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
          setRecoverStatus(makeRecoverError(t.inlineNeedSelection, t.inlineNeedSelection))
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
      setRecoverStatus(makeRecoverError(t.inlineActionFailed, t.inlineActionFailed))
    } catch {
      setStreamPhase('error')
      setRecoverStatus(makeRecoverError(t.inlineActionFailed, t.inlineActionFailed))
    } finally {
      setStreamingContent('')
      setIsLoading(false)
    }
  }


  const handleRestoreToCheckpoint = async () => {
    if (!recoverableCheckpointId || isLoading) return
    await restoreToCheckpoint()
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

  const handleSend = async (overrideMessage?: string, overridePayload?: RetryPayload) => {
    const payloadForSend = overridePayload ?? {
      message: overrideMessage ?? input.trim(),
      chatMode,
      agentAction,
      workflowLevel,
      selectedSkills: [...selectedSkills],
      enableModelComparison,
      comparisonModel,
    }

    if (!payloadForSend.message.trim() || isLoading) return

    if (!currentConversationId) {
      createConversation()
    }

    const userMessage = payloadForSend.message.trim()
    setInput('')
    setRecoverStatus(null)
    lastRetryPayloadRef.current = payloadForSend

    let checkpointId: string | null = null

    try {
      checkpointId = await createBeforeSendCheckpoint(`before-send:${Date.now()}`)

      addMessage('user', userMessage)
      setIsLoading(true)
      setStreamingContent('')
      setStreamPhase('idle')

      const request = buildChatRequest({
        userMessage,
        workflowLevel: payloadForSend.workflowLevel,
        selectedSkills: payloadForSend.selectedSkills,
        enableModelComparison: payloadForSend.enableModelComparison,
        comparisonModel: payloadForSend.comparisonModel,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      })

      const contextTypes = settings.contextTypes

      if (payloadForSend.chatMode === 'agent') {
        let handled = false

        if (payloadForSend.agentAction === 'write') {
          const routeResult = await agentRoute(userMessage)
          if (routeResult.success && routeResult.data) {
            const writeResult = await agentWrite(
              {
                task: userMessage,
                scene_type: routeResult.data.scene_type,
                workflow_level: routeResult.data.workflow_level,
                task_assignments: routeResult.data.task_assignments,
              },
              payloadForSend.selectedSkills,
              undefined,
              {
                naturalness: qualityGoals.naturalness,
                readability: qualityGoals.readability,
                coherence: qualityGoals.coherence,
                style_consistency: qualityGoals.styleConsistency,
              }
            )
            if (writeResult.success && writeResult.data?.content) {
              addMessage('assistant', writeResult.data.content, payloadForSend.selectedSkills)
              setRecoverableCheckpointId(null)
              handled = true
            }
          }
        }

        if (payloadForSend.agentAction === 'revise') {
          const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
          const reviseResult = await agentRevise(
            lastAssistantMessage?.content || userMessage,
            {
              instruction: userMessage,
              workflow_level: payloadForSend.workflowLevel,
              skills: payloadForSend.selectedSkills,
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
            addMessage('assistant', reviseResult.data.content, payloadForSend.selectedSkills)
            setRecoverableCheckpointId(null)
            handled = true
          }
        }

        if (payloadForSend.agentAction === 'context') {
          const contextResult = await agentGetContext(
            {
              task: userMessage,
              workflow_level: payloadForSend.workflowLevel,
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
        setRecoverStatus(makeRecoverError(t.streamRestoreHint, t.backendConnectionFailed))
      }
    } finally {
      setStreamingContent('')
      setIsLoading(false)
    }
  }

  const handleRetryLastSend = async () => {
    const payload = lastRetryPayloadRef.current
    if (!payload || isLoading) return

    setChatMode(payload.chatMode)
    setAgentAction(payload.agentAction)
    setWorkflowLevel(payload.workflowLevel)
    setEnableModelComparison(payload.enableModelComparison)
    setComparisonModel(payload.comparisonModel)

    await handleSend(payload.message, payload)
  }

  const handleCopyRecoverError = async (): Promise<boolean> => {
    const detail = recoverStatus?.detail || recoverStatus?.message
    if (!detail) return false

    try {
      await navigator.clipboard.writeText(detail)
      setRecoverStatus((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          message: `${prev.message} ${t.streamErrorCopied}`,
        }
      })
      return true
    } catch {
      return false
    }
  }

  const handleApplyModePreset = (presetId: 'focusWriting' | 'agentDiagnose' | 'compareReview') => {
    if (presetId === 'focusWriting') {
      setChatMode('chat')
      setEnableModelComparison(false)
      setAgentAction('write')
      setWorkflowLevel('L3')
      return
    }

    if (presetId === 'agentDiagnose') {
      setChatMode('agent')
      setAgentAction('context')
      setEnableModelComparison(false)
      setWorkflowLevel('L4')
      return
    }

    setChatMode('chat')
    setEnableModelComparison(true)
    setAgentAction('write')
    setWorkflowLevel('L2')
  }


  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isEnter = e.key === 'Enter' && !e.shiftKey
    if (!isEnter) return

    const shortcut = settings.sendShortcut
    const requireModifier = shortcut === 'ctrlEnter'
    const hasModifier = e.ctrlKey || e.metaKey

    if (requireModifier && !hasModifier) {
      return
    }

    if (!requireModifier && hasModifier) {
      return
    }

    e.preventDefault()
    void handleSend()
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
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-xl">
              {modePresets.map((preset) => (
                <button
                  key={`empty-${preset.id}`}
                  type="button"
                  onClick={() => handleApplyModePreset(preset.id)}
                  className="px-3 py-1.5 text-xs rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIsTemplatePanelOpen(true)}
                className="px-3 py-1.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-dark-border dark:text-dark-text hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t.templateLibraryEntry}
              </button>
              <button
                type="button"
                onClick={() => openPicker()}
                className="px-3 py-1.5 text-xs rounded-full bg-gray-100 text-gray-700 dark:bg-dark-border dark:text-dark-text hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {t.composerUpload}
              </button>
            </div>
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
          retryLastSendLabel={t.streamRetryLastSend}
          copyErrorLabel={t.streamCopyError}
          onRestoreToCheckpoint={handleRestoreToCheckpoint}
          onRetryLastSend={handleRetryLastSend}
          onCopyRecoverError={handleCopyRecoverError}
          uploadStatus={uploadStatus}
        />

      <div className="px-4 py-2 border-t border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface">
        <button
          type="button"
          onClick={() => setShowQuickRollbackAdvanced((prev) => !prev)}
          className="w-full flex items-center justify-between text-xs font-medium text-gray-600 dark:text-dark-text-secondary"
        >
          <span>{t.quickRollbackAdvancedToggle}</span>
          {showQuickRollbackAdvanced ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>

        {showQuickRollbackAdvanced && (
          <>
            <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary mt-2 mb-2">{t.quickRollbackTitle}</div>
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
          </>
        )}
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
            runDisabled={runDisabled}
            onSelectAction={setInlineAction}
            onRun={runInlineAction}
            onClear={resetInlineState}
          />
        )}

        <ChatAreaModeControls
          modeLabel={t.chatModeLabel}
          workflowLabel={`${t.workflow}:`}
          modePresetsLabel={t.modePresetsLabel}
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
          modePresets={modePresets}
          onSetChatMode={setChatMode}
          onToggleModelComparison={() => setEnableModelComparison((prev) => !prev)}
          onOpenTemplateLibrary={() => setIsTemplatePanelOpen(true)}
          onSetComparisonModel={setComparisonModel}
          onSetAgentAction={setAgentAction}
          onSetWorkflowLevel={setWorkflowLevel}
          onApplyPreset={handleApplyModePreset}
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
          onOpenFilePicker={openPicker}
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
