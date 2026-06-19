import { useState, useCallback, useEffect } from 'react'
import {
  sbGetEntities,
  sbCreateEntity,
  sbUpdateEntity,
  sbDeleteEntity,
  sbGetCompleteness,
  type StoryBibleEntity,
  type SbEntityType,
  type CompletenessReport,
  type ExtractionResult,
} from '../../api/story-bible'
import {
  CompletenessIndicator,
  completenessColor,
} from './CompletenessIndicator'
import { AutoExtractButton } from './AutoExtractButton'

// ============================================================
// Types
// ============================================================

type EntityTab = 'character' | 'world-rule' | 'plot-thread' | 'timeline-event'

interface TabConfig {
  key: EntityTab
  label: string
  subLabel: string
}

interface EditingField {
  entityId: string
  field: string
  value: string
}

// ============================================================
// Constants
// ============================================================

const TABS: readonly TabConfig[] = [
  { key: 'character', label: 'Characters', subLabel: '角色' },
  { key: 'world-rule', label: 'World', subLabel: '世界观' },
  { key: 'plot-thread', label: 'Plots', subLabel: '情节' },
  { key: 'timeline-event', label: 'Timeline', subLabel: '时间线' },
] as const

const ENTITY_TYPE_LABELS: Record<SbEntityType, string> = {
  character: '角色',
  'world-rule': '世界观',
  'plot-thread': '情节',
  'timeline-event': '时间线',
}

const ADD_ENTITY_TYPES: SbEntityType[] = ['character', 'world-rule', 'plot-thread', 'timeline-event']

// ============================================================
// Helpers
// ============================================================

function getEntitySubLabel(entity: StoryBibleEntity): string {
  switch (entity.type) {
    case 'character':
      return entity.archetype || '未设定原型'
    case 'world-rule':
      return entity.category || '未分类'
    case 'plot-thread':
      return entity.status || '未知状态'
    case 'timeline-event':
      return entity.eventType || '未分类'
  }
}

/** Editable fields per entity type — key is display label, value is the field path on the entity */
function getEditableFields(entity: StoryBibleEntity): Array<{ label: string; field: string; value: string }> {
  switch (entity.type) {
    case 'character':
      return [
        { label: '原型', field: 'archetype', value: entity.archetype || '' },
        { label: '背景', field: 'backstory', value: entity.backstory || '' },
        { label: '动机', field: 'motivations', value: (entity.motivations || []).join(', ') },
        { label: '语言风格', field: 'speechPatterns', value: (entity.speechPatterns || []).join(', ') },
        { label: '成长阶段', field: 'arcStage', value: entity.arcStage || '' },
      ]
    case 'world-rule':
      return [
        { label: '分类', field: 'category', value: entity.category || '' },
        { label: '描述', field: 'description', value: entity.description || '' },
        { label: '约束', field: 'constraints', value: (entity.constraints || []).join(', ') },
        { label: '例外', field: 'exceptions', value: (entity.exceptions || []).join(', ') },
        { label: '影响范围', field: 'impactScope', value: entity.impactScope || '' },
      ]
    case 'plot-thread':
      return [
        { label: '状态', field: 'status', value: entity.status || '' },
        { label: '前提', field: 'premise', value: entity.premise || '' },
        { label: '目标', field: 'goal', value: entity.goal || '' },
        { label: '赌注', field: 'stakes', value: entity.stakes || '' },
        { label: '结局', field: 'resolution', value: entity.resolution || '' },
      ]
    case 'timeline-event':
      return [
        { label: '事件类型', field: 'eventType', value: entity.eventType || '' },
        { label: '时间戳', field: 'timestamp', value: entity.timestamp || '' },
        { label: '章节', field: 'chapterRef', value: entity.chapterRef || '' },
        { label: '描述', field: 'description', value: entity.description || '' },
        { label: '情感影响', field: 'emotionalImpact', value: entity.emotionalImpact || '' },
      ]
  }
}

function getDefaultEntityName(type: SbEntityType): string {
  switch (type) {
    case 'character': return '新角色'
    case 'world-rule': return '新世界规则'
    case 'plot-thread': return '新情节线'
    case 'timeline-event': return '新时间线事件'
  }
}

// ============================================================
// Sub-components
// ============================================================

function EntityCard({
  entity,
  editingField,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
}: {
  entity: StoryBibleEntity
  editingField: EditingField | null
  onStartEdit: (entityId: string, field: string, value: string) => void
  onCancelEdit: () => void
  onSaveEdit: (value: string) => void
  onDelete: (entityId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editValue, setEditValue] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const fields = getEditableFields(entity)
  const isEditing = editingField?.entityId === entity.id

  const handleStartEdit = useCallback((field: string, value: string) => {
    setEditValue(value)
    onStartEdit(entity.id, field, value)
  }, [entity.id, onStartEdit])

  const handleSave = useCallback(() => {
    if (editingField && editValue !== editingField.value) {
      onSaveEdit(editValue)
    } else {
      onCancelEdit()
    }
  }, [editValue, editingField, onCancelEdit, onSaveEdit])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
    if (e.key === 'Escape') onCancelEdit()
  }, [handleSave, onCancelEdit])

  const handleDeleteClick = useCallback(() => {
    if (confirmDelete) {
      onDelete(entity.id)
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
      setTimeout(() => setConfirmDelete(false), 3000)
    }
  }, [confirmDelete, entity.id, onDelete])

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 overflow-hidden">
      {/* Card header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors"
      >
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${completenessColor(entity.completenessScore)}`} />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200 truncate">{entity.name}</div>
          <div className="text-[10px] text-zinc-500 truncate">{getEntitySubLabel(entity)}</div>
        </div>
        <CompletenessIndicator score={entity.completenessScore} size="md" showLabel />
        <svg
          className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-zinc-700 px-3 py-2 space-y-1.5">
          {fields.map(({ label, field, value }) => {
            const isFieldEditing = isEditing && editingField?.field === field
            return (
              <div key={field} className="text-[10px]">
                <span className="text-zinc-500">{label}</span>
                {isFieldEditing ? (
                  <div className="mt-0.5 flex gap-1">
                    <input
                      type="text"
                      value={editValue}
                      onChange={e => setEditValue(e.target.value)}
                      onKeyDown={handleKeyDown}
                      onBlur={handleSave}
                      autoFocus
                      className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-1.5 py-0.5 text-zinc-200 text-[10px] outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-1.5 py-0.5 rounded bg-blue-600/80 text-white hover:bg-blue-600 text-[10px]"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleStartEdit(field, value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleStartEdit(field, value) }}
                    className="mt-0.5 text-zinc-300 cursor-text hover:bg-zinc-700/50 rounded px-1 py-0.5 -mx-1 transition-colors"
                  >
                    {value || <span className="text-zinc-600 italic">点击编辑...</span>}
                  </div>
                )}
              </div>
            )
          })}

          {/* Source badge */}
          <div className="pt-1.5 border-t border-zinc-700/50 flex items-center justify-between">
            <span className="text-[9px] text-zinc-600">
              {entity.source === 'auto-extract' ? '自动提取' : entity.source === 'hybrid' ? '混合' : '手动'}
            </span>
            <button
              type="button"
              onClick={handleDeleteClick}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                confirmDelete
                  ? 'bg-red-600 text-white hover:bg-red-500'
                  : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-700/50'
              }`}
            >
              {confirmDelete ? '确认删除' : '删除'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main component
// ============================================================

interface Props {
  novelId: string
}

export function StoryBiblePanel({ novelId }: Props) {
  const [activeTab, setActiveTab] = useState<EntityTab>('character')
  const [entities, setEntities] = useState<StoryBibleEntity[]>([])
  const [completeness, setCompleteness] = useState<CompletenessReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingField, setEditingField] = useState<EditingField | null>(null)
  const [showAddDropdown, setShowAddDropdown] = useState(false)
  const [addingEntity, setAddingEntity] = useState(false)

  // Load entities for the active tab
  const loadEntities = useCallback(async () => {
    setLoading(true)
    try {
      const response = await sbGetEntities(novelId, activeTab)
      if (response.success && response.data) {
        setEntities(response.data.entities)
      } else {
        setEntities([])
      }
    } catch {
      setEntities([])
    } finally {
      setLoading(false)
    }
  }, [novelId, activeTab])

  // Load completeness report
  const loadCompleteness = useCallback(async () => {
    try {
      const response = await sbGetCompleteness(novelId)
      if (response.success && response.data) {
        setCompleteness(response.data)
      }
    } catch {
      // Silently fail — completeness is supplementary
    }
  }, [novelId])

  // Initial load + tab change
  useEffect(() => {
    void loadEntities()
  }, [loadEntities])

  useEffect(() => {
    void loadCompleteness()
  }, [loadCompleteness])

  // Auto-extract completion handler
  const handleExtractionComplete = useCallback(async (_result: ExtractionResult) => {
    await Promise.all([loadEntities(), loadCompleteness()])
  }, [loadEntities, loadCompleteness])

  // Inline edit save
  const handleSaveEdit = useCallback(async (nextValue: string) => {
    if (!editingField) return
    const { entityId, field } = editingField

    // Parse array fields (comma-separated strings back to arrays)
    const arrayFields = new Set([
      'motivations', 'speechPatterns', 'constraints', 'exceptions',
      'traits', 'relationships', 'involvedCharacters', 'keyEvents',
      'foreshadowingRefs', 'participants', 'consequences', 'plotThreadRefs',
    ])

    const updates: Record<string, unknown> = {
      [field]: arrayFields.has(field)
        ? nextValue.split(',').map(s => s.trim()).filter(Boolean)
        : nextValue,
    }

    try {
      await sbUpdateEntity(entityId, updates)
      setEditingField(null)
      await loadEntities()
      await loadCompleteness()
    } catch {
      // Keep editing state on failure so user can retry
    }
  }, [editingField, loadEntities, loadCompleteness])

  // Delete entity
  const handleDelete = useCallback(async (entityId: string) => {
    try {
      await sbDeleteEntity(entityId)
      await Promise.all([loadEntities(), loadCompleteness()])
    } catch {
      // Silently fail — list stays consistent
    }
  }, [loadEntities, loadCompleteness])

  // Add entity
  const handleAddEntity = useCallback(async (type: SbEntityType) => {
    setShowAddDropdown(false)
    setAddingEntity(true)
    try {
      await sbCreateEntity({
        novelId,
        name: getDefaultEntityName(type),
        type,
      })
      // Switch to the new entity's tab
      setActiveTab(type)
      await loadCompleteness()
    } catch {
      // Silently fail
    } finally {
      setAddingEntity(false)
    }
  }, [novelId, loadCompleteness])

  // Overall completeness display
  const overallScore = completeness?.overallScore ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-zinc-300">Story Bible</h3>
          <CompletenessIndicator score={overallScore} size="md" showLabel />
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex-1">
            <AutoExtractButton
              novelId={novelId}
              onExtractionComplete={handleExtractionComplete}
            />
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddDropdown(v => !v)}
              disabled={addingEntity}
              className="text-[10px] py-1 px-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 transition-colors"
            >
              + Add
            </button>
            {showAddDropdown && (
              <div className="absolute right-0 top-full mt-1 z-10 bg-zinc-800 border border-zinc-600 rounded shadow-lg py-1 min-w-[120px]">
                {ADD_ENTITY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleAddEntity(type)}
                    className="w-full text-left text-[10px] px-3 py-1.5 text-zinc-300 hover:bg-zinc-700 transition-colors"
                  >
                    {ENTITY_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800">
        {TABS.map(tab => {
          const count = completeness?.byType[tab.key]?.count
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-1.5 text-[10px] transition-colors ${
                activeTab === tab.key
                  ? 'text-zinc-200 border-b-2 border-blue-500'
                  : 'text-zinc-600 hover:text-zinc-400'
              }`}
            >
              <div>{tab.label}</div>
              {count !== undefined && (
                <div className="text-[9px] text-zinc-500">{count}</div>
              )}
            </button>
          )
        })}
      </div>

      {/* Entity list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {loading ? (
          <div className="text-xs text-zinc-600 text-center py-4">加载中...</div>
        ) : entities.length === 0 ? (
          <div className="text-xs text-zinc-600 text-center py-4">
            暂无{ENTITY_TYPE_LABELS[activeTab]}实体
            <br />
            <span className="text-[10px]">点击 Auto-Extract 或 + Add 创建</span>
          </div>
        ) : (
          entities.map(entity => (
            <EntityCard
              key={entity.id}
              entity={entity}
              editingField={editingField}
              onStartEdit={(entityId, field, value) => setEditingField({ entityId, field, value })}
              onCancelEdit={() => setEditingField(null)}
              onSaveEdit={handleSaveEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Footer — missing suggestions */}
      {completeness && completeness.missing.length > 0 && (
        <div className="px-3 py-2 border-t border-zinc-800 space-y-1">
          <span className="text-[9px] font-semibold text-zinc-500">建议补充</span>
          {completeness.missing.slice(0, 3).map((item, i) => (
            <p key={i} className="text-[9px] text-zinc-500">
              [{ENTITY_TYPE_LABELS[item.type]}] {item.suggestion}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
