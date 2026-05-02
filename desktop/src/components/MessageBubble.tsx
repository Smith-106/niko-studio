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

function governanceSignature(message: Message): string {
  return JSON.stringify({
    governance: message.writerMetadata?.consistency_governance ?? null,
    narrative_authority: message.writerMetadata?.narrative_authority ?? null,
  })
}

function getGovernanceSummary(message: Message, language: 'zh' | 'en') {
  const governance = message.writerMetadata?.consistency_governance
  const authority = message.writerMetadata?.narrative_authority
  if (!governance && !authority?.consistencyRunId) {
    return null
  }

  const decision = governance?.decision
  const publishRecommendation = governance?.publish_recommendation
  const score = governance?.score
  const feedback = governance?.feedback?.trim()

  const decisionLabel = (() => {
    if (language === 'zh') {
      if (decision === 'go') return 'Go'
      if (decision === 'soft_go') return 'Soft Go'
      if (decision === 'no_go') return 'No-Go'
      return '未标记'
    }
    if (decision === 'go') return 'Go'
    if (decision === 'soft_go') return 'Soft Go'
    if (decision === 'no_go') return 'No-Go'
    return 'Not marked'
  })()

  const recommendationLabel = (() => {
    if (language === 'zh') {
      if (publishRecommendation === 'pass') return '通过'
      if (publishRecommendation === 'revise') return '需修改'
      if (publishRecommendation === 'block') return '阻塞'
      return '未生成'
    }
    if (publishRecommendation === 'pass') return 'Pass'
    if (publishRecommendation === 'revise') return 'Revise'
    if (publishRecommendation === 'block') return 'Block'
    return 'Not generated'
  })()

  const statusTone = decision === 'no_go'
    ? 'error'
    : decision === 'soft_go'
      ? 'warning'
      : 'success'

  const summary = language === 'zh'
    ? `一致性治理：${decisionLabel} / ${recommendationLabel}`
    : `Consistency governance: ${decisionLabel} / ${recommendationLabel}`

  const scoreLine = typeof score === 'number'
    ? (language === 'zh' ? `评估分数 ${score}` : `Evaluation score ${score}`)
    : null
  const runIdLine = authority?.consistencyRunId
    ? (language === 'zh' ? `运行 ID ${authority.consistencyRunId}` : `Run ID ${authority.consistencyRunId}`)
    : null

  return {
    summary,
    scoreLine,
    feedback: feedback || null,
    runIdLine,
    statusTone,
  }
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
  if (governanceSignature(prevMsg) !== governanceSignature(nextMsg)) return false

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

function getReferenceSummary(message: Message, language: 'zh' | 'en', t: ReturnType<typeof useI18n>['t']) {
  const knowledge = message.writerMetadata?.knowledge_retrieved
  const canonContext = message.writerMetadata?.canon_context
  const labels: string[] = []

  if (canonContext?.injected) labels.push(t.messageBubbleSourceTypeCanon)
  if ((knowledge?.entities_count ?? 0) > 0) labels.push(t.messageBubbleSourceTypeEntity)
  if ((knowledge?.relations_count ?? 0) > 0) labels.push(t.messageBubbleSourceTypeRelation)
  if ((knowledge?.memories_count ?? 0) > 0) labels.push(t.messageBubbleSourceTypeMemory)

  const uniqueLabels = labels.filter((label, index) => labels.indexOf(label) === index)
  const summary = uniqueLabels.length > 0
    ? t.messageBubbleSourceSummaryUsed.replace('{summary}', uniqueLabels.join(language === 'zh' ? '、' : ', '))
    : null

  return {
    summary,
    primaryMatch: canonContext?.injected && canonContext.matches.length > 0 ? canonContext.matches[0] : null,
    unavailableReason: canonContext && !canonContext.available
      ? t.messageBubbleCanonContextUnavailable.replace('{reason}', canonContext.reason ?? 'unknown')
      : null,
  }
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
  const { t, language } = useI18n()
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
  const governanceSummary = getGovernanceSummary(message, language)
  const referenceSummary = getReferenceSummary(message, language, t)
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

        {!isUser && governanceSummary && (
          <div
            className={`mb-3 rounded-xl border px-3 py-3 ${
              governanceSummary.statusTone === 'error'
                ? 'border-danger-500/20 bg-danger-500/5'
                : governanceSummary.statusTone === 'warning'
                  ? 'border-warning-500/20 bg-warning-500/5'
                  : 'border-success-500/20 bg-success-500/5'
            }`}
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-dark-text-secondary">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  governanceSummary.statusTone === 'error'
                    ? 'bg-danger-400'
                    : governanceSummary.statusTone === 'warning'
                      ? 'bg-warning-400'
                      : 'bg-success-400'
                }`}
              ></span>
              {language === 'zh' ? '一致性治理' : 'Consistency governance'}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-dark-text-muted">{governanceSummary.summary}</p>
            {(governanceSummary.scoreLine || governanceSummary.runIdLine || governanceSummary.feedback) && (
              <div className="mt-3 space-y-1 text-xs text-dark-text-secondary">
                {governanceSummary.scoreLine && <div>{governanceSummary.scoreLine}</div>}
                {governanceSummary.runIdLine && <div>{governanceSummary.runIdLine}</div>}
                {governanceSummary.feedback && (
                  <p className="leading-relaxed text-dark-text-muted">{governanceSummary.feedback}</p>
                )}
              </div>
            )}
          </div>
        )}

        {!isUser && (referenceSummary.summary || referenceSummary.unavailableReason || (canonContext && shouldRenderCanonContext(message))) && (
          <div className="mb-3 rounded-xl border border-primary-500/20 bg-primary-500/5 px-3 py-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary-300">
              <span className={`h-1.5 w-1.5 rounded-full ${referenceSummary.unavailableReason ? 'bg-warning-500' : 'bg-primary-400'}`}></span>
              {t.messageBubbleSourceSummaryTitle}
            </div>
            <p className="mt-2 text-xs leading-relaxed text-dark-text-muted">
              {referenceSummary.summary ?? referenceSummary.unavailableReason ?? t.messageBubbleSourceSummaryFallback}
            </p>
            {referenceSummary.primaryMatch && (
              <div className="mt-3 rounded-lg border border-dark-border/60 bg-dark-bg/60 px-3 py-2">
                <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-dark-text-muted">
                  {t.messageBubbleSourcePrimary}
                </div>
                <div className="mt-1 text-xs font-semibold text-dark-text">{referenceSummary.primaryMatch.title}</div>
                <p className="mt-2 text-xs leading-relaxed text-dark-text-secondary">{referenceSummary.primaryMatch.excerpt}</p>
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
              className="inline-flex items-center gap-2 rounded-full border border-primary-500/30 bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-300 transition-colors hover:bg-primary-500/15 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
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
                    className="rounded-full bg-primary-600/10 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-600/20 border border-primary-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
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
                    className="rounded-full bg-dark-surface2 px-3 py-1.5 text-xs font-medium text-dark-text hover:bg-dark-border border border-dark-border2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
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
                className="mt-2 text-xs text-primary-200 hover:text-white underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              >
                {t.scrollToBottom}
              </button>
            )}
          </div>
        )}

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

export const MessageBubble = React.memo(MessageBubbleComponent, arePropsEqual)
