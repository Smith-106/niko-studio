import { useState, useRef, useEffect, useMemo } from 'react'
import { Send, Paperclip, Mic } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useMessages, useCurrentConversationId, useWorkflowLevel, useSelectedSkills, useAllowLlmFallback } from '../stores/selectors'
import { chat, chatStream, agentRoute, agentWrite, agentRevise, agentGetContext, createCheckpoint, restoreCheckpoint, uploadMemoryFile } from '../api/client'
import type { ChatRequest, StreamDonePayload } from '../api/client'
import { MessageBubble } from './MessageBubble'
import { PromptTemplatePanel, type ApplyTemplatePayload } from './PromptTemplatePanel'
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
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const streamRequestIdRef = useRef(0)
  const { t, translate } = useI18n()
  const previousConnectionStateRef = useRef(connectionState)

  const currentConversationId = useCurrentConversationId()
  const messages = useMessages()
  const workflowLevel = useWorkflowLevel()
  const selectedSkills = useSelectedSkills()
  const allowLlmFallback = useAllowLlmFallback()
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

    onContextUsageChange({ usedChars, usedK, totalK, percent })
  }, [messages, streamingContent, onContextUsageChange])

  useEffect(() => {
    const previous = previousConnectionStateRef.current
    const isSameState = connectionState === previous
    if (isSameState && connectionState !== 'reconnecting' && connectionState !== 'disconnected') {
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
            comparison
          )
        } else {
          addMessage('assistant', response.data.content || '处理完成', response.data.skills_used || selectedSkills)
        }
        setRecoverableCheckpointId(null)
        setRecoverStatus(null)
        setStreamPhase('done')
        return 'done'
      }
      addMessage('assistant', response.error || '抱歉，服务暂时不可用，请稍后重试。')
      if (checkpointId) {
        setRecoverStatus({ type: 'error', message: t.streamRestoreHint })
      }
      setStreamPhase('error')
      return 'error'
    }

    let streamFailed = false
    let hasStreamContent = false
    let streamText = ''
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
      addMessage('assistant', streamText || '处理完成', selectedSkills)
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
          comparison
        )
      } else {
        addMessage('assistant', response.data.content || '处理完成', response.data.skills_used || selectedSkills)
      }
      setRecoverableCheckpointId(null)
      setRecoverStatus(null)
      return finalPhase ?? 'done'
    }

    addMessage('assistant', response.error || '抱歉，服务暂时不可用，请稍后重试。')
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
          selectedSkills
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
      setUploadStatus({ type: 'error', message: '无法创建会话，请重试。' })
      return
    }

    const allowedExtensions = ['txt', 'md', 'pdf', 'docx']
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      setUploadStatus({ type: 'error', message: '仅支持 TXT/MD/PDF/DOCX 文件。' })
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
        setUploadStatus({ type: 'error', message: response.error || '文件注入失败，请重试。' })
        return
      }

      setUploadStatus({ type: 'success', message: `文件已注入上下文：${file.name}（${response.data.chunks} 段）` })
      addMessage('assistant', `已完成文件上下文注入：${file.name}（${response.data.chunks} 段）`)
    } catch {
      setUploadStatus({ type: 'error', message: '文件注入失败，请重试。' })
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

      const request: ChatRequest = {
        messages: [{ role: 'user', content: userMessage }],
        workflowLevel,
        skills: selectedSkills,
        allowLlmFallback,
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
              selectedSkills
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
            ['memory', 'graph', 'skills']
          )
          if (contextResult.success && contextResult.data) {
            addMessage('assistant', `上下文信息：\n\n${JSON.stringify(contextResult.data, null, 2)}`)
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
      addMessage('assistant', '无法连接到后端服务，请确保服务已启动。')
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

      {recoverStatus && (
        <div
          className={`px-4 py-2 text-xs ${
            recoverStatus.type === 'success'
              ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
              : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{recoverStatus.message}</span>
            {recoverableCheckpointId && recoverStatus.type === 'error' && (
              <button
                onClick={handleRestoreToCheckpoint}
                className="px-2 py-1 rounded bg-white/80 dark:bg-dark-border dark:text-dark-text"
              >
                {t.streamRestoreToBeforeSend}
              </button>
            )}
          </div>
        </div>
      )}

      {uploadStatus && (
        <div
          className={`px-4 py-2 text-xs ${
            uploadStatus.type === 'success'
              ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
              : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {uploadStatus.message}
        </div>
      )}

      <div className="border-t border-gray-200 dark:border-dark-border p-4 bg-gray-50 dark:bg-dark-bg">
        {selectionMeta && (
          <div className="mb-3 rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-2">
            <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">
              {translate('inlineSelectedTextInfo', { count: Math.min(selectedText.length, 80) })}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setInlineAction('continue')}
                className={`px-2 py-1 text-xs rounded ${inlineAction === 'continue' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'}`}
              >
                {t.inlineContinue}
              </button>
              <button
                onClick={() => setInlineAction('revise')}
                disabled={!selectedText}
                className={`px-2 py-1 text-xs rounded ${inlineAction === 'revise' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'} disabled:opacity-50`}
              >
                {t.inlineRevise}
              </button>
              <button
                onClick={() => setInlineAction('generate')}
                className={`px-2 py-1 text-xs rounded ${inlineAction === 'generate' ? 'bg-blue-600 text-white' : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'}`}
              >
                {t.inlineGenerate}
              </button>
              <button
                onClick={runInlineAction}
                disabled={!inlineAction || isLoading}
                className="px-2 py-1 text-xs rounded bg-emerald-600 text-white disabled:opacity-50"
              >
                {t.inlineRun}
              </button>
              <button
                onClick={resetInlineState}
                className="px-2 py-1 text-xs rounded bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text"
              >
                {t.inlineClearSelection}
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 dark:text-dark-text-secondary">模式：</span>
          <button
            onClick={() => setChatMode('chat')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              chatMode === 'chat'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            普通聊天
          </button>
          <button
            onClick={() => setChatMode('agent')}
            className={`px-3 py-1 text-xs rounded-full transition-colors ${
              chatMode === 'agent'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            Agent 高级
          </button>
          {chatMode === 'chat' && (
            <>
              <button
                onClick={() => setEnableModelComparison((prev) => !prev)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  enableModelComparison
                    ? 'bg-emerald-600 text-white'
                    : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                模型对比
              </button>
              <button
                onClick={() => setIsTemplatePanelOpen(true)}
                className="px-3 py-1 text-xs rounded-full transition-colors bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                {t.templateLibraryEntry}
              </button>
              {enableModelComparison && (
                <select
                  aria-label="对照模型"
                  value={comparisonModel}
                  onChange={(e) => setComparisonModel(e.target.value)}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded"
                >
                  {availableComparisonModels.map((model) => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              )}
            </>
          )}
          {chatMode === 'agent' && (
            <select
              value={agentAction}
              onChange={(e) => setAgentAction(e.target.value as 'write' | 'revise' | 'context')}
              className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded"
            >
              <option value="write">写作</option>
              <option value="revise">润色/重写</option>
              <option value="context">取上下文</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-gray-500 dark:text-dark-text-secondary">{t.workflow}:</span>
          {([
            { level: 'L1', label: t.quick },
            { level: 'L2', label: t.lite },
            { level: 'L3', label: t.standard },
            { level: 'L4', label: t.brainstorm },
            { level: 'L5', label: t.coordinator },
          ] as const).map(({ level, label }) => (
            <button
              key={level}
              onClick={() => setWorkflowLevel(level)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                workflowLevel === level
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-dark-border text-gray-600 dark:text-dark-text hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {label}
            </button>
          ))}
          {selectedSkills.length > 0 && (
            <span className="text-xs text-blue-600 dark:text-blue-400 ml-2">
              {translate('selectedSkills', { count: selectedSkills.length })}
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.inputPlaceholder}
              className="w-full px-4 py-3 pr-20 border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              style={{ minHeight: '48px', maxHeight: '200px' }}
            />
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,.docx"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
              >
                <Paperclip size={18} />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors">
                <Mic size={18} />
              </button>
            </div>
          </div>
          {isLoading ? (
            <button
              onClick={handleCancelStream}
              className="px-4 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
            >
              {t.cancel}
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Send size={20} />
            </button>
          )}
        </div>
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
