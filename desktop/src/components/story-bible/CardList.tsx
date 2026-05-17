export interface GraphItem {
  name?: string
  title?: string
  description?: string
  content?: string
  id?: string
  [key: string]: unknown
}

export function CardList({ items, emptyText }: { items: GraphItem[]; emptyText: string }) {
  if (items.length === 0) {
    return <p className="text-sm text-[var(--text-muted)] italic">{emptyText}</p>
  }
  return (
    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
      {items.map((item, index) => (
        <div
          key={item.id ?? index}
          className="px-3 py-2 rounded-[var(--radius-sm)] bg-[var(--surface-sunken)] border border-[var(--border-default)]"
        >
          <div className="text-sm font-medium text-[var(--text-primary)]">
            {item.name || item.title || item.id || `条目 ${index + 1}`}
          </div>
          {(item.description || item.content) && (
            <div className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">
              {String(item.description || item.content || '')}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
