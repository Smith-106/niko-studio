import React, { useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Components } from 'react-markdown'
import { ChevronDown, ChevronUp, Package } from 'lucide-react'
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
  for (let index = 0; index < prevSkills.length; index += 1) {
    if (prevSkills[index] !== nextSkills[index]) return false
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

  if (JSON.stringify(prevMsg.metadata) !== JSON.stringify(nextMsg.metadata)) return false

  return true
}

function MessageBubbleComponent({ message, onAssistantSelection }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const { t } = useI18n()
  const [detailsOpen, setDetailsOpen] = useState(false)

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
        <pre className="rounded-md overflow-x-auto bg-[#1f2937] text-[#f9fafb] p-2.5 md:p-3 text-xs md:text-sm">
          <code className={className}>{codeText}</code>
        </pre>
      )
    },
  }

  const detailRows = useMemo(() => {
    const rows: Array<{ label: string; value: string }> = []
    const runtime = message.metadata?.runtime
    const workflow = message.metadata?.workflow
    const knowledge = message.metadata?.knowledge

    if (runtime?.terminal) rows.push({ label: t.messageDetailTerminal, value: runtime.terminal })
    if (runtime?.decision) rows.push({ label: t.messageDetailDecision, value: runtime.decision })
    if (runtime?.routeModel) rows.push({ label: t.messageDetailRouteModel, value: runtime.routeModel })
    if (runtime?.controlModel) rows.push({ label: t.messageDetailControlModel, value: runtime.controlModel })
    if (typeof runtime?.latencyMs === 'number') rows.push({ label: t.messageDetailLatency, value: `${runtime.latencyMs}ms` })
    if (runtime?.diagnostics?.fallback_reason) rows.push({ label: t.messageDetailFallbackReason, value: runtime.diagnostics.fallback_reason })
    if (runtime?.diagnostics?.failure_reason) rows.push({ label: t.messageDetailFailureReason, value: runtime.diagnostics.failure_reason })
    if (runtime?.diagnostics?.error_type) rows.push({ label: t.messageDetailErrorType, value: runtime.diagnostics.error_type })

    if (workflow?.level) rows.push({ label: t.messageDetailWorkflowLevel, value: workflow.level })
    if (typeof workflow?.stepsCompleted === 'number' && typeof workflow?.totalSteps === 'number') {
      rows.push({ label: t.messageDetailWorkflowSteps, value: `${workflow.stepsCompleted}/${workflow.totalSteps}` })
    }

    if (typeof knowledge?.entitiesCount === 'number') rows.push({ label: t.messageDetailKnowledgeEntities, value: String(knowledge.entitiesCount) })
    if (typeof knowledge?.relationsCount === 'number') rows.push({ label: t.messageDetailKnowledgeRelations, value: String(knowledge.relationsCount) })
    if (typeof knowledge?.memoriesCount === 'number') rows.push({ label: t.messageDetailKnowledgeMemories, value: String(knowledge.memoriesCount) })

    if (typeof message.metadata?.evaluationScore === 'number') rows.push({ label: t.messageDetailEvaluationScore, value: String(message.metadata.evaluationScore) })
    if (message.metadata?.evaluationFeedback) rows.push({ label: t.messageDetailEvaluationFeedback, value: message.metadata.evaluationFeedback })

    return rows
  }, [message.metadata, t])

  const warnings = message.metadata?.writerWarnings ?? []
  const hasDetails = detailRows.length > 0 || warnings.length > 0
  const detailsId = `message-details-${message.id}`

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`w-full max-w-[92%] md:max-w-[85%] rounded-2xl px-3 py-2.5 md:px-4 md:py-3 shadow-sm ${
          isUser
            ? 'bg-teal-600 text-white'
            : 'border border-slate-200 bg-white text-slate-800 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text'
        }`}
      >
        {message.skills && message.skills.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {message.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
              >
                <Package size={12} />
                {skill}
              </span>
            ))}
          </div>
        )}

        {message.comparison?.enabled ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2 md:gap-3" onMouseUp={handleMouseUp}>
            <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-2.5 md:p-3">
              <div className="text-xs font-semibold mb-2 text-slate-500 dark:text-dark-text-secondary">
                主模型：{message.comparison.primary.model}
              </div>
              <div className="markdown-body text-sm leading-6">
                <ReactMarkdown components={markdownComponents}>
                  {message.comparison.primary.content}
                </ReactMarkdown>
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 dark:border-dark-border bg-white dark:bg-dark-surface p-2.5 md:p-3">
              <div className="text-xs font-semibold mb-2 text-slate-500 dark:text-dark-text-secondary">
                对照模型：{message.comparison.control.model}
              </div>
              <div className="markdown-body text-sm leading-6">
                <ReactMarkdown components={markdownComponents}>
                  {message.comparison.control.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="markdown-body text-sm leading-6" onMouseUp={handleMouseUp}>
            <ReactMarkdown components={markdownComponents}>{message.content}</ReactMarkdown>
          </div>
        )}

        {hasDetails && !isUser && (
          <div className="mt-2 border-t border-slate-200 pt-2 dark:border-dark-border">
            <button
              type="button"
              onClick={() => setDetailsOpen((prev) => !prev)}
              aria-label={t.messageDetailsToggleAria}
              aria-expanded={detailsOpen}
              aria-controls={detailsId}
              className="cursor-pointer inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-dark-text-secondary dark:hover:bg-dark-border dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {t.messageDetailsTitle}
            </button>
            {detailsOpen && (
              <div id={detailsId} className="mt-2 rounded-lg bg-slate-50 dark:bg-dark-bg p-2 space-y-1">
                {detailRows.map((row) => (
                  <div key={`${row.label}-${row.value}`} className="flex items-start justify-between gap-2 text-xs">
                    <span className="text-slate-500 dark:text-dark-text-secondary">{row.label}</span>
                    <span className="text-right text-slate-700 dark:text-dark-text break-all">{row.value}</span>
                  </div>
                ))}
                {warnings.length > 0 && (
                  <div className="pt-1 border-t border-slate-200 dark:border-dark-border text-xs text-amber-700 dark:text-amber-300">
                    {t.messageDetailWarnings}: {warnings.join('；')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div
          className={`text-xs mt-2 ${
            isUser ? 'text-teal-100' : 'text-slate-400 dark:text-dark-text-secondary'
          }`}
        >
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  )
}

export const MessageBubble = React.memo(MessageBubbleComponent, arePropsEqual)
