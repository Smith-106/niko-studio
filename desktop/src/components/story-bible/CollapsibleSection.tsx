import { useState, useId, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

export function CollapsibleSection({
  title,
  icon,
  content,
  defaultOpen = false,
  contentId,
}: {
  title: string
  icon: ReactNode
  content: ReactNode
  defaultOpen?: boolean
  contentId?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const generatedContentId = useId()
  const resolvedContentId = contentId || generatedContentId

  return (
    <div className="border border-[var(--border-default)] rounded-[var(--radius-md)] overflow-hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={resolvedContentId}
        onClick={() => setOpen((current) => !current)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-[var(--surface-elevated)] hover:bg-[var(--surface-sunken)] transition-colors"
      >
        <span className="text-[var(--text-muted)]">{icon}</span>
        <span className="flex-1 text-sm font-medium text-[var(--text-primary)]">{title}</span>
        <ChevronDown
          size={16}
          className={`text-[var(--text-muted)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div id={resolvedContentId} className="px-4 py-3 border-t border-[var(--border-default)]">{content}</div>}
    </div>
  )
}
