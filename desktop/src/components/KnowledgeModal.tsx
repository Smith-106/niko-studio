import { useState, useEffect, useRef } from 'react'
import { Search, User, MapPin, BookOpen, Sparkles, X } from 'lucide-react'
import { useI18n } from '../i18n'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import type { TabType, KnowledgeItem, OperationStatus, TabConfig } from './knowledge/KnowledgeTypes'
import { CharacterTab } from './knowledge/CharacterTab'
import { LocationTab } from './knowledge/LocationTab'
import { PlotTab } from './knowledge/PlotTab'
import { SkillTab } from './knowledge/SkillTab'
import { MemoryForm } from './knowledge/MemoryForm'

interface KnowledgeModalProps {
  isOpen: boolean
  onClose: () => void
}

export function KnowledgeModal({ isOpen, onClose }: KnowledgeModalProps) {
  const { t } = useI18n()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('characters')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null)
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')
  const [selectedItem, setSelectedItem] = useState<KnowledgeItem | null>(null)

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
    isActive: isOpen,
  })

  // Reset items when tab changes
  useEffect(() => {
    setItems([])
    setSelectedItem(null)
  }, [activeTab])

  const handleStatusChange = (status: OperationStatus | null) => {
    setOperationStatus(status)
  }

  const handleItemsChange = (newItems: KnowledgeItem[]) => {
    setItems(newItems)
  }

  const handleLoadingChange = (isLoading: boolean) => {
    setLoading(isLoading)
  }

  const handleItemClick = (item: KnowledgeItem) => {
    setSelectedItem(item)
  }

  const selectedItemId =
    selectedItem && typeof selectedItem === 'object'
      ? String(selectedItem.id ?? selectedItem.name ?? '')
      : ''

  const renderSelectedItemDetails = () => {
    if (activeTab === 'skills' || !selectedItem) return null

    const title =
      (selectedItem.name as string) ||
      (selectedItem.title as string) ||
      (selectedItem.id as string) ||
      t.knowledgeNoDescription

    const summary =
      (selectedItem.description as string) ||
      (selectedItem.content as string) ||
      (selectedItem.type as string) ||
      t.knowledgeNoDescription

    const detailEntries = Object.entries(selectedItem).filter(([, value]) => {
      if (value === null || value === undefined || value === '') {
        return false
      }
      return true
    })

    return (
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50/70 p-4 shadow-sm dark:border-blue-500/30 dark:bg-blue-900/10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-dark-text">{title}</div>
            <div className="mt-1 text-xs text-slate-600 dark:text-dark-text-secondary">{summary}</div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedItem(null)}
            className="rounded-md px-2 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-300 dark:hover:bg-blue-900/20"
          >
            {t.knowledgeClose}
          </button>
        </div>
        <div className="mt-3 grid gap-2">
          {detailEntries.map(([key, value]) => (
            <div
              key={key}
              className="rounded-lg border border-blue-100 bg-white/80 px-3 py-2 text-xs dark:border-blue-500/20 dark:bg-dark-surface"
            >
              <div className="font-medium uppercase tracking-wide text-slate-500 dark:text-dark-text-secondary">
                {key}
              </div>
              <div className="mt-1 whitespace-pre-wrap break-words text-slate-800 dark:text-dark-text">
                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  const tabs: TabConfig[] = [
    { id: 'characters', label: t.knowledgeTabCharacters, icon: User },
    { id: 'locations', label: t.knowledgeTabLocations, icon: MapPin },
    { id: 'plots', label: t.knowledgeTabPlots, icon: BookOpen },
    { id: 'skills', label: t.knowledgeTabSkills, icon: Sparkles },
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'characters':
        return (
          <CharacterTab
            items={items}
            onItemsChange={handleItemsChange}
            loading={loading}
            onLoadingChange={handleLoadingChange}
            onItemClick={handleItemClick}
            selectedItemId={selectedItemId}
            searchQuery={searchQuery}
          />
        )
      case 'locations':
        return (
          <LocationTab
            items={items}
            onItemsChange={handleItemsChange}
            loading={loading}
            onLoadingChange={handleLoadingChange}
            onItemClick={handleItemClick}
            selectedItemId={selectedItemId}
            searchQuery={searchQuery}
          />
        )
      case 'plots':
        return (
          <PlotTab
            items={items}
            onItemsChange={handleItemsChange}
            loading={loading}
            onLoadingChange={handleLoadingChange}
            onItemClick={handleItemClick}
            selectedItemId={selectedItemId}
            searchQuery={searchQuery}
          />
        )
      case 'skills': {
        const skillTab = SkillTab({
          items,
          onItemsChange: handleItemsChange,
          loading,
          onLoadingChange: handleLoadingChange,
          selectedSkillId,
          onSelectedSkillIdChange: setSelectedSkillId,
          searchQuery,
        })
        return (
          <>
            {skillTab.details}
            {skillTab.content}
          </>
        )
      }
      default:
        return null
    }
  }

  const getSkillTabControls = () => {
    if (activeTab !== 'skills') return null
    const skillTab = SkillTab({
      items,
      onItemsChange: handleItemsChange,
      loading,
      onLoadingChange: handleLoadingChange,
      selectedSkillId,
      onSelectedSkillIdChange: setSelectedSkillId,
      searchQuery,
    })
    return skillTab.controls
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="fixed right-0 top-14 bottom-0 w-full max-w-[800px] bg-slate-50 dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col z-40 transform transition-transform animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-label={t.knowledgeTitle}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80 backdrop-blur-md">
        <h2 className="text-base font-semibold text-gray-800 dark:text-dark-text tracking-wide">{t.knowledgeTitle}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none rounded-md p-1 hover:bg-gray-200 dark:hover:bg-dark-surface2 transition-colors"
          aria-label={t.knowledgeClose}
          title={t.knowledgeClose}
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex border-b border-gray-200 dark:border-dark-border bg-white dark:bg-dark-bg overflow-x-auto custom-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-all focus:outline-none shrink-0 text-sm font-medium ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-600 dark:text-primary-400 bg-primary-50/30 dark:bg-primary-900/10'
                : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2'
            }`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? 'text-primary-600' : ''} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6 border-b border-gray-200 dark:border-dark-border space-y-4 bg-white dark:bg-dark-bg">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.knowledgeSearchPlaceholder}
            aria-label={t.knowledgeSearchPlaceholder}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface text-gray-800 dark:text-dark-text rounded-xl focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all shadow-sm"
          />
        </div>
        {getSkillTabControls()}

        <MemoryForm onStatusChange={handleStatusChange} onItemsChange={handleItemsChange} />

        {operationStatus && (
          <div
            className={`mt-2 p-3 rounded-lg text-xs font-medium shadow-sm animate-fade-in ${
              operationStatus.type === 'success' 
                ? 'bg-success-50 text-success-700 border border-success-100 dark:bg-success-900/20 dark:text-success-400 dark:border-success-500/20' 
                : 'bg-danger-50 text-danger-700 border border-danger-100 dark:bg-danger-900/20 dark:text-danger-400 dark:border-danger-500/20'
            }`}
          >
            {operationStatus.message}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-dark-bg">
        {renderSelectedItemDetails()}
        {renderTabContent()}
      </div>
    </div>
  )
}
