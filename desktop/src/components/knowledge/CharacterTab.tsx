import { User } from 'lucide-react'

import { useI18n } from '../../i18n'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import type { FieldConfig } from './KnowledgeTypes'
import { PersistedEntityTab } from './PersistedEntityTab'

const CHARACTER_FIELDS: FieldConfig[] = [
  { key: 'role', label: 'Role', type: 'text' },
  { key: 'traits', label: 'Traits', type: 'textarea' },
]

interface CharacterTabProps {
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

export function CharacterTab(props: CharacterTabProps) {
  const { t } = useI18n()

  return (
    <PersistedEntityTab
      {...props}
      entityType="Character"
      itemKind="character"
      itemLabel={t.knowledgeTabCharacters}
      itemIcon={User}
      extraFields={CHARACTER_FIELDS}
    />
  )
}
