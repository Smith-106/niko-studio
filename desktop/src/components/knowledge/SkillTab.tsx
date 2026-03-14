import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Folder, Plus } from 'lucide-react'
import { listSkills, loadSkill, matchSkills, getSkillChain } from '../../api/client'
import { useI18n } from '../../i18n'
import type { KnowledgeItem, SkillMatch, SkillChainItem } from './KnowledgeTypes'

interface SkillTabProps {
  items: KnowledgeItem[]
  onItemsChange: (items: KnowledgeItem[]) => void
  loading: boolean
  onLoadingChange: (loading: boolean) => void
  selectedSkillId: string
  onSelectedSkillIdChange: (id: string) => void
  searchQuery: string
}

export function SkillTab({
  items,
  onItemsChange,
  loading,
  onLoadingChange,
  selectedSkillId,
  onSelectedSkillIdChange,
  searchQuery,
}: SkillTabProps) {
  const { t, translate } = useI18n()
  const [skillDetails, setSkillDetails] = useState<string>('')
  const [skillMatches, setSkillMatches] = useState<SkillMatch[]>([])
  const [skillChain, setSkillChain] = useState<SkillChainItem[]>([])

  const loadSkillsList = useCallback(async () => {
    onLoadingChange(true)
    try {
      const skillsResult = await listSkills()
      if (skillsResult.success && Array.isArray(skillsResult.data)) {
        onItemsChange(
          skillsResult.data.map((skill) => ({
            id: skill.id,
            name: skill.name || skill.id,
            description: '',
          }))
        )
      } else {
        onItemsChange([
          { name: 'character-forge', description: t.skillDescCharacterForge },
          { name: 'suspense-craft', description: t.skillDescSuspenseCraft },
          { name: 'dialogue-system', description: t.skillDescDialogueSystem },
          { name: 'tension-arc', description: t.skillDescTensionArc },
          { name: 'emotion-arc', description: t.skillDescEmotionArc },
          { name: 'opening-craft', description: t.skillDescOpeningCraft },
          { name: 'ending-craft', description: t.skillDescEndingCraft },
          { name: 'conflict-escalation', description: t.skillDescConflictEscalation },
        ])
      }
    } catch (error) {
      console.error('Failed to load skills:', error)
    } finally {
      onLoadingChange(false)
    }
  }, [onItemsChange, onLoadingChange, t])

  useEffect(() => {
    loadSkillsList()
  }, [loadSkillsList])

  const loadSkillDetails = async () => {
    if (!selectedSkillId) return
    const response = await loadSkill(selectedSkillId)
    if (response.success && response.data?.content) {
      setSkillDetails(response.data.content)
    } else {
      setSkillDetails(t.knowledgeSkillDetailsLoadFailed)
    }
  }

  const runSkillMatch = async () => {
    const keywords = searchQuery.trim() ? searchQuery.trim().split(/\s+/).slice(0, 5) : undefined
    const response = await matchSkills(undefined, keywords)
    if (response.success && Array.isArray(response.data)) {
      setSkillMatches(response.data)
    } else {
      setSkillMatches([])
    }
  }

  const loadSkillChain = async () => {
    if (!selectedSkillId) return
    const response = await getSkillChain(selectedSkillId)
    if (response.success && Array.isArray(response.data)) {
      setSkillChain(response.data)
    } else {
      setSkillChain([])
    }
  }

  const handleItemClick = (item: KnowledgeItem) => {
    onSelectedSkillIdChange((item.id as string) || (item.name as string) || '')
  }

  const filteredItems = items.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const controls = (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        onClick={runSkillMatch}
        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
        aria-label={t.knowledgeTaskMatch}
        title={t.knowledgeTaskMatch}
      >
        {t.knowledgeTaskMatch}
      </button>
      <button
        onClick={loadSkillDetails}
        disabled={!selectedSkillId}
        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
        aria-label={t.knowledgeSkillDetails}
        title={t.knowledgeSkillDetails}
      >
        {t.knowledgeSkillDetails}
      </button>
      <button
        onClick={loadSkillChain}
        disabled={!selectedSkillId}
        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
        aria-label={t.knowledgeSkillChain}
        title={t.knowledgeSkillChain}
      >
        {t.knowledgeSkillChain}
      </button>
      {selectedSkillId && (
        <span className="text-xs text-blue-600 dark:text-blue-400">
          {translate('knowledgeCurrentSkill', { skillId: selectedSkillId })}
        </span>
      )}
    </div>
  )

  const details = (
    <div className="mb-4 space-y-2">
      {skillDetails && (
        <div className="p-3 border border-gray-200 dark:border-dark-border rounded bg-gray-50 dark:bg-dark-bg">
          <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-1">{t.knowledgeSkillDetails}</div>
          <pre className="text-xs text-gray-600 dark:text-dark-text-secondary whitespace-pre-wrap break-all">{skillDetails}</pre>
        </div>
      )}
      {skillMatches.length > 0 && (
        <div className="p-3 border border-gray-200 dark:border-dark-border rounded bg-gray-50 dark:bg-dark-bg">
          <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-1">{t.knowledgeTaskMatch}</div>
          <div className="text-xs text-gray-600 dark:text-dark-text-secondary">
            {skillMatches.map((item) => `${item.skill_id} (${item.relevance})`).join('，')}
          </div>
        </div>
      )}
      {skillChain.length > 0 && (
        <div className="p-3 border border-gray-200 dark:border-dark-border rounded bg-gray-50 dark:bg-dark-bg">
          <div className="text-xs font-medium text-gray-700 dark:text-dark-text mb-1">{t.knowledgeSkillChain}</div>
          <div className="text-xs text-gray-600 dark:text-dark-text-secondary">
            {skillChain
              .slice()
              .sort((a, b) => a.step - b.step)
              .map((item) => `Step ${item.step}: ${item.skill_id}`)
              .join(' → ')}
          </div>
        </div>
      )}
    </div>
  )

  if (loading) {
    return { controls, details, content: <div className="flex items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">{t.knowledgeLoading}</div> }
  }

  if (filteredItems.length === 0) {
    return {
      controls,
      details,
      content: (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">
          <Folder size={48} className="mb-2" />
          <p>{t.knowledgeEmpty}</p>
          <button
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`${t.knowledgeAddPrefix}${t.knowledgeTabSkills}`}
            title={`${t.knowledgeAddPrefix}${t.knowledgeTabSkills}`}
            type="button"
          >
            <Plus size={16} />
            {t.knowledgeAddPrefix}
            {t.knowledgeTabSkills}
          </button>
        </div>
      ),
    }
  }

  return {
    controls,
    details,
    content: (
      <div className="grid grid-cols-2 gap-4">
        {filteredItems.map((item, index) => (
          <div
            key={index}
            onClick={() => handleItemClick(item)}
            className="p-4 border border-gray-200 dark:border-dark-border rounded-lg hover:border-blue-500 hover:shadow-md cursor-pointer transition-all"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Sparkles size={20} className="text-blue-600 dark:text-blue-400" />
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
    ),
  }
}
