import { useEffect, useCallback } from 'react'
import { FileText, Folder, Plus } from 'lucide-react'
import { searchMemory } from '../../api/client'
import { useI18n } from '../../i18n'
import type { KnowledgeItem } from './KnowledgeTypes'

interface PlotTabProps {
  items: KnowledgeItem[]
  onItemsChange: (items: KnowledgeItem[]) => void
  loading: boolean
  onLoadingChange: (loading: boolean) => void
  onItemClick: (item: KnowledgeItem) => void
  selectedItemId: string
  searchQuery: string
}

export function PlotTab({ items, onItemsChange, loading, onLoadingChange, onItemClick, selectedItemId, searchQuery }: PlotTabProps) {
  const { t, translate } = useI18n()

  const loadPlots = useCallback(async () => {
    onLoadingChange(true)
    try {
      const plotResult = await searchMemory('plot outline', { limit: 50 })
      onItemsChange((plotResult.data as KnowledgeItem[]) || [])
    } catch (error) {
      console.error('Failed to load plots:', error)
    } finally {
      onLoadingChange(false)
    }
  }, [onItemsChange, onLoadingChange])

  useEffect(() => {
    loadPlots()
  }, [loadPlots])

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
          className="mt-4 flex items-center gap-2 rounded-lg bg-slate-300 px-4 py-2 text-slate-600 opacity-70 cursor-not-allowed"
          aria-label={`${t.knowledgeAddPrefix}${t.knowledgeTabPlots}`}
          title={`${t.knowledgeAddPrefix}${t.knowledgeTabPlots}`}
          type="button"
          disabled
        >
          <Plus size={16} />
          {t.knowledgeAddPrefix}{t.knowledgeTabPlots}
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
          className={`p-4 border rounded-lg cursor-pointer transition-all ${
            String(item.id ?? item.name ?? '') === selectedItemId
              ? 'border-blue-500 shadow-md bg-blue-50/60 dark:border-blue-400 dark:bg-blue-900/10'
              : 'border-gray-200 dark:border-dark-border hover:border-blue-500 hover:shadow-md'
          }`}
        >
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <FileText size={20} className="text-blue-600 dark:text-blue-400" />
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
