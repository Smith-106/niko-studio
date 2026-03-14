import { useState, useEffect, useRef } from 'react'
import { Search, User, MapPin, BookOpen, Sparkles } from 'lucide-react'
import { useI18n } from '../i18n'
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
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('characters')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null)
  const [selectedSkillId, setSelectedSkillId] = useState<string>('')

  useEffect(() => {
    if (!isOpen) {
      return
    }

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusDialog = () => {
      const dialog = dialogRef.current
      if (!dialog) return
      const focusable = dialog.querySelector<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (focusable) {
        focusable.focus()
      } else {
        dialog.focus()
      }
    }

    focusDialog()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') {
        return
      }

      const dialog = dialogRef.current
      if (!dialog) {
        return
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled') && element.tabIndex !== -1)

      if (focusableElements.length === 0) {
        event.preventDefault()
        return
      }

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      const active = document.activeElement as HTMLElement | null

      if (event.shiftKey) {
        if (!active || active === first || !dialog.contains(active)) {
          event.preventDefault()
          last.focus()
        }
      } else if (!active || active === last || !dialog.contains(active)) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [isOpen, onClose])

  // Reset items when tab changes
  useEffect(() => {
    setItems([])
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

  const handleItemClick = (_item: KnowledgeItem) => {
    // Generic click handler - skill tab uses this differently
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
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-label={t.knowledgeTitle}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="bg-white dark:bg-dark-surface rounded-2xl w-[800px] h-[600px] overflow-hidden shadow-2xl flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-dark-border">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-text">{t.knowledgeTitle}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
            aria-label={t.knowledgeClose}
            title={t.knowledgeClose}
          >
            ×
          </button>
        </div>

        <div className="flex border-b border-gray-200 dark:border-dark-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-3 border-b-2 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-dark-text-secondary hover:text-gray-700 dark:hover:text-dark-text'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-4 border-b border-gray-200 dark:border-dark-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.knowledgeSearchPlaceholder}
              aria-label={t.knowledgeSearchPlaceholder}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {getSkillTabControls()}

          <MemoryForm onStatusChange={handleStatusChange} onItemsChange={handleItemsChange} />

          {operationStatus && (
            <p
              className={`mt-2 text-xs ${operationStatus.type === 'success' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {operationStatus.message}
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4">{renderTabContent()}</div>
      </div>
    </div>
  )
}
