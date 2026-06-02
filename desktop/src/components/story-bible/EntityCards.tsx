import { useState, useCallback, useEffect, useRef } from 'react'
import {
  ChevronDown,
  Trash2,
  Check,
  X,
  PencilLine,
  User,
  Globe,
  GitBranch,
  Clock,
} from 'lucide-react'
import type {
  StoryBibleEntity,
  CharacterProfile,
  WorldRule,
  PlotThread,
  TimelineEvent,
} from '../../api/story-bible'

// ============================================================
// Types
// ============================================================

interface EditingField {
  entityId: string
  field: string
  value: string
}

interface CardCallbacks {
  onStartEdit: (entityId: string, field: string, value: string) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onDelete: (entityId: string) => void
}

interface CardProps extends CardCallbacks {
  entity: StoryBibleEntity
  editingField: EditingField | null
}

// ============================================================
// Helpers
// ============================================================

function completenessColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500'
  if (score >= 0.6) return 'bg-blue-500'
  if (score >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

function completenessTextColor(score: number): string {
  if (score >= 0.8) return 'text-green-400'
  if (score >= 0.6) return 'text-blue-400'
  if (score >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

function completenessBadgeColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/30'
  if (score >= 0.6) return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  if (score >= 0.3) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
  return 'bg-red-500/20 text-red-400 border-red-500/30'
}

/** Comma-separated string to array */
function splitToArray(value: string): string[] {
  return value.split(',').map(s => s.trim()).filter(Boolean)
}

/** Array to comma-separated string */
function joinFromArray(arr: string[]): string {
  return arr.join(', ')
}

// ============================================================
// Shared sub-components
// ============================================================

function CompletenessBadge({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${completenessColor(score)}`}
          style={{ width: `${Math.round(score * 100)}%` }}
        />
      </div>
      <span className={`text-[10px] font-mono ${completenessTextColor(score)}`}>
        {Math.round(score * 100)}%
      </span>
    </div>
  )
}

function CompletenessScoreBadge({ score }: { score: number }) {
  return (
    <span
      className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${completenessBadgeColor(score)}`}
    >
      {Math.round(score * 100)}%
    </span>
  )
}

function TypeBadge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {label}
    </span>
  )
}

function InlineEditField({
  label,
  value,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSave,
  onCancel,
}: {
  label: string
  value: string
  isEditing: boolean
  editValue: string
  onEditValueChange: (v: string) => void
  onStartEdit: () => void
  onSave: () => void
  onCancel: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  if (isEditing) {
    return (
      <div className="text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <div className="mt-0.5 flex gap-1">
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={e => onEditValueChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') onSave()
              if (e.key === 'Escape') onCancel()
            }}
            className="flex-1 bg-zinc-900 border border-zinc-600 rounded px-1.5 py-0.5 text-zinc-200 text-[10px] outline-none focus:border-blue-500"
          />
          <button
            type="button"
            onClick={onSave}
            className="p-0.5 rounded bg-blue-600/80 text-white hover:bg-blue-600"
          >
            <Check size={10} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="p-0.5 rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
          >
            <X size={10} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="text-[10px]">
      <span className="text-zinc-500">{label}</span>
      <div
        role="button"
        tabIndex={0}
        onClick={onStartEdit}
        onKeyDown={e => { if (e.key === 'Enter') onStartEdit() }}
        className="mt-0.5 text-zinc-300 cursor-text hover:bg-zinc-700/50 rounded px-1 py-0.5 -mx-1 transition-colors flex items-center gap-1 group"
      >
        {value || <span className="text-zinc-600 italic">点击编辑...</span>}
        <PencilLine size={8} className="text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
      </div>
    </div>
  )
}

function DeleteButton({ onDelete }: { onDelete: () => void }) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (confirmDelete) {
      timerRef.current = setTimeout(() => setConfirmDelete(false), 3000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [confirmDelete])

  const handleClick = useCallback(() => {
    if (confirmDelete) {
      onDelete()
      setConfirmDelete(false)
    } else {
      setConfirmDelete(true)
    }
  }, [confirmDelete, onDelete])

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`text-[10px] px-1.5 py-0.5 rounded transition-colors flex items-center gap-1 ${
        confirmDelete
          ? 'bg-red-600 text-white hover:bg-red-500'
          : 'text-zinc-500 hover:text-red-400 hover:bg-zinc-700/50'
      }`}
    >
      <Trash2 size={9} />
      {confirmDelete ? '确认删除' : '删除'}
    </button>
  )
}

function SourceBadge({ source }: { source: StoryBibleEntity['source'] }) {
  const label = source === 'auto-extract' ? '自动提取' : source === 'hybrid' ? '混合' : '手动'
  const color = source === 'auto-extract'
    ? 'bg-purple-500/20 text-purple-400'
    : source === 'hybrid'
      ? 'bg-cyan-500/20 text-cyan-400'
      : 'bg-zinc-600/50 text-zinc-400'
  return <span className={`text-[9px] px-1.5 py-0.5 rounded ${color}`}>{label}</span>
}

// ============================================================
// Card shell — shared collapsible container
// ============================================================

function CardShell({
  entity,
  icon,
  badge,
  children,
}: {
  entity: StoryBibleEntity
  icon: React.ReactNode
  badge: React.ReactNode
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors"
      >
        <span className="text-zinc-500 flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-zinc-200 truncate">{entity.name}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {badge}
          </div>
        </div>
        <CompletenessScoreBadge score={entity.completenessScore} />
        <ChevronDown
          size={14}
          className={`text-zinc-500 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-zinc-700 px-3 py-2 space-y-1.5">
          {children}
        </div>
      )}
    </div>
  )
}

// ============================================================
// CharacterCard
// ============================================================

export function CharacterCard({ entity, editingField, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: CardProps) {
  const char = entity as CharacterProfile
  const [editValue, setEditValue] = useState('')

  const isFieldEditing = useCallback(
    (field: string) => editingField?.entityId === char.id && editingField?.field === field,
    [editingField, char.id],
  )

  const handleStartEdit = useCallback((field: string, value: string) => {
    setEditValue(value)
    onStartEdit(char.id, field, value)
  }, [char.id, onStartEdit])

  const handleSave = useCallback(() => {
    if (editingField && editValue !== editingField.value) {
      onSaveEdit()
    } else {
      onCancelEdit()
    }
  }, [editValue, editingField, onCancelEdit, onSaveEdit])

  const fields = [
    { label: '原型', field: 'archetype', value: char.archetype || '' },
    { label: '背景', field: 'backstory', value: char.backstory || '' },
    { label: '动机', field: 'motivations', value: joinFromArray(char.motivations || []) },
    { label: '语言风格', field: 'speechPatterns', value: joinFromArray(char.speechPatterns || []) },
    { label: '成长阶段', field: 'arcStage', value: char.arcStage || '' },
  ]

  return (
    <CardShell
      entity={char}
      icon={<User size={12} />}
      badge={
        <>
          <TypeBadge label={char.archetype || '未设定原型'} colorClass="bg-amber-500/20 text-amber-400" />
          {(char.traits?.length ?? 0) > 0 && (
            <TypeBadge label={`${char.traits.length} 特质`} colorClass="bg-zinc-600/50 text-zinc-400" />
          )}
        </>
      }
    >
      {fields.map(({ label, field, value }) => (
        <InlineEditField
          key={field}
          label={label}
          value={value}
          isEditing={isFieldEditing(field)}
          editValue={editValue}
          onEditValueChange={setEditValue}
          onStartEdit={() => handleStartEdit(field, value)}
          onSave={handleSave}
          onCancel={onCancelEdit}
        />
      ))}

      {/* Relationships summary */}
      {(char.relationships?.length ?? 0) > 0 && (
        <div className="text-[10px] pt-1 border-t border-zinc-700/50">
          <span className="text-zinc-500">关系 ({char.relationships.length})</span>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {char.relationships.map((rel, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-700/50 text-zinc-400">
                {rel.type}: {rel.description}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-zinc-700/50 flex items-center justify-between">
        <SourceBadge source={char.source} />
        <DeleteButton onDelete={() => onDelete(char.id)} />
      </div>
    </CardShell>
  )
}

// ============================================================
// WorldRuleCard
// ============================================================

export function WorldRuleCard({ entity, editingField, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: CardProps) {
  const rule = entity as WorldRule
  const [editValue, setEditValue] = useState('')

  const isFieldEditing = useCallback(
    (field: string) => editingField?.entityId === rule.id && editingField?.field === field,
    [editingField, rule.id],
  )

  const handleStartEdit = useCallback((field: string, value: string) => {
    setEditValue(value)
    onStartEdit(rule.id, field, value)
  }, [rule.id, onStartEdit])

  const handleSave = useCallback(() => {
    if (editingField && editValue !== editingField.value) {
      onSaveEdit()
    } else {
      onCancelEdit()
    }
  }, [editValue, editingField, onCancelEdit, onSaveEdit])

  const fields = [
    { label: '分类', field: 'category', value: rule.category || '' },
    { label: '描述', field: 'description', value: rule.description || '' },
    { label: '约束', field: 'constraints', value: joinFromArray(rule.constraints || []) },
    { label: '例外', field: 'exceptions', value: joinFromArray(rule.exceptions || []) },
    { label: '影响范围', field: 'impactScope', value: rule.impactScope || '' },
  ]

  return (
    <CardShell
      entity={rule}
      icon={<Globe size={12} />}
      badge={
        <TypeBadge label={rule.category || '未分类'} colorClass="bg-teal-500/20 text-teal-400" />
      }
    >
      {fields.map(({ label, field, value }) => (
        <InlineEditField
          key={field}
          label={label}
          value={value}
          isEditing={isFieldEditing(field)}
          editValue={editValue}
          onEditValueChange={setEditValue}
          onStartEdit={() => handleStartEdit(field, value)}
          onSave={handleSave}
          onCancel={onCancelEdit}
        />
      ))}

      {/* Constraints & exceptions summary */}
      {(rule.constraints?.length ?? 0) > 0 && (
        <div className="text-[10px] pt-1 border-t border-zinc-700/50">
          <span className="text-zinc-500">约束 ({rule.constraints.length})</span>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {rule.constraints.map((c, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                {c}
              </span>
            ))}
          </div>
        </div>
      )}
      {(rule.exceptions?.length ?? 0) > 0 && (
        <div className="text-[10px]">
          <span className="text-zinc-500">例外 ({rule.exceptions.length})</span>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {rule.exceptions.map((e, i) => (
              <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-zinc-700/50 flex items-center justify-between">
        <SourceBadge source={rule.source} />
        <DeleteButton onDelete={() => onDelete(rule.id)} />
      </div>
    </CardShell>
  )
}

// ============================================================
// PlotThreadCard
// ============================================================

function plotStatusColor(status: string): string {
  switch (status) {
    case 'active': return 'bg-green-500/20 text-green-400'
    case 'resolved': return 'bg-blue-500/20 text-blue-400'
    case 'abandoned': return 'bg-zinc-500/20 text-zinc-400'
    case 'planned': return 'bg-purple-500/20 text-purple-400'
    default: return 'bg-yellow-500/20 text-yellow-400'
  }
}

export function PlotThreadCard({ entity, editingField, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: CardProps) {
  const plot = entity as PlotThread
  const [editValue, setEditValue] = useState('')

  const isFieldEditing = useCallback(
    (field: string) => editingField?.entityId === plot.id && editingField?.field === field,
    [editingField, plot.id],
  )

  const handleStartEdit = useCallback((field: string, value: string) => {
    setEditValue(value)
    onStartEdit(plot.id, field, value)
  }, [plot.id, onStartEdit])

  const handleSave = useCallback(() => {
    if (editingField && editValue !== editingField.value) {
      onSaveEdit()
    } else {
      onCancelEdit()
    }
  }, [editValue, editingField, onCancelEdit, onSaveEdit])

  const fields = [
    { label: '状态', field: 'status', value: plot.status || '' },
    { label: '前提', field: 'premise', value: plot.premise || '' },
    { label: '目标', field: 'goal', value: plot.goal || '' },
    { label: '赌注', field: 'stakes', value: plot.stakes || '' },
    { label: '结局', field: 'resolution', value: plot.resolution || '' },
  ]

  return (
    <CardShell
      entity={plot}
      icon={<GitBranch size={12} />}
      badge={
        <TypeBadge label={plot.status || '未知状态'} colorClass={plotStatusColor(plot.status)} />
      }
    >
      {fields.map(({ label, field, value }) => (
        <InlineEditField
          key={field}
          label={label}
          value={value}
          isEditing={isFieldEditing(field)}
          editValue={editValue}
          onEditValueChange={setEditValue}
          onStartEdit={() => handleStartEdit(field, value)}
          onSave={handleSave}
          onCancel={onCancelEdit}
        />
      ))}

      {/* Stakes highlight */}
      {plot.stakes && (
        <div className="text-[10px] pt-1 border-t border-zinc-700/50">
          <span className="text-zinc-500">赌注</span>
          <div className="mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">
            {plot.stakes}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-zinc-700/50 flex items-center justify-between">
        <SourceBadge source={plot.source} />
        <DeleteButton onDelete={() => onDelete(plot.id)} />
      </div>
    </CardShell>
  )
}

// ============================================================
// TimelineEventCard
// ============================================================

function eventTypeColor(eventType: string): string {
  switch (eventType) {
    case 'conflict': return 'bg-red-500/20 text-red-400'
    case 'revelation': return 'bg-purple-500/20 text-purple-400'
    case 'turning-point': return 'bg-orange-500/20 text-orange-400'
    case 'climax': return 'bg-yellow-500/20 text-yellow-400'
    case 'resolution': return 'bg-green-500/20 text-green-400'
    default: return 'bg-cyan-500/20 text-cyan-400'
  }
}

export function TimelineEventCard({ entity, editingField, onStartEdit, onCancelEdit, onSaveEdit, onDelete }: CardProps) {
  const event = entity as TimelineEvent
  const [editValue, setEditValue] = useState('')

  const isFieldEditing = useCallback(
    (field: string) => editingField?.entityId === event.id && editingField?.field === field,
    [editingField, event.id],
  )

  const handleStartEdit = useCallback((field: string, value: string) => {
    setEditValue(value)
    onStartEdit(event.id, field, value)
  }, [event.id, onStartEdit])

  const handleSave = useCallback(() => {
    if (editingField && editValue !== editingField.value) {
      onSaveEdit()
    } else {
      onCancelEdit()
    }
  }, [editValue, editingField, onCancelEdit, onSaveEdit])

  const fields = [
    { label: '事件类型', field: 'eventType', value: event.eventType || '' },
    { label: '时间戳', field: 'timestamp', value: event.timestamp || '' },
    { label: '章节', field: 'chapterRef', value: event.chapterRef || '' },
    { label: '描述', field: 'description', value: event.description || '' },
    { label: '情感影响', field: 'emotionalImpact', value: event.emotionalImpact || '' },
  ]

  return (
    <CardShell
      entity={event}
      icon={<Clock size={12} />}
      badge={
        <>
          <TypeBadge label={event.eventType || '未分类'} colorClass={eventTypeColor(event.eventType)} />
          {event.timestamp && (
            <span className="text-[9px] text-zinc-500 font-mono">{event.timestamp}</span>
          )}
        </>
      }
    >
      {fields.map(({ label, field, value }) => (
        <InlineEditField
          key={field}
          label={label}
          value={value}
          isEditing={isFieldEditing(field)}
          editValue={editValue}
          onEditValueChange={setEditValue}
          onStartEdit={() => handleStartEdit(field, value)}
          onSave={handleSave}
          onCancel={onCancelEdit}
        />
      ))}

      {/* Emotional impact highlight */}
      {event.emotionalImpact && (
        <div className="text-[10px] pt-1 border-t border-zinc-700/50">
          <span className="text-zinc-500">情感影响</span>
          <div className="mt-0.5 text-[9px] px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            {event.emotionalImpact}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="pt-1.5 border-t border-zinc-700/50 flex items-center justify-between">
        <SourceBadge source={event.source} />
        <DeleteButton onDelete={() => onDelete(event.id)} />
      </div>
    </CardShell>
  )
}

// ============================================================
// Type-aware card dispatcher
// ============================================================

export function EntityCardDispatcher(props: CardProps) {
  switch (props.entity.type) {
    case 'character': return <CharacterCard {...props} />
    case 'world-rule': return <WorldRuleCard {...props} />
    case 'plot-thread': return <PlotThreadCard {...props} />
    case 'timeline-event': return <TimelineEventCard {...props} />
  }
}

// Re-export for convenience
export { CompletenessBadge, completenessColor, completenessTextColor, splitToArray, joinFromArray }
