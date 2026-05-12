import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { BookOpen, ChevronDown, ChevronRight, Lightbulb, MessageSquareText, PenLine, RefreshCw } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useCreateConversation, useAddMessage, useMessages, useCurrentConversationId, useWorkflowLevel, useSelectedSkills, useAvailableSkills, useAllowLlmFallback, useQualityGoals, useLatestAssistantMessageContent } from '../stores/selectors'
import { chat, agentRoute, agentWrite, agentRevise, agentGetContext, quickRollbackWorkflow, buildConsistencyGovernanceMetadata, mergeWriterMetadataGovernance } from '../api/client'
import type { ChatRequest, StreamDonePayload, WriterMetadata } from '../api/client'
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
  const [quickRollbackPlanId, setQuickRollbackPlanId] = useState('')
  const [quickRollbackCheckpointId, setQuickRollbackCheckpointId] = useState('')
  const [quickRollbackReason, setQuickRollbackReason] = useState('')
  const [showQuickRollbackAdvanced, setShowQuickRollbackAdvanced] = useState(false)
  const [quickRollbackStatus, setQuickRollbackStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)
  const { t, translate } = useI18n()
  const writerWorkspaceSummary = useWriterWorkspaceSummary()
  const writerContextTitle = translate('writerContextTitle')
  const writerContextHint = translate('writerContextHint')
  const voiceInputStatusLabel = translate('voiceInputStatusLabel')
  const quickRollbackSummary = translate('quickRollbackSummary')
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
  const { settings } = useSettingsStore()
  const promptTemplateLibrary = settings.promptTemplateLibrary
  const {
    toggleTemplateFavorite,
    recordTemplateUsage,
    setTemplateVariablePreset,
  } = useSettingsStore()

  const scrollPos = useScrollPosition(currentConversationId ?? 'default')
  const lastRetryPayloadRef = useRef<RetryPayload | null>(null)

  // Virtual scrolling for long conversations
  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => scrollPos.containerRef.current,
    estimateSize: (index) => {
      const msg = messages[index]
      if (!msg) return 80
      return Math.max(80, Math.min(600, msg.content.length * 0.4 + 60))
    },
    overscan: 5,
  })

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

  useEffect(() => {
    if (!onContextUsageChange) return

    const messageChars = messages.reduce((total, message) => total + message.content.length, 0)
    const usedChars = messageChars + streamingContent.length
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
  }, [contextWindowTokens, messages, streamingContent, onContextUsageChange])

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



  // Auto-scroll to bottom when near bottom and new content arrives
  useEffect(() => {
    if (!scrollPos.isNearBottom) return
    scrollPos.scrollToBottom()
  }, [messages, streamingContent, scrollPos])

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

  const handleQuickRollback = async () => {
    const planId = quickRollbackPlanId.trim()
    const checkpointId = quickRollbackCheckpointId.trim()

    if (!planId || !checkpointId || isLoading) {
      setQuickRollbackStatus({ type: 'error', message: t.quickRollbackMissingRequired })
      return
    }

    const setQuickRollbackFailed = (message?: string) => {
      setQuickRollbackStatus({ type: 'error', message: message || t.quickRollbackFailed })
    }

    try {
      const response = await quickRollbackWorkflow(planId, checkpointId, quickRollbackReason.trim() || undefined)
      if (response.success) {
        setQuickRollbackStatus({ type: 'success', message: t.quickRollbackSuccess })
      } else {
        setQuickRollbackFailed(response.error)
      }
    } catch {
      setQuickRollbackFailed()
    }
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

  const handleStarterAction = (action: (typeof starterActions)[number]) => {
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
      <div ref={scrollPos.containerRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth" onScroll={scrollPos.handleScroll}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-dark-text-muted mt-10">
            <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/10 flex items-center justify-center mb-6 shadow-sm border border-primary-100 dark:border-primary-500/20 animate-fade-in">
              <span className="text-3xl">✨</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-dark-text mb-3 tracking-wide">{t.startWriting}</h2>
            <p className="text-sm text-gray-500 dark:text-dark-text-secondary max-w-md text-center leading-relaxed mb-8">
              {t.startWritingDesc}
            </p>
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary max-w-2xl text-center leading-relaxed mb-5">
              {t.chatStarterHint}
            </p>
            {writerWorkspaceSummary.hasMeaningfulScope && (
              <div className="mb-6 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
                {writerWorkspaceSummary.scopeChips.map((chip) => (
                  <span
                    key={`empty-scope-${chip}`}
                    className="rounded-full border border-primary-100 bg-white px-3 py-1 text-xs text-gray-600 shadow-sm dark:border-primary-500/20 dark:bg-dark-surface dark:text-dark-text-secondary"
                  >
                    {chip}
                  </span>
                ))}
              </div>
            )}
            <div className="grid w-full max-w-3xl grid-cols-1 gap-3">
              {starterActions.map((action) => {
                const Icon = action.icon
                return (
                  <button
                    key={`starter-${action.id}`}
                    type="button"
                    onClick={() => handleStarterAction(action)}
                    className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md dark:border-dark-border dark:bg-dark-surface dark:hover:border-primary-500/30"
                  >
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300">
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-gray-800 dark:text-dark-text">
                        {action.label}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                        {action.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 max-w-2xl">
              {modePresets.map((preset) => (
                <button
                  key={`empty-${preset.id}`}
                  type="button"
                  onClick={() => handleApplyModePreset(preset.id)}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-100 dark:border-primary-500/20 transition-all active:scale-[0.98]"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={handleOpenTemplateLibrary}
                className="px-4 py-2 text-sm font-medium rounded-full bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border shadow-sm transition-all active:scale-[0.98]"
              >
                {t.templateLibraryEntry}
              </button>
              <button
                type="button"
                onClick={() => openPicker()}
                className="px-4 py-2 text-sm font-medium rounded-full bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border shadow-sm transition-all active:scale-[0.98]"
              >
                {t.composerUpload}
              </button>
            </div>
          </div>
        ) : messages.length > 50 ? (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              width: '100%',
              position: 'relative',
            }}
          >
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const message = messages[virtualRow.index]
              if (!message) return null
              return (
                <div
                  key={message.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className="pb-6"
                >
                  <MessageBubble
                    message={message}
                    onAssistantSelection={handleAssistantSelection}
                    onComparisonAccept={handleComparisonAccept}
                  />
                </div>
              )
            })}
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className="pb-6">
              <MessageBubble
                message={message}
                onAssistantSelection={handleAssistantSelection}
                onComparisonAccept={handleComparisonAccept}
              />
            </div>
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
            <div className="animate-pulse">{streamStatusText}</div>
          </div>
        )}
      </div>

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
          <div className="mb-3">
            <button
              type="button"
              onClick={() => setShowQuickRollbackAdvanced((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-medium text-gray-400 dark:text-dark-text-muted hover:text-gray-600 dark:hover:text-dark-text-secondary transition-colors py-1"
            >
              <span>{t.quickRollbackAdvancedToggle}</span>
              {showQuickRollbackAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
            {showQuickRollbackAdvanced && (
              <div className="animate-fade-in mt-2 mb-1">
                <p className="text-[11px] leading-relaxed text-gray-400 dark:text-dark-text-muted mb-3">
                  {quickRollbackSummary}
                </p>
                <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-dark-text-muted mb-2">{t.quickRollbackTitle}</div>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    value={quickRollbackPlanId}
                    onChange={(event) => setQuickRollbackPlanId(event.target.value)}
                    placeholder={t.quickRollbackPlanIdPlaceholder}
                    aria-label={t.quickRollbackPlanIdPlaceholder}
                    className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-800 dark:text-dark-text rounded-md focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                  />
                  <input
                    value={quickRollbackCheckpointId}
                    onChange={(event) => setQuickRollbackCheckpointId(event.target.value)}
                    placeholder={t.quickRollbackCheckpointIdPlaceholder}
                    aria-label={t.quickRollbackCheckpointIdPlaceholder}
                    className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-800 dark:text-dark-text rounded-md focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                  />
                  <input
                    value={quickRollbackReason}
                    onChange={(event) => setQuickRollbackReason(event.target.value)}
                    placeholder={t.quickRollbackReasonPlaceholder}
                    aria-label={t.quickRollbackReasonPlaceholder}
                    className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-800 dark:text-dark-text rounded-md focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <button
                    onClick={handleQuickRollback}
                    type="button"
                    className="px-4 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-md shadow-sm hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 transition-all"
                    disabled={isLoading}
                  >
                    {t.quickRollbackAction}
                  </button>
                  {quickRollbackStatus && (
                    <span className={`text-[11px] font-medium px-2 py-1 rounded ${quickRollbackStatus.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                      {quickRollbackStatus.message}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
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

          {writerWorkspaceSummary.hasMeaningfulScope && (
            <div className="mb-4 rounded-2xl border border-primary-100 bg-white/90 p-4 shadow-sm dark:border-primary-500/20 dark:bg-dark-surface/80">
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-300">
                {writerContextTitle}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {writerWorkspaceSummary.scopeChips.map((chip) => (
                  <span
                    key={`writer-scope-${chip}`}
                    className="rounded-full bg-primary-50 px-3 py-1 text-xs font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                {writerContextHint}
              </p>
            </div>
          )}

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
