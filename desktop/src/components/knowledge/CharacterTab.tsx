import { useState } from 'react'
import { User } from 'lucide-react'

import { useI18n } from '../../i18n'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import type { FieldConfig } from './KnowledgeTypes'
import { PersistedEntityTab } from './PersistedEntityTab'
import {
  analyzeCharacterDepth,
  getCharacterProfile,
  getCharacterRelationships,
  type CharacterDepthAssessment,
  type CharacterProfile,
  type CharacterRelationshipNetwork,
} from '../../api/knowledge'

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
  const { onStatusChange } = props

  const [profileName, setProfileName] = useState('')
  const [profile, setProfile] = useState<CharacterProfile | null>(null)
  const [depth, setDepth] = useState<CharacterDepthAssessment | null>(null)
  const [relationships, setRelationships] = useState<CharacterRelationshipNetwork | null>(null)

  const handleLoadProfile = async () => {
    const name = profileName.trim()
    if (!name) return
    const response = await getCharacterProfile(name)
    if (response.success && response.data) {
      setProfile(response.data)
      onStatusChange({ type: 'success', message: t.knowledgeProfileTitle })
    } else {
      setProfile(null)
      onStatusChange({ type: 'error', message: t.knowledgeProfileNotFound })
    }
  }

  const handleAnalyzeDepth = async () => {
    if (!profile) return
    const response = await analyzeCharacterDepth(profile.id)
    if (response.success && response.data) {
      setDepth(response.data)
      onStatusChange({ type: 'success', message: t.knowledgeDepthTitle })
    } else {
      onStatusChange({ type: 'error', message: t.knowledgeProfileNotFound })
    }
  }

  const handleLoadRelationships = async () => {
    const response = await getCharacterRelationships()
    if (response.success && response.data) {
      setRelationships(response.data)
      onStatusChange({ type: 'success', message: t.knowledgeRelationshipsTitle })
    }
  }

  return (
    <div className="space-y-3">
      <PersistedEntityTab
        {...props}
        entityType="Character"
        itemKind="character"
        itemLabel={t.knowledgeTabCharacters}
        itemIcon={User}
        extraFields={CHARACTER_FIELDS}
      />

      <div className="border-t border-gray-200 dark:border-dark-border pt-3">
        <div className="text-xs font-medium text-gray-600 dark:text-dark-text-secondary mb-2">
          {t.knowledgeProfileTitle}
        </div>
        <div className="flex gap-2 mb-2">
          <input
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder={t.knowledgeCharacterNamePlaceholder}
            aria-label={t.knowledgeCharacterNamePlaceholder}
            className="flex-1 px-2 py-1 text-xs border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
          <button
            onClick={handleLoadProfile}
            className="px-2 py-1 text-xs bg-blue-600 text-white rounded"
            type="button"
          >
            {t.knowledgeProfileLoad}
          </button>
        </div>

        {profile && (
          <div className="space-y-2">
            <div className="p-2 border border-gray-200 dark:border-dark-border rounded text-xs">
              <div className="font-medium">{profile.name} ({profile.role})</div>
              <div className="text-gray-500 dark:text-dark-text-secondary mt-1">
                {t.knowledgeDepthLevel}: {String(profile.five_dimension_score?.depth_level ?? '—')}
                {' | '}
                {t.knowledgeDepthScores}: {String(Math.round(Number(profile.five_dimension_score?.overall ?? 0)))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleAnalyzeDepth}
                className="px-2 py-1 text-xs bg-purple-600 text-white rounded"
                type="button"
              >
                {t.knowledgeDepthAnalyze}
              </button>
              <button
                onClick={handleLoadRelationships}
                className="px-2 py-1 text-xs bg-teal-600 text-white rounded"
                type="button"
              >
                {t.knowledgeRelationshipsLoad}
              </button>
            </div>

            {depth && (
              <div className="p-2 border border-gray-200 dark:border-dark-border rounded text-xs space-y-1">
                <div className="font-medium">{t.knowledgeDepthScores}</div>
                <div className="grid grid-cols-5 gap-1 text-center">
                  {(['dynamicScore', 'competenceScore', 'eccentricityScore', 'contrastScore', 'dualityScore'] as const).map((key) => (
                    <div key={key} className="bg-gray-100 dark:bg-dark-border rounded p-1">
                      <div className="text-gray-500 dark:text-dark-text-secondary">{key.replace('Score', '')}</div>
                      <div className="font-medium">{Math.round(depth.scores[key] ?? 0)}</div>
                    </div>
                  ))}
                </div>
                <div className="text-gray-600 dark:text-dark-text-secondary">
                  {t.knowledgeDepthLevel}: {depth.depth_level}
                </div>
                {depth.suggestions.length > 0 && (
                  <div>
                    <div className="font-medium">{t.knowledgeDepthSuggestions}</div>
                    <ul className="list-disc list-inside text-gray-500 dark:text-dark-text-secondary">
                      {depth.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {relationships && (
              <div className="p-2 border border-gray-200 dark:border-dark-border rounded text-xs space-y-1">
                <div className="font-medium">{t.knowledgeRelationshipsTitle}</div>
                <div className="text-gray-500 dark:text-dark-text-secondary">
                  {relationships.nodes.length} nodes, {relationships.edges.length} edges
                </div>
                {relationships.edges.length > 0 && (
                  <div className="space-y-0.5">
                    {relationships.edges.map((edge, i) => {
                      const source = relationships.nodes.find((n) => n.id === edge.source)
                      const target = relationships.nodes.find((n) => n.id === edge.target)
                      return (
                        <div key={i} className="text-gray-500 dark:text-dark-text-secondary">
                          {source?.name ?? edge.source} → {target?.name ?? edge.target} ({edge.type})
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
