import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Folder, Plus, Trash2, Save, Pencil } from 'lucide-react'
import { listSkills, loadSkill, matchSkills, getSkillChain, createSkill, saveSkill, deleteSkill } from '../../api/client'
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
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const loadSkillsList = useCallback(async () => {
    onLoadingChange(true)
    try {
      const skillsResult = await listSkills()
      if (skillsResult?.success && Array.isArray(skillsResult.data)) {
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
    if (response?.success && response.data?.content) {
      setSkillDetails(response.data.content)
    } else {
      setSkillDetails(t.knowledgeSkillDetailsLoadFailed)
    }
  }

  const handleEdit = async () => {
    if (!selectedSkillId) return
    if (!isEditing) {
      const response = await loadSkill(selectedSkillId)
      if (response?.success && response.data?.content) {
        setSkillDetails(response.data.content)
        setEditContent(response.data.content)
      } else {
        setSkillDetails(t.knowledgeSkillDetailsLoadFailed)
        setEditContent('')
      }
      setIsEditing(true)
    } else {
      const response = await saveSkill(selectedSkillId, editContent)
      if (response?.success) {
        setSkillDetails(editContent)
        setIsEditing(false)
      }
    }
  }

  const handleCreate = async () => {
    if (!isCreating) {
      setIsCreating(true)
      setNewName('')
      return
    }
    if (!newName.trim()) return
    const template = `# ${newName}\n\nDescription: \n\n## Instructions\n\n`
    const response = await createSkill(newName, template)
    if (response?.success) {
      setIsCreating(false)
      setNewName('')
      await loadSkillsList()
      onSelectedSkillIdChange(response.data?.id ?? newName)
    }
  }

  const handleDelete = async () => {
    if (!selectedSkillId) return
    if (confirmDelete !== selectedSkillId) {
      setConfirmDelete(selectedSkillId)
      return
    }
    const response = await deleteSkill(selectedSkillId)
    if (response?.success) {
      setConfirmDelete(null)
      setSkillDetails('')
      onSelectedSkillIdChange('')
      await loadSkillsList()
    }
  }

  const runSkillMatch = async () => {
    const keywords = searchQuery.trim() ? searchQuery.trim().split(/\s+/).slice(0, 5) : undefined
    const response = await matchSkills(undefined, keywords)
    if (response?.success && Array.isArray(response.data)) {
      setSkillMatches(response.data)
    } else {
      setSkillMatches([])
    }
  }

  const loadSkillChain = async () => {
    if (!selectedSkillId) return
    const response = await getSkillChain(selectedSkillId)
    if (response?.success && Array.isArray(response.data)) {
      setSkillChain(response.data)
    } else {
      setSkillChain([])
    }
  }

  const handleItemClick = (item: KnowledgeItem) => {
    onSelectedSkillIdChange((item.id as string) || (item.name as string) || '')
    setIsEditing(false)
    setConfirmDelete(null)
  }

  const filteredItems = items.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase())
  )

  const controls = (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button
        onClick={() => { handleCreate() }}
        className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
        aria-label="create skill"
        title="create skill"
        type="button"
      >
        <Plus size={12} className="inline mr-1" />
        {isCreating ? 'Create' : 'New'}
      </button>
      {isCreating && (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
          placeholder="Skill name..."
          className="px-2 py-1 text-xs border border-gray-300 dark:border-dark-border rounded bg-white dark:bg-dark-bg dark:text-dark-text"
          autoFocus
        />
      )}
      <button
        onClick={handleEdit}
        disabled={!selectedSkillId}
        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
        aria-label={isEditing ? 'save skill' : 'edit skill'}
        title={isEditing ? 'save skill' : 'edit skill'}
        type="button"
      >
        {isEditing ? <><Save size={12} className="inline mr-1" />Save</> : <><Pencil size={12} className="inline mr-1" />Edit</>}
      </button>
      <button
        onClick={handleDelete}
        disabled={!selectedSkillId}
        className={`px-3 py-1.5 text-xs rounded disabled:opacity-50 ${confirmDelete === selectedSkillId ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-dark-border dark:text-dark-text'}`}
        aria-label={confirmDelete === selectedSkillId ? 'confirm delete' : 'delete skill'}
        title={confirmDelete === selectedSkillId ? 'confirm delete' : 'delete skill'}
        type="button"
      >
        <Trash2 size={12} className="inline mr-1" />
        {confirmDelete === selectedSkillId ? 'Confirm?' : 'Delete'}
      </button>
      {confirmDelete && confirmDelete !== selectedSkillId && (
        <button onClick={() => setConfirmDelete(null)} className="text-xs text-gray-500 dark:text-dark-text-muted">
          Cancel
        </button>
      )}
      <button
        onClick={runSkillMatch}
        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
        aria-label={t.knowledgeTaskMatch}
        title={t.knowledgeTaskMatch}
        type="button"
      >
        {t.knowledgeTaskMatch}
      </button>
      <button
        onClick={loadSkillChain}
        disabled={!selectedSkillId}
        className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
        aria-label={t.knowledgeSkillChain}
        title={t.knowledgeSkillChain}
        type="button"
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
      {isEditing ? (
        <div className="p-3 border border-blue-300 dark:border-blue-700 rounded bg-gray-50 dark:bg-dark-bg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mb-1">Edit Skill</div>
          <textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-48 text-xs font-mono text-gray-600 dark:text-dark-text-secondary bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded p-2 resize-y"
          />
        </div>
      ) : (
        skillDetails && (
          <div className="p-3 border border-gray-200 dark:border-dark-border rounded bg-gray-50 dark:bg-dark-bg">
            <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mb-1">{t.knowledgeSkillDetails}</div>
            <pre className="text-xs text-gray-600 dark:text-dark-text-secondary whitespace-pre-wrap break-all">{skillDetails}</pre>
          </div>
        )
      )}
      {skillMatches.length > 0 && (
        <div className="p-3 border border-gray-200 dark:border-dark-border rounded bg-gray-50 dark:bg-dark-bg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mb-1">{t.knowledgeTaskMatch}</div>
          <div className="text-xs text-gray-600 dark:text-dark-text-secondary">
            {skillMatches.map((item) => `${item.skill_id} (${item.relevance})`).join('，')}
          </div>
        </div>
      )}
      {skillChain.length > 0 && (
        <div className="p-3 border border-gray-200 dark:border-dark-border rounded bg-gray-50 dark:bg-dark-bg">
          <div className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted mb-1">{t.knowledgeSkillChain}</div>
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
    return (
      <>
        {controls}
        {details}
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">
          {t.knowledgeLoading}
        </div>
      </>
    )
  }

  if (filteredItems.length === 0) {
    return (
      <>
        {controls}
        {details}
        <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">
          <Folder size={48} className="mb-2" />
          <p>{t.knowledgeEmpty}</p>
          <button
            className="mt-4 flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`${t.knowledgeAddPrefix}${t.knowledgeTabSkills}`}
            title={`${t.knowledgeAddPrefix}${t.knowledgeTabSkills}`}
            type="button"
            onClick={() => { setIsCreating(true) }}
          >
            <Plus size={16} />
            {t.knowledgeAddPrefix}
            {t.knowledgeTabSkills}
          </button>
        </div>
      </>
    )
  }

  return (
    <>
      {controls}
      {details}
      <div className="grid grid-cols-2 gap-4">
        {filteredItems.map((item, index) => (
          <div
            key={index}
            onClick={() => handleItemClick(item)}
            className={`p-4 border rounded-lg cursor-pointer transition-all ${selectedSkillId === ((item.id as string) || (item.name as string)) ? 'border-blue-500 shadow-md' : 'border-gray-200 dark:border-dark-border hover:border-blue-500 hover:shadow-md'}`}
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
    </>
  )
}
