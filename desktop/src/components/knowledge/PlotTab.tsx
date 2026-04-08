import { FileText } from 'lucide-react'

import { useI18n } from '../../i18n'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import { PersistedEntityTab } from './PersistedEntityTab'

interface PlotTabProps {
  items: KnowledgeItem[]
  onItemsChange: (items: KnowledgeItem[]) => void
  loading: boolean
  onLoadingChange: (loading: boolean) => void
  onItemClick: (item: KnowledgeItem) => void
  selectedItemId: string
  selectedItem: KnowledgeItem | null
  searchQuery: string
  onStatusChange: (status: OperationStatus | null) => void
}

export function PlotTab(props: PlotTabProps) {
  const { t } = useI18n()

  return (
    <PersistedEntityTab
      {...props}
      entityType="Event"
      itemKind="plot"
      itemLabel={t.knowledgeTabPlots}
      itemIcon={FileText}
    />
  )
}
