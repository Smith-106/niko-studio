import { useEffect, useCallback } from 'react'
import { User, Folder, Plus } from 'lucide-react'
import { queryGraph } from '../../api/client'
import { useI18n } from '../../i18n'
import type { KnowledgeItem } from './KnowledgeTypes'
import { toGraphItems } from './knowledgeUtils'

interface CharacterTabProps {
  items: KnowledgeItem[]
  onItemsChange: (items: KnowledgeItem[]) => void
  loading: boolean
  onLoadingChange: (loading: boolean) => void
  onItemClick: (item: KnowledgeItem) => void
  searchQuery: string
}

export function CharacterTab({ items, onItemsChange, loading, onLoadingChange, onItemClick, searchQuery }: CharacterTabProps) {
  const { t, translate } = useI18n()

  const loadCharacters = useCallback(async () => {
    onLoadingChange(true)
    try {
      const charResult = await queryGraph('MATCH (c:Character) RETURN c LIMIT 50')
      onItemsChange(toGraphItems(charResult.data, 'c'))
    } catch (error) {
      console.error('Failed to load characters:', error)
    } finally {
      onLoadingChange(false)
    }
  }, [onItemsChange, onLoadingChange])

  useEffect(() => {
    loadCharacters()
  }, [loadCharacters])

  const filteredItems = items.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return <div className="flex items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">{t.knowledgeLoading}</div>
  }

  if (filteredItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">
        <Folder size={48} className="mb-2" />
        <p>{t.knowledgeEmpty}</p>
        <button
          className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label={`${t.knowledgeAddPrefix}${t.knowledgeTabCharacters}`}
          title={`${t.knowledgeAddPrefix}${t.knowledgeTabCharacters}`}
          type="button"
        >
          <Plus size={16} />
          {t.knowledgeAddPrefix}{t.knowledgeTabCharacters}
        </button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      {filteredItems.map((item, index) => (
        <div
          key={index}
          onClick={() => onItemClick(item)}
          className="p-4 border border-gray-200 dark:border-dark-border rounded-lg hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <User size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-gray-800 dark:text-dark-text truncate">
                {(item.name as string) || (item.title as string) || (item.id as string) || translate('knowledgeItemFallback', { index: index + 1 })}
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1 line-clamp-2">
                {(item.description as string) || (item.content as string) || t.knowledgeNoDescription}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
