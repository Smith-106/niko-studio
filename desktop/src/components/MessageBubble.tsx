import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { promoteProjectWikiCanonApi } from '../api/client'
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

  if (canonContextSignature(prevMsg) !== canonContextSignature(nextMsg)) return false

  return true
}

const MAX_USER_LINES = 8

function canonContextSignature(message: Message): string {
  return JSON.stringify(message.writerMetadata?.canon_context ?? null)
}

function shouldRenderCanonContext(message: Message): boolean {
  const canonContext = message.writerMetadata?.canon_context
  return Boolean(canonContext && (canonContext.injected || !canonContext.available))
}

function slugifySegment(value: string | null | undefined): string {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'reply'
}

function deriveReplyTitle(message: Message): string {
  const firstContentLine = message.content
    .split('\n')
    .map((line) => line.replace(/^[#>*\-\s`]+/, '').trim())
    .find(Boolean)

  if (firstContentLine) {
    return firstContentLine.slice(0, 80)
  }

  const workspace = message.workspaceContext
  const workspaceLabel = workspace?.identity.projectName || workspace?.identity.projectId || 'Workspace'
  return `${workspaceLabel} Chat Reply`
}

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
  const [isPromotingCanon, setIsPromotingCanon] = useState(false)
  const [canonPromotionStatus, setCanonPromotionStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const primaryDiffLines = message.comparison?.enabled
    ? getUniqueComparisonLines(message.comparison.primary.content, message.comparison.control.content)
    : []
  const controlDiffLines = message.comparison?.enabled
    ? getUniqueComparisonLines(message.comparison.control.content, message.comparison.primary.content)
    : []
  const canonContext = message.writerMetadata?.canon_context
  const workspaceContext = message.workspaceContext
  const canPromoteReplyToCanon = !isUser && Boolean(workspaceContext) && Boolean(message.content.trim())

  const handleMouseUp = () => {
    if (isUser || !onAssistantSelection) return
    const selection = window.getSelection()
    const text = selection?.toString().trim() || ''
    if (!text) return
    onAssistantSelection({ messageId: message.id, selectedText: text })
  }

  const handlePromoteReplyToCanon = async () => {
    if (!workspaceContext || !message.content.trim() || isPromotingCanon) return

    setIsPromotingCanon(true)
    setCanonPromotionStatus(null)

    try {
      const conversationId = slugifySegment(workspaceContext.chat.conversationId)
      const workspaceId = slugifySegment(workspaceContext.identity.workspaceId)
      const messageId = slugifySegment(message.id)
      const title = deriveReplyTitle(message)
      const response = await promoteProjectWikiCanonApi({
        title,
        body: message.content.trim(),
        slug: `chat/${workspaceId}-${conversationId}-${messageId}`,
        idSeed: `${workspaceId}:${conversationId}:${message.id}`,
        promotedFrom: 'chat',
        sourceId: message.id,
        sourceRef: `chat.${conversationId}.${message.id}`,
        rawEvidence: {
          relativePath: `imports/chat/${workspaceId}/${conversationId}/${messageId}.md`,
          content: message.content.trim(),
        },
        metadata: {
          conversation_id: workspaceContext.chat.conversationId,
          workflow_session_id: workspaceContext.workflow.sessionId,
          chapter_id: workspaceContext.manuscript.chapterId,
          source: 'assistant-message',
        },
      }, workspaceContext)

      if (!response.success || !response.data?.available || !response.data.page) {
        throw new Error(response.error || response.data?.reason || 'canon-promotion-failed')
      }

      setCanonPromotionStatus({ type: 'success', text: t.messageBubblePromoteCanonSuccess })
    } catch {
      setCanonPromotionStatus({ type: 'error', text: t.messageBubblePromoteCanonFailure })
    } finally {
      setIsPromotingCanon(false)
    }
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

        {!isUser && canonContext && shouldRenderCanonContext(message) && (
          <div className="mb-3 rounded-xl border border-primary-500/20 bg-primary-500/5 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-300">
              <span className={`h-1.5 w-1.5 rounded-full ${canonContext.injected ? 'bg-primary-400' : 'bg-warning-500'}`}></span>
              {t.messageBubbleCanonContextTitle}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-dark-text-muted">
              {canonContext.injected
                ? t.messageBubbleCanonContextApplied
                  .replace('{matches}', String(canonContext.match_count))
                  .replace('{pages}', String(canonContext.total_pages))
                : t.messageBubbleCanonContextUnavailable
                  .replace('{reason}', canonContext.reason ?? 'unknown')}
            </p>
            {canonContext.injected && canonContext.matches.length > 0 && (
              <div className="mt-3 space-y-2">
                {canonContext.matches.map((match) => (
                  <div
                    key={`${message.id}-${match.page_id}`}
                    className="rounded-lg border border-dark-border/60 bg-dark-bg/60 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-dark-text">{match.title}</span>
                      <span className="rounded-full border border-primary-500/20 bg-primary-500/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-primary-300">
                        {match.authority.promotedFrom}
                      </span>
                      <span className="rounded-full border border-dark-border2 bg-dark-surface2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-dark-text-secondary">
                        {match.authority.status}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-dark-text-muted">{match.slug}</div>
                    <p className="mt-2 text-xs leading-relaxed text-dark-text-secondary">{match.excerpt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {canPromoteReplyToCanon && (
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void handlePromoteReplyToCanon()}
              disabled={isPromotingCanon}
              className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-300 transition-colors hover:bg-primary-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPromotingCanon ? t.messageBubblePromotingCanon : t.messageBubblePromoteCanon}
            </button>
            {canonPromotionStatus && (
              <span
                className={`text-xs ${canonPromotionStatus.type === 'success' ? 'text-success-400' : 'text-danger-400'}`}
              >
                {canonPromotionStatus.text}
              </span>
            )}
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
