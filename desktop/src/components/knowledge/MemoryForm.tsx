import { useState } from 'react'
import { getTemporalFacts, getCharacter, getForeshadows, addMemory } from '../../api/client'
import { plantForeshadow, getForeshadowStats, type ForeshadowStats } from '../../api/knowledge'
import { useI18n } from '../../i18n'
import { useAppStore } from '../../stores/appStore'
import type { OperationStatus, KnowledgeItem } from './KnowledgeTypes'

interface MemoryFormProps {
  onStatusChange: (status: OperationStatus | null) => void
  onItemsChange: (items: KnowledgeItem[]) => void
}

export function MemoryForm({ onStatusChange, onItemsChange }: MemoryFormProps) {
  const { t } = useI18n()
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const currentFocusEntityId = currentWorkspace.knowledge.focusEntityId?.trim() || ''
  const [temporalEntityId, setTemporalEntityId] = useState('')
  const [temporalAtTime, setTemporalAtTime] = useState('')
  const [characterName, setCharacterName] = useState('')
  const [foreshadowStatus, setForeshadowStatus] = useState('pending')
  const [foreshadowChapter, setForeshadowChapter] = useState('')
  const [foreshadowPlantDesc, setForeshadowPlantDesc] = useState('')
  const [foreshadowStats, setForeshadowStats] = useState<ForeshadowStats | null>(null)
  const [memoryContent, setMemoryContent] = useState('')
  const [memoryLayer, setMemoryLayer] = useState('session')
  const [memoryDimension, setMemoryDimension] = useState('context')
  const [memoryEntityId, setMemoryEntityId] = useState('')
  const [memoryTags, setMemoryTags] = useState('')

  const runTemporalFactsQuery = async () => {
    const entityId = temporalEntityId.trim()
    if (!entityId) {
      onStatusChange({ type: 'error', message: t.knowledgeTemporalEntityRequired })
      return
    }

    const response = await getTemporalFacts(entityId, temporalAtTime.trim() || undefined, currentWorkspace)
    if (response.success && Array.isArray(response.data)) {
      const temporalItems = response.data.map((fact) => ({
        id: fact.id,
        name: fact.id,
        description: fact.content,
        content: fact.content,
      }))
      onItemsChange(temporalItems)
      onStatusChange({ type: 'success', message: t.knowledgeTemporalLoaded })
    } else {
      onStatusChange({ type: 'error', message: response.error || t.knowledgeRequestFailed })
    }
  }

  const loadCharacterDetails = async () => {
    const name = characterName.trim()
    if (!name) {
      onStatusChange({ type: 'error', message: t.knowledgeCharacterNameRequired })
      return
    }

    const response = await getCharacter(name, true, { workspace: currentWorkspace })
    if (response.success && response.data) {
      const relationships = response.data.relationships
        ? Object.entries(response.data.relationships).map(([target, relation]) => `${target}: ${relation}`).join('；')
        : ''
      onItemsChange([
        {
          id: response.data.name,
          name: response.data.name,
          title: response.data.role,
          description: relationships || t.knowledgeNoDescription,
        },
      ])
      onStatusChange({ type: 'success', message: t.knowledgeCharacterLoaded })
    } else {
      onStatusChange({ type: 'error', message: response.error || t.knowledgeRequestFailed })
    }
  }

  const loadForeshadows = async () => {
    const chapter = Number(foreshadowChapter)
    const chapterValue = Number.isFinite(chapter) && chapter > 0 ? chapter : undefined
    const response = await getForeshadows(foreshadowStatus || undefined, chapterValue, {
      workspace: currentWorkspace,
    })
    if (response.success && Array.isArray(response.data)) {
      onItemsChange(
        response.data.map((item) => ({
          id: item.id,
          name: item.id,
          title: item.status,
          description: item.description,
        }))
      )
      onStatusChange({ type: 'success', message: t.knowledgeForeshadowsLoaded })
    } else {
      onStatusChange({ type: 'error', message: response.error || t.knowledgeRequestFailed })
    }
  }

  const handleAddMemory = async () => {
    const content = memoryContent.trim()
    const explicitEntityId = memoryEntityId.trim()
    const shouldUseFocusEntity = !explicitEntityId && Boolean(currentFocusEntityId)
    if (!content) {
      onStatusChange({ type: 'error', message: t.knowledgeMemoryContentRequired })
      return
    }

    const tags = memoryTags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)

    const response = await addMemory(content, {
      layer: memoryLayer,
      dimension: memoryDimension,
      entity_id: explicitEntityId || undefined,
      use_focus_entity: shouldUseFocusEntity,
      tags,
      workspace: currentWorkspace,
    })

    if (response.success) {
      setMemoryContent('')
      onStatusChange({ type: 'success', message: t.knowledgeMemoryAdded })
    } else {
      onStatusChange({ type: 'error', message: response.error || t.knowledgeRequestFailed })
    }
  }

  const handlePlantForeshadow = async () => {
    const description = foreshadowPlantDesc.trim()
    if (!description) {
      onStatusChange({ type: 'error', message: t.knowledgeForeshadowPlantDescPlaceholder })
      return
    }
    const response = await plantForeshadow(description)
    if (response.success && response.data) {
      setForeshadowPlantDesc('')
      onStatusChange({ type: 'success', message: t.knowledgeForeshadowPlanted })
      loadForeshadowStats()
    } else {
      onStatusChange({ type: 'error', message: (response.error as string) || t.knowledgeRequestFailed })
    }
  }

  const loadForeshadowStats = async () => {
    const response = await getForeshadowStats()
    if (response.success && response.data) {
      setForeshadowStats(response.data)
      onStatusChange({ type: 'success', message: t.knowledgeForeshadowStatsLoaded })
    } else {
      onStatusChange({ type: 'error', message: (response.error as string) || t.knowledgeRequestFailed })
    }
  }

  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
      <div className="p-2 border border-gray-200 dark:border-dark-border rounded space-y-2">
        <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">{t.knowledgeTemporalTitle}</div>
        <input
          value={temporalEntityId}
          onChange={(event) => setTemporalEntityId(event.target.value)}
          placeholder={t.knowledgeTemporalEntityPlaceholder}
          aria-label={t.knowledgeTemporalEntityPlaceholder}
          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
        />
        <input
          value={temporalAtTime}
          onChange={(event) => setTemporalAtTime(event.target.value)}
          placeholder={t.knowledgeTemporalAtTimePlaceholder}
          aria-label={t.knowledgeTemporalAtTimePlaceholder}
          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
        />
        <button
          onClick={runTemporalFactsQuery}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          type="button"
        >
          {t.knowledgeTemporalAction}
        </button>
      </div>

      <div className="p-2 border border-gray-200 dark:border-dark-border rounded space-y-2">
        <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">{t.knowledgeCharacterTitle}</div>
        <input
          value={characterName}
          onChange={(event) => setCharacterName(event.target.value)}
          placeholder={t.knowledgeCharacterNamePlaceholder}
          aria-label={t.knowledgeCharacterNamePlaceholder}
          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
        />
        <button
          onClick={loadCharacterDetails}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          type="button"
        >
          {t.knowledgeCharacterAction}
        </button>
      </div>

      <div className="p-2 border border-gray-200 dark:border-dark-border rounded space-y-2">
        <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">{t.knowledgeForeshadowTitle}</div>
        <div className="flex gap-2">
          <select
            value={foreshadowStatus}
            onChange={(event) => setForeshadowStatus(event.target.value)}
            aria-label={t.knowledgeForeshadowStatusPlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          >
            <option value="pending">{t.knowledgeForeshadowStatusPending}</option>
            <option value="resolved">{t.knowledgeForeshadowStatusResolved}</option>
            <option value="all">{t.knowledgeForeshadowStatusAll}</option>
          </select>
          <input
            value={foreshadowChapter}
            onChange={(event) => setForeshadowChapter(event.target.value)}
            placeholder={t.knowledgeForeshadowChapterPlaceholder}
            aria-label={t.knowledgeForeshadowChapterPlaceholder}
            className="w-24 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
        </div>
        <button
          onClick={loadForeshadows}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          type="button"
        >
          {t.knowledgeForeshadowAction}
        </button>

        <div className="border-t border-gray-200 dark:border-dark-border pt-2 mt-2">
          <input
            value={foreshadowPlantDesc}
            onChange={(event) => setForeshadowPlantDesc(event.target.value)}
            placeholder={t.knowledgeForeshadowPlantDescPlaceholder}
            aria-label={t.knowledgeForeshadowPlantDescPlaceholder}
            className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
          <button
            onClick={handlePlantForeshadow}
            className="mt-1 px-2 py-1 text-xs bg-green-600 text-white rounded"
            type="button"
          >
            {t.knowledgeForeshadowPlantAction}
          </button>
        </div>

        {foreshadowStats && (
          <div className="flex gap-2 text-xs text-gray-600 dark:text-dark-text-secondary">
            <span>{t.knowledgeForeshadowPlanted}: {foreshadowStats.by_state.planted}</span>
            <span>{t.knowledgeForeshadowHinted}: {foreshadowStats.by_state.hinted}</span>
            <span>{t.knowledgeForeshadowHarvested}: {foreshadowStats.by_state.harvested}</span>
          </div>
        )}
        <button
          onClick={loadForeshadowStats}
          className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
          type="button"
        >
          Stats
        </button>
      </div>

      <div className="p-2 border border-gray-200 dark:border-dark-border rounded space-y-2">
        <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary">{t.knowledgeMemoryTitle}</div>
        <input
          value={memoryContent}
          onChange={(event) => setMemoryContent(event.target.value)}
          placeholder={t.knowledgeMemoryContentPlaceholder}
          aria-label={t.knowledgeMemoryContentPlaceholder}
          className="w-full px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
        />
        <div className="flex gap-2">
          <input
            value={memoryLayer}
            onChange={(event) => setMemoryLayer(event.target.value)}
            placeholder={t.knowledgeMemoryLayerPlaceholder}
            aria-label={t.knowledgeMemoryLayerPlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
          <input
            value={memoryDimension}
            onChange={(event) => setMemoryDimension(event.target.value)}
            placeholder={t.knowledgeMemoryDimensionPlaceholder}
            aria-label={t.knowledgeMemoryDimensionPlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
        </div>
        <div className="flex gap-2">
          <input
            value={memoryEntityId}
            onChange={(event) => setMemoryEntityId(event.target.value)}
            placeholder={t.knowledgeMemoryEntityPlaceholder}
            aria-label={t.knowledgeMemoryEntityPlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
          {currentFocusEntityId ? (
            <button
              type="button"
              onClick={() => setMemoryEntityId(currentFocusEntityId)}
              aria-label={`${t.knowledgeMemoryEntityPlaceholder}: ${currentFocusEntityId}`}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
            >
              {currentFocusEntityId}
            </button>
          ) : null}
          <input
            value={memoryTags}
            onChange={(event) => setMemoryTags(event.target.value)}
            placeholder={t.knowledgeMemoryTagsPlaceholder}
            aria-label={t.knowledgeMemoryTagsPlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
        </div>
        <button
          onClick={handleAddMemory}
          className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
          type="button"
        >
          {t.knowledgeMemoryAction}
        </button>
      </div>
    </div>
  )
}
