import { PenLine, RefreshCw, MessageSquareText, Lightbulb, Wand2, Shield } from 'lucide-react'
import { useI18n } from '../i18n'

interface AiToolbarProps {
  disabled?: boolean
  onWrite: () => void
  onRewrite: () => void
  onDescribe: () => void
  onBrainstorm: () => void
  onOpenWritingHelper: () => void
  onOpenTextOptimizer: () => void
}

export function AiToolbar({ disabled, onWrite, onRewrite, onDescribe, onBrainstorm, onOpenWritingHelper, onOpenTextOptimizer }: AiToolbarProps) {
  const { t } = useI18n()

  const tools = [
    { label: t.aiToolWrite, icon: <PenLine size={14} />, action: onWrite },
    { label: t.aiToolRewrite, icon: <RefreshCw size={14} />, action: onRewrite },
    { label: t.aiToolDescribe, icon: <MessageSquareText size={14} />, action: onDescribe },
    { label: t.aiToolBrainstorm, icon: <Lightbulb size={14} />, action: onBrainstorm },
  ]

  const extendedTools = [
    { label: t.sidebarWritingHelper, icon: <Wand2 size={14} />, action: onOpenWritingHelper },
    { label: t.sidebarTextOptimizer, icon: <Shield size={14} />, action: onOpenTextOptimizer },
  ]

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5">
        {tools.map((tool) => (
          <button
            key={tool.label}
            onClick={tool.action}
            disabled={disabled}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[var(--primary-cta)] hover:bg-[var(--primary-cta-hover)] active:bg-[var(--primary-cta-active)] rounded-[var(--radius-pill)] shadow-[var(--shadow-tiny)] transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wide focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            title={tool.label}
          >
            {tool.icon}
            <span className="hidden sm:inline">{tool.label}</span>
          </button>
        ))}
      </div>
      <div className="w-[1px] h-4 bg-gray-200 dark:bg-dark-border mx-1"></div>
      <div className="flex items-center gap-1.5">
        {extendedTools.map((tool) => (
          <button
            key={tool.label}
            onClick={tool.action}
            disabled={disabled}
            className="p-1.5 text-gray-500 hover:text-[var(--primary-cta)] dark:text-dark-text-muted dark:hover:text-[var(--primary-cta)] bg-gray-50 hover:bg-[var(--primary-cta-transparent-05)] dark:bg-dark-surface2 dark:hover:bg-[var(--primary-cta-transparent-05)] rounded-[var(--radius-pill)] transition-all active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            title={tool.label}
            aria-label={tool.label}
          >
            {tool.icon}
          </button>
        ))}
      </div>
    </div>
  )
}
