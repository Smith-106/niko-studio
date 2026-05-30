import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { BookOpen, Lightbulb, MessageSquareText, PenLine, RefreshCw } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useCreateConversation, useAddMessage, useMessages, useCurrentConversationId, useWorkflowLevel, useSelectedSkills, useAvailableSkills, useAllowLlmFallback, useQualityGoals, useLatestAssistantMessageContent, useChatAreaSettings } from '../stores/selectors'
import { chat, agentRoute, agentWrite, agentRevise, agentGetContext, buildConsistencyGovernanceMetadata, mergeWriterMetadataGovernance } from '../api/client'
import type { ChatRequest, StreamDonePayload, WriterMetadata } from '../api/client'
import { PromptTemplatePanel, type ApplyTemplatePayload } from './PromptTemplatePanel'
import { ChatAreaInlineActions } from './ChatAreaInlineActions'
import { ChatAreaModeControls } from './ChatAreaModeControls'
import { ChatAreaComposer } from './ChatAreaComposer'
import { ChatAreaStreamStatus } from './ChatAreaStreamStatus'
import { ChatMessageList, type StarterAction } from './ChatMessageList'
import { ChatContextBar } from './ChatContextBar'
import { QuickRollback } from './QuickRollback'
import { useI18n } from '../i18n'
import { useChatRequestBuilder } from '../hooks/useChatRequestBuilder'
import { useChatStreaming } from '../hooks/useChatStreaming'
import { useChatRecovery } from '../hooks/useChatRecovery'
import { useMemoryUpload } from '../hooks/useMemoryUpload'
import { useInlineActions } from '../hooks/useInlineActions'
import { useScrollPosition } from '../hooks/useScrollPosition'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { buildFailurePresentation } from '../utils/failurePresentation'
import { useDraftCache } from '../hooks/useDraftCache'

interface ChatAreaProps {
  onContextUsageChange?: (usage: { usedChars: number; usedK: number; totalK: number; percent: number }) => void
  connectionState?: 'connected' | 'degraded' | 'disconnected' | 'reconnecting'
  isTemplatePanelOpen?: boolean
  onTemplatePanelOpenChange?: (open: boolean) => void
  onToggleKnowledgePanel?: () => void
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

const DEFAULT_CONTEXT_WINDOW_TOKENS = 128_000

const MODEL_CONTEXT_WINDOWS: Array<[prefix: string, contextWindow: number]> = [
  ['gpt-4o-mini', 128_000],
  ['gpt-4o', 128_000],
  ['gpt-4-turbo', 128_000],
  ['gpt-3.5-turbo', 16_385],
  ['claude-3.5-sonnet', 200_000],
  ['claude-3-5-sonnet', 200_000],
  ['claude-3-opus', 200_000],
  ['claude-3-sonnet', 200_000],
  ['claude-3-haiku', 200_000],
  ['gemini-1.5-pro', 1_000_000],
  ['gemini-1.5-flash', 1_000_000],
  ['local', 32_000],
]

function normalizeModelId(model: string | undefined): string {
  const normalized = String(model ?? '').trim().toLowerCase()
  if (!normalized) return ''
  const modelSegments = normalized.split('/')
  const providerScopedModel = modelSegments[modelSegments.length - 1]?.trim()
  return providerScopedModel || normalized
}

function formatContextBudgetK(totalTokens: number): number {
  const raw = totalTokens / 1000
  return Number(raw.toFixed(raw >= 100 ? 0 : 1))
}

function resolveContextWindowTokens(settings: {
  defaultModel: string
  primaryProvider: string
  llmProviders: Array<{ id: string; defaultModel: string }>
  backendConfig: { config: null | { agent?: { max_tokens_per_request?: number } } }
}): number {
  const primaryProviderModel = settings.llmProviders.find(
    (provider) => provider.id === settings.primaryProvider,
  )?.defaultModel
  const configuredModel = primaryProviderModel || settings.defaultModel
  const normalizedModel = normalizeModelId(configuredModel)

  for (const [prefix, contextWindow] of MODEL_CONTEXT_WINDOWS) {
    if (normalizedModel === prefix || normalizedModel.startsWith(`${prefix}-`)) {
      return contextWindow
    }
  }

  const configuredLimit = settings.backendConfig.config?.agent?.max_tokens_per_request
  return typeof configuredLimit === 'number' && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_CONTEXT_WINDOW_TOKENS
}

function makeDebounce<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let timer: ReturnType<typeof setTimeout>
  const call = (...args: Parameters<T>) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
  const cancel = () => clearTimeout(timer)
  return { call, cancel }
}

export function ChatArea({
  onContextUsageChange,
  connectionState = 'connected',
  isTemplatePanelOpen = false,
  onTemplatePanelOpenChange,
  onToggleKnowledgePanel,
}: ChatAreaProps) {
  const composerInputRef = useRef<HTMLTextAreaElement | null>(null)
  const templatePanelRestoreFocusRef = useRef<HTMLElement | null>(null)
  const currentConversationId = useCurrentConversationId()
  // Draft lifecycle: restore on conversationId change, persist on keystroke (debounced 350ms), clear on successful send
  const { persistedText, persist, clearDraft } = useDraftCache(currentConversationId)
  const [input, setInput] = useState(persistedText)
  const debouncedPersist = useMemo(() => makeDebounce(persist, 350), [persist])
  const handleInputChange = useCallback((v: string) => {
    setInput(v)
    debouncedPersist.call(v)
  }, [debouncedPersist])
  useEffect(() => { setInput(persistedText) }, [currentConversationId])
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
  const { t, translate } = useI18n()
  const writerWorkspaceSummary = useWriterWorkspaceSummary()
  const writerContextTitle = translate('writerContextTitle')
  const writerContextHint = translate('writerContextHint')
  const voiceInputStatusLabel = translate('voiceInputStatusLabel')
  const currentWritingTarget = writerWorkspaceSummary.chapterLabel
    ?? writerWorkspaceSummary.projectLabel
    ?? translate('currentDocumentFallback')
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
  const messages = useMessages()
  const workflowLevel = useWorkflowLevel()
  const selectedSkills = useSelectedSkills()
  const availableSkills = useAvailableSkills()
  const allowLlmFallback = useAllowLlmFallback()
  const qualityGoals = useQualityGoals()
  const latestAssistantContent = useLatestAssistantMessageContent()
  const { settings, toggleTemplateFavorite, recordTemplateUsage, setTemplateVariablePreset } = useChatAreaSettings()
  const promptTemplateLibrary = settings.promptTemplateLibrary

  const scrollPos = useScrollPosition(currentConversationId ?? 'default')
  const lastRetryPayloadRef = useRef<RetryPayload | null>(null)

  const lastContextUsageRef = useRef<{ usedChars: number; usedK: number; totalK: number; percent: number } | null>(null)

  const addMessage = useAddMessage()
  const createConversation = useCreateConversation()
  const toggleSkill = useAppStore((state) => state.toggleSkill)
  const setWorkflowLevel = useSettingsStore((state) => (level: 'L1' | 'L2' | 'L3' | 'L4' | 'L5') => {
    state.updateSettings({ defaultWorkflowLevel: level })
  })

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
      uploadErrorPrerequisite: t.uploadErrorPrerequisite,
      uploadErrorService: t.uploadErrorService,
      uploadMultipleProgress: t.uploadMultipleProgress,
      uploadMultipleComplete: t.uploadMultipleComplete,
    },
    translate: (key, vars) => translate(key, vars),
    currentConversationId,
    createConversation,
    getCurrentConversationId: () => useAppStore.getState().currentConversationId,
  })
  const modePresets = useMemo(() => ([
    { id: 'focusWriting' as const, label: t.modePresetFocusWriting },
    { id: 'agentDiagnose' as const, label: t.modePresetAgentDiagnose },
    { id: 'compareReview' as const, label: t.modePresetCompareReview },
  ]), [t])
  const starterActions = useMemo(() => ([
    {
      id: 'continueDraft' as const,
      label: t.chatStarterContinue,
      icon: PenLine,
      description: translate('starterContinueDesc'),
      prompt: translate('starterContinuePrompt', { target: currentWritingTarget }),
      mode: 'chat' as const,
      agentAction: 'write' as const,
      workflowLevel: 'L3' as const,
    },
    {
      id: 'rewritePassage' as const,
      label: t.chatStarterRewrite,
      icon: RefreshCw,
      description: translate('starterRewriteDesc'),
      prompt: translate('starterRewritePrompt', { target: currentWritingTarget }),
      mode: 'chat' as const,
      agentAction: 'revise' as const,
      workflowLevel: 'L3' as const,
    },
    {
      id: 'expandScene' as const,
      label: t.chatStarterExpand,
      icon: MessageSquareText,
      description: translate('starterExpandDesc'),
      prompt: translate('starterExpandPrompt', { target: currentWritingTarget }),
      mode: 'chat' as const,
      agentAction: 'write' as const,
      workflowLevel: 'L2' as const,
    },
    {
      id: 'alignCanon' as const,
      label: t.chatStarterAlignCanon,
      icon: BookOpen,
      description: translate('starterAlignCanonDesc'),
      prompt: translate('starterAlignCanonPrompt', { target: currentWritingTarget }),
      mode: 'agent' as const,
      agentAction: 'context' as const,
      workflowLevel: 'L4' as const,
    },
    {
      id: 'checkIssues' as const,
      label: t.chatStarterCheckIssues,
      icon: Lightbulb,
      description: translate('starterCheckIssuesDesc'),
      prompt: translate('starterCheckIssuesPrompt', { target: currentWritingTarget }),
      mode: 'chat' as const,
      agentAction: 'write' as const,
      workflowLevel: 'L2' as const,
    },
  ]), [currentWritingTarget, t, translate])
  const availableComparisonModels = useMemo(() => {
    const allModels = settings.llmProviders.flatMap((provider) => {
      const models = [...(provider.models ?? []), ...(provider.fetchedModels ?? []), ...(provider.customModels ?? [])]
      return models.filter((model) => Boolean(model && model.trim())).map((model) => model.trim())
    })
    return Array.from(new Set(allModels))
  }, [settings.llmProviders])
  const contextWindowTokens = useMemo(
    () => resolveContextWindowTokens(settings),
    [settings],
  )

  useEffect(() => {
    if (availableComparisonModels.length === 0) {
      setComparisonModel('')
      return
    }
    setComparisonModel((prev) => (prev && availableComparisonModels.includes(prev) ? prev : availableComparisonModels[0]))
  }, [availableComparisonModels])

  // 基础消息字符数：仅依赖 messages 变化，流式帧不触发重算
  const baseMessageChars = useMemo(
    () => messages.reduce((total, message) => total + message.content.length, 0),
    [messages],
  )

  useEffect(() => {
    if (!onContextUsageChange) return

    const usedChars = baseMessageChars + streamingContent.length
    const usedTokensApprox = Math.max(0, Math.ceil(usedChars / 4))
    const totalTokens = Math.max(contextWindowTokens, 1)
    const totalK = formatContextBudgetK(totalTokens)
    const usedK = usedTokensApprox === 0
      ? 0
      : Number(Math.max(0.1, usedTokensApprox / 1000).toFixed(1))
    const percent = Number(Math.min((usedTokensApprox / totalTokens) * 100, 999).toFixed(1))
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
  }, [contextWindowTokens, baseMessageChars, streamingContent, onContextUsageChange])

  const { buildChatRequest } = useChatRequestBuilder({
    allowLlmFallback,
    qualityGoals,
    retrieval: settings.retrieval,
    workspace: writerWorkspaceSummary.meaningfulWorkspace,
  })

  const makeRecoverError = (message: string, detail?: string): RecoverStatus => ({
    type: 'error',
    message,
    detail,
  })

  const setRecoverError = (message: string, detail?: string) => {
    setRecoverStatus(makeRecoverError(message, detail ?? message))
  }

  const resetLoadingState = () => {
    setStreamingContent('')
    setIsLoading(false)
  }

  const handleCancelStream = () => {
    cancelStream()
  }

  const handleComparisonAccept = useCallback((content: string) => {
    setInput(content)
  }, [])

  const handleOpenTemplateLibrary = useCallback(() => {
    templatePanelRestoreFocusRef.current = null
    onTemplatePanelOpenChange?.(true)
  }, [onTemplatePanelOpenChange])

  const commitAssistantResponse = (response: Awaited<ReturnType<typeof chat>>) => {
    if (!response.success || !response.data) return

    const writerMetadata = mergeWriterMetadataGovernance(
      response.data.writer_metadata,
      buildConsistencyGovernanceMetadata({
        evaluation: response.data.evaluation,
      }),
    )

    if (response.data.comparison?.enabled) {
      const comparison = response.data.comparison
      addMessage(
        'assistant',
        response.data.content || comparison.primary.content,
        response.data.skills_used || selectedSkills,
        comparison,
        writerMetadata
      )
      return
    }

    addMessage(
      'assistant',
      response.data.content || t.processingCompleted,
      response.data.skills_used || selectedSkills,
      undefined,
      writerMetadata
    )
  }

  const setSendFailureRecoverStatus = ({
    checkpointId,
    detail,
    diagnosticsText,
    source = 'chat',
  }: {
    checkpointId?: string | null
    detail: string
    diagnosticsText?: string | null
    source?: 'chat' | 'evaluation' | 'retrieval'
  }) => {
    if (!checkpointId) return
    const failure = buildFailurePresentation({
      t,
      source,
      error: detail,
      diagnostics: diagnosticsText,
      fallbackMessage: t.streamRestoreHint,
    })
    setRecoverError(`${failure.label}：${failure.message}`, failure.detail ?? detail)
  }

  const finalizeInlineSuccess = (content: string) => {
    setStreamingContent(content)
    addMessage('assistant', content, selectedSkills)
    setStreamPhase('done')
    resetInlineState()
  }

  const finalizeInlineFailure = () => {
    setStreamPhase('error')
    setRecoverError(t.inlineActionFailed)
  }

  const buildWriteQualityGoals = () => ({
    naturalness: qualityGoals.naturalness,
    readability: qualityGoals.readability,
    coherence: qualityGoals.coherence,
    style_consistency: qualityGoals.styleConsistency,
  })

  const buildReviseQualityGoals = () => ({
    naturalness: qualityGoals.naturalness,
    readability: qualityGoals.readability,
    coherence: qualityGoals.coherence,
    style_consistency: qualityGoals.styleConsistency,
    humanization_preset: qualityGoals.humanizationPreset,
    custom_humanization_instruction: qualityGoals.customHumanizationInstruction,
    sentence_entropy_target: qualityGoals.sentenceEntropyTarget,
    rhythm_variability_target: qualityGoals.rhythmVariabilityTarget,
  })

  const runNormalChat = async (request: ChatRequest, checkpointId?: string | null): Promise<StreamPhase> => {
    const commitNormalChatSuccess = (response: Awaited<ReturnType<typeof chat>>) => {
      commitAssistantResponse(response)
      setRecoverableCheckpointId(null)
      setRecoverStatus(null)
    }

    if (request.comparison?.enabled) {
      setStreamPhase('streaming')
      const response = await chat(request)
      if (response.success && response.data) {
        commitNormalChatSuccess(response)
        setStreamPhase('done')
        return 'done'
      }
      const errorMessage = response.error || t.serviceUnavailableRetry
      addMessage('assistant', errorMessage)
      setSendFailureRecoverStatus({
        checkpointId,
        detail: errorMessage,
        source: 'chat',
      })
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
        setRecoverStatus({ type: 'info', message: `${t.streamGateSoftGo} ${t.streamGovernanceReviewReady}` })
      }
      if (payload.decision === 'no_go') {
        setRecoverStatus({ type: 'error', message: `${t.streamGateNoGo} ${t.streamGovernanceReviewReady}` })
      }
      streamMeta = {
        terminal: normalizeTerminal(payload),
        decision: payload.decision,
        diagnostics: payload.diagnostics,
      }
      if (streamMeta.terminal === 'recovered') {
        setRecoverStatus({ type: 'success', message: `${t.streamRecovered} ${t.streamGovernanceRecovered}` })
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
        setRecoverStatus((prev) => {
          if (
            prev?.type === 'success'
            && prev.message === `${t.streamRecovered} ${t.streamGovernanceRecovered}`
            && status.type === 'success'
            && status.message === t.streamRecovered
          ) {
            return prev
          }
          return status
        })
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
      setRecoverStatus((prev) => prev ?? makeRecoverError(t.streamInterrupted, t.streamInterrupted))
      return 'interrupted'
    }
    const response = await chat(request)
    if (response.success && response.data) {
      commitNormalChatSuccess(response)
      return phase
    }

    const diagnosticsText = meta?.diagnostics?.fallback_reason || meta?.diagnostics?.failure_reason
    const detail = response.error || diagnosticsText || t.serviceUnavailableRetry
    addMessage('assistant', response.error || t.serviceUnavailableRetry)
    setSendFailureRecoverStatus({ checkpointId, detail, diagnosticsText })
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
          setRecoverError(t.inlineNeedSelection)
          return
        }
        const reviseResult = await agentRevise(selectedText, {
          instruction: promptText || t.inlineReviseDefaultInstruction,
          workflow_level: workflowLevel,
          skills: selectedSkills,
        }, buildReviseQualityGoals())
        if (reviseResult.success && reviseResult.data?.content) {
          finalizeInlineSuccess(reviseResult.data.content)
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
          buildReviseQualityGoals(),
          writerWorkspaceSummary.meaningfulWorkspace,
        )

        if (writeResult.success && writeResult.data?.content) {
          finalizeInlineSuccess(writeResult.data.content)
          return
        }
      }

      finalizeInlineFailure()
    } catch {
      finalizeInlineFailure()
    } finally {
      resetLoadingState()
    }
  }


  const handleRestoreToCheckpoint = async () => {
    if (!recoverableCheckpointId || isLoading) return
    await restoreToCheckpoint()
  }

  const runAgentAction = async ({
    payloadForSend,
    userMessage,
    contextTypes,
  }: {
    payloadForSend: RetryPayload
    userMessage: string
    contextTypes: string[]
  }): Promise<boolean> => {
    let handled = false

    const commitAgentActionSuccess = (content: string, writerMetadata?: WriterMetadata) => {
      addMessage('assistant', content, payloadForSend.selectedSkills, undefined, writerMetadata)
      setRecoverableCheckpointId(null)
      handled = true
    }

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
          buildWriteQualityGoals(),
          writerWorkspaceSummary.meaningfulWorkspace,
        )
        if (writeResult.success && writeResult.data?.content) {
          commitAgentActionSuccess(writeResult.data.content, writeResult.data.writer_metadata)
        }
      }
    } else if (payloadForSend.agentAction === 'revise') {
      const lastAssistantMessage = [...messages].reverse().find((message) => message.role === 'assistant')
      const reviseResult = await agentRevise(
        lastAssistantMessage?.content || userMessage,
        {
          instruction: userMessage,
          workflow_level: payloadForSend.workflowLevel,
          skills: payloadForSend.selectedSkills,
        },
        buildReviseQualityGoals()
      )
      if (reviseResult.success && reviseResult.data?.content) {
        commitAgentActionSuccess(reviseResult.data.content)
      }
    } else if (payloadForSend.agentAction === 'context') {
      const contextResult = await agentGetContext(
        {
          task: userMessage,
          workflow_level: payloadForSend.workflowLevel,
        },
        contextTypes
      )
      if (contextResult.success && contextResult.data) {
        commitAgentActionSuccess(`${t.chatAgentContextPrefix}\n\n${JSON.stringify(contextResult.data, null, 2)}`)
      }
    }

    return handled
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
    debouncedPersist.cancel()
    clearDraft()
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

      let shouldRunNormalChat = true
      if (payloadForSend.chatMode === 'agent') {
        const handled = await runAgentAction({
          payloadForSend,
          userMessage,
          contextTypes,
        })
        shouldRunNormalChat = !handled
      }

      if (shouldRunNormalChat) {
        await runNormalChat(request, checkpointId)
      }
    } catch {
      setStreamPhase('error')
      addMessage('assistant', t.backendConnectionFailed)
      setSendFailureRecoverStatus({
        checkpointId,
        detail: t.backendConnectionFailed,
        source: 'chat',
      })
    } finally {
      resetLoadingState()
    }
  }

  const applyRetryPayloadState = (payload: RetryPayload) => {
    setChatMode(payload.chatMode)
    setAgentAction(payload.agentAction)
    setWorkflowLevel(payload.workflowLevel)
    setEnableModelComparison(payload.enableModelComparison)
    setComparisonModel(payload.comparisonModel)
  }

  const handleRetryLastSend = async () => {
    const payload = lastRetryPayloadRef.current
    if (!payload || isLoading) return

    applyRetryPayloadState(payload)

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

  const applyModePreset = ({
    nextChatMode,
    nextEnableModelComparison,
    nextAgentAction,
    nextWorkflowLevel,
  }: {
    nextChatMode: 'chat' | 'agent'
    nextEnableModelComparison: boolean
    nextAgentAction: 'write' | 'revise' | 'context'
    nextWorkflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
  }) => {
    setChatMode(nextChatMode)
    setEnableModelComparison(nextEnableModelComparison)
    setAgentAction(nextAgentAction)
    setWorkflowLevel(nextWorkflowLevel)
  }

  const handleApplyModePreset = (presetId: 'focusWriting' | 'agentDiagnose' | 'compareReview') => {
    if (presetId === 'focusWriting') {
      applyModePreset({
        nextChatMode: 'chat',
        nextEnableModelComparison: false,
        nextAgentAction: 'write',
        nextWorkflowLevel: 'L3',
      })
      return
    }

    if (presetId === 'agentDiagnose') {
      applyModePreset({
        nextChatMode: 'agent',
        nextEnableModelComparison: false,
        nextAgentAction: 'context',
        nextWorkflowLevel: 'L4',
      })
      return
    }

    applyModePreset({
      nextChatMode: 'chat',
      nextEnableModelComparison: true,
      nextAgentAction: 'write',
      nextWorkflowLevel: 'L2',
    })
  }

  const handleStarterAction = (action: StarterAction) => {
    applyModePreset({
      nextChatMode: action.mode,
      nextEnableModelComparison: false,
      nextAgentAction: action.agentAction,
      nextWorkflowLevel: action.workflowLevel,
    })
    setInput(action.prompt)
    composerInputRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const isEnter = e.key === 'Enter' && !e.shiftKey
    if (!isEnter) return

    const shortcut = settings.sendShortcut
    const requireModifier = shortcut === 'ctrlEnter'
    const hasModifier = e.ctrlKey || e.metaKey

    if (requireModifier !== hasModifier) {
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
    templatePanelRestoreFocusRef.current = composerInputRef.current
    onTemplatePanelOpenChange?.(false)
  }

  const streamStatusText = (() => {
    if (streamPhase === 'interrupted') {
      return t.streamInterrupted
    }

    if (streamPhase === 'recovered') {
      return t.streamRecovered
    }

    if (connectionState === 'reconnecting' && streamPhase === 'streaming') {
      return t.streamReconnecting
    }

    return t.thinking
  })()

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-slate-50 dark:bg-dark-bg relative z-0">
      <ChatMessageList
        isLoading={isLoading}
        streamingContent={streamingContent}
        streamStatusText={streamStatusText}
        starterActions={starterActions}
        modePresets={modePresets}
        scrollPos={scrollPos}
        onStarterAction={handleStarterAction}
        onApplyModePreset={handleApplyModePreset}
        onOpenTemplateLibrary={handleOpenTemplateLibrary}
        onOpenFilePicker={openPicker}
        onAssistantSelection={handleAssistantSelection}
        onComparisonAccept={handleComparisonAccept}
        startWritingTitle={t.startWriting}
        startWritingDesc={t.startWritingDesc}
        chatStarterHint={t.chatStarterHint}
        templateLibraryEntry={t.templateLibraryEntry}
        composerUpload={t.composerUpload}
      />

        <ChatAreaStreamStatus
          recoverStatus={recoverStatus}
          recoverableCheckpointId={recoverableCheckpointId}
          restoreBeforeSendLabel={t.streamRestoreToBeforeSend}
          retryLastSendLabel={t.streamRetryLastSend}
          copyErrorLabel={t.streamCopyError}
          errorCategoryLabel={t.streamErrorCategory}
          onRestoreToCheckpoint={handleRestoreToCheckpoint}
          onRetryLastSend={handleRetryLastSend}
          onCopyRecoverError={handleCopyRecoverError}
          onDismissStatus={() => { setStreamPhase('idle'); setRecoverStatus(null) }}
          uploadStatus={uploadStatus}
        />

      <div className="border-t border-gray-200 dark:border-dark-border bg-slate-50 dark:bg-dark-bg shrink-0 flex flex-col max-h-[65%]">
        <div className="flex-1 min-h-0 overflow-y-auto px-4 md:px-6 pt-3 md:pt-4 custom-scrollbar">
          <QuickRollback
            isLoading={isLoading}
            quickRollbackAdvancedToggle={t.quickRollbackAdvancedToggle}
            quickRollbackSummary={translate('quickRollbackSummary')}
            quickRollbackTitle={t.quickRollbackTitle}
            quickRollbackPlanIdPlaceholder={t.quickRollbackPlanIdPlaceholder}
            quickRollbackCheckpointIdPlaceholder={t.quickRollbackCheckpointIdPlaceholder}
            quickRollbackReasonPlaceholder={t.quickRollbackReasonPlaceholder}
            quickRollbackAction={t.quickRollbackAction}
            quickRollbackMissingRequired={t.quickRollbackMissingRequired}
            quickRollbackFailed={t.quickRollbackFailed}
            quickRollbackSuccess={t.quickRollbackSuccess}
            autoExpand={streamPhase === 'error' || streamPhase === 'interrupted'}
          />
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

          <ChatContextBar
            writerContextTitle={writerContextTitle}
            writerContextHint={writerContextHint}
          />

          <ChatAreaModeControls
            modeLabel={t.chatModeLabel}
            modePresetsLabel={t.modePresetsLabel}
            selectedSkillsLabel={selectedSkills.length > 0 ? translate('selectedSkills', { count: selectedSkills.length }) : undefined}
            availableSkillIds={availableSkills}
            selectedSkillIds={selectedSkills}
            skillPacksLabel={t.skillPacks}
            chatMode={chatMode}
            agentAction={agentAction}
            enableModelComparison={enableModelComparison}
            chatModeNormalLabel={t.chatModeNormal}
            chatModeAgentLabel={t.chatModeAgent}
            chatModeComparisonLabel={t.chatModeComparison}
            templateLibraryEntryLabel={t.templateLibraryEntry}
            chatAgentActionWriteLabel={t.chatAgentActionWrite}
            chatAgentActionReviseLabel={t.chatAgentActionRevise}
            chatAgentActionContextLabel={t.chatAgentActionContext}
            modePresets={modePresets}
            onOpenTemplateLibrary={handleOpenTemplateLibrary}
            onSetComparisonModel={setComparisonModel}
            onSetAgentAction={setAgentAction}
            onApplyPreset={handleApplyModePreset}
            onToggleSkill={toggleSkill}
          />
        </div>

        <div className="shrink-0 px-4 md:px-6 pb-4 md:pb-6">
          <ChatAreaComposer
            input={input}
            isLoading={isLoading}
            sendDisabled={!input.trim()}
            inputPlaceholder={t.inputPlaceholder}
            uploadLabel={t.composerUpload}
            voiceInputLabel={t.composerVoiceInput}
            voiceInputStatusLabel={voiceInputStatusLabel}
            sendLabel={t.composerSend}
            cancelLabel={t.cancel}
            sendShortcutLabel={t.sendShortcutLabel}
            sendShortcutHint={settings.sendShortcut === 'ctrlEnter' ? t.sendShortcutCtrlEnter : t.sendShortcutEnter}
            fileInputRef={fileInputRef}
            inputRef={composerInputRef}
            onInputChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFileUpload={handleFileUpload}
            onOpenFilePicker={openPicker}
            onCancelStream={handleCancelStream}
            onSend={handleSend}
            onToggleKnowledgePanel={onToggleKnowledgePanel}
            onClearDraft={clearDraft}
            lastAssistantContent={latestAssistantContent}
          />
        </div>
      </div>
      {isTemplatePanelOpen && promptTemplateLibrary && (
        <PromptTemplatePanel
          templates={promptTemplateLibrary.templates}
          variablePresets={promptTemplateLibrary.variablePresets}
          onToggleFavorite={toggleTemplateFavorite}
          onApplyTemplate={handleApplyTemplate}
          restoreFocusRef={templatePanelRestoreFocusRef}
          onClose={() => onTemplatePanelOpenChange?.(false)}
        />
      )}
    </div>
  )
}