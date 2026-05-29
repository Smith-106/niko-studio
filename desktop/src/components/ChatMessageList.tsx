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
  startWritingDesc: _startWritingDesc,
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
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-dark-text-muted mt-6 px-4">
          <div className="w-14 h-14 rounded-2xl bg-primary-50 dark:bg-primary-900/10 flex items-center justify-center mb-5 shadow-sm border border-primary-100 dark:border-primary-500/20 animate-fade-in">
            <span className="text-2xl">✨</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-dark-text mb-2">{startWritingTitle}</h2>
          <p className="text-sm text-gray-500 dark:text-dark-text-secondary max-w-md text-center leading-relaxed mb-6">
            {chatStarterHint}
          </p>
          {writerWorkspaceSummary.hasMeaningfulScope && (
            <div className="mb-5 flex flex-wrap items-center justify-center gap-1.5 max-w-2xl">
              {writerWorkspaceSummary.scopeChips.map((chip) => (
                <span
                  key={`empty-scope-${chip}`}
                  className="rounded-full border border-primary-100 bg-white px-2.5 py-0.5 text-[11px] text-gray-600 shadow-sm dark:border-primary-500/20 dark:bg-dark-surface dark:text-dark-text-secondary"
                >
                  {chip}
                </span>
              ))}
            </div>
          )}
          <div className="w-full max-w-lg space-y-2.5">
            {starterActions.map((action) => {
              const Icon = action.icon
              return (
                <button
                  key={`starter-${action.id}`}
                  type="button"
                  onClick={() => onStarterAction(action)}
                  className="group flex items-center gap-3 w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-left shadow-sm transition-all hover:border-primary-200 hover:shadow-md dark:border-dark-border dark:bg-dark-surface dark:hover:border-primary-500/30"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/40 transition-colors">
                    <Icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-gray-800 dark:text-dark-text">{action.label}</span>
                    <span className="block text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">{action.description}</span>
                  </span>
                </button>
              )
            })}
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {modePresets.map((preset) => (
              <button
                key={`empty-${preset.id}`}
                type="button"
                onClick={() => onApplyModePreset(preset.id)}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 border border-primary-100 dark:border-primary-500/20 transition-all active:scale-[0.98]"
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={onOpenTemplateLibrary}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border transition-all active:scale-[0.98]"
            >
              {templateLibraryEntry}
            </button>
            <button
              type="button"
              onClick={onOpenFilePicker}
              className="px-3 py-1.5 text-xs font-medium rounded-full bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text-secondary hover:bg-gray-50 dark:hover:bg-dark-surface2 border border-gray-200 dark:border-dark-border transition-all active:scale-[0.98]"
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