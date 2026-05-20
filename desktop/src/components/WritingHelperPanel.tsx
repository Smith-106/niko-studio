import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, X } from 'lucide-react'
import { processWritingHelper, polishContent, type WritingHelperMode } from '../api/client'
import type { WritingHelperDraftState, WritingHelperEvaluationHandoff } from '../hooks/useAppUiPersistence'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n, type Translations } from '../i18n'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import { RevisionPreviewCard } from './RevisionPreviewCard'
import { getEditorHandle, type EditorSelectionSnapshot } from '../utils/editorHandle'
import { useAppStore } from '../stores/appStore'
import {
  applyRevisionCandidateToEditor,
  captureMatchedSelectionSnapshot,
  getRevisionCopy,
  insertRevisionAlternativeToEditor,
  undoLastRevisionApplyInEditor,
} from '../utils/revisionLoop'
import {
  type WritingStyle,
  type ToneOption,
  type PerspectiveOption,
  type SentenceStyleOption,
  type RhythmOption,
  loadStyle,
  saveStyle,
  buildStyleInstruction,
  addTag,
  removeTag,
} from './editor/WritingStyle'

interface WritingHelperPanelProps {
  onClose: () => void
  onOpenSettings: () => void
  draftState?: WritingHelperDraftState
  onDraftStateChange?: (draft: WritingHelperDraftState) => void
  onClearDraft?: () => void
}

interface WritingHelperResult {
  processedText?: string
  outline?: string[]
  mode?: string
  sourceText?: string
  selectionSnapshot?: EditorSelectionSnapshot | null
  skillsUsed?: string[]
}

type PresetFieldKey = 'mode' | 'maxSentences' | 'maxItems' | 'guidance'

interface PresetControlAssist {
  field: PresetFieldKey
  recommendedText: string
  changed: boolean
  restoreLabel: string
}

const GUIDANCE_PREVIEW_MAX_LINES = 2
const GUIDANCE_PREVIEW_MAX_CHARS = 120

function buildGuidancePreview(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }

  const lines = trimmed.split('\n')
  const previewBase = lines.slice(0, GUIDANCE_PREVIEW_MAX_LINES).join('\n').trim()
  const shortenedByLines = lines.length > GUIDANCE_PREVIEW_MAX_LINES
  const shortenedByChars = previewBase.length > GUIDANCE_PREVIEW_MAX_CHARS
  const clipped = shortenedByChars
    ? previewBase.slice(0, GUIDANCE_PREVIEW_MAX_CHARS).trimEnd()
    : previewBase

  return shortenedByLines || shortenedByChars ? `${clipped}…` : clipped
}

// ── Style types imported from WritingStyle module ────────────────
// WritingStyle, loadStyle, saveStyle are imported from './editor/WritingStyle'

// ── Label maps (localized in component via t) ──────────────────

const TONE_OPTIONS: ToneOption[] = ['warm', 'formal', 'casual', 'humorous', 'serious', 'melancholic']
const PERSPECTIVE_OPTIONS: PerspectiveOption[] = ['first', 'third', 'second', 'omniscient']
const SENTENCE_STYLE_OPTIONS: SentenceStyleOption[] = ['concise', 'flowing', 'varied', 'complex']
const RHYTHM_OPTIONS: RhythmOption[] = ['brisk', 'moderate', 'leisurely']

// i18n key suffixes mapped to option values
const toneLabelKey = (v: ToneOption): keyof Translations => `styleTone${v.charAt(0).toUpperCase() + v.slice(1)}` as keyof Translations
const perspectiveLabelKey = (v: PerspectiveOption): keyof Translations => `stylePerspective${v.charAt(0).toUpperCase() + v.slice(1)}` as keyof Translations
const sentenceStyleLabelKey = (v: SentenceStyleOption): keyof Translations => `styleSentence${v.charAt(0).toUpperCase() + v.slice(1)}` as keyof Translations
const rhythmLabelKey = (v: RhythmOption): keyof Translations => `styleRhythm${v.charAt(0).toUpperCase() + v.slice(1)}` as keyof Translations

// ── Constants ──────────────────────────────────────────────────

const MODE_OPTIONS: Array<{ value: WritingHelperMode; labelKey: keyof Translations }> = [
  { value: 'polish', labelKey: 'writingHelperModePolish' },
  { value: 'rewrite', labelKey: 'writingHelperModeRewrite' },
  { value: 'expand', labelKey: 'writingHelperModeExpand' },
  { value: 'summarize', labelKey: 'writingHelperModeSummarize' },
  { value: 'outline', labelKey: 'writingHelperModeOutline' },
]

// ── Sub-components ─────────────────────────────────────────────

function StyleSlider({ label, value, onChange, min = 1, max = 5 }: {
  label: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary">{label}</span>
        <span className="text-[11px] font-mono text-gray-400 dark:text-dark-text-muted">{value}/{max}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-gray-200 dark:bg-dark-border cursor-pointer accent-primary-600 dark:accent-primary-500"
      />
    </label>
  )
}

function TagInput({ tags, onAdd, onRemove, placeholder }: {
  tags: string[]
  onAdd: (tag: string) => void
  onRemove: (tag: string) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-1 px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface min-h-[34px]">
      {tags.map(tag => (
        <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary-50 dark:bg-primary-900/20 text-[11px] font-medium text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-500/20">
          {tag}
          <button type="button" onClick={() => onRemove(tag)} className="hover:text-primary-900 dark:hover:text-primary-100">
            <X size={12} />
          </button>
        </span>
      ))}
      <div className="relative flex-1 min-w-[80px]">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && input.trim()) {
              e.preventDefault()
              onAdd(input.trim())
              setInput('')
            }
          }}
          placeholder={placeholder}
          className="w-full bg-transparent text-[12px] text-gray-800 dark:text-dark-text outline-none placeholder-gray-400 dark:placeholder-dark-text-muted"
        />
      </div>
    </div>
  )
}

function CollapsibleGroup({ title, defaultOpen = false, children }: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border border-gray-100 dark:border-dark-border/50 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left bg-gray-50/50 dark:bg-dark-bg/50 hover:bg-gray-100 dark:hover:bg-dark-surface2 transition-colors"
      >
        <span className="text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary">{title}</span>
        <ChevronDown size={12} className={`ml-auto text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3 py-2.5 space-y-2.5 border-t border-gray-100 dark:border-dark-border/30">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function WritingHelperPanel({ onClose, onOpenSettings, draftState, onDraftStateChange, onClearDraft }: WritingHelperPanelProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const detectionEvasionGuardEnabled = useSettingsStore((state) => state.settings.detectionEvasionGuardEnabled)
  const selectedSkills = useAppStore((state) => state.selectedSkills)
  const availableSkills = useAppStore((state) => state.availableSkills)
  const toggleSkill = useAppStore((state) => state.toggleSkill)
  const selectedSkillIds = Array.isArray(selectedSkills) ? selectedSkills : []
  const availableSkillIds = Array.isArray(availableSkills) ? availableSkills : []
  const toggleSelectedSkill = typeof toggleSkill === 'function' ? toggleSkill : () => {}
  const useLegacyPolish = useSettingsStore((state) => state.settings.writingHelperUseLegacyPolish)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const { t, translate, language } = useI18n()
  const isZh = language === 'zh'

  const getProviderFields = useCallback(() => {
    const { settings } = useSettingsStore.getState()
    const provider = settings.llmProviders.find(
      (p) => p.id === settings.primaryProvider && p.enabled && p.apiKey,
    )
    return provider
      ? { api_key: provider.apiKey, base_url: provider.baseUrl, model: provider.defaultModel, provider: provider.id }
      : {}
  }, [])
  const [content, setContent] = useState(() => {
    if (draftState?.content) return draftState.content
    // Prefill from editor selection
    const handle = getEditorHandle()
    if (handle) {
      const selected = handle.getSelectedText()
      if (selected.trim()) return selected
    }
    return ''
  })
  const [mode, setMode] = useState<WritingHelperMode>(draftState?.mode ?? 'polish')
  const [maxSentences, setMaxSentences] = useState(draftState?.maxSentences ?? 3)
  const [maxItems, setMaxItems] = useState(draftState?.maxItems ?? 6)
  const [guidance, setGuidance] = useState(draftState?.guidance ?? '')
  const [handoff, setHandoff] = useState<WritingHelperEvaluationHandoff | null>(draftState?.handoff ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<WritingHelperResult | null>(null)
  const [applyMessage, setApplyMessage] = useState<string | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [style, setStyle] = useState<WritingStyle>(loadStyle)
  const [guidanceExpanded, setGuidanceExpanded] = useState(false)
  const [presetCardExpanded, setPresetCardExpanded] = useState(false)
  const initialPresetRef = useRef({
    mode: draftState?.handoff?.preset.mode ?? draftState?.mode ?? 'polish' as WritingHelperMode,
    maxSentences: draftState?.handoff?.preset.maxSentences ?? draftState?.maxSentences ?? 3,
    maxItems: draftState?.handoff?.preset.maxItems ?? draftState?.maxItems ?? 6,
    guidance: draftState?.handoff?.guidance ?? draftState?.guidance ?? '',
  })
  const buttonDisabled = useMemo(() => loading || content.trim().length === 0, [loading, content])
  const revisionCopy = useMemo(() => getRevisionCopy(language), [language])
  const modeLabelMap: Record<WritingHelperMode, string> = {
    polish: t.writingHelperModePolish,
    rewrite: t.writingHelperModeRewrite,
    expand: t.writingHelperModeExpand,
    summarize: t.writingHelperModeSummarize,
    outline: t.writingHelperModeOutline,
  }
  const hasInitialPreset = initialPresetRef.current.guidance.trim().length > 0 || handoff !== null
  const presetGuidance = guidance.trim() ? guidance : initialPresetRef.current.guidance
  const isEvaluationHandoff = handoff?.source === 'evaluation'
    || presetGuidance.startsWith(isZh ? '优先处理这条评估建议：' : 'Prioritize this evaluation guidance:')
  const presetTitle = isEvaluationHandoff
    ? (isZh ? '评估接力预设' : 'Evaluation handoff preset')
    : (isZh ? '当前处理预设' : 'Active processing preset')
  const presetHint = isZh
    ? '这组模式和参数已经按接力上下文预选好，你可以直接运行，也可以先手动调整。'
    : 'This mode and parameter set was preselected from the current handoff. Run it as-is or adjust it first.'
  const presetModeText = isZh
    ? `模式：${modeLabelMap[mode]}`
    : `Mode: ${modeLabelMap[mode]}`
  const presetSentenceText = isZh
    ? `句数：${maxSentences}`
    : `Sentences: ${maxSentences}`
  const presetItemsText = isZh
    ? `条目：${maxItems}`
    : `Items: ${maxItems}`
  const handoffSourceTitle = isZh ? '接力来源' : 'Handoff source'
  const handoffSuggestionText = handoff
    ? (isZh ? `建议：${handoff.suggestionTitle}` : `Suggestion: ${handoff.suggestionTitle}`)
    : ''
  const handoffReasonText = handoff
    ? (isZh ? `原因：${handoff.suggestionReason}` : `Reason: ${handoff.suggestionReason}`)
    : ''
  const handoffCarryText = handoff
    ? (isZh
      ? `携带：${handoff.carriedContent === 'revision-preview' ? '修改预览' : '原始回复'}`
      : `Carries: ${handoff.carriedContent === 'revision-preview' ? 'revision preview' : 'original reply'}`)
    : ''
  const handoffRevisionSessionText = handoff?.revisionSession
    ? (isZh
      ? `修订会话：${handoff.revisionSession.id}${handoff.revisionSession.state ? ` · ${handoff.revisionSession.state}` : ''}`
      : `Revision session: ${handoff.revisionSession.id}${handoff.revisionSession.state ? ` · ${handoff.revisionSession.state}` : ''}`)
    : ''
  const handoffRevisionSessionSummaryText = handoff?.revisionSession?.comparisonSummary
    ? (isZh
      ? `会话提示：${handoff.revisionSession.comparisonSummary}`
      : `Session note: ${handoff.revisionSession.comparisonSummary}`)
    : ''
  const personalizedCraftSummary = useAppStore((state) => state.personalizedCraftSummary)
  const personalizedCraftTrajectory = useAppStore((state) => state.personalizedCraftTrajectory)
  const personalizedCraftRecommendations = useAppStore((state) => state.personalizedCraftRecommendations)
  const guidanceTitle = isZh ? '交接说明' : 'Handoff guidance'
  const guidanceHint = isZh
    ? '这段说明会作为本次处理的附加指令，你可以保留它，也可以清除后按自己的思路继续。'
    : 'This note will be added to the current request as extra guidance. Keep it or clear it before continuing.'
  const clearGuidanceLabel = isZh ? '清除说明' : 'Clear guidance'
  const expandGuidanceLabel = isZh ? '展开说明' : 'Expand guidance'
  const collapseGuidanceLabel = isZh ? '收起说明' : 'Collapse guidance'
  const restoreGuidanceInlineLabel = isZh ? '恢复说明' : 'Restore guidance'
  const expandPresetDetailsLabel = isZh ? '展开预设详情' : 'Expand preset details'
  const collapsePresetDetailsLabel = isZh ? '收起预设详情' : 'Collapse preset details'
  const restorePresetLabel = isZh ? '恢复推荐参数' : 'Restore recommended preset'
  const presetClearedHint = isZh ? '交接说明已清除，你仍可恢复推荐参数。' : 'Handoff guidance was cleared. You can still restore the recommended preset.'
  const presetAlignedLabel = isZh ? '当前与推荐一致' : 'Matches recommendation'
  const presetChangedLabel = isZh ? '已偏离推荐参数' : 'Preset changed'
  const presetChangedHint = isZh
    ? '你已经改动了推荐模式或参数；如需回到评估给出的起始设置，可使用“恢复推荐参数”。'
    : 'You changed the recommended mode or parameters. Use “Restore recommended preset” to go back to the original handoff state.'
  const restoreSinglePresetFieldLabel = isZh ? '恢复此项' : 'Restore'
  const controlRestoreLabel = isZh ? '恢复' : 'Restore'
  const controlAlignedLabel = isZh ? '当前即推荐' : 'Using recommended value'
  const modeRecommendedOptionSuffix = isZh ? '（推荐）' : ' (Recommended)'
  const presetModeChanged = mode !== initialPresetRef.current.mode
  const presetSentencesChanged = maxSentences !== initialPresetRef.current.maxSentences
  const presetItemsChanged = maxItems !== initialPresetRef.current.maxItems
  const presetGuidanceChanged = guidance !== initialPresetRef.current.guidance
  const hasPresetChanges = (
    presetModeChanged ||
    presetSentencesChanged ||
    presetItemsChanged ||
    presetGuidanceChanged
  )
  const presetDiffLabels = [
    presetModeChanged
      ? {
          key: 'mode' as const,
          label: isZh ? '模式已改动' : 'Mode changed',
          restoreLabel: isZh ? '恢复模式推荐' : 'Restore recommended mode',
        }
      : null,
    presetSentencesChanged
      ? {
          key: 'maxSentences' as const,
          label: isZh ? '句数已改动' : 'Sentence limit changed',
          restoreLabel: isZh ? '恢复推荐句数' : 'Restore recommended sentence limit',
        }
      : null,
    presetItemsChanged
      ? {
          key: 'maxItems' as const,
          label: isZh ? '条目已改动' : 'Item limit changed',
          restoreLabel: isZh ? '恢复推荐条目数' : 'Restore recommended item limit',
        }
      : null,
    presetGuidanceChanged
      ? {
          key: 'guidance' as const,
          label: isZh ? '说明已改动' : 'Guidance changed',
          restoreLabel: isZh ? '恢复推荐说明' : 'Restore recommended guidance',
        }
      : null,
  ].filter((item): item is { key: PresetFieldKey; label: string; restoreLabel: string } => Boolean(item))
  const presetModeAssist: PresetControlAssist = {
    field: 'mode',
    recommendedText: isZh
      ? `推荐：${modeLabelMap[initialPresetRef.current.mode]}`
      : `Recommended: ${modeLabelMap[initialPresetRef.current.mode]}`,
    changed: presetModeChanged,
    restoreLabel: isZh ? '在模式控件中恢复推荐' : 'Restore recommendation in mode control',
  }
  const modeControlStatusText = hasInitialPreset
    ? (presetModeChanged
      ? (isZh
        ? `当前：${modeLabelMap[mode]} · 推荐：${modeLabelMap[initialPresetRef.current.mode]}`
        : `Current: ${modeLabelMap[mode]} · Recommended: ${modeLabelMap[initialPresetRef.current.mode]}`)
      : (isZh
        ? `当前正在使用推荐模式：${modeLabelMap[initialPresetRef.current.mode]}`
        : `Currently using recommended mode: ${modeLabelMap[initialPresetRef.current.mode]}`))
    : null
  const presetSentencesAssist: PresetControlAssist = {
    field: 'maxSentences',
    recommendedText: isZh
      ? `推荐：${initialPresetRef.current.maxSentences} 句`
      : `Recommended: ${initialPresetRef.current.maxSentences} sentences`,
    changed: presetSentencesChanged,
    restoreLabel: isZh ? '在句数控件中恢复推荐' : 'Restore recommendation in sentence limit control',
  }
  const presetItemsAssist: PresetControlAssist = {
    field: 'maxItems',
    recommendedText: isZh
      ? `推荐：${initialPresetRef.current.maxItems} 条`
      : `Recommended: ${initialPresetRef.current.maxItems} items`,
    changed: presetItemsChanged,
    restoreLabel: isZh ? '在条目控件中恢复推荐' : 'Restore recommendation in item limit control',
  }
  const presetSummaryText = isZh
    ? `${modeLabelMap[mode]} · ${maxSentences} 句 · ${maxItems} 条${guidance.trim() ? ' · 含交接说明' : ''}${hasPresetChanges ? ` · 已改动 ${presetDiffLabels.length} 项` : ''}`
    : `${modeLabelMap[mode]} · ${maxSentences} sentences · ${maxItems} items${guidance.trim() ? ' · guidance included' : ''}${hasPresetChanges ? ` · ${presetDiffLabels.length} changes` : ''}`
  const guidancePreview = buildGuidancePreview(guidance)
  const hasCollapsedGuidancePreview = guidance.trim().length > 0 && guidancePreview !== guidance.trim()
  const displayedGuidance = guidanceExpanded || !hasCollapsedGuidancePreview ? guidance : guidancePreview
  const hasRevisionPreview = Boolean(
    result?.processedText &&
    result?.sourceText &&
    result.selectionSnapshot &&
    result.sourceText.trim().length > 0,
  )

  const updateStyle = useCallback((patch: Partial<WritingStyle>) => {
    setStyle(prev => {
      const next = { ...prev, ...patch }
      saveStyle(next)
      return next
    })
  }, [])

  const updateSubStyle = useCallback(<K extends keyof WritingStyle>(key: K, sub: Partial<NonNullable<WritingStyle[K]>>) => {
    setStyle(prev => {
      const prevVal = prev[key]
      const merged = prevVal && typeof prevVal === 'object' ? { ...(prevVal as object), ...(sub as object) } : sub
      const next = { ...prev, [key]: merged } as WritingStyle
      saveStyle(next)
      return next
    })
  }, [])

  useEffect(() => {
    onDraftStateChange?.({ content, mode, maxSentences, maxItems, guidance, handoff })
  }, [content, mode, maxSentences, maxItems, guidance, handoff, onDraftStateChange])

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
  })

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setApplyMessage(null)
    setResult(null)
    const matchedSelectionSnapshot = captureMatchedSelectionSnapshot(content)

    try {
      if (mode === 'polish' && useLegacyPolish) {
        const legacyResponse = await polishContent({
          originalText: content,
          polishType: 'standard',
          ...getProviderFields(),
        })

        if (legacyResponse.error) {
          setError(legacyResponse.error)
          return
        }

        setResult({
          mode: 'polish',
          processedText: legacyResponse.polishedText,
          sourceText: content,
          selectionSnapshot: matchedSelectionSnapshot,
          skillsUsed: selectedSkillIds,
        })
        return
      }

      const styleInstruction = buildStyleInstruction(style, isZh)
      const combinedInstruction = [
        guidance.trim()
          ? (isZh
            ? `优先遵循以下交接说明：\n${guidance.trim()}`
            : `Prioritize the following handoff guidance:\n${guidance.trim()}`)
          : '',
        styleInstruction.trim(),
      ].filter(Boolean).join('\n\n')
      const response = await processWritingHelper({
        content,
        mode,
        max_sentences: maxSentences,
        max_items: maxItems,
        instruction: combinedInstruction || undefined,
        skill_ids: selectedSkillIds,
        detection_evasion_guard_enabled: detectionEvasionGuardEnabled,
        ...getProviderFields(),
      })

      if (!response.success || !response.data) {
        setError(response.error || t.writingHelperFailed)
        return
      }

      setResult({
        mode: response.data.mode,
        processedText: response.data.processed_text,
        outline: Array.isArray(response.data.outline) ? response.data.outline : undefined,
        sourceText: content,
        selectionSnapshot: matchedSelectionSnapshot,
        skillsUsed: Array.isArray(response.data.skills_used) ? response.data.skills_used : selectedSkillIds,
      })
    } catch (submitError) {
      setError(String(submitError))
    } finally {
      setLoading(false)
    }
  }

  const handleClearDraft = () => {
    setContent('')
    setMode('polish')
    setMaxSentences(3)
    setMaxItems(6)
    setGuidance('')
    setHandoff(null)
    setGuidanceExpanded(false)
    setPresetCardExpanded(false)
    setError(null)
    setApplyMessage(null)
    setResult(null)
    onClearDraft?.()
  }

  const resetTransientState = () => {
    setError(null)
    setApplyMessage(null)
    setResult(null)
  }

  const restorePresetFieldValue = (field: PresetFieldKey) => {
    if (field === 'mode') {
      setMode(initialPresetRef.current.mode)
    } else if (field === 'maxSentences') {
      setMaxSentences(initialPresetRef.current.maxSentences)
    } else if (field === 'maxItems') {
      setMaxItems(initialPresetRef.current.maxItems)
    } else {
      setGuidance(initialPresetRef.current.guidance)
    }
  }

  const handleRestorePresetField = (field: PresetFieldKey) => {
    restorePresetFieldValue(field)
    if (field === 'guidance') {
      setGuidanceExpanded(false)
    }
    resetTransientState()
  }

  const handleRestorePreset = () => {
    restorePresetFieldValue('mode')
    restorePresetFieldValue('maxSentences')
    restorePresetFieldValue('maxItems')
    restorePresetFieldValue('guidance')
    setGuidanceExpanded(false)
    setPresetCardExpanded(false)
    resetTransientState()
  }

  const handleReplaceSelection = () => {
    if (!result?.processedText) {
      return
    }

    const message = applyRevisionCandidateToEditor({
      sourceText: result.sourceText ?? '',
      candidateText: result.processedText,
      selectionSnapshot: result.selectionSnapshot ?? null,
    }, revisionCopy)
    if (message) {
      setApplyMessage(message)
    }
  }

  const handleInsertAlternative = () => {
    if (!result?.processedText) {
      return
    }

    const message = insertRevisionAlternativeToEditor({
      sourceText: result.sourceText ?? '',
      candidateText: result.processedText,
      selectionSnapshot: result.selectionSnapshot ?? null,
    }, revisionCopy)
    if (message) {
      setApplyMessage(message)
    }
  }

  const handleUndoLastApply = () => {
    const message = undoLastRevisionApplyInEditor(revisionCopy)
    if (message) {
      setApplyMessage(message)
    }
  }

  const handleClearGuidance = () => {
    setGuidance('')
    setGuidanceExpanded(false)
  }

  const getModeOptionLabel = (option: { value: WritingHelperMode; labelKey: keyof Translations }) => {
    const label = t[option.labelKey]
    if (!hasInitialPreset || option.value !== initialPresetRef.current.mode) {
      return label
    }

    return `${label}${modeRecommendedOptionSuffix}`
  }

  const renderPresetControlAssist = (assist: PresetControlAssist) => {
    if (!hasInitialPreset) {
      return null
    }

    return (
      <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] font-medium">
        <span className={`rounded-full px-2 py-0.5 ${
          assist.changed
            ? 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200'
            : 'bg-gray-100 text-gray-600 dark:bg-dark-surface2 dark:text-dark-text-secondary'
        }`}>
          {assist.recommendedText}
        </span>
        {assist.changed ? (
          <button
            type="button"
            onClick={() => handleRestorePresetField(assist.field)}
            aria-label={assist.restoreLabel}
            title={assist.restoreLabel}
            className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-50 dark:border-amber-500/30 dark:bg-dark-surface dark:text-amber-200 dark:hover:bg-amber-900/20"
          >
            {controlRestoreLabel}
          </button>
        ) : (
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            {controlAlignedLabel}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={t.writingHelperTitle}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-2xl overflow-hidden transform transition-all flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border/50 bg-slate-50 dark:bg-dark-surface2/50 shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-gray-800 dark:text-dark-text tracking-wide">{t.writingHelperTitle}</h2>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${
                detectionEvasionGuardEnabled
                  ? 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-500/20'
                  : 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-500/20'
              }`}
            >
              {translate('writingHelperGuardStatus', {
                status: detectionEvasionGuardEnabled ? t.writingHelperGuardOn : t.writingHelperGuardOff,
              })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-dark-text dark:hover:bg-dark-border rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={t.writingHelperClose}
            title={t.writingHelperClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto custom-scrollbar">
          <div className="p-6 pb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="text-[11px] font-medium text-gray-500 dark:text-dark-text-muted">
                {t.writingHelperHint}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary cursor-pointer hover:text-gray-800 dark:hover:text-dark-text transition-colors">
                  <input
                    type="checkbox"
                    checked={useLegacyPolish}
                    onChange={(event) => updateSettings({ writingHelperUseLegacyPolish: event.target.checked })}
                    className="rounded text-primary-600 focus:ring-primary-500 bg-gray-50 border-gray-300 dark:bg-dark-bg dark:border-dark-border"
                  />
                  {t.writingHelperLegacyPolish}
                </label>
                <button
                  onClick={onOpenSettings}
                  className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface2 text-gray-700 dark:text-dark-text transition-all shadow-sm active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
                >
                  {t.writingHelperOpenSettings}
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 space-y-4 pb-6">
            {hasInitialPreset && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 shadow-sm dark:border-amber-500/20 dark:bg-amber-900/10">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                        {presetTitle}
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          hasPresetChanges
                            ? 'bg-amber-200/80 text-amber-900 dark:bg-amber-500/20 dark:text-amber-100'
                            : 'bg-white/80 text-amber-700 dark:bg-dark-surface dark:text-amber-100'
                        }`}
                      >
                        {hasPresetChanges ? presetChangedLabel : presetAlignedLabel}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-200/80">
                      {hasPresetChanges ? presetChangedHint : presetHint}
                    </p>
                    <p className="mt-2 text-[11px] font-medium leading-relaxed text-amber-800 dark:text-amber-100">
                      {presetSummaryText}
                    </p>
                    {handoff?.source === 'evaluation' && (
                      <div className="mt-3 rounded-lg border border-amber-200/80 bg-white/80 px-3 py-2 dark:border-amber-500/20 dark:bg-dark-surface">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                          {handoffSourceTitle}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                            {handoffSuggestionText}
                          </span>
                          <span className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                            {handoffCarryText}
                          </span>
                          {handoffRevisionSessionText && (
                            <span className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                              {handoffRevisionSessionText}
                            </span>
                          )}
                          {handoffRevisionSessionSummaryText && (
                            <span className="rounded-full bg-amber-100/80 px-2.5 py-1 text-[11px] font-medium text-amber-900 dark:bg-amber-500/15 dark:text-amber-100">
                              {handoffRevisionSessionSummaryText}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 text-[11px] leading-relaxed text-amber-800 dark:text-amber-100">
                          {handoffReasonText}
                        </p>
                        {(personalizedCraftSummary || personalizedCraftTrajectory || personalizedCraftRecommendations.length > 0) && (
                          <div className="mt-3 rounded-xl border border-amber-200/80 bg-white/80 px-3 py-2 text-[11px] text-amber-900 dark:border-amber-500/20 dark:bg-dark-surface2 dark:text-amber-100">
                            <div className="font-semibold">{isZh ? '个性化技巧画像' : 'Personalized craft profile'}</div>
                            {personalizedCraftSummary && <div className="mt-1">{personalizedCraftSummary}</div>}
                            {personalizedCraftTrajectory && <div className="mt-1 opacity-80">{personalizedCraftTrajectory}</div>}
                            {personalizedCraftRecommendations.length > 0 && (
                              <ul className="mt-1 list-disc pl-4">
                                {personalizedCraftRecommendations.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {hasPresetChanges && (
                      <button
                        type="button"
                        onClick={handleRestorePreset}
                        className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-dark-surface dark:text-amber-200 dark:hover:bg-amber-900/20"
                      >
                        {restorePresetLabel}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setPresetCardExpanded((value) => !value)}
                      className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-medium text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-dark-surface dark:text-amber-200 dark:hover:bg-amber-900/20"
                    >
                      <ChevronDown size={12} className={`transition-transform ${presetCardExpanded ? 'rotate-180' : ''}`} />
                      {presetCardExpanded ? collapsePresetDetailsLabel : expandPresetDetailsLabel}
                    </button>
                  </div>
                </div>
                {presetCardExpanded && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[presetModeText, presetSentenceText, presetItemsText].map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-amber-200/80 bg-white/80 px-3 py-1 text-[11px] font-medium text-amber-800 dark:border-amber-500/20 dark:bg-dark-surface dark:text-amber-100"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                    {hasPresetChanges && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {presetDiffLabels.map((item) => (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => handleRestorePresetField(item.key)}
                            aria-label={item.restoreLabel}
                            title={item.restoreLabel}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-200/80 px-3 py-1 text-[11px] font-semibold text-amber-900 transition-colors hover:bg-amber-300/80 dark:bg-amber-500/20 dark:text-amber-100 dark:hover:bg-amber-500/30"
                          >
                            <span>{item.label}</span>
                            <span className="rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-dark-surface dark:text-amber-200">
                              {restoreSinglePresetFieldLabel}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">
                          {guidanceTitle}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {guidance.trim() && (
                            <button
                              type="button"
                              onClick={handleClearGuidance}
                              className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-dark-surface dark:text-amber-200 dark:hover:bg-amber-900/20"
                            >
                              {clearGuidanceLabel}
                            </button>
                          )}
                          {hasCollapsedGuidancePreview && (
                            <button
                              type="button"
                              onClick={() => setGuidanceExpanded((value) => !value)}
                              className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-dark-surface dark:text-amber-200 dark:hover:bg-amber-900/20"
                            >
                              {guidanceExpanded ? collapseGuidanceLabel : expandGuidanceLabel}
                            </button>
                          )}
                          {presetGuidanceChanged && (
                            <button
                              type="button"
                              onClick={() => handleRestorePresetField('guidance')}
                              aria-label={isZh ? '在说明区恢复推荐说明' : 'Restore recommended guidance in guidance section'}
                              className="rounded-full border border-amber-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-700 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-dark-surface dark:text-amber-200 dark:hover:bg-amber-900/20"
                            >
                              {restoreGuidanceInlineLabel}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-amber-700/90 dark:text-amber-200/80">
                        {guidance.trim() ? guidanceHint : presetClearedHint}
                      </p>
                      {guidance.trim() ? (
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-amber-900 dark:text-amber-100">
                          {displayedGuidance}
                        </p>
                      ) : null}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Mode controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-100 dark:border-dark-border/50">
              <label className="text-xs font-semibold text-gray-700 dark:text-dark-text flex flex-col gap-1.5">
                <div>
                  <div>{t.writingHelperMode}</div>
                  {renderPresetControlAssist(presetModeAssist)}
                </div>
                <select
                  aria-label={t.writingHelperMode}
                  value={mode}
                  onChange={(event) => setMode(event.target.value as WritingHelperMode)}
                  className={`px-3 py-2 rounded-md border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none shadow-sm transition-all ${
                    hasInitialPreset && presetModeChanged
                      ? 'border-amber-300 dark:border-amber-500/40'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                >
                  {MODE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {getModeOptionLabel(option)}
                    </option>
                  ))}
                </select>
                {modeControlStatusText ? (
                  <p className={`text-[10px] leading-relaxed ${
                    presetModeChanged
                      ? 'text-amber-700 dark:text-amber-200'
                      : 'text-gray-500 dark:text-dark-text-secondary'
                  }`}>
                    {modeControlStatusText}
                  </p>
                ) : null}
              </label>

              <label className="text-xs font-semibold text-gray-700 dark:text-dark-text flex flex-col gap-1.5">
                <div>
                  <div>{t.writingHelperMaxSentences}</div>
                  {renderPresetControlAssist(presetSentencesAssist)}
                </div>
                <input
                  aria-label={t.writingHelperMaxSentences}
                  type="number"
                  min={1}
                  value={maxSentences}
                  onChange={(event) => setMaxSentences(Number(event.target.value) || 1)}
                  className={`px-3 py-2 rounded-md border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none shadow-sm transition-all ${
                    hasInitialPreset && presetSentencesChanged
                      ? 'border-amber-300 dark:border-amber-500/40'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                />
              </label>

              <label className="text-xs font-semibold text-gray-700 dark:text-dark-text flex flex-col gap-1.5">
                <div>
                  <div>{t.writingHelperMaxItems}</div>
                  {renderPresetControlAssist(presetItemsAssist)}
                </div>
                <input
                  aria-label={t.writingHelperMaxItems}
                  type="number"
                  min={1}
                  value={maxItems}
                  onChange={(event) => setMaxItems(Number(event.target.value) || 1)}
                  className={`px-3 py-2 rounded-md border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none shadow-sm transition-all ${
                    hasInitialPreset && presetItemsChanged
                      ? 'border-amber-300 dark:border-amber-500/40'
                      : 'border-gray-200 dark:border-dark-border'
                  }`}
                />
              </label>
            </div>

            {/* ── 8-Dimensional Style Settings ── */}
            <div className="border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden">
              <button
                onClick={() => setStyleOpen(!styleOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-dark-surface2 transition-colors"
              >
                <span className="text-[12px] font-semibold text-gray-700 dark:text-dark-text">{t.styleSettingsTitle}</span>
                <span className="text-[10px] text-gray-400 dark:text-dark-text-muted">8 维风格控制</span>
                <ChevronDown
                  size={14}
                  className={`ml-auto text-gray-400 dark:text-dark-text-muted transition-transform duration-200 ${styleOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {styleOpen && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-border/50 space-y-4 bg-white dark:bg-dark-surface/50">
                  {/* Row 1: Selects */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <label className="text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1.5">
                      {t.styleTone}
                      <select
                        value={style.tone}
                        onChange={(e) => updateStyle({ tone: e.target.value as ToneOption })}
                        className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none"
                      >
                        {TONE_OPTIONS.map(v => <option key={v} value={v}>{t[toneLabelKey(v)]}</option>)}
                      </select>
                    </label>

                    <label className="text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1.5">
                      {t.stylePerspective}
                      <select
                        value={style.perspective}
                        onChange={(e) => updateStyle({ perspective: e.target.value as PerspectiveOption })}
                        className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none"
                      >
                        {PERSPECTIVE_OPTIONS.map(v => <option key={v} value={v}>{t[perspectiveLabelKey(v)]}</option>)}
                      </select>
                    </label>

                    <label className="text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1.5">
                      {t.styleSentence}
                      <select
                        value={style.sentenceStyle}
                        onChange={(e) => updateStyle({ sentenceStyle: e.target.value as SentenceStyleOption })}
                        className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none"
                      >
                        {SENTENCE_STYLE_OPTIONS.map(v => <option key={v} value={v}>{t[sentenceStyleLabelKey(v)]}</option>)}
                      </select>
                    </label>

                    <label className="text-[11px] font-semibold text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1.5">
                      {t.styleRhythmLabel}
                      <select
                        value={style.rhythm}
                        onChange={(e) => updateStyle({ rhythm: e.target.value as RhythmOption })}
                        className="px-2.5 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none"
                      >
                        {RHYTHM_OPTIONS.map(v => <option key={v} value={v}>{t[rhythmLabelKey(v)]}</option>)}
                      </select>
                    </label>
                  </div>

                  {/* Row 2: Sliders */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-3">
                    <StyleSlider
                      label={t.styleFormality}
                      value={style.formality}
                      onChange={(v) => updateStyle({ formality: v })}
                    />
                    <StyleSlider
                      label={t.styleEmotion}
                      value={style.emotionIntensity}
                      onChange={(v) => updateStyle({ emotionIntensity: v })}
                    />
                    <StyleSlider
                      label={t.styleCreativity}
                      value={style.creativity}
                      onChange={(v) => updateStyle({ creativity: v })}
                    />
                    <StyleSlider
                      label={t.styleNarrativeDistance}
                      value={style.narrativeDistance}
                      onChange={(v) => updateStyle({ narrativeDistance: v })}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── Advanced Style Sub-Properties ── */}
            <div className="border border-gray-200 dark:border-dark-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setAdvancedOpen(!advancedOpen)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left bg-gray-50 dark:bg-dark-bg hover:bg-gray-100 dark:hover:bg-dark-surface2 transition-colors"
              >
                <span className="text-[12px] font-semibold text-gray-700 dark:text-dark-text">{t.styleAdvancedTitle}</span>
                <ChevronDown
                  size={14}
                  className={`ml-auto text-gray-400 dark:text-dark-text-muted transition-transform duration-200 ${advancedOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {advancedOpen && (
                <div className="px-4 py-3 border-t border-gray-100 dark:border-dark-border/50 space-y-3 bg-white dark:bg-dark-surface/50">
                  {/* Structure */}
                  <CollapsibleGroup title={t.styleStructure}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleParagraphLength}
                        <select value={style.structure.paragraphLength} onChange={(e) => updateSubStyle('structure', { paragraphLength: e.target.value as WritingStyle['structure']['paragraphLength'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="short">{t.styleParagraphShort}</option>
                          <option value="medium">{t.styleParagraphMedium}</option>
                          <option value="long">{t.styleParagraphLong}</option>
                          <option value="varied">{t.styleParagraphVaried}</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleTransition}
                        <select value={style.structure.transitionStyle} onChange={(e) => updateSubStyle('structure', { transitionStyle: e.target.value as WritingStyle['structure']['transitionStyle'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="smooth">{t.styleTransitionSmooth}</option>
                          <option value="direct">{t.styleTransitionDirect}</option>
                          <option value="dramatic">{t.styleTransitionDramatic}</option>
                          <option value="subtle">{t.styleTransitionSubtle}</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleHierarchy}
                        <select value={style.structure.hierarchyPattern} onChange={(e) => updateSubStyle('structure', { hierarchyPattern: e.target.value as WritingStyle['structure']['hierarchyPattern'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="flat">{t.styleHierarchyFlat}</option>
                          <option value="nested">{t.styleHierarchyNested}</option>
                          <option value="parallel">{t.styleHierarchyParallel}</option>
                          <option value="progressive">{t.styleHierarchyProgressive}</option>
                        </select>
                      </label>
                    </div>
                  </CollapsibleGroup>

                  {/* Emotion */}
                  <CollapsibleGroup title={`${t.styleEmotionExpression} / ${t.styleEmotion}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleEmotionExpression}
                        <select value={style.emotion.expressionStyle} onChange={(e) => updateSubStyle('emotion', { expressionStyle: e.target.value as WritingStyle['emotion']['expressionStyle'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="implicit">{t.styleEmotionImplicit}</option>
                          <option value="explicit">{t.styleEmotionExplicit}</option>
                          <option value="restrained">{t.styleEmotionRestrained}</option>
                          <option value="passionate">{t.styleEmotionPassionate}</option>
                        </select>
                      </label>
                      <StyleSlider label={t.styleEmotion} value={style.emotion.intensity} onChange={(v) => updateSubStyle('emotion', { intensity: v })} />
                    </div>
                  </CollapsibleGroup>

                  {/* Thinking */}
                  <CollapsibleGroup title={t.styleThinkingLogic}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleThinkingLogic}
                        <select value={style.thinking.logicPattern} onChange={(e) => updateSubStyle('thinking', { logicPattern: e.target.value as WritingStyle['thinking']['logicPattern'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="deductive">{t.styleThinkingDeductive}</option>
                          <option value="inductive">{t.styleThinkingInductive}</option>
                          <option value="analogical">{t.styleThinkingAnalogical}</option>
                          <option value="dialectical">{t.styleThinkingDialectical}</option>
                        </select>
                      </label>
                      <StyleSlider label={t.styleThinkingDepth} value={style.thinking.depth} onChange={(v) => updateSubStyle('thinking', { depth: v })} />
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleThinkingRhythm}
                        <select value={style.thinking.rhythm} onChange={(e) => updateSubStyle('thinking', { rhythm: e.target.value as WritingStyle['thinking']['rhythm'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="methodical">{t.styleThinkingMethodical}</option>
                          <option value="exploratory">{t.styleThinkingExploratory}</option>
                          <option value="rapid">{t.styleThinkingRapid}</option>
                          <option value="contemplative">{t.styleThinkingContemplative}</option>
                        </select>
                      </label>
                    </div>
                  </CollapsibleGroup>

                  {/* Narrative */}
                  <CollapsibleGroup title={t.stylePerspective}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleNarrativeTime}
                        <select value={style.narrative.timeSequence} onChange={(e) => updateSubStyle('narrative', { timeSequence: e.target.value as WritingStyle['narrative']['timeSequence'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="linear">{t.styleNarrativeTimeLinear}</option>
                          <option value="flashback">{t.styleNarrativeTimeFlashback}</option>
                          <option value="interleaved">{t.styleNarrativeTimeInterleaved}</option>
                          <option value="circular">{t.styleNarrativeTimeCircular}</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleNarrativeAttitude}
                        <select value={style.narrative.narratorAttitude} onChange={(e) => updateSubStyle('narrative', { narratorAttitude: e.target.value as WritingStyle['narrative']['narratorAttitude'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="objective">{t.styleNarrativeObjective}</option>
                          <option value="sympathetic">{t.styleNarrativeSympathetic}</option>
                          <option value="critical">{t.styleNarrativeCritical}</option>
                          <option value="detached">{t.styleNarrativeDetached}</option>
                        </select>
                      </label>
                    </div>
                  </CollapsibleGroup>

                  {/* Rhythm */}
                  <CollapsibleGroup title={t.styleRhythmLabel}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleRhythmSyllable}
                        <select value={style.rhythmFull.syllablePattern} onChange={(e) => updateSubStyle('rhythmFull', { syllablePattern: e.target.value as WritingStyle['rhythmFull']['syllablePattern'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="dense">{t.styleRhythmSyllableDense}</option>
                          <option value="balanced">{t.styleRhythmSyllableBalanced}</option>
                          <option value="sparse">{t.styleRhythmSyllableSparse}</option>
                          <option value="free">{t.styleRhythmSyllableFree}</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleRhythmPause}
                        <select value={style.rhythmFull.pausePattern} onChange={(e) => updateSubStyle('rhythmFull', { pausePattern: e.target.value as WritingStyle['rhythmFull']['pausePattern'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="frequent">{t.styleRhythmPauseFrequent}</option>
                          <option value="moderate">{t.styleRhythmPauseModerate}</option>
                          <option value="minimal">{t.styleRhythmPauseMinimal}</option>
                        </select>
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleRhythmTempo}
                        <select value={style.rhythmFull.tempo} onChange={(e) => updateSubStyle('rhythmFull', { tempo: e.target.value as WritingStyle['rhythmFull']['tempo'] })} className="px-2 py-1.5 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-[12px] text-gray-800 dark:text-dark-text outline-none">
                          <option value="fast">{t.styleRhythmTempoFast}</option>
                          <option value="moderate">{t.styleRhythmTempoModerate || t.styleRhythmModerate}</option>
                          <option value="slow">{t.styleRhythmTempoSlow}</option>
                          <option value="varied">{t.styleRhythmTempoVaried}</option>
                        </select>
                      </label>
                    </div>
                  </CollapsibleGroup>

                  {/* Uniqueness & Cultural — Tag Inputs */}
                  <CollapsibleGroup title={t.styleUniqueness || '独特性 / 文化'}>
                    <div className="space-y-3">
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleSignaturePhrases}
                        <TagInput tags={style.uniqueness.signaturePhrases} placeholder={t.styleTagPlaceholder} onAdd={(tag) => updateSubStyle('uniqueness', { signaturePhrases: addTag(style.uniqueness.signaturePhrases, tag) })} onRemove={(tag) => updateSubStyle('uniqueness', { signaturePhrases: removeTag(style.uniqueness.signaturePhrases, tag) })} />
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleImagerySystem}
                        <TagInput tags={style.uniqueness.imagerySystem} placeholder={t.styleTagPlaceholder} onAdd={(tag) => updateSubStyle('uniqueness', { imagerySystem: addTag(style.uniqueness.imagerySystem, tag) })} onRemove={(tag) => updateSubStyle('uniqueness', { imagerySystem: removeTag(style.uniqueness.imagerySystem, tag) })} />
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleAllusions}
                        <TagInput tags={style.cultural.allusions} placeholder={t.styleTagPlaceholder} onAdd={(tag) => updateSubStyle('cultural', { allusions: addTag(style.cultural.allusions, tag) })} onRemove={(tag) => updateSubStyle('cultural', { allusions: removeTag(style.cultural.allusions, tag) })} />
                      </label>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
                        {t.styleKnowledgeDomains}
                        <TagInput tags={style.cultural.knowledgeDomains} placeholder={t.styleTagPlaceholder} onAdd={(tag) => updateSubStyle('cultural', { knowledgeDomains: addTag(style.cultural.knowledgeDomains, tag) })} onRemove={(tag) => updateSubStyle('cultural', { knowledgeDomains: removeTag(style.cultural.knowledgeDomains, tag) })} />
                      </label>
                    </div>
                  </CollapsibleGroup>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-white/70 dark:bg-dark-bg/40 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-800 dark:text-dark-text">{t.skillPacks}</div>
                  <p className="text-[12px] text-gray-500 dark:text-dark-text-secondary">
                    {selectedSkillIds.length > 0
                      ? (isZh ? `当前已应用 ${selectedSkillIds.length} 个技能包` : `${selectedSkillIds.length} skill packs applied`)
                      : (isZh ? '为本次写作显式应用技能包。' : 'Explicitly apply skill packs to this writing run.')}
                  </p>
                </div>
                {selectedSkillIds.length > 0 && (
                  <span className="rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300 border border-primary-100 dark:border-primary-500/20">
                    {translate('selectedSkills', { count: selectedSkillIds.length })}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {availableSkillIds.map((skillId) => {
                  const selected = selectedSkillIds.includes(skillId)
                  return (
                    <button
                      key={skillId}
                      type="button"
                      onClick={() => toggleSelectedSkill(skillId)}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        selected
                          ? 'border-primary-500 bg-primary-600 text-white shadow-sm'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-primary-300 hover:text-primary-700 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text dark:hover:border-primary-500/40 dark:hover:text-primary-300'
                      }`}
                      aria-pressed={selected}
                    >
                      {skillId}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Textarea */}
            <label className="text-sm font-semibold text-gray-800 dark:text-dark-text flex flex-col gap-2">
              {t.writingHelperInputText}
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                placeholder={t.writingHelperInputPlaceholder}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg text-[14px] leading-relaxed text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none shadow-inner transition-all custom-scrollbar resize-y"
              />
            </label>

            {/* Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSubmit}
                disabled={buttonDisabled}
                className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white shadow-sm hover:bg-primary-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
                title={buttonDisabled ? (loading ? t.writingHelperRunning : t.writingHelperInputPlaceholder) : undefined}
              >
                {loading && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />}
                {loading ? t.writingHelperRunning : t.writingHelperRun}
              </button>
              <button
                onClick={handleClearDraft}
                disabled={loading}
                className="px-4 py-2.5 text-sm font-medium rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
              >
                {t.writingHelperClearDraft}
              </button>
              {error && <span className="text-[13px] font-medium text-danger-500 ml-2 px-2 py-1 bg-danger-50 dark:bg-danger-900/10 rounded">{error}</span>}
            </div>

            {/* Result */}
            {result && (
              <div className="rounded-xl border border-primary-100 dark:border-primary-500/20 p-5 bg-primary-50/50 dark:bg-primary-900/10 shadow-sm mt-4 animate-fade-in">
                <div className="text-[11px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-subtle"></span>
                  {translate('writingHelperModePrefix', { mode: result.mode ?? '' })}
                </div>
                {result.skillsUsed && result.skillsUsed.length > 0 && (
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-primary-700 dark:text-primary-300">
                      {isZh ? '已应用技能包' : 'Applied skill packs'}
                    </span>
                    {result.skillsUsed.map((skillId) => (
                      <span
                        key={skillId}
                        className="rounded-full border border-primary-100 bg-white/80 px-2.5 py-1 text-[11px] font-medium text-primary-700 dark:border-primary-500/20 dark:bg-dark-bg/40 dark:text-primary-300"
                      >
                        {skillId}
                      </span>
                    ))}
                  </div>
                )}
                {hasRevisionPreview && (
                  <RevisionPreviewCard
                    previewTitle={revisionCopy.previewTitle}
                    originalLabel={revisionCopy.originalLabel}
                    candidateLabel={revisionCopy.candidateLabel}
                    sourceText={result.sourceText ?? ''}
                    candidateText={result.processedText ?? ''}
                    primaryActionLabel={result.selectionSnapshot ? revisionCopy.replaceLabel : t.writingHelperInsertToEditor}
                    secondaryActionLabel={result.selectionSnapshot ? revisionCopy.alternativeLabel : undefined}
                    undoActionLabel={revisionCopy.undoLabel}
                    onPrimaryAction={handleReplaceSelection}
                    onSecondaryAction={result.selectionSnapshot ? handleInsertAlternative : undefined}
                    onUndoAction={handleUndoLastApply}
                    className="mb-4 rounded-lg border border-primary-100 bg-white/70 p-3 dark:border-primary-500/20 dark:bg-dark-bg/40"
                    sourceTextClassName="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-dark-text font-serif leading-relaxed"
                    candidateTextClassName="mt-2 whitespace-pre-wrap text-sm text-gray-800 dark:text-dark-text font-serif leading-relaxed"
                    actionsClassName="mt-3 flex flex-wrap justify-end gap-2"
                  />
                )}
                {result.processedText && (
                  <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-dark-text font-serif leading-relaxed">
                    {result.processedText}
                  </div>
                )}
                {!hasRevisionPreview && result.processedText && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button
                      type="button"
                      onClick={handleReplaceSelection}
                      className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary-600 text-white hover:bg-primary-500 active:scale-95 transition-all shadow-sm"
                    >
                      {t.writingHelperInsertToEditor}
                    </button>
                    <button
                      type="button"
                      onClick={handleUndoLastApply}
                      className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 active:scale-95 transition-all shadow-sm"
                    >
                      {revisionCopy.undoLabel}
                    </button>
                  </div>
                )}
                {applyMessage && (
                  <div className="mt-3 text-[12px] font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/10 border border-primary-100 dark:border-primary-500/20 rounded-md px-3 py-2">
                    {applyMessage}
                  </div>
                )}
                {result.outline && result.outline.length > 0 && (
                  <ul className="list-disc pl-6 text-sm text-gray-800 dark:text-dark-text space-y-2 font-serif mt-2">
                    {result.outline.map((item, index) => (
                      <li key={`${item}-${index}`} className="leading-relaxed pl-1 marker:text-primary-400">{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
