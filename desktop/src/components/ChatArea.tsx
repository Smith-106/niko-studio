import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Mic } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useMessages, useCurrentConversationId, useWorkflowLevel, useSelectedSkills, useAllowLlmFallback } from '../stores/selectors'
import { chat, chatStream } from '../api/client'
import { MessageBubble } from './MessageBubble'
import { useI18n } from '../i18n'

export function ChatArea() {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { t, translate } = useI18n()

  // Use selective selectors for better performance
  const currentConversationId = useCurrentConversationId()
  const messages = useMessages()
  const workflowLevel = useWorkflowLevel()
  const selectedSkills = useSelectedSkills()
  const allowLlmFallback = useAllowLlmFallback()

  // Get actions directly from store (these don't cause re-renders)
  const { addMessage, setWorkflowLevel, createConversation } = useAppStore()

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    // Create conversation if none exists
    if (!currentConversationId) {
      createConversation()
    }

    const userMessage = input.trim()
    setInput('')
    addMessage('user', userMessage)
    setIsLoading(true)

    try {
      const request = {
        messages: [{ role: 'user' as const, content: userMessage }],
        workflowLevel,
        skills: selectedSkills,
        allowLlmFallback,
      }

      let streamFailed = false
      let hasStreamContent = false
      let streamText = ''

      await chatStream(request, {
        onContent: (chunk) => {
          hasStreamContent = true
          streamText += chunk
          setStreamingContent(streamText)
        },
        onError: () => {
          streamFailed = true
        },
      })

      if (!streamFailed && hasStreamContent) {
        addMessage('assistant', streamText || '处理完成', selectedSkills)
      } else {
        const response = await chat(request)
        if (response.success && response.data) {
          addMessage('assistant', response.data.content || '处理完成', response.data.skills_used || selectedSkills)
        } else {
          addMessage('assistant', response.error || '抱歉，服务暂时不可用，请稍后重试。')
        }
      }
    } catch {
      addMessage('assistant', '无法连接到后端服务，请确保服务已启动。')
    } finally {
      setStreamingContent('')
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-dark-surface">
      {/* Messages Area */}
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
            <MessageBubble key={message.id} message={message} />
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
            <div className="animate-pulse">{t.thinking}</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-gray-200 dark:border-dark-border p-4 bg-gray-50 dark:bg-dark-bg">
        {/* Workflow Level Selector */}
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

        {/* Input Box */}
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
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors">
                <Paperclip size={18} />
              </button>
              <button className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors">
                <Mic size={18} />
              </button>
            </div>
          </div>
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}
