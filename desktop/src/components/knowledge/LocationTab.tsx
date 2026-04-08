import { MapPin } from 'lucide-react'

import { useI18n } from '../../i18n'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import { PersistedEntityTab } from './PersistedEntityTab'

interface LocationTabProps {
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

export function LocationTab(props: LocationTabProps) {
  const { t } = useI18n()

  return (
    <PersistedEntityTab
      {...props}
      entityType="Location"
      itemKind="location"
      itemLabel={t.knowledgeTabLocations}
      itemIcon={MapPin}
    />
  )
}
