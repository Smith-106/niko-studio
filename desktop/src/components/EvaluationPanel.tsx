import { useEffect, useMemo, useRef, useState } from 'react'
import { BarChart3, TrendingUp, AlertCircle, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react'
import {
  runConsistencyCheck,
  type ConsistencyCheckResult,
  type RecommendationPayload,
} from '../api/client'
import { processWritingHelper } from '../api/writing'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n, type Translations } from '../i18n'
import { useEvaluationWorkflow, type WorkflowAction, type WorkflowLifecycleAction } from '../hooks/useEvaluationWorkflow'
import { useEvaluationRecommendations, defaultSuggestionState } from '../hooks/useEvaluationRecommendations'
import { useEvaluationCheckpoints } from '../hooks/useEvaluationCheckpoints'
import { useEvaluationQualityCheck } from '../hooks/useEvaluationQualityCheck'
import { useEvaluationData } from '../hooks/useEvaluationData'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import type { WritingHelperEvaluationHandoff } from '../hooks/useAppUiPersistence'
import { type EvaluationSourceDescriptor, useAddMessage } from '../stores/selectors'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { RevisionPreviewCard } from './RevisionPreviewCard'
import type { RevisionCandidate } from '../utils/revisionLoop'
import {
  applyRevisionCandidateToEditor,
  captureMatchedSelectionSnapshot,
  getRevisionCopy,
  insertRevisionAlternativeToEditor,
  undoLastRevisionApplyInEditor,
} from '../utils/revisionLoop'

interface EvaluationPanelProps {
  content?: string
  evaluationSources?: EvaluationSourceDescriptor[]
  onClose: () => void
  onOpenAutomation?: () => void
  onOpenWritingHelper?: (handoff: {
    content: string
    guidance: string
    mode: 'polish' | 'rewrite' | 'expand' | 'summarize' | 'outline'
    maxSentences: number
    maxItems: number
    handoff: WritingHelperEvaluationHandoff
  }) => void
}

interface EvaluationRevisionCandidate extends RevisionCandidate {
  suggestionId: string
  surface: 'compact' | 'detailed'
}

type SuggestionFocus =
  | 'conflict'
  | 'pacing'
  | 'structure'
  | 'logic'
  | 'character'
  | 'dialogue'
  | 'detail'
  | 'style'
  | 'generic'

const buildDimensions = (
  data: {
    lock_score: number
    style_score: number
    logic_score: number
    actionable_feedback: string
    module_scores?: Record<string, number>
  },
  fallbackFeedback: string,
  t: Translations,
) => {
  const core = [
    { name: t.evaluationDimensionLock, score: Number((data.lock_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
    { name: t.evaluationDimensionStyle, score: Number((data.style_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
    { name: t.evaluationDimensionLogic, score: Number((data.logic_score / 4).toFixed(1)), feedback: data.actionable_feedback || fallbackFeedback },
  ]
  const modules = Object.entries(data.module_scores ?? {}).map(([name, score]) => ({
    name,
    score: Number(score.toFixed(1)),
    feedback: '',
  }))
  return { core, modules }
}

const toRecommendationPayload = (
  raw: unknown,
  index: number,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): RecommendationPayload => {
  if (typeof raw === 'string') {
    const title = raw.trim()
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title,
      reason: title,
      action: 'apply',
    }
  }

  if (!raw || typeof raw !== 'object') {
    const fallback = translate('evaluationRecommendationFallback', { index: index + 1 })
    return {
      id: `rec-${String(index + 1).padStart(2, '0')}`,
      title: fallback,
      reason: fallback,
      action: 'apply',
    }
  }

  const record = raw as Record<string, unknown>
  const titleRaw = record.title ?? record.name ?? record.recommendation
  const fallbackTitle = translate('evaluationRecommendationFallback', { index: index + 1 })
  const title = typeof titleRaw === 'string' && titleRaw.trim() ? titleRaw.trim() : fallbackTitle
  const reasonRaw = record.reason
  const actionRaw = record.action

  return {
    id: typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `rec-${String(index + 1).padStart(2, '0')}`,
    title,
    reason: typeof reasonRaw === 'string' && reasonRaw.trim() ? reasonRaw.trim() : title,
    action: typeof actionRaw === 'string' && actionRaw.trim() ? actionRaw.trim() : 'apply',
  }
}

const normalizeSuggestionPayloads = (
  rawSuggestions: unknown,
  translate: (key: keyof Translations, params?: Record<string, string | number>) => string,
): RecommendationPayload[] => {
  if (!Array.isArray(rawSuggestions)) {
    return []
  }

  return rawSuggestions
    .map((item, index) => toRecommendationPayload(item, index, translate))
    .filter((item) => item.title.length > 0)
}

const getWorkflowActionLabel = (action: WorkflowAction, t: Translations): string => {
  if (action === 'route') return t.evaluationWorkflowRoute
  if (action === 'plan') return t.evaluationWorkflowPlan
  if (action === 'execute') return t.evaluationWorkflowExecute
  return t.evaluationWorkflowLifecycle
}

const detectSuggestionFocus = (suggestion: RecommendationPayload): SuggestionFocus => {
  const normalized = `${suggestion.title} ${suggestion.reason}`.toLowerCase()

  if (
    normalized.includes('冲突') ||
    normalized.includes('张力') ||
    normalized.includes('风险') ||
    normalized.includes('stakes') ||
    normalized.includes('tension') ||
    normalized.includes('conflict') ||
    normalized.includes('pressure')
  ) {
    return 'conflict'
  }

  if (
    normalized.includes('节奏') ||
    normalized.includes('拖沓') ||
    normalized.includes(' pacing') ||
    normalized.includes('rhythm') ||
    normalized.includes('tempo')
  ) {
    return 'pacing'
  }

  if (
    normalized.includes('结构') ||
    normalized.includes('大纲') ||
    normalized.includes('组织') ||
    normalized.includes('层次') ||
    normalized.includes('structure') ||
    normalized.includes('outline') ||
    normalized.includes('organization')
  ) {
    return 'structure'
  }

  if (
    normalized.includes('逻辑') ||
    normalized.includes('因果') ||
    normalized.includes('连贯') ||
    normalized.includes('前后') ||
    normalized.includes('continuity') ||
    normalized.includes('causal') ||
    normalized.includes('logic')
  ) {
    return 'logic'
  }

  if (
    normalized.includes('角色') ||
    normalized.includes('人物') ||
    normalized.includes('动机') ||
    normalized.includes('弧光') ||
    normalized.includes('character') ||
    normalized.includes('motivation') ||
    normalized.includes('arc')
  ) {
    return 'character'
  }

  if (
    normalized.includes('对话') ||
    normalized.includes('对白') ||
    normalized.includes('台词') ||
    normalized.includes('dialogue') ||
    normalized.includes('voice')
  ) {
    return 'dialogue'
  }

  if (
    normalized.includes('细节') ||
    normalized.includes('场景') ||
    normalized.includes('描写') ||
    normalized.includes('画面') ||
    normalized.includes('detail') ||
    normalized.includes('imagery') ||
    normalized.includes('scene')
  ) {
    return 'detail'
  }

  if (
    normalized.includes('风格') ||
    normalized.includes('语气') ||
    normalized.includes('表达') ||
    normalized.includes('句式') ||
    normalized.includes('style') ||
    normalized.includes('tone') ||
    normalized.includes('clarity')
  ) {
    return 'style'
  }

  return 'generic'
}

const buildWritingHelperPreset = (focus: SuggestionFocus) => {
  switch (focus) {
    case 'detail':
      return { mode: 'expand' as const, maxSentences: 5, maxItems: 6 }
    case 'style':
      return { mode: 'polish' as const, maxSentences: 3, maxItems: 6 }
    case 'structure':
      return { mode: 'outline' as const, maxSentences: 3, maxItems: 5 }
    case 'conflict':
      return { mode: 'rewrite' as const, maxSentences: 4, maxItems: 6 }
    case 'pacing':
      return { mode: 'rewrite' as const, maxSentences: 4, maxItems: 6 }
    case 'logic':
      return { mode: 'rewrite' as const, maxSentences: 4, maxItems: 6 }
    case 'character':
      return { mode: 'rewrite' as const, maxSentences: 4, maxItems: 6 }
    case 'dialogue':
      return { mode: 'rewrite' as const, maxSentences: 4, maxItems: 6 }
    default:
      return { mode: 'rewrite' as const, maxSentences: 3, maxItems: 6 }
  }
}

const buildSuggestionActionTemplate = (focus: SuggestionFocus, isZh: boolean): string => {
  if (isZh) {
    switch (focus) {
      case 'conflict':
        return '本次改写请优先这样处理：\n1. 更早亮出人物之间的对立目标或阻力。\n2. 明确抬高失败代价、风险或情绪压力。\n3. 让结尾保留未解决的悬念或压迫感。'
      case 'pacing':
        return '本次改写请优先这样处理：\n1. 删掉重复铺垫，尽快进入有效动作。\n2. 缩短解释段，把信息拆进动作和反应里。\n3. 每一段都推进事件、关系或决策，不做原地踏步。'
      case 'logic':
        return '本次改写请优先这样处理：\n1. 补足因果链，让每个动作都有明确触发原因。\n2. 修正前后信息冲突，保持设定和时间线一致。\n3. 让关键结论来自可见线索，而不是突然跳结论。'
      case 'character':
        return '本次改写请优先这样处理：\n1. 把角色当下想要什么、害怕什么写得更具体。\n2. 让动作和对白能反映人物立场，而不是作者说明。\n3. 保留角色差异，让情绪变化有递进。'
      case 'dialogue':
        return '本次改写请优先这样处理：\n1. 删除解释型台词，让对白承担试探、施压或遮掩。\n2. 拉开人物语气差异，避免所有人说话一个腔调。\n3. 用对白后的动作或沉默补足潜台词。'
      case 'detail':
        return '本次改写请优先这样处理：\n1. 增加能服务情绪和冲突的具体场景细节。\n2. 用可感知的动作、声音、视线或环境替代空泛描述。\n3. 只保留会推动氛围或信息的细节，不堆砌形容词。'
      case 'style':
        return '本次改写请优先这样处理：\n1. 收紧句子，把模糊和重复表达改得更直接。\n2. 统一语气，不让段落在风格上来回跳。\n3. 优先保留有辨识度的措辞，减少模板化表达。'
      default:
        return '本次改写请优先这样处理：\n1. 围绕这条建议只解决最关键的一处问题。\n2. 让修改结果直接体现在动作、信息或情绪推进上。\n3. 输出完整改写版本，不要附加解释。'
    }
  }

  switch (focus) {
    case 'conflict':
      return 'Use this rewrite template:\n1. Surface the opposing goals or resistance earlier.\n2. Raise the cost of failure, risk, or emotional pressure.\n3. End with unresolved pressure or a sharper hook.'
    case 'pacing':
      return 'Use this rewrite template:\n1. Cut repeated setup and move into meaningful action sooner.\n2. Break explanations into reactions and scene movement.\n3. Make every paragraph advance event, relationship, or decision.'
    case 'logic':
      return 'Use this rewrite template:\n1. Repair the cause-and-effect chain behind each action.\n2. Remove continuity conflicts across facts, setup, and timing.\n3. Let key conclusions grow out of visible evidence.'
    case 'character':
      return 'Use this rewrite template:\n1. Clarify what the character wants and fears right now.\n2. Let action and dialogue reveal stance instead of narration alone.\n3. Preserve distinct emotional progression and motivation.'
    case 'dialogue':
      return 'Use this rewrite template:\n1. Remove explanatory lines and turn dialogue into pressure or concealment.\n2. Differentiate each speaker’s cadence and intent.\n3. Use action beats or silence to carry subtext.'
    case 'detail':
      return 'Use this rewrite template:\n1. Add concrete scene details that support mood or conflict.\n2. Prefer sensory action over generic description.\n3. Keep only details that strengthen atmosphere or information flow.'
    case 'style':
      return 'Use this rewrite template:\n1. Tighten sentences and replace vague repetition.\n2. Keep tone consistent across the passage.\n3. Preserve distinctive phrasing while reducing templated language.'
    default:
      return 'Use this rewrite template:\n1. Solve the single highest-value issue from this suggestion.\n2. Make the change visible in action, information flow, or emotional movement.\n3. Return a full revised version without commentary.'
  }
}

const panelShellClassName =
  'fixed right-0 top-14 bottom-0 w-80 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg z-30'

export function EvaluationPanel({
  content: fallbackContent = '',
  evaluationSources,
  onClose,
  onOpenAutomation,
  onOpenWritingHelper,
}: EvaluationPanelProps) {
  const { t, translate, language } = useI18n()
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [showAdvancedWorkflow, setShowAdvancedWorkflow] = useState(false)
  const [showDetailedReview, setShowDetailedReview] = useState(false)
  const [showSupportTools, setShowSupportTools] = useState(false)
  const [consistencyChecking, setConsistencyChecking] = useState(false)
  const [consistencyCheckError, setConsistencyCheckError] = useState<string | null>(null)
  const [consistencyCheckResult, setConsistencyCheckResult] = useState<ConsistencyCheckResult | null>(null)
  const qualityGoals = useSettingsStore((state) => state.settings.qualityGoals)
  const detectionEvasionGuardEnabled = useSettingsStore((state) => state.settings.detectionEvasionGuardEnabled)
  const workspaceSummary = useWriterWorkspaceSummary()
  const isZh = language === 'zh'
  const availableEvaluationSources = useMemo<EvaluationSourceDescriptor[]>(() => {
    const explicitSources = evaluationSources?.length
      ? evaluationSources
      : [{
        kind: 'latestAssistantReply',
        label: isZh ? '最近一次助手回复' : 'Latest assistant reply',
        content: fallbackContent,
      } satisfies EvaluationSourceDescriptor]

    return explicitSources
      .map((source) => ({
        ...source,
        content: source.content.trim(),
      }))
      .filter((source, index, sources) => (
        source.content.length > 0
        && sources.findIndex((candidate) => candidate.kind === source.kind) === index
      ))
  }, [evaluationSources, fallbackContent, isZh])
  const [selectedSourceKind, setSelectedSourceKind] = useState<EvaluationSourceDescriptor['kind'] | null>(
    availableEvaluationSources[0]?.kind ?? null,
  )
  const [revisionCandidate, setRevisionCandidate] = useState<EvaluationRevisionCandidate | null>(null)
  const [revisionLoadingId, setRevisionLoadingId] = useState<string | null>(null)
  const [revisionMessage, setRevisionMessage] = useState<{
    suggestionId: string
    tone: 'error' | 'success' | 'info'
    text: string
  } | null>(null)
  const activeEvaluationSource = availableEvaluationSources.find((source) => source.kind === selectedSourceKind)
    ?? availableEvaluationSources[0]
    ?? null
  const content = activeEvaluationSource?.content ?? ''
  const hasEvaluableContent = content.trim().length > 0
  const evaluationSourceTitle = activeEvaluationSource?.label ?? (isZh ? '评估来源' : 'Evaluation source')
  const evaluationSourceHint = availableEvaluationSources.length > 1
    ? (isZh
      ? '当前评分、建议和写作助手接力都基于这里选中的来源。需要时可以切换。'
      : 'Scores, suggestions, and Writing Helper handoff all use the selected source. Switch when you need a different input.')
    : (isZh
      ? '当前面板会基于这个来源给出评分、建议和下一步写作动作。'
      : 'This panel uses the current source for the score, recommendations, and next writing move.')
  const writerWorkflowTitle = isZh ? '基于当前来源的下一步动作' : 'Next move for this source'
  const writerWorkflowHint = isZh
    ? '先用面向作者的快捷动作处理当前来源。只有需要 plan_id、step_id 或生命周期控制时，再展开高级控制。'
    : 'Start with writer-facing actions for the current source. Use the advanced controls below when you need plan_id, step_id, or lifecycle commands.'
  const writerAdvancedTitle = isZh ? '高级控制' : 'Advanced controls'
  const writerAdvancedHint = isZh
    ? '保留完整流程能力，但把底层控制和确认令牌集中在这里。'
    : 'Full workflow power stays available here, with low-level controls and confirmation tokens kept out of the main path.'
  const compactSummaryTitle = isZh ? '先看结论' : 'Start with the verdict'
  const compactSummaryHint = isZh
    ? '默认先判断这条回复能不能直接用，以及最值得先处理的两点。'
    : 'Start with whether this reply is usable now and the two most important next steps.'
  const detailedReviewTitle = isZh ? '详细评估' : 'Detailed review'
  const detailedReviewHint = isZh
    ? '查看完整维度分析、全部建议，以及批量操作。'
    : 'See the full score breakdown, every suggestion, and batch actions.'
  const supportToolsTitle = isZh ? '更多工具' : 'More tools'
  const supportToolsHint = isZh
    ? '质量检查、流程编排和检查点放在这里，避免默认打断主链路。'
    : 'Quality checks, workflow orchestration, and checkpoints live here so they do not interrupt the default flow.'
  useEffect(() => {
    if (!availableEvaluationSources.some((source) => source.kind === selectedSourceKind)) {
      setSelectedSourceKind(availableEvaluationSources[0]?.kind ?? null)
    }
  }, [availableEvaluationSources, selectedSourceKind])

  useEffect(() => {
    setRevisionCandidate(null)
    setRevisionMessage(null)
  }, [content])
  const writingHelperModeLabelMap = {
    polish: t.writingHelperModePolish,
    rewrite: t.writingHelperModeRewrite,
    expand: t.writingHelperModeExpand,
    summarize: t.writingHelperModeSummarize,
    outline: t.writingHelperModeOutline,
  }
  const formatWritingHelperPresetSummary = (preset: ReturnType<typeof buildWritingHelperPreset>) => (
    isZh
      ? `${writingHelperModeLabelMap[preset.mode]} · ${preset.maxSentences} 句 · ${preset.maxItems} 条`
      : `${writingHelperModeLabelMap[preset.mode]} · ${preset.maxSentences} sentences · ${preset.maxItems} items`
  )
  const getContinueInWritingHelperLabel = (carriedContent: WritingHelperEvaluationHandoff['carriedContent']) => (
    isZh
      ? (carriedContent === 'revision-preview'
        ? '带着修改预览继续到写作助手'
        : '带着原始回复继续到写作助手')
      : (carriedContent === 'revision-preview'
        ? 'Continue to Writing Helper with the revision preview'
        : 'Continue to Writing Helper with the original reply')
  )
  const getWritingHelperPresetInlineLabel = (preset: ReturnType<typeof buildWritingHelperPreset>) => (
    isZh
      ? `写作助手预设：${formatWritingHelperPresetSummary(preset)}`
      : `Writing Helper preset: ${formatWritingHelperPresetSummary(preset)}`
  )
  const moreSuggestionsHint = (count: number) => (
    isZh
      ? `还有 ${count} 条建议，展开“详细评估”后可继续查看。`
      : `${count} more suggestions are available in detailed review.`
  )
  const baseRevisionCopy = getRevisionCopy(isZh ? 'zh' : 'en')
  const revisionCopy = {
    ...baseRevisionCopy,
    triggerLabel: isZh ? '生成修改预览' : 'Generate revision preview',
    triggeringLabel: isZh ? '生成中...' : 'Generating...',
    sourceLabel: baseRevisionCopy.originalLabel,
    insertedLabel: isZh ? '插入到编辑器' : 'Insert to editor',
    previewReadyMessage: isZh ? '已生成修改预览。' : 'Revision preview is ready.',
    helperHint: isZh
      ? '先生成一版修改结果，再决定是否替换正文。'
      : 'Generate a candidate revision first, then decide whether to apply it.',
  }
  const {
    workflowTask,
    workflowLevel,
    workflowPlanId,
    workflowStepId,
    workflowLifecycleAction,
    workflowStates,
    workflowResult,
    workflowConfirmToken,
    workflowGateReason,
    workflowWaitingConfirmation,
    setWorkflowTask,
    setWorkflowLevel,
    setWorkflowPlanId,
    setWorkflowStepId,
    setWorkflowLifecycleAction,
    setWorkflowConfirmToken,
    handleWorkflowRoute,
    handleWorkflowPlan,
    handleWorkflowExecute,
    handleWorkflowConfirmAndContinue,
    handleWorkflowLifecycle,
    retryWorkflowAction,
  } = useEvaluationWorkflow({
    content,
    defaultLevel: 'L3',
    workspace: workspaceSummary.meaningfulWorkspace,
    t: {
      evaluationWorkflowLoading: t.evaluationWorkflowLoading,
      evaluationWorkflowError: t.evaluationWorkflowError,
      evaluationWorkflowSuccess: t.evaluationWorkflowSuccess,
      evaluationWorkflowPlanIdRequired: t.evaluationWorkflowPlanIdRequired,
      evaluationWorkflowConfirmTokenRequired: t.evaluationWorkflowConfirmTokenRequired,
    },
  })
  const {
    evaluationError,
    loading,
    result,
    runEvaluation,
    suggestionsRefreshing,
    suggestionsRefreshError,
    refreshSuggestions,
  } = useEvaluationData({
    content,
    qualityGoals,
    t: {
      evaluationFailed: t.evaluationFailed,
      evaluationSuggestionsRefreshFailed: t.evaluationSuggestionsRefreshFailed,
      failureCategoryGeneration: t.failureCategoryGeneration,
      failureCategoryEvaluation: t.failureCategoryEvaluation,
      failureCategoryRetrieval: t.failureCategoryRetrieval,
      failureCategoryConnection: t.failureCategoryConnection,
      failureMessageGeneration: t.failureMessageGeneration,
      failureMessageEvaluation: t.failureMessageEvaluation,
      failureMessageRetrieval: t.failureMessageRetrieval,
      failureMessageConnection: t.failureMessageConnection,
    },
    translateSuggestions: (rawSuggestions) => normalizeSuggestionPayloads(rawSuggestions, translate),
    buildViewModel: (data) => {
      const { core, modules } = buildDimensions(
        {
          lock_score: data.lock_score as number,
          style_score: data.style_score as number,
          logic_score: data.logic_score as number,
          actionable_feedback: data.actionable_feedback as string,
          module_scores: data.module_scores as Record<string, number> | undefined,
        },
        t.evaluationNoFeedback,
        t,
      )
      return {
        score: Number((data.total_score / 10).toFixed(1)),
        dimensions: core,
        modules,
        suggestions: data.suggestions,
        decision: data.decision,
      }
    },
  })
  const {
    suggestionStates,
    batchState,
    resetRecommendationStates,
    handleApplySuggestion,
    handleUndoSuggestion,
    handleBatchApply,
    handleBatchUndo,
  } = useEvaluationRecommendations({
    content,
    suggestions: result?.suggestions ?? [],
    t,
    translate,
  })
  const addMessage = useAddMessage()
  const {
    checkpointDescription,
    checkpoints,
    checkpointError,
    setCheckpointDescription,
    refreshCheckpoints,
    handleCreateCheckpoint,
    handleRestoreCheckpoint,
  } = useEvaluationCheckpoints({
    t: {
      loadingCheckpoints: t.loadingCheckpoints,
      evaluationCheckpointPlaceholder: t.evaluationCheckpointPlaceholder,
      save: t.save,
      restoreFailed: t.restoreFailed,
    },
    onRestoreSuccess: async (checkpointId) => {
      addMessage('assistant', translate('restoreSuccessWithCheckpoint', { checkpointId }))
    },
  })
  const {
    qualityChecking,
    qualityCheckError,
    qualityCheckResult,
    runNovelQualityCheck,
  } = useEvaluationQualityCheck({
    content,
    qualityGoals,
    t: {
      evaluationQualityCheckFailed: t.evaluationQualityCheckFailed,
      evaluationNoFeedback: t.evaluationNoFeedback,
      failureCategoryGeneration: t.failureCategoryGeneration,
      failureCategoryEvaluation: t.failureCategoryEvaluation,
      failureCategoryRetrieval: t.failureCategoryRetrieval,
      failureCategoryConnection: t.failureCategoryConnection,
      failureMessageGeneration: t.failureMessageGeneration,
      failureMessageEvaluation: t.failureMessageEvaluation,
      failureMessageRetrieval: t.failureMessageRetrieval,
      failureMessageConnection: t.failureMessageConnection,
    },
  })

  const runWorkspaceConsistencyCheck = async () => {
    const activeWorkspace = workspaceSummary.meaningfulWorkspace
    if (!activeWorkspace) {
      setConsistencyCheckResult(null)
      setConsistencyCheckError(t.evaluationConsistencyFailed)
      return
    }

    const chapterTitle = workspaceSummary.chapterLabel ?? activeWorkspace.manuscript.chapterTitle ?? 'Chapter 1'
    const chapterNumber = activeWorkspace.manuscript.chapterNumber ?? 1

    setConsistencyChecking(true)
    setConsistencyCheckError(null)
    try {
      const response = await runConsistencyCheck(
        [content],
        [{ chapterNumber, title: chapterTitle }],
        undefined,
        activeWorkspace,
      )
      if (!response.success || !response.data) {
        setConsistencyCheckResult(null)
        setConsistencyCheckError(response.error || t.evaluationConsistencyFailed)
        return
      }

      setConsistencyCheckResult(response.data)
      const activeConversationId = useAppStore.getState().currentConversationId
      if (activeConversationId) {
        useAppStore.getState().syncConversationWorkspace(activeConversationId, response.data.workspace)
      } else {
        useAppStore.getState().setCurrentWorkspace(response.data.workspace)
      }
    } catch (error) {
      setConsistencyCheckResult(null)
      setConsistencyCheckError(error instanceof Error ? error.message : String(error))
    } finally {
      setConsistencyChecking(false)
    }
  }

  const getProviderFields = () => {
    const { settings } = useSettingsStore.getState()
    const provider = settings.llmProviders.find(
      (item) => item.id === settings.primaryProvider && item.enabled && item.apiKey,
    )

    return provider
      ? { api_key: provider.apiKey, base_url: provider.baseUrl, model: provider.defaultModel, provider: provider.id }
      : {}
  }

  const buildRevisionInstruction = (suggestion: RecommendationPayload) => (
    isZh
      ? `请根据下面的评估建议直接重写文本，并只输出修改后的完整版本，不要解释。\n\n评估建议：${suggestion.title}\n原因：${suggestion.reason}`
      : `Rewrite the text according to the evaluation guidance below. Return only the revised full text with no explanation.\n\nSuggestion: ${suggestion.title}\nReason: ${suggestion.reason}`
  )

  const buildWritingHelperGuidance = (suggestion: RecommendationPayload) => (
    isZh
      ? `优先处理这条评估建议：${suggestion.title}\n原因：${suggestion.reason}\n\n${buildSuggestionActionTemplate(detectSuggestionFocus(suggestion), true)}`
      : `Prioritize this evaluation guidance: ${suggestion.title}\nReason: ${suggestion.reason}\n\n${buildSuggestionActionTemplate(detectSuggestionFocus(suggestion), false)}`
  )

  const getWritingHelperContinueState = (suggestion: RecommendationPayload) => {
    const focus = detectSuggestionFocus(suggestion)
    const preset = buildWritingHelperPreset(focus)
    const carriedContent: WritingHelperEvaluationHandoff['carriedContent'] = revisionCandidate?.suggestionId === suggestion.id
      ? 'revision-preview'
      : 'original-reply'

    return {
      preset,
      carriedContent,
      continueLabel: getContinueInWritingHelperLabel(carriedContent),
      presetInlineLabel: getWritingHelperPresetInlineLabel(preset),
    }
  }

  useEffect(() => {
    resetRecommendationStates(result?.suggestions ?? [])
    setRevisionCandidate(null)
    setRevisionLoadingId(null)
    setRevisionMessage(null)
  }, [result?.suggestions])

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
  })

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-700 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
    if (score >= 6) return 'text-amber-800 bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300'
    return 'text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
  }

  const getDecisionStyle = (decision: string) => {
    switch (decision) {
      case 'APPROVED':
        return { icon: CheckCircle, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20', label: t.evaluationPassed }
      case 'REVISE':
        return { icon: AlertCircle, color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/20', label: t.evaluationNeedRevise }
      case 'REWRITE':
        return { icon: AlertCircle, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: t.evaluationNeedRewrite }
      default:
        return { icon: AlertCircle, color: 'text-gray-600 dark:text-dark-text-secondary', bg: 'bg-gray-50 dark:bg-dark-bg', label: t.evaluationUnknown }
    }
  }

  if (loading) {
    return (
      <div className={`${panelShellClassName} p-4`}>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </div>
    )
  }

  if (!hasEvaluableContent) {
    return (
      <div className={`${panelShellClassName} p-4`}>
        <div className="space-y-2 text-center">
          <div className="text-gray-500 dark:text-dark-text-secondary">{t.evaluationNoContent}</div>
          <div className="text-xs text-gray-400 dark:text-dark-text-muted">{evaluationSourceHint}</div>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className={`${panelShellClassName} p-4`}>
        <div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 text-left shadow-sm dark:border-red-500/20 dark:bg-red-950/20">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-300">
            {evaluationError?.label ?? t.evaluationFailed}
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-red-700 dark:text-red-200">
            {evaluationError?.message ?? t.evaluationFailed}
          </p>
          {evaluationError?.detail ? (
            <p className="mt-2 text-xs leading-relaxed text-red-600/90 dark:text-red-200/80">
              {evaluationError.detail}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void runEvaluation()
              }}
              className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 dark:bg-dark-surface dark:text-red-200 dark:hover:bg-red-950/40"
            >
              {t.evaluationRefresh}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-red-200 bg-transparent px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100/80 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-950/30"
            >
              {t.evaluationClose}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const decisionStyle = getDecisionStyle(result.decision)
  const DecisionIcon = decisionStyle.icon
  const primaryFeedback = result.dimensions.find((dim) => dim.feedback && dim.feedback !== t.evaluationNoFeedback)?.feedback
    ?? t.evaluationNoFeedback
  const previewSuggestions = result.suggestions.slice(0, 2)
  const remainingSuggestionCount = Math.max(0, result.suggestions.length - previewSuggestions.length)
  const scopeSubject = workspaceSummary.chapterLabel
    ?? workspaceSummary.projectLabel
    ?? (isZh ? '当前草稿' : 'the current draft')
  const writerWorkflowPresets = [
    {
      id: 'next-step',
      title: isZh ? '找出下一步写作重点' : 'Find the next writing move',
      description: isZh
        ? '让系统基于当前项目范围，为这一段内容推荐最合适的写作流程。'
        : 'Route this draft through the workflow that best fits the current project scope.',
      action: () => handleWorkflowRoute({
        task: isZh
          ? `围绕${scopeSubject}判断下一步最合适的写作流程，并说明为什么。`
          : `Choose the best next writing workflow for ${scopeSubject} and explain why.`,
        level: 'L3',
      }),
    },
    {
      id: 'revision-plan',
      title: isZh ? '制定修订计划' : 'Plan a revision pass',
      description: isZh
        ? '按当前章节与设定整理下一轮修订清单，优先处理连贯性、角色动机和节奏。'
        : 'Build the next revision pass for this draft with continuity, character motivation, and pacing at the top.',
      action: () => handleWorkflowPlan({
        task: isZh
          ? `为${scopeSubject}制定下一轮修订计划，优先检查连贯性、角色动机和节奏。`
          : `Create the next revision plan for ${scopeSubject}, focusing on continuity, motivation, and pacing.`,
        level: 'L3',
      }),
    },
    {
      id: 'continue-plan',
      title: isZh ? '继续当前流程' : 'Continue the current workflow',
      description: isZh
        ? '如果已经有计划，就继续执行；如果还没有，就先生成一个可执行计划。'
        : 'Resume the active plan when one exists, or create an executable plan first.',
      action: () => workflowPlanId.trim()
        ? handleWorkflowExecute({ planId: workflowPlanId })
        : handleWorkflowPlan({
          task: isZh
            ? `继续推进${scopeSubject}的写作流程，并给出当前最安全的下一步。`
            : `Continue the workflow for ${scopeSubject} and surface the safest next writing step.`,
          level: 'L3',
        }),
    },
  ]

  const handleGenerateRevisionPreview = async (
    suggestion: RecommendationPayload,
    surface: 'compact' | 'detailed',
  ) => {
    setRevisionLoadingId(suggestion.id)
    setRevisionMessage(null)
    const matchedSelectionSnapshot = captureMatchedSelectionSnapshot(content)

    try {
      const response = await processWritingHelper({
        content,
        mode: 'rewrite',
        instruction: buildRevisionInstruction(suggestion),
        detection_evasion_guard_enabled: detectionEvasionGuardEnabled,
        ...(workspaceSummary.meaningfulWorkspace ? { workspace: workspaceSummary.meaningfulWorkspace } : {}),
        ...getProviderFields(),
      })

      const candidateText = response.success && response.data?.processed_text
        ? response.data.processed_text.trim()
        : ''

      if (!response.success || !candidateText) {
        setRevisionCandidate(null)
        setRevisionMessage({
          suggestionId: suggestion.id,
          tone: 'error',
          text: response.error || t.evaluationFailed,
        })
        return
      }

      setRevisionCandidate({
        suggestionId: suggestion.id,
        sourceText: content,
        candidateText,
        selectionSnapshot: matchedSelectionSnapshot,
        surface,
      })
      setRevisionMessage({
        suggestionId: suggestion.id,
        tone: 'info',
        text: revisionCopy.previewReadyMessage,
      })
    } catch (error) {
      setRevisionCandidate(null)
      setRevisionMessage({
        suggestionId: suggestion.id,
        tone: 'error',
        text: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setRevisionLoadingId(null)
    }
  }

  const handleApplyRevisionCandidate = () => {
    if (!revisionCandidate) {
      return
    }

    const message = applyRevisionCandidateToEditor(revisionCandidate, baseRevisionCopy)
    if (message) {
      setRevisionMessage({
        suggestionId: revisionCandidate.suggestionId,
        tone: message === baseRevisionCopy.selectionChangedMessage ? 'error' : 'success',
        text: message,
      })
    }
  }

  const handleInsertRevisionAlternative = () => {
    if (!revisionCandidate) {
      return
    }

    const message = insertRevisionAlternativeToEditor(revisionCandidate, baseRevisionCopy)
    if (message) {
      setRevisionMessage({
        suggestionId: revisionCandidate.suggestionId,
        tone: message === baseRevisionCopy.selectionChangedMessage ? 'error' : 'success',
        text: message,
      })
    }
  }

  const handleUndoRevisionApply = () => {
    if (!revisionCandidate) {
      return
    }

    const message = undoLastRevisionApplyInEditor(baseRevisionCopy)
    if (message) {
      setRevisionMessage({
        suggestionId: revisionCandidate.suggestionId,
        tone: message === baseRevisionCopy.undoFailedMessage ? 'error' : 'success',
        text: message,
      })
    }
  }

  const handleOpenWritingHelper = (suggestion: RecommendationPayload) => {
    if (!onOpenWritingHelper) {
      return
    }

    const { preset, carriedContent } = getWritingHelperContinueState(suggestion)
    const guidance = buildWritingHelperGuidance(suggestion)
    const nextDraftContent = carriedContent === 'revision-preview'
      ? revisionCandidate!.candidateText
      : content

    onOpenWritingHelper({
      content: nextDraftContent,
      guidance,
      mode: preset.mode,
      maxSentences: preset.maxSentences,
      maxItems: preset.maxItems,
      handoff: {
        source: 'evaluation',
        suggestionTitle: suggestion.title,
        suggestionReason: suggestion.reason,
        guidance,
        carriedContent,
        preset: {
          mode: preset.mode,
          maxSentences: preset.maxSentences,
          maxItems: preset.maxItems,
        },
      },
    })
  }

  const renderRevisionPreview = (preview: EvaluationRevisionCandidate) => (
    <RevisionPreviewCard
      previewTitle={revisionCopy.previewTitle}
      originalLabel={revisionCopy.sourceLabel}
      candidateLabel={revisionCopy.candidateLabel}
      sourceText={preview.sourceText}
      candidateText={preview.candidateText}
      primaryActionLabel={preview.selectionSnapshot ? revisionCopy.replaceLabel : revisionCopy.insertedLabel}
      secondaryActionLabel={preview.selectionSnapshot ? revisionCopy.alternativeLabel : undefined}
      undoActionLabel={revisionCopy.undoLabel}
      onPrimaryAction={handleApplyRevisionCandidate}
      onSecondaryAction={preview.selectionSnapshot ? handleInsertRevisionAlternative : undefined}
      onUndoAction={handleUndoRevisionApply}
    />
  )

  const renderPreviewSuggestionItem = (suggestion: RecommendationPayload) => {
    const isGenerating = revisionLoadingId === suggestion.id
    const preview = revisionCandidate?.suggestionId === suggestion.id && revisionCandidate.surface === 'compact'
      ? revisionCandidate
      : null
    const itemMessage = revisionMessage?.suggestionId === suggestion.id ? revisionMessage : null
    const continueState = getWritingHelperContinueState(suggestion)

    return (
      <li key={suggestion.id} className="text-sm text-gray-600 dark:text-dark-text-secondary border border-gray-200 dark:border-dark-border rounded-xl p-3 bg-white dark:bg-dark-bg">
        <div className="flex items-start gap-2">
          <span className="text-blue-500">•</span>
          <div className="flex-1">
            <p className="font-medium text-gray-700 dark:text-dark-text">{suggestion.title}</p>
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{suggestion.reason}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-dark-text-secondary">
              {revisionCopy.helperHint}
            </p>
            {itemMessage && (
              <p className={`text-xs mt-2 ${itemMessage.tone === 'error' ? 'text-red-500' : itemMessage.tone === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                {itemMessage.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  void handleGenerateRevisionPreview(suggestion, 'compact')
                }}
                disabled={isGenerating}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
              >
                {isGenerating ? revisionCopy.triggeringLabel : revisionCopy.triggerLabel}
              </button>
              {onOpenWritingHelper && (
                <button
                  type="button"
                  onClick={() => handleOpenWritingHelper(suggestion)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded transition-colors hover:bg-gray-200 dark:bg-dark-border dark:text-dark-text"
                  aria-label={continueState.continueLabel}
                  title={continueState.continueLabel}
                >
                  {continueState.continueLabel}
                </button>
              )}
              {onOpenWritingHelper && (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary">
                  {continueState.presetInlineLabel}
                </span>
              )}
            </div>

            {preview && renderRevisionPreview(preview)}
          </div>
        </div>
      </li>
    )
  }

  const renderSuggestionItem = (suggestion: RecommendationPayload) => {
    const actionState = suggestionStates[suggestion.id] || defaultSuggestionState()
    const isGenerating = revisionLoadingId === suggestion.id
    const preview = revisionCandidate?.suggestionId === suggestion.id && revisionCandidate.surface === 'detailed'
      ? revisionCandidate
      : null
    const previewMessage = revisionMessage?.suggestionId === suggestion.id ? revisionMessage : null
    const continueState = getWritingHelperContinueState(suggestion)

    return (
      <li key={suggestion.id} className="text-sm text-gray-600 dark:text-dark-text-secondary border border-gray-200 dark:border-dark-border rounded-xl p-3 bg-white dark:bg-dark-bg">
        <div className="flex items-start gap-2">
          <span className="text-blue-500">•</span>
          <div className="flex-1">
            <p className="font-medium text-gray-700 dark:text-dark-text">{suggestion.title}</p>
            <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{suggestion.reason}</p>
            {actionState.message && (
              <p className={`text-xs mt-1 ${actionState.status === 'error' ? 'text-red-500' : actionState.status === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                {actionState.message}
              </p>
            )}
            {previewMessage && (
              <p className={`text-xs mt-1 ${previewMessage.tone === 'error' ? 'text-red-500' : previewMessage.tone === 'success' ? 'text-green-600' : 'text-gray-500'}`}>
                {previewMessage.text}
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                onClick={() => {
                  void handleGenerateRevisionPreview(suggestion, 'detailed')
                }}
                disabled={isGenerating}
                className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
              >
                {isGenerating ? revisionCopy.triggeringLabel : revisionCopy.triggerLabel}
              </button>
              {onOpenWritingHelper && (
                <button
                  type="button"
                  onClick={() => handleOpenWritingHelper(suggestion)}
                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded transition-colors hover:bg-gray-200 dark:bg-dark-border dark:text-dark-text"
                  aria-label={continueState.continueLabel}
                  title={continueState.continueLabel}
                >
                  {continueState.continueLabel}
                </button>
              )}
              {onOpenWritingHelper && (
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary">
                  {continueState.presetInlineLabel}
                </span>
              )}
              <button
                onClick={() => handleApplySuggestion(suggestion)}
                disabled={actionState.mode === 'processing'}
                className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                aria-label={t.evaluationApply}
                title={t.evaluationApply}
              >
                {t.evaluationApply}
              </button>
              <button
                onClick={() => handleUndoSuggestion(suggestion)}
                disabled={actionState.mode !== 'rollback-ready' || actionState.status === 'idle'}
                className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
                aria-label={t.evaluationUndo}
                title={t.evaluationUndo}
              >
                {t.evaluationUndo}
              </button>
            </div>
            {preview && renderRevisionPreview(preview)}
          </div>
        </div>
      </li>
    )
  }

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className={`${panelShellClassName} flex flex-col`}
      role="dialog"
      aria-modal="true"
      aria-label={t.evaluationTitle}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="flex items-center gap-2">
          <BarChart3 size={20} className="text-blue-600" />
          <span className="font-semibold text-gray-900 dark:text-dark-text">{t.evaluationTitle}</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={t.evaluationClose}
          title={t.evaluationClose}
        >
          ×
        </button>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-dark-border space-y-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 dark:border-blue-900/30 dark:bg-blue-950/20">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">
            {evaluationSourceTitle}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-blue-700/90 dark:text-blue-200/80">
            {evaluationSourceHint}
          </p>
          {availableEvaluationSources.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableEvaluationSources.map((source) => {
                const isActive = source.kind === activeEvaluationSource?.kind
                return (
                  <button
                    key={source.kind}
                    type="button"
                    onClick={() => setSelectedSourceKind(source.kind)}
                    aria-pressed={isActive}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      isActive
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-blue-200 bg-white/80 text-blue-700 hover:bg-blue-100 dark:border-blue-700 dark:bg-dark-surface dark:text-blue-200 dark:hover:bg-blue-900/30'
                    }`}
                  >
                    {source.label}
                  </button>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.evaluationOverallScore}</span>
          <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreColor(result.score)}`}>
            {result.score.toFixed(1)} / 10
          </div>
        </div>
        <div className={`flex items-center gap-2 p-3 rounded-lg ${decisionStyle.bg}`}>
          <DecisionIcon size={20} className={decisionStyle.color} />
          <span className={`font-medium ${decisionStyle.color}`}>{decisionStyle.label}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="rounded-2xl border border-gray-200 bg-gray-50/80 p-4 dark:border-dark-border dark:bg-dark-bg/70">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
            {compactSummaryTitle}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
            {compactSummaryHint}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-dark-text">
            {primaryFeedback}
          </p>
        </div>

        {previewSuggestions.length > 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-dark-border dark:bg-dark-surface">
            <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3 flex items-center gap-2">
              <TrendingUp size={16} />
              {t.evaluationSuggestions}
            </h3>
            <ul className="space-y-2">
              {previewSuggestions.map((suggestion) => renderPreviewSuggestionItem(suggestion))}
            </ul>
            {remainingSuggestionCount > 0 && (
              <p className="mt-3 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                {moreSuggestionsHint(remainingSuggestionCount)}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
          <button
            type="button"
            onClick={() => setShowDetailedReview((prev) => !prev)}
            className="flex w-full items-start justify-between gap-3 text-left"
            aria-expanded={showDetailedReview}
            aria-label={detailedReviewTitle}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
                {detailedReviewTitle}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                {detailedReviewHint}
              </p>
            </div>
            {showDetailedReview ? (
              <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
            ) : (
              <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
            )}
          </button>
          {showDetailedReview && (
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.evaluationDimensionAnalysis}</h3>
                <div className="space-y-3">
                  {result.dimensions.map((dim, index) => (
                    <div key={index} className="p-3 bg-white dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{dim.name}</span>
                        <span className={`text-sm font-medium ${dim.score >= 7 ? 'text-green-700 dark:text-green-400' : dim.score >= 5 ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                          {dim.score}/10
                        </span>
                      </div>
                      <div className="w-full bg-gray-300 dark:bg-dark-border2 rounded-full h-2 mb-2">
                        <div
                          className={`h-2 rounded-full ${dim.score >= 7 ? 'bg-green-600 dark:bg-green-500' : dim.score >= 5 ? 'bg-amber-700 dark:bg-amber-500' : 'bg-red-600 dark:bg-red-500'}`}
                          style={{ width: `${dim.score * 10}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{dim.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>

              {result.modules.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text mb-3">{t.evaluationModuleBreakdown}</h3>
                  <div className="space-y-2">
                    {result.modules.map((mod) => (
                      <div key={mod.name} className="flex items-center gap-3 p-2 bg-white dark:bg-dark-surface rounded-lg border border-gray-200 dark:border-dark-border">
                        <span className="text-sm font-medium text-gray-700 dark:text-dark-text flex-1">{mod.name}</span>
                        <span className={`text-sm font-medium ${mod.score >= 7 ? 'text-green-700 dark:text-green-400' : mod.score >= 5 ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                          {mod.score}/10
                        </span>
                        <div className="w-24 bg-gray-300 dark:bg-dark-border2 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${mod.score >= 7 ? 'bg-green-600 dark:bg-green-500' : mod.score >= 5 ? 'bg-amber-700 dark:bg-amber-500' : 'bg-red-600 dark:bg-red-500'}`}
                            style={{ width: `${mod.score * 10}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {result.suggestions.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      onClick={refreshSuggestions}
                      disabled={suggestionsRefreshing}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
                      aria-label={t.evaluationSuggestionsRefresh}
                      title={t.evaluationSuggestionsRefresh}
                    >
                      {suggestionsRefreshing ? t.evaluationSuggestionsRefreshing : t.evaluationSuggestionsRefresh}
                    </button>
                    <button
                      onClick={handleBatchApply}
                      disabled={batchState.mode === 'processing'}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                      aria-label={t.evaluationBatchApply}
                      title={t.evaluationBatchApply}
                    >
                      {t.evaluationBatchApply}
                    </button>
                    <button
                      onClick={handleBatchUndo}
                      disabled={batchState.mode === 'processing' || batchState.lastAppliedIds.length === 0}
                      className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded disabled:opacity-50"
                      aria-label={t.evaluationBatchUndo}
                      title={t.evaluationBatchUndo}
                    >
                      {t.evaluationBatchUndo}
                    </button>
                  </div>
                  {suggestionsRefreshError && (
                    <p className="mb-3 text-xs text-red-500" role="alert">
                      {suggestionsRefreshError}
                    </p>
                  )}
                  {batchState.message && (
                    <p className={`mb-3 text-xs ${batchState.status === 'error' ? 'text-red-500' : 'text-green-600'}`}>
                      {batchState.message}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {result.suggestions.map((suggestion) => renderSuggestionItem(suggestion))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
          <button
            type="button"
            onClick={() => setShowSupportTools((prev) => !prev)}
            className="flex w-full items-start justify-between gap-3 text-left"
            aria-expanded={showSupportTools}
            aria-label={supportToolsTitle}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
                {supportToolsTitle}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                {supportToolsHint}
              </p>
            </div>
            {showSupportTools ? (
              <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
            ) : (
              <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
            )}
          </button>
          {showSupportTools && (
            <div className="mt-4 space-y-6">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.evaluationQualityCheckTitle}</span>
                  <button
                    onClick={runNovelQualityCheck}
                    disabled={qualityChecking}
                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
                    aria-label={t.evaluationQualityCheckRun}
                    title={t.evaluationQualityCheckRun}
                  >
                    {qualityChecking ? t.evaluationQualityCheckRunning : t.evaluationQualityCheckRun}
                  </button>
                </div>
                {qualityCheckError && (
                  <p className="text-xs text-red-500">{qualityCheckError}</p>
                )}
                {qualityCheckResult && (
                  <div className="mt-2 p-2 rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-xs text-gray-700 dark:text-dark-text-secondary">
                    <div className="font-medium text-gray-800 dark:text-dark-text mb-1">
                      {t.evaluationQualityCheckDecision}: {qualityCheckResult.decision}
                    </div>
                    <div>{t.evaluationQualityCheckTotal}: {qualityCheckResult.totalScore}</div>
                    <div>{t.evaluationQualityCheckLock}: {qualityCheckResult.lockScore}</div>
                    <div>{t.evaluationQualityCheckStyle}: {qualityCheckResult.styleScore}</div>
                    <div>{t.evaluationQualityCheckLogic}: {qualityCheckResult.logicScore}</div>
                    <div className="mt-1">{t.evaluationQualityCheckFeedback}: {qualityCheckResult.feedback}</div>
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-dark-border pt-4">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-dark-text">{t.evaluationConsistencyTitle}</span>
                  <button
                    onClick={() => {
                      void runWorkspaceConsistencyCheck()
                    }}
                    disabled={consistencyChecking || !workspaceSummary.hasMeaningfulScope}
                    className="px-2 py-1 text-xs bg-indigo-600 text-white rounded disabled:opacity-50"
                    aria-label={t.evaluationConsistencyRun}
                    title={t.evaluationConsistencyRun}
                  >
                    {consistencyChecking ? t.evaluationConsistencyRunning : t.evaluationConsistencyRun}
                  </button>
                </div>
                {!workspaceSummary.hasMeaningfulScope && (
                  <p className="text-xs text-gray-500 dark:text-dark-text-secondary">
                    {isZh ? '需要先进入带项目范围的工作区后才能执行一致性治理。' : 'Consistency governance needs a workspace-scoped project context first.'}
                  </p>
                )}
                {consistencyCheckError && (
                  <p className="text-xs text-red-500">{consistencyCheckError}</p>
                )}
                {consistencyCheckResult && (
                  <div className="mt-2 p-2 rounded border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-xs text-gray-700 dark:text-dark-text-secondary">
                    <div className="font-medium text-gray-800 dark:text-dark-text mb-1">
                      {t.evaluationConsistencyRunId}: {consistencyCheckResult.runId}
                    </div>
                    <div>{t.evaluationConsistencyScore}: {consistencyCheckResult.combined.overallScore}</div>
                    <div>{t.evaluationConsistencyConflicts}: {consistencyCheckResult.combined.totalConflicts}</div>
                    <div className="mt-1">{t.evaluationConsistencySummary}: {consistencyCheckResult.combined.summary}</div>
                    {consistencyCheckResult.combined.moduleScores && (
                      <div className="mt-2 pt-2 border-t border-gray-200 dark:border-dark-border">
                        <div className="font-medium text-gray-800 dark:text-dark-text mb-1">{t.evaluationModuleBreakdown}</div>
                        {Object.entries(consistencyCheckResult.combined.moduleScores).map(([name, score]) => (
                          <div key={name} className="flex items-center gap-2 py-0.5">
                            <span className="flex-1">{name}</span>
                            <span className={`font-medium ${Number(score) >= 7 ? 'text-green-700 dark:text-green-400' : Number(score) >= 5 ? 'text-amber-800 dark:text-amber-300' : 'text-red-700 dark:text-red-400'}`}>
                              {Number(score).toFixed(1)}
                            </span>
                            <div className="w-16 bg-gray-300 dark:bg-dark-border2 rounded-full h-1">
                              <div
                                className={`h-1 rounded-full ${Number(score) >= 7 ? 'bg-green-600 dark:bg-green-500' : Number(score) >= 5 ? 'bg-amber-700 dark:bg-amber-500' : 'bg-red-600 dark:bg-red-500'}`}
                                style={{ width: `${Number(score) * 10}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-dark-border pt-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{writerWorkflowTitle}</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                  {writerWorkflowHint}
                </p>
                {workspaceSummary.hasMeaningfulScope && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workspaceSummary.scopeChips.map((chip) => (
                      <span
                        key={`evaluation-scope-${chip}`}
                        className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                )}
                {onOpenAutomation && (
                  <button
                    type="button"
                    onClick={onOpenAutomation}
                    className="mt-3 w-full rounded-2xl border border-indigo-200 bg-indigo-50 px-3 py-3 text-left transition-colors hover:bg-indigo-100/80 dark:border-indigo-500/30 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30"
                  >
                    <div className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                      {isZh ? '打开自动化任务面板' : 'Open automation tasks panel'}
                    </div>
                    <div className="mt-1 text-xs leading-relaxed text-indigo-700/80 dark:text-indigo-200/80">
                      {isZh ? '查看调度任务状态，并执行审批、重试或恢复操作。' : 'Review scheduler task states and run approval, retry, or recovery actions.'}
                    </div>
                  </button>
                )}
                <div className="mt-3 space-y-2">
                  {writerWorkflowPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        void preset.action()
                      }}
                      className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/60 dark:border-dark-border dark:bg-dark-bg dark:hover:border-primary-500/30 dark:hover:bg-dark-surface"
                    >
                      <div className="text-sm font-medium text-gray-800 dark:text-dark-text">{preset.title}</div>
                      <div className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                        {preset.description}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedWorkflow((prev) => !prev)}
                    className="flex w-full items-start justify-between gap-3 text-left"
                    aria-expanded={showAdvancedWorkflow}
                    aria-label={writerAdvancedTitle}
                  >
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
                        {writerAdvancedTitle}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                        {writerAdvancedHint}
                      </p>
                    </div>
                    {showAdvancedWorkflow ? (
                      <ChevronDown size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
                    ) : (
                      <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400 dark:text-dark-text-secondary" />
                    )}
                  </button>
                  {showAdvancedWorkflow && (
                    <>
                      <div className="mt-3 space-y-2">
                        <input
                          value={workflowTask}
                          onChange={(e) => setWorkflowTask(e.target.value)}
                          placeholder={t.evaluationWorkflowTaskPlaceholder}
                          aria-label={t.evaluationWorkflowTaskPlaceholder}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                        />
                        <input
                          value={workflowLevel}
                          onChange={(e) => setWorkflowLevel(e.target.value)}
                          placeholder={t.evaluationWorkflowLevelPlaceholder}
                          aria-label={t.evaluationWorkflowLevelPlaceholder}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                        />
                        <input
                          value={workflowPlanId}
                          onChange={(e) => setWorkflowPlanId(e.target.value)}
                          placeholder={t.evaluationWorkflowPlanIdPlaceholder}
                          aria-label={t.evaluationWorkflowPlanIdPlaceholder}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                        />
                        <input
                          value={workflowStepId}
                          onChange={(e) => setWorkflowStepId(e.target.value)}
                          placeholder={t.evaluationWorkflowStepIdPlaceholder}
                          aria-label={t.evaluationWorkflowStepIdPlaceholder}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                        />
                        <select
                          value={workflowLifecycleAction}
                          onChange={(e) => setWorkflowLifecycleAction(e.target.value as WorkflowLifecycleAction)}
                          aria-label={t.evaluationWorkflowLifecycleActionLabel}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                        >
                          <option value="status">{t.evaluationWorkflowLifecycleStatus}</option>
                          <option value="start">{t.evaluationWorkflowLifecycleStart}</option>
                          <option value="pause">{t.evaluationWorkflowLifecyclePause}</option>
                          <option value="resume">{t.evaluationWorkflowLifecycleResume}</option>
                          <option value="stop">{t.evaluationWorkflowLifecycleStop}</option>
                        </select>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            void handleWorkflowRoute()
                          }}
                          disabled={workflowStates.route.status === 'loading'}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                          aria-label={t.evaluationWorkflowRoute}
                          title={t.evaluationWorkflowRoute}
                        >
                          {t.evaluationWorkflowRoute}
                        </button>
                        <button
                          onClick={() => {
                            void handleWorkflowPlan()
                          }}
                          disabled={workflowStates.plan.status === 'loading'}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                          aria-label={t.evaluationWorkflowPlan}
                          title={t.evaluationWorkflowPlan}
                        >
                          {t.evaluationWorkflowPlan}
                        </button>
                        <button
                          onClick={() => {
                            void handleWorkflowExecute()
                          }}
                          disabled={workflowStates.execute.status === 'loading'}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                          aria-label={t.evaluationWorkflowExecute}
                          title={t.evaluationWorkflowExecute}
                        >
                          {t.evaluationWorkflowExecute}
                        </button>
                        <button
                          onClick={() => {
                            void handleWorkflowLifecycle()
                          }}
                          disabled={workflowStates.lifecycle.status === 'loading'}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded disabled:opacity-50"
                          aria-label={t.evaluationWorkflowLifecycle}
                          title={t.evaluationWorkflowLifecycle}
                        >
                          {t.evaluationWorkflowLifecycle}
                        </button>
                      </div>

                      {workflowWaitingConfirmation && (
                        <div className="mt-3 rounded border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-2 text-xs">
                          <div className="font-medium text-amber-700 dark:text-amber-200">{t.evaluationWorkflowWaitingConfirmation}</div>
                          {workflowGateReason && (
                            <div className="mt-1 text-amber-700/80 dark:text-amber-200/80">{t.evaluationWorkflowGateReason}: {workflowGateReason}</div>
                          )}
                          <div className="mt-2 flex gap-2">
                            <input
                              value={workflowConfirmToken}
                              onChange={(e) => setWorkflowConfirmToken(e.target.value)}
                              placeholder={t.evaluationWorkflowConfirmTokenPlaceholder}
                              aria-label={t.evaluationWorkflowConfirmTokenPlaceholder}
                              className="flex-1 px-2 py-1 text-xs border border-amber-200 dark:border-amber-700 dark:bg-dark-bg dark:text-dark-text rounded"
                            />
                            <button
                              onClick={() => {
                                void handleWorkflowConfirmAndContinue()
                              }}
                              disabled={workflowStates.execute.status === 'loading'}
                              className="px-2 py-1 text-xs bg-amber-600 text-white rounded disabled:opacity-50"
                              aria-label={t.evaluationWorkflowConfirmAndContinue}
                              title={t.evaluationWorkflowConfirmAndContinue}
                            >
                              {t.evaluationWorkflowConfirmAndContinue}
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 space-y-2 text-xs">
                        {(['route', 'plan', 'execute', 'lifecycle'] as WorkflowAction[]).map((action) => {
                          const state = workflowStates[action]
                          if (state.status === 'idle' || !state.message) {
                            return null
                          }
                          return (
                            <div key={action} className="flex items-center justify-between gap-2">
                              <span className={state.status === 'error' ? 'text-red-500' : state.status === 'success' ? 'text-green-600' : 'text-gray-500'}>
                                {getWorkflowActionLabel(action, t)}: {state.message}
                              </span>
                              {state.status === 'error' && (
                                <button
                                  onClick={() => {
                                    void retryWorkflowAction(action)
                                  }}
                                  className="px-2 py-1 bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
                                  aria-label={t.evaluationWorkflowRetry}
                                  title={t.evaluationWorkflowRetry}
                                >
                                  {t.evaluationWorkflowRetry}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>

                      {workflowResult && (
                        <pre className="mt-3 p-2 rounded border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-bg text-[11px] text-gray-700 dark:text-dark-text-secondary overflow-x-auto whitespace-pre-wrap">
                          {workflowResult}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              </div>

              <div className="border-t border-gray-200 dark:border-dark-border pt-4">
                <div className="flex gap-2 mb-3">
                  <input
                    value={checkpointDescription}
                    onChange={(e) => setCheckpointDescription(e.target.value)}
                    placeholder={t.evaluationCheckpointPlaceholder}
                    aria-label={t.evaluationCheckpointPlaceholder}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                  />
                  <button
                    onClick={handleCreateCheckpoint}
                    className="px-3 py-2 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                    aria-label={t.save}
                    title={t.save}
                  >
                    {t.save}
                  </button>
                  <button
                    onClick={refreshCheckpoints}
                    className="px-3 py-2 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
                    aria-label={t.evaluationRefresh}
                    title={t.evaluationRefresh}
                  >
                    {t.evaluationRefresh}
                  </button>
                </div>
                {checkpointError && (
                  <p className="text-xs text-red-500 mb-2">{checkpointError}</p>
                )}
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {checkpoints.map((checkpoint) => (
                    <div
                      key={checkpoint.id}
                      className="p-2 border border-gray-200 dark:border-dark-border rounded"
                    >
                      <div className="text-xs text-gray-700 dark:text-dark-text">{checkpoint.description || checkpoint.id}</div>
                      <div className="text-[11px] text-gray-500 dark:text-dark-text-secondary">{checkpoint.created_at}</div>
                      <button
                        onClick={() => handleRestoreCheckpoint(checkpoint.id)}
                        className="mt-1 px-2 py-1 text-xs bg-gray-100 dark:bg-dark-border dark:text-dark-text rounded"
                        aria-label={t.restore}
                        title={t.restore}
                      >
                        {t.restore}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
