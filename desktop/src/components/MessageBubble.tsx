import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import type { Message } from '../stores/appStore'
import { useI18n } from '../i18n'

interface MessageBubbleProps {
  message: Message
  onAssistantSelection?: (payload: { messageId: string; selectedText: string }) => void
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: MessageBubbleProps, nextProps: MessageBubbleProps): boolean {
  const prevMsg = prevProps.message
  const nextMsg = nextProps.message

  if (prevMsg.id !== nextMsg.id) return false
  if (prevMsg.content !== nextMsg.content) return false

  const prevSkills = prevMsg.skills || []
  const nextSkills = nextMsg.skills || []
  if (prevSkills.length !== nextSkills.length) return false
  for (let i = 0; i < prevSkills.length; i++) {
    if (prevSkills[i] !== nextSkills[i]) return false
  }

  const prevComparison = prevMsg.comparison
  const nextComparison = nextMsg.comparison
  if (Boolean(prevComparison) !== Boolean(nextComparison)) return false
  if (prevComparison && nextComparison) {
    if (prevComparison.enabled !== nextComparison.enabled) return false
    if (prevComparison.primary.model !== nextComparison.primary.model) return false
    if (prevComparison.primary.content !== nextComparison.primary.content) return false
    if (prevComparison.control.model !== nextComparison.control.model) return false
    if (prevComparison.control.content !== nextComparison.control.content) return false
  }

  const prevKnowledge = prevMsg.writerMetadata?.knowledge_retrieved
  const nextKnowledge = nextMsg.writerMetadata?.knowledge_retrieved
  if (Boolean(prevKnowledge) !== Boolean(nextKnowledge)) return false
  if (prevKnowledge && nextKnowledge) {
    if (prevKnowledge.entities_count !== nextKnowledge.entities_count) return false
    if (prevKnowledge.relations_count !== nextKnowledge.relations_count) return false
    if (prevKnowledge.memories_count !== nextKnowledge.memories_count) return false
  }

  return true
}

function MessageBubbleComponent({ message, onAssistantSelection }: MessageBubbleProps) {
  const { t } = useI18n()
  const isUser = message.role === 'user'

  const handleMouseUp = () => {
    if (isUser || !onAssistantSelection) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!text) return
    onAssistantSelection({ messageId: message.id, selectedText: text })
  }

  const markdownComponents: Components = {
    code({ className, children }) {
      const codeText = String(children).replace(/\n$/, '')
      return (
        <pre className="rounded-md overflow-x-auto bg-[#1f2937] text-[#f9fafb] p-3 text-sm">
          <code className={className}>{codeText}</code>
        </pre>
      )
    },
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-blue-600 text-white'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {/* Skills Badge */}
        {message.skills && message.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.skills.map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 bg-blue-500/20 text-blue-600 text-xs rounded-full"
              >
                📦 {skill}
              </span>
            ))}
          </div>
        )}

        {/* Retrieval Status */}
        {!isUser && message.writerMetadata?.knowledge_retrieved && (
          <div className="mb-2 text-xs text-gray-500 dark:text-dark-text-secondary">
            {t.messageBubbleRetrievalStatus
              .replace('{entities}', String(message.writerMetadata.knowledge_retrieved.entities_count))
              .replace('{relations}', String(message.writerMetadata.knowledge_retrieved.relations_count))
              .replace('{memories}', String(message.writerMetadata.knowledge_retrieved.memories_count))}
          </div>
        )}

        {/* Content */}
        {message.comparison?.enabled ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" onMouseUp={handleMouseUp}>
            <div className="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3">
              <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-dark-text-secondary">
                {`${t.messageBubblePrimaryModelLabel}${message.comparison.primary.model}`}
              </div>
              <div className="markdown-body">
                <ReactMarkdown components={markdownComponents}>
                  {message.comparison.primary.content}
                </ReactMarkdown>
              </div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3">
              <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-dark-text-secondary">
                {`${t.messageBubbleControlModelLabel}${message.comparison.control.model}`}
              </div>
              <div className="markdown-body">
                <ReactMarkdown components={markdownComponents}>
                  {message.comparison.control.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="markdown-body" onMouseUp={handleMouseUp}>
            <ReactMarkdown
              components={markdownComponents}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-blue-200' : 'text-gray-400'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

// Export memoized component to prevent unnecessary re-renders
export const MessageBubble = React.memo(MessageBubbleComponent, arePropsEqual)
