import { CardList, type GraphItem } from './CardList'

export interface StoryBibleKnowledgeSectionProps {
  items: GraphItem[]
  loading: boolean
  loadingText: string
  emptyText: string
}

export function StoryBibleKnowledgeSection({
  items,
  loading,
  loadingText,
  emptyText,
}: StoryBibleKnowledgeSectionProps) {
  if (loading) {
    return <p className="text-sm text-[var(--text-muted)]">{loadingText}</p>
  }

  return <CardList items={items} emptyText={emptyText} />
}
