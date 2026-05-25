import React, { useEffect } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useMessages, useSelectedSkills } from '../stores/selectors'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { MessageBubble } from './MessageBubble'

/**
 * 从 ChatArea 中提取：消息列表区域（含虚拟滚动、空状态、流式气泡）
 * 原因：消息渲染是渲染开销最大的区域，独立订阅 messages/selectedSkills，
 * 避免因 composer 或 mode 状态变化触发整棵树重渲染
 */
export interface StarterAction {
  id: string
  label: string
  icon: LucideIcon
  description: string
  prompt: string
  mode: 'chat' | 'agent'
  agentAction: 'write' | 'revise' | 'context'
  workflowLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5'
}

interface ChatModePreset {
  id: 'focusWriting' | 'agentDiagnose' | 'compareReview'
  label: string
}

interface ScrollPositionResult {
  containerRef: React.RefObject<HTMLDivElement>
  handleScroll: () => void
  isNearBottom: boolean
  scrollToBottom: () => void
}

interface ChatMessageListProps {
  isLoading: boolean
  streamingContent: string
  streamStatusText: string
  starterActions: StarterAction[]
  modePresets: ChatModePreset[]
  scrollPos: ScrollPositionResult
  onStarterAction: (action: StarterAction) => void
  onApplyModePreset: (presetId: ChatModePreset['id']) => void
  onOpenTemplateLibrary: () => void
  onOpenFilePicker: () => void
  onAssistantSelection: (payload: { messageId: string; selectedText: string }) => void
  onComparisonAccept: (content: string) => void
  startWritingTitle: string
  startWritingDesc: string
  chatStarterHint: string
  templateLibraryEntry: string
  composerUpload: string
}

export const ChatMessageList = React.memo(function ChatMessageList({
  isLoading,
  streamingContent,
  streamStatusText,
  starterActions,
  modePresets,
  scrollPos,
  onStarterAction,
  onApplyModePreset,
  onOpenTemplateLibrary,
  onOpenFilePicker,
  onAssistantSelection,
  onComparisonAccept,
  startWritingTitle,
  startWritingDesc,
  chatStarterHint,
  templateLibraryEntry,
  composerUpload,
}: ChatMessageListProps) {
  const messages = useMessages()
  const selectedSkills = useSelectedSkills()
  const writerWorkspaceSummary = useWriterWorkspaceSummary()

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

  // Auto-scroll to bottom when near bottom and new content arrives
  useEffect(() => {
    if (!scrollPos.isNearBottom) return
    scrollPos.scrollToBottom()
  }, [messages, streamingContent, scrollPos])

  return (
    <div ref={scrollPos.containerRef} className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar scroll-smooth" onScroll={scrollPos.handleScroll}>
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-dark-text-muted mt-10">
          <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/10 flex items-center justify-center mb-6 shadow-sm border border-primary-100 dark:border-primary-500/20 animate-fade-in">
            <span className="text-3xl">✨</span>
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-dark-text mb-3 tracking-wide">{startWritingTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary max-w-md text-center leading-relaxed mb-8">
            {startWritingDesc}
          </p>
          <p className="text-xs text-gray-500 dark:text-dark-text-secondary max-w-2xl text-center leading-relaxed mb-5">
            {chatStarterHint}
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
                  onClick={() => onStarterAction(action)}
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
                onClick={() => onApplyModePreset(preset.id)}
                className="px-4 py-2 text-sm font-medium rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-100 dark:border-primary-500/20 transition-all active:scale-[0.98]"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenTemplateLibrary}
              className="px-4 py-2 text-sm font-medium rounded-full bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border shadow-sm transition-all active:scale-[0.98]"
            >
              {templateLibraryEntry}
            </button>
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="px-4 py-2 text-sm font-medium rounded-full bg-white dark:bg-dark-surface text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border shadow-sm transition-all active:scale-[0.98]"
            >
              {composerUpload}
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
                  onAssistantSelection={onAssistantSelection}
                  onComparisonAccept={onComparisonAccept}
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
              onAssistantSelection={onAssistantSelection}
              onComparisonAccept={onComparisonAccept}
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
  )
})