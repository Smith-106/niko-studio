import { useState, useCallback, useMemo } from 'react'
import { Zap, BookOpen, User, Plus, X, Check, Sliders } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ============================================================
// Types
// ============================================================

export interface PersonaWeights {
  plot: number // 0-1
  character: number // 0-1
  style: number // 0-1
  pacing: number // 0-1
}

export interface Persona {
  id: string
  name: string
  description: string
  icon: LucideIcon
  weights: PersonaWeights
  toleranceThreshold: number // 0-1
  focusAreas: string[]
  isPreset: boolean
}

export interface PersonaSelectorProps {
  selectedPersonaIds: string[]
  onSelectionChange: (ids: string[]) => void
  disabled?: boolean
}

// ============================================================
// Constants
// ============================================================

const PRESET_PERSONAS: Persona[] = [
  {
    id: 'suspense-enthusiast',
    name: '悬疑爱好者',
    description: '注重情节张力与伏笔，追求紧凑节奏',
    icon: Zap,
    weights: { plot: 0.9, character: 0.5, style: 0.4, pacing: 0.85 },
    toleranceThreshold: 0.3,
    focusAreas: ['伏笔', '悬念', '反转', '节奏'],
    isPreset: true,
  },
  {
    id: 'literary-critic',
    name: '文学评论家',
    description: '关注文笔风格与人物深度，偏好细腻描写',
    icon: BookOpen,
    weights: { plot: 0.5, character: 0.85, style: 0.9, pacing: 0.4 },
    toleranceThreshold: 0.5,
    focusAreas: ['文笔', '人物塑造', '隐喻', '叙事视角'],
    isPreset: true,
  },
  {
    id: 'general-reader',
    name: '普通读者',
    description: '追求平衡体验，关注故事整体流畅度',
    icon: User,
    weights: { plot: 0.7, character: 0.7, style: 0.6, pacing: 0.65 },
    toleranceThreshold: 0.6,
    focusAreas: ['故事性', '代入感', '可读性'],
    isPreset: true,
  },
]

const FOCUS_AREA_OPTIONS = [
  '伏笔',
  '悬念',
  '反转',
  '节奏',
  '文笔',
  '人物塑造',
  '隐喻',
  '叙事视角',
  '故事性',
  '代入感',
  '可读性',
  '情感共鸣',
  '世界观',
  '对话',
]

const WEIGHT_LABELS: Record<keyof PersonaWeights, string> = {
  plot: '情节',
  character: '人物',
  style: '风格',
  pacing: '节奏',
}

// ============================================================
// Sub-components
// ============================================================

function WeightSlider({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  disabled: boolean
}) {
  const pct = Math.round(value * 100)
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-dark-text-secondary">{label}</span>
        <span className="text-xs font-mono text-dark-text-muted">{pct}%</span>
      </div>
      <input
        type="range"
        min="0"
        max="1"
        step="0.05"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        disabled={disabled}
        className="w-full h-1.5 rounded-full appearance-none bg-dark-border
          [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full
          [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:border-2
          [&::-webkit-slider-thumb]:border-dark-bg [&::-webkit-slider-thumb]:cursor-pointer
          disabled:opacity-40 disabled:cursor-not-allowed"
      />
    </div>
  )
}

function PersonaCard({
  persona,
  isSelected,
  onToggle,
  disabled,
}: {
  persona: Persona
  isSelected: boolean
  onToggle: () => void
  disabled: boolean
}) {
  const Icon = persona.icon
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`
        w-full p-3 rounded-lg border text-left transition-all
        ${
          isSelected
            ? 'bg-blue-500/10 border-blue-500/60'
            : 'bg-dark-surface-sunken/20 border-dark-border hover:border-dark-text-muted'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
      aria-pressed={isSelected}
    >
      <div className="flex items-start gap-2.5">
        <div
          className={`
            shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
            ${isSelected ? 'bg-blue-500/20 text-blue-400' : 'bg-dark-border text-dark-text-muted'}
          `}
        >
          <Icon size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-dark-text">{persona.name}</span>
            {isSelected && <Check size={14} className="text-blue-400" />}
          </div>
          <p className="mt-0.5 text-xs text-dark-text-muted line-clamp-2">{persona.description}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {persona.focusAreas.slice(0, 3).map((area) => (
              <span
                key={area}
                className="px-1.5 py-0.5 text-[10px] rounded bg-dark-border text-dark-text-secondary"
              >
                {area}
              </span>
            ))}
          </div>
        </div>
      </div>
    </button>
  )
}

function CustomPersonaModal({
  isOpen,
  onClose,
  onSave,
}: {
  isOpen: boolean
  onClose: () => void
  onSave: (persona: Persona) => void
}) {
  const [name, setName] = useState('')
  const [weights, setWeights] = useState<PersonaWeights>({
    plot: 0.5,
    character: 0.5,
    style: 0.5,
    pacing: 0.5,
  })
  const [toleranceThreshold, setToleranceThreshold] = useState(0.5)
  const [focusAreas, setFocusAreas] = useState<string[]>([])

  const handleWeightChange = useCallback((key: keyof PersonaWeights, value: number) => {
    setWeights((prev) => ({ ...prev, [key]: value }))
  }, [])

  const toggleFocusArea = useCallback((area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    )
  }, [])

  const handleSave = useCallback(() => {
    if (!name.trim()) return
    const persona: Persona = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      description: `自定义读者画像：${focusAreas.slice(0, 3).join('、') || '综合评价'}`,
      icon: Sliders,
      weights,
      toleranceThreshold,
      focusAreas,
      isPreset: false,
    }
    onSave(persona)
    onClose()
    // Reset form
    setName('')
    setWeights({ plot: 0.5, character: 0.5, style: 0.5, pacing: 0.5 })
    setToleranceThreshold(0.5)
    setFocusAreas([])
  }, [name, weights, toleranceThreshold, focusAreas, onSave, onClose])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-dark-surface border border-dark-border rounded-lg shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-persona-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
          <h2 id="custom-persona-title" className="text-sm font-medium text-dark-text">
            创建自定义读者画像
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-dark-border text-dark-text-muted transition-colors"
            aria-label="关闭"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {/* Name */}
          <div>
            <label className="block text-xs text-dark-text-secondary mb-1">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入画像名称"
              className="w-full px-3 py-2 text-sm bg-dark-bg border border-dark-border rounded
                text-dark-text placeholder:text-dark-text-muted
                focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Weights */}
          <div>
            <label className="block text-xs text-dark-text-secondary mb-2">权重配置</label>
            <div className="space-y-3 p-3 bg-dark-bg rounded border border-dark-border">
              {(Object.keys(weights) as Array<keyof PersonaWeights>).map((key) => (
                <WeightSlider
                  key={key}
                  label={WEIGHT_LABELS[key]}
                  value={weights[key]}
                  onChange={(v) => handleWeightChange(key, v)}
                  disabled={false}
                />
              ))}
            </div>
          </div>

          {/* Tolerance Threshold */}
          <div>
            <label className="block text-xs text-dark-text-secondary mb-2">容错阈值</label>
            <div className="p-3 bg-dark-bg rounded border border-dark-border">
              <WeightSlider
                label="容忍度"
                value={toleranceThreshold}
                onChange={setToleranceThreshold}
                disabled={false}
              />
              <p className="mt-2 text-[10px] text-dark-text-muted">
                较高值表示对缺陷更宽容，较低值表示更严格
              </p>
            </div>
          </div>

          {/* Focus Areas */}
          <div>
            <label className="block text-xs text-dark-text-secondary mb-2">关注领域</label>
            <div className="flex flex-wrap gap-1.5 p-3 bg-dark-bg rounded border border-dark-border">
              {FOCUS_AREA_OPTIONS.map((area) => {
                const isSelected = focusAreas.includes(area)
                return (
                  <button
                    key={area}
                    onClick={() => toggleFocusArea(area)}
                    className={`
                      px-2 py-1 text-xs rounded transition-colors
                      ${
                        isSelected
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-dark-border text-dark-text-secondary hover:text-dark-text'
                      }
                    `}
                  >
                    {area}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-dark-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs rounded bg-dark-border text-dark-text-secondary
              hover:bg-dark-surface-sunken transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white
              hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// Main Component
// ============================================================

export function PersonaSelector({
  selectedPersonaIds,
  onSelectionChange,
  disabled = false,
}: PersonaSelectorProps) {
  const [customPersonas, setCustomPersonas] = useState<Persona[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)

  const allPersonas = useMemo(() => [...PRESET_PERSONAS, ...customPersonas], [customPersonas])

  const toggleSelection = useCallback(
    (id: string) => {
      if (disabled) return
      const isSelected = selectedPersonaIds.includes(id)
      if (isSelected && selectedPersonaIds.length <= 1) {
        // Minimum 1 selection required
        return
      }
      const newSelection = isSelected
        ? selectedPersonaIds.filter((pid) => pid !== id)
        : [...selectedPersonaIds, id]
      onSelectionChange(newSelection)
    },
    [selectedPersonaIds, onSelectionChange, disabled]
  )

  const handleSaveCustomPersona = useCallback((persona: Persona) => {
    setCustomPersonas((prev) => [...prev, persona])
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-dark-text-secondary">读者画像</span>
        <span className="text-[10px] text-dark-text-muted">
          已选 {selectedPersonaIds.length} 个
        </span>
      </div>

      {/* Preset personas */}
      <div className="grid grid-cols-1 gap-2">
        {allPersonas.map((persona) => (
          <PersonaCard
            key={persona.id}
            persona={persona}
            isSelected={selectedPersonaIds.includes(persona.id)}
            onToggle={() => toggleSelection(persona.id)}
            disabled={disabled}
          />
        ))}
      </div>

      {/* Add custom persona button */}
      <button
        onClick={() => setIsModalOpen(true)}
        disabled={disabled}
        className="w-full py-2 text-xs rounded-lg border border-dashed border-dark-border
          text-dark-text-muted hover:border-dark-text-secondary hover:text-dark-text-secondary
          disabled:opacity-40 disabled:cursor-not-allowed transition-colors
          flex items-center justify-center gap-1.5"
      >
        <Plus size={14} />
        <span>创建自定义画像</span>
      </button>

      {/* Custom persona modal */}
      <CustomPersonaModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveCustomPersona}
      />
    </div>
  )
}
