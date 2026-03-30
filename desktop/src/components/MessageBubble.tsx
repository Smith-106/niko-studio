import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import type { Message } from '../stores/appStore'
import { useI18n } from '../i18n'

interface MessageBubbleProps {
  message: Message
  onAssistantSelection?: (payload: { messageId: string; selectedText: string }) => void
  onComparisonAccept?: (content: string) => void
}

const getUniqueComparisonLines = (source: string, target: string): string[] => {
  const targetLines = new Set(
    target
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
  )

  return source
    .split('\n')
    .map((line) => line.trim())
    .filter((line, index, lines) => Boolean(line) && !targetLines.has(line) && lines.indexOf(line) === index)
}

// Custom comparison function for React.memo
function arePropsEqual(prevProps: MessageBubbleProps, nextProps: MessageBubbleProps): boolean {
  const prevMsg = prevProps.message
  const nextMsg = nextProps.message

  if (prevProps.onAssistantSelection !== nextProps.onAssistantSelection) return false
  if (prevProps.onComparisonAccept !== nextProps.onComparisonAccept) return false
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

const MAX_USER_LINES = 8

const markdownComponents: Components = {
  code({ className, children }) {
    const codeText = String(children).replace(/\n$/, '')
    return (
      <pre className="rounded-md overflow-x-auto bg-dark-bg text-dark-text p-3 text-sm my-2 border border-dark-border shadow-sm">
        <code className={className}>{codeText}</code>
      </pre>
    )
  },
}

function MessageBubbleComponent({ message, onAssistantSelection, onComparisonAccept }: MessageBubbleProps) {
  const { t } = useI18n()
  const isUser = message.role === 'user'
  const [isExpanded, setIsExpanded] = useState(false)
  const primaryDiffLines = message.comparison?.enabled
    ? getUniqueComparisonLines(message.comparison.primary.content, message.comparison.control.content)
    : []
  const controlDiffLines = message.comparison?.enabled
    ? getUniqueComparisonLines(message.comparison.control.content, message.comparison.primary.content)
    : []

  const handleMouseUp = () => {
    if (isUser || !onAssistantSelection) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!text) return
    onAssistantSelection({ messageId: message.id, selectedText: text })
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fade-in`}>
      <div
        className={`max-w-[85%] rounded-2xl px-5 py-4 shadow-sm transition-all duration-200 ${
          isUser
            ? 'bg-primary-600 text-white rounded-tr-sm'
            : 'bg-dark-surface border border-dark-border text-dark-text rounded-tl-sm'
        }`}
      >
        {/* Skills Badge */}
        {message.skills && message.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {message.skills.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 bg-primary-500/10 text-primary-400 text-[11px] uppercase tracking-wider font-medium rounded-full border border-primary-500/20"
              >
                📦 {skill}
              </span>
            ))}
          </div>
        )}

        {/* Retrieval Status */}
        {!isUser && message.writerMetadata?.knowledge_retrieved && (
          <div className="mb-3 text-xs text-dark-text-muted flex items-center gap-1.5 bg-dark-bg/50 px-3 py-1.5 rounded-md border border-dark-border/50">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-subtle"></span>
            {t.messageBubbleRetrievalStatus
              .replace('{entities}', String(message.writerMetadata.knowledge_retrieved.entities_count))
              .replace('{relations}', String(message.writerMetadata.knowledge_retrieved.relations_count))
              .replace('{memories}', String(message.writerMetadata.knowledge_retrieved.memories_count))}
          </div>
        )}

        {/* Content */}
        {message.comparison?.enabled ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2" onMouseUp={handleMouseUp}>
            <div className="rounded-xl border border-dark-border bg-dark-bg p-4 shadow-inner">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-dark-text-secondary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-primary-400"></span>
                  {`${t.messageBubblePrimaryModelLabel}${message.comparison.primary.model}`}
                </div>
                {onComparisonAccept && (
                  <button
                    type="button"
                    onClick={() => onComparisonAccept(message.comparison!.primary.content)}
                    className="rounded-full bg-primary-600/10 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-600/20 border border-primary-500/20 transition-colors"
                  >
                    {t.messageBubbleAcceptPrimary}
                  </button>
                )}
              </div>
              {primaryDiffLines.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-warning-500">{t.messageBubbleDiffHighlightsLabel}</span>
                  {primaryDiffLines.map((line) => (
                    <span
                      key={line}
                      className="rounded-full bg-warning-500/10 text-warning-500 px-2.5 py-0.5 border border-warning-500/20"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}
              <div className="markdown-body prose prose-invert max-w-none text-sm leading-relaxed text-dark-text font-serif">
                <ReactMarkdown components={markdownComponents}>
                  {message.comparison.primary.content}
                </ReactMarkdown>
              </div>
            </div>
            <div className="rounded-xl border border-dark-border bg-dark-bg p-4 shadow-inner">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="text-xs font-semibold text-dark-text-secondary flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-dark-border2"></span>
                  {`${t.messageBubbleControlModelLabel}${message.comparison.control.model}`}
                </div>
                {onComparisonAccept && (
                  <button
                    type="button"
                    onClick={() => onComparisonAccept(message.comparison!.control.content)}
                    className="rounded-full bg-dark-surface2 px-3 py-1.5 text-xs font-medium text-dark-text hover:bg-dark-border border border-dark-border2 transition-colors"
                  >
                    {t.messageBubbleAcceptControl}
                  </button>
                )}
              </div>
              {controlDiffLines.length > 0 && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-medium text-warning-500">{t.messageBubbleDiffHighlightsLabel}</span>
                  {controlDiffLines.map((line) => (
                    <span
                      key={line}
                      className="rounded-full bg-warning-500/10 text-warning-500 px-2.5 py-0.5 border border-warning-500/20"
                    >
                      {line}
                    </span>
                  ))}
                </div>
              )}
              <div className="markdown-body prose prose-invert max-w-none text-sm leading-relaxed text-dark-text font-serif">
                <ReactMarkdown components={markdownComponents}>
                  {message.comparison.control.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className={`markdown-body prose max-w-none text-sm md:text-base leading-relaxed ${isUser ? 'prose-invert text-white' : 'prose-invert text-dark-text font-serif'}`} onMouseUp={handleMouseUp}>
            <ReactMarkdown
              components={markdownComponents}
            >
              {isUser && !isExpanded && message.content.split('\n').length > MAX_USER_LINES
                ? message.content.split('\n').slice(0, MAX_USER_LINES).join('\n') + '...'
                : message.content}
            </ReactMarkdown>
            {isUser && !isExpanded && message.content.split('\n').length > MAX_USER_LINES && (
              <button
                type="button"
                onClick={() => setIsExpanded(true)}
                className="mt-2 text-xs text-primary-200 hover:text-white underline"
              >
                {t.scrollToBottom}
              </button>
            )}
          </div>
        )}

        {/* Timestamp */}
        <div
          className={`text-[11px] mt-3 flex items-center gap-1 ${
            isUser ? 'text-primary-100/70 justify-end' : 'text-dark-text-muted justify-start'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}

// Export memoized component to prevent unnecessary re-renders
export const MessageBubble = React.memo(MessageBubbleComponent, arePropsEqual)
