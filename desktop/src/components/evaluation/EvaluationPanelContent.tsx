import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertCircle, BarChart3, CheckCircle } from 'lucide-react'

import { runConsistencyCheck, type ConsistencyCheckResult, type RecommendationPayload } from '../../api/client'
import { processWritingHelper } from '../../api/writing'
import { useDialogFocusTrap } from '../../hooks/useDialogFocusTrap'
import { useEvaluationCheckpoints } from '../../hooks/useEvaluationCheckpoints'
import { useEvaluationData } from '../../hooks/useEvaluationData'
import { useEvaluationQualityCheck } from '../../hooks/useEvaluationQualityCheck'
import { useEvaluationRecommendations, defaultSuggestionState } from '../../hooks/useEvaluationRecommendations'
import { useEvaluationWorkflow, type WorkflowLifecycleAction } from '../../hooks/useEvaluationWorkflow'
import type { WritingHelperEvaluationHandoff } from '../../hooks/useAppUiPersistence'
import { useWriterWorkspaceSummary } from '../../hooks/useWriterWorkspaceSummary'
import { useI18n } from '../../i18n'
import { RevisionOrchestrator } from '../../services/revisionOrchestrator'
import { useAppStore } from '../../stores/appStore'
import { useSettingsStore } from '../../stores/settingsStore'
import { type EvaluationSourceDescriptor, useAddMessage } from '../../stores/selectors'
import { applyRevisionCandidateToEditor, captureMatchedSelectionSnapshot, getRevisionCopy, insertRevisionAlternativeToEditor, undoLastRevisionApplyInEditor, type RevisionCandidate } from '../../utils/revisionLoop'
import { RevisionPreviewCard } from '../RevisionPreviewCard'
import { EvaluationCompactReviewSection } from './EvaluationCompactReviewSection'
import { EvaluationDetailedReviewSection } from './EvaluationDetailedReviewSection'
import { EvaluationSourceSection } from './EvaluationSourceSection'
import { EvaluationSupportToolsSection } from './EvaluationSupportToolsSection'
import { buildDimensions, buildSuggestionActionTemplate, buildWritingHelperPreset, detectSuggestionFocus, normalizeSuggestionPayloads } from './suggestionUtils'
import type { EvaluationWorkflowPreset } from './EvaluationWorkflowSection'

export interface EvaluationPanelProps {
  content?: string
  evaluationSources?: EvaluationSourceDescriptor[]
  onClose: () => void
  onOpenAutomation?: () => void
  onOpenWritingHelper?: (handoff: { content: string; guidance: string; mode: 'polish' | 'rewrite' | 'expand' | 'summarize' | 'outline'; maxSentences: number; maxItems: number; handoff: WritingHelperEvaluationHandoff }) => void
}
interface EvaluationRevisionCandidate extends RevisionCandidate { suggestionId: string; surface: 'compact' | 'detailed' }
export const panelShellClassName = 'fixed right-0 top-14 bottom-0 z-30 w-80 border-l border-gray-200 bg-white shadow-lg dark:border-dark-border dark:bg-dark-surface'

export function EvaluationPanel({ content: fallbackContent = '', evaluationSources, onClose, onOpenAutomation, onOpenWritingHelper }: EvaluationPanelProps) {
  const { t, translate, language } = useI18n()
  const isZh = language === 'zh'
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const [showAdvancedWorkflow, setShowAdvancedWorkflow] = useState(false)
  const [showDetailedReview, setShowDetailedReview] = useState(false)
  const [showSupportTools, setShowSupportTools] = useState(false)
  const [consistencyChecking, setConsistencyChecking] = useState(false)
  const [consistencyCheckError, setConsistencyCheckError] = useState<string | null>(null)
  const [consistencyCheckResult, setConsistencyCheckResult] = useState<ConsistencyCheckResult | null>(null)
  const [revisionCandidate, setRevisionCandidate] = useState<EvaluationRevisionCandidate | null>(null)
  const [revisionLoadingId, setRevisionLoadingId] = useState<string | null>(null)
  const [revisionMessage, setRevisionMessage] = useState<{ suggestionId: string; tone: 'error' | 'success' | 'info'; text: string } | null>(null)
  const [multiPassTarget, setMultiPassTarget] = useState(8)
  const [multiPassMaxIter, setMultiPassMaxIter] = useState(5)
  const [multiPassRunning, setMultiPassRunning] = useState(false)
  const [multiPassResult, setMultiPassResult] = useState<{ iterations: number; initialScore: number; finalScore: number; reason: string; sessionId?: string | null; revisionSession?: { id?: string | null; chapterId: string; state: string; iteration: number; comparisonSummary?: string | null } | null } | null>(null)
  const qualityGoals = useSettingsStore((state) => state.settings.qualityGoals)
  const detectionEvasionGuardEnabled = useSettingsStore((state) => state.settings.detectionEvasionGuardEnabled)
  const workspaceSummary = useWriterWorkspaceSummary()
  const availableEvaluationSources = useMemo(() => (evaluationSources?.length ? evaluationSources : [{ kind: 'latestAssistantReply', label: isZh ? '最近一次助手回复' : 'Latest assistant reply', content: fallbackContent } satisfies EvaluationSourceDescriptor])
    .map((source) => ({ ...source, content: source.content.trim() }))
    .filter((source, index, sources) => source.content.length > 0 && sources.findIndex((candidate) => candidate.kind === source.kind) === index), [evaluationSources, fallbackContent, isZh])
  const [selectedSourceKind, setSelectedSourceKind] = useState<EvaluationSourceDescriptor['kind'] | null>(availableEvaluationSources[0]?.kind ?? null)
  const activeEvaluationSource = availableEvaluationSources.find((source) => source.kind === selectedSourceKind) ?? availableEvaluationSources[0] ?? null
  const content = activeEvaluationSource?.content ?? ''
  const hasEvaluableContent = content.trim().length > 0
  const evaluationSourceTitle = activeEvaluationSource?.label ?? (isZh ? '评估来源' : 'Evaluation source')
  const evaluationSourceHint = availableEvaluationSources.length > 1
    ? (isZh ? '当前评分、建议和写作助手接力都基于这里选中的来源。需要时可以切换。' : 'Scores, suggestions, and Writing Helper handoff all use the selected source. Switch when you need a different input.')
    : (isZh ? '当前面板会基于这个来源给出评分、建议和下一步写作动作。' : 'This panel uses the current source for the score, recommendations, and next writing move.')
  const writerWorkflowTitle = isZh ? '基于当前来源的下一步动作' : 'Next move for this source'
  const writerWorkflowHint = isZh ? '先用面向作者的快捷动作处理当前来源。只有需要 plan_id、step_id 或生命周期控制时，再展开高级控制。' : 'Start with writer-facing actions for the current source. Use the advanced controls below when you need plan_id, step_id, or lifecycle commands.'
  const writerAdvancedTitle = isZh ? '高级控制' : 'Advanced controls'
  const writerAdvancedHint = isZh ? '保留完整流程能力，但把底层控制和确认令牌集中在这里。' : 'Full workflow power stays available here, with low-level controls and confirmation tokens kept out of the main path.'
  const compactSummaryTitle = isZh ? '先看结论' : 'Start with the verdict'
  const compactSummaryHint = isZh ? '默认先判断这条回复能不能直接用，以及最值得先处理的两点。' : 'Start with whether this reply is usable now and the two most important next steps.'
  const detailedReviewTitle = isZh ? '详细评估' : 'Detailed review'
  const detailedReviewHint = isZh ? '查看完整维度分析、全部建议，以及批量操作。' : 'See the full score breakdown, every suggestion, and batch actions.'
  const supportToolsTitle = isZh ? '更多工具' : 'More tools'
  const supportToolsHint = isZh ? '质量检查、流程编排和检查点放在这里，避免默认打断主链路。' : 'Quality checks, workflow orchestration, and checkpoints live here so they do not interrupt the default flow.'
  const noConsistencyScopeHint = isZh ? '需要先进入带项目范围的工作区后才能执行一致性治理。' : 'Consistency governance needs a workspace-scoped project context first.'
  const writingHelperModeLabelMap = { polish: t.writingHelperModePolish, rewrite: t.writingHelperModeRewrite, expand: t.writingHelperModeExpand, summarize: t.writingHelperModeSummarize, outline: t.writingHelperModeOutline }
  const baseRevisionCopy = getRevisionCopy(isZh ? 'zh' : 'en')
  const revisionCopy = { ...baseRevisionCopy, triggerLabel: isZh ? '生成修改预览' : 'Generate revision preview', triggeringLabel: isZh ? '生成中...' : 'Generating...', sourceLabel: baseRevisionCopy.originalLabel, insertedLabel: isZh ? '插入到编辑器' : 'Insert to editor', previewReadyMessage: isZh ? '已生成修改预览。' : 'Revision preview is ready.', helperHint: isZh ? '先生成一版修改结果，再决定是否替换正文。' : 'Generate a candidate revision first, then decide whether to apply it.' }

  useEffect(() => { if (!availableEvaluationSources.some((source) => source.kind === selectedSourceKind)) setSelectedSourceKind(availableEvaluationSources[0]?.kind ?? null) }, [availableEvaluationSources, selectedSourceKind])
  useEffect(() => { setRevisionCandidate(null); setRevisionMessage(null) }, [content])
  useDialogFocusTrap({ containerRef: dialogRef, onClose })

  const { workflowTask, workflowLevel, workflowPlanId, workflowStepId, workflowLifecycleAction, workflowStates, workflowResult, workflowConfirmToken, workflowGateReason, workflowWaitingConfirmation, setWorkflowTask, setWorkflowLevel, setWorkflowPlanId, setWorkflowStepId, setWorkflowLifecycleAction, setWorkflowConfirmToken, handleWorkflowRoute, handleWorkflowPlan, handleWorkflowExecute, handleWorkflowConfirmAndContinue, handleWorkflowLifecycle, retryWorkflowAction } = useEvaluationWorkflow({
    content,
    defaultLevel: 'L3',
    workspace: workspaceSummary.meaningfulWorkspace,
    t: { evaluationWorkflowLoading: t.evaluationWorkflowLoading, evaluationWorkflowError: t.evaluationWorkflowError, evaluationWorkflowSuccess: t.evaluationWorkflowSuccess, evaluationWorkflowPlanIdRequired: t.evaluationWorkflowPlanIdRequired, evaluationWorkflowConfirmTokenRequired: t.evaluationWorkflowConfirmTokenRequired },
  })
  const { evaluationError, loading, result, runEvaluation, suggestionsRefreshing, suggestionsRefreshError, refreshSuggestions } = useEvaluationData({
    content,
    qualityGoals,
    t: { evaluationFailed: t.evaluationFailed, evaluationSuggestionsRefreshFailed: t.evaluationSuggestionsRefreshFailed, failureCategoryGeneration: t.failureCategoryGeneration, failureCategoryEvaluation: t.failureCategoryEvaluation, failureCategoryRetrieval: t.failureCategoryRetrieval, failureCategoryConnection: t.failureCategoryConnection, failureMessageGeneration: t.failureMessageGeneration, failureMessageEvaluation: t.failureMessageEvaluation, failureMessageRetrieval: t.failureMessageRetrieval, failureMessageConnection: t.failureMessageConnection },
    translateSuggestions: (rawSuggestions) => normalizeSuggestionPayloads(rawSuggestions, translate),
    buildViewModel: (data) => {
      const { core, modules } = buildDimensions({ lock_score: data.lock_score as number, style_score: data.style_score as number, logic_score: data.logic_score as number, actionable_feedback: data.actionable_feedback as string, module_scores: data.module_scores as Record<string, number> | undefined }, t.evaluationNoFeedback, t)
      return { score: Number((data.total_score / 10).toFixed(1)), dimensions: core, modules, suggestions: data.suggestions, decision: data.decision }
    },
  })
  const { suggestionStates, batchState, resetRecommendationStates, handleApplySuggestion, handleUndoSuggestion, handleBatchApply, handleBatchUndo } = useEvaluationRecommendations({ content, suggestions: result?.suggestions ?? [], t, translate })
  const addMessage = useAddMessage()
  const { checkpointDescription, checkpoints, checkpointError, setCheckpointDescription, refreshCheckpoints, handleCreateCheckpoint, handleRestoreCheckpoint } = useEvaluationCheckpoints({
    t: { loadingCheckpoints: t.loadingCheckpoints, evaluationCheckpointPlaceholder: t.evaluationCheckpointPlaceholder, save: t.save, restoreFailed: t.restoreFailed },
    onRestoreSuccess: async (checkpointId) => { addMessage('assistant', translate('restoreSuccessWithCheckpoint', { checkpointId })) },
  })
  const { qualityChecking, qualityCheckError, qualityCheckResult, runNovelQualityCheck } = useEvaluationQualityCheck({
    content,
    qualityGoals,
    t: { evaluationQualityCheckFailed: t.evaluationQualityCheckFailed, evaluationNoFeedback: t.evaluationNoFeedback, failureCategoryGeneration: t.failureCategoryGeneration, failureCategoryEvaluation: t.failureCategoryEvaluation, failureCategoryRetrieval: t.failureCategoryRetrieval, failureCategoryConnection: t.failureCategoryConnection, failureMessageGeneration: t.failureMessageGeneration, failureMessageEvaluation: t.failureMessageEvaluation, failureMessageRetrieval: t.failureMessageRetrieval, failureMessageConnection: t.failureMessageConnection },
  })

  const getProviderFields = () => {
    const { settings } = useSettingsStore.getState()
    const provider = settings.llmProviders.find((item) => item.id === settings.primaryProvider && item.enabled && item.apiKey)
    return provider ? { api_key: provider.apiKey, base_url: provider.baseUrl, model: provider.defaultModel, provider: provider.id } : {}
  }
  const getScoreColor = (score: number) => score >= 8 ? 'text-green-700 bg-green-100 dark:bg-green-900/20 dark:text-green-400' : score >= 6 ? 'text-amber-800 bg-amber-100 dark:bg-amber-900/20 dark:text-amber-300' : 'text-red-700 bg-red-100 dark:bg-red-900/20 dark:text-red-400'
  const getDecisionStyle = (decision: string) => decision === 'APPROVED'
    ? { icon: CheckCircle, color: 'text-green-700 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/20', label: t.evaluationPassed }
    : decision === 'REVISE'
      ? { icon: AlertCircle, color: 'text-amber-800 dark:text-amber-300', bg: 'bg-amber-100 dark:bg-amber-900/20', label: t.evaluationNeedRevise }
      : decision === 'REWRITE'
        ? { icon: AlertCircle, color: 'text-red-700 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/20', label: t.evaluationNeedRewrite }
        : { icon: AlertCircle, color: 'text-gray-600 dark:text-dark-text-secondary', bg: 'bg-gray-50 dark:bg-dark-bg', label: t.evaluationUnknown }
  const buildRevisionInstruction = (suggestion: RecommendationPayload) => isZh
    ? `请根据下面的评估建议直接重写文本，并只输出修改后的完整版本，不要解释。\n\n评估建议：${suggestion.title}\n原因：${suggestion.reason}`
    : `Rewrite the text according to the evaluation guidance below. Return only the revised full text with no explanation.\n\nSuggestion: ${suggestion.title}\nReason: ${suggestion.reason}`
  const buildWritingHelperGuidance = (suggestion: RecommendationPayload) => isZh
    ? `优先处理这条评估建议：${suggestion.title}\n原因：${suggestion.reason}\n\n${buildSuggestionActionTemplate(detectSuggestionFocus(suggestion), true)}`
    : `Prioritize this evaluation guidance: ${suggestion.title}\nReason: ${suggestion.reason}\n\n${buildSuggestionActionTemplate(detectSuggestionFocus(suggestion), false)}`
  const formatWritingHelperPresetSummary = (preset: ReturnType<typeof buildWritingHelperPreset>) => isZh ? `${writingHelperModeLabelMap[preset.mode]} · ${preset.maxSentences} 句 · ${preset.maxItems} 条` : `${writingHelperModeLabelMap[preset.mode]} · ${preset.maxSentences} sentences · ${preset.maxItems} items`
  const getContinueInWritingHelperLabel = (carriedContent: WritingHelperEvaluationHandoff['carriedContent']) => isZh ? (carriedContent === 'revision-preview' ? '带着修改预览继续到写作助手' : '带着原始回复继续到写作助手') : (carriedContent === 'revision-preview' ? 'Continue to Writing Helper with the revision preview' : 'Continue to Writing Helper with the original reply')
  const getWritingHelperContinueState = (suggestion: RecommendationPayload) => {
    const preset = buildWritingHelperPreset(detectSuggestionFocus(suggestion))
    const carriedContent: WritingHelperEvaluationHandoff['carriedContent'] = revisionCandidate?.suggestionId === suggestion.id ? 'revision-preview' : 'original-reply'
    return { preset, carriedContent, continueLabel: getContinueInWritingHelperLabel(carriedContent), presetInlineLabel: isZh ? `写作助手预设：${formatWritingHelperPresetSummary(preset)}` : `Writing Helper preset: ${formatWritingHelperPresetSummary(preset)}` }
  }
  const moreSuggestionsHint = (count: number) => isZh ? `还有 ${count} 条建议，展开“详细评估”后可继续查看。` : `${count} more suggestions are available in detailed review.`

  const runWorkspaceConsistencyCheck = async () => {
    const activeWorkspace = workspaceSummary.meaningfulWorkspace
    if (!activeWorkspace) { setConsistencyCheckResult(null); setConsistencyCheckError(t.evaluationConsistencyFailed); return }
    setConsistencyChecking(true)
    setConsistencyCheckError(null)
    try {
      const response = await runConsistencyCheck([content], [{ chapterNumber: activeWorkspace.manuscript.chapterNumber ?? 1, title: workspaceSummary.chapterLabel ?? activeWorkspace.manuscript.chapterTitle ?? 'Chapter 1' }], undefined, activeWorkspace)
      if (!response.success || !response.data) { setConsistencyCheckResult(null); setConsistencyCheckError(response.error || t.evaluationConsistencyFailed); return }
      setConsistencyCheckResult(response.data)
      const conversationId = useAppStore.getState().currentConversationId
      if (conversationId) useAppStore.getState().syncConversationWorkspace(conversationId, response.data.workspace)
      else useAppStore.getState().setCurrentWorkspace(response.data.workspace)
    } catch (error) {
      setConsistencyCheckResult(null)
      setConsistencyCheckError(error instanceof Error ? error.message : String(error))
    } finally { setConsistencyChecking(false) }
  }
  const handleMultiPassRevision = async () => {
    if (!content.trim()) return
    setMultiPassRunning(true)
    setMultiPassResult(null)
    try {
      const revisionResult = await new RevisionOrchestrator({ targetScore: multiPassTarget, maxIterations: multiPassMaxIter, workspace: workspaceSummary.meaningfulWorkspace ?? undefined }).run(content)
      setMultiPassResult({
        iterations: revisionResult.iterations,
        initialScore: revisionResult.initialScore,
        finalScore: revisionResult.finalScore,
        reason: revisionResult.reason,
        sessionId: revisionResult.sessionId ?? null,
        revisionSession: revisionResult.revisionSession ?? null,
      })
    } catch { setMultiPassResult({ iterations: 0, initialScore: 0, finalScore: 0, reason: 'error' }) } finally { setMultiPassRunning(false) }
  }
  const handleGenerateRevisionPreview = async (suggestion: RecommendationPayload, surface: 'compact' | 'detailed') => {
    setRevisionLoadingId(suggestion.id)
    setRevisionMessage(null)
    try {
      const response = await processWritingHelper({ content, mode: 'rewrite', instruction: buildRevisionInstruction(suggestion), detection_evasion_guard_enabled: detectionEvasionGuardEnabled, ...(workspaceSummary.meaningfulWorkspace ? { workspace: workspaceSummary.meaningfulWorkspace } : {}), ...getProviderFields() })
      const candidateText = response.success && response.data?.processed_text ? response.data.processed_text.trim() : ''
      if (!response.success || !candidateText) { setRevisionCandidate(null); setRevisionMessage({ suggestionId: suggestion.id, tone: 'error', text: response.error || t.evaluationFailed }); return }
      setRevisionCandidate({ suggestionId: suggestion.id, sourceText: content, candidateText, selectionSnapshot: captureMatchedSelectionSnapshot(content), surface })
      setRevisionMessage({ suggestionId: suggestion.id, tone: 'info', text: revisionCopy.previewReadyMessage })
    } catch (error) { setRevisionCandidate(null); setRevisionMessage({ suggestionId: suggestion.id, tone: 'error', text: error instanceof Error ? error.message : String(error) }) } finally { setRevisionLoadingId(null) }
  }
  const handleApplyRevisionCandidate = () => {
    if (!revisionCandidate) return
    const message = applyRevisionCandidateToEditor(revisionCandidate, baseRevisionCopy)
    if (message) setRevisionMessage({ suggestionId: revisionCandidate.suggestionId, tone: message === baseRevisionCopy.selectionChangedMessage ? 'error' : 'success', text: message })
  }
  const handleInsertRevisionAlternative = () => {
    if (!revisionCandidate) return
    const message = insertRevisionAlternativeToEditor(revisionCandidate, baseRevisionCopy)
    if (message) setRevisionMessage({ suggestionId: revisionCandidate.suggestionId, tone: message === baseRevisionCopy.selectionChangedMessage ? 'error' : 'success', text: message })
  }
  const handleUndoRevisionApply = () => {
    if (!revisionCandidate) return
    const message = undoLastRevisionApplyInEditor(baseRevisionCopy)
    if (message) setRevisionMessage({ suggestionId: revisionCandidate.suggestionId, tone: message === baseRevisionCopy.undoFailedMessage ? 'error' : 'success', text: message })
  }
  const handleOpenWritingHelper = (suggestion: RecommendationPayload) => {
    if (!onOpenWritingHelper) return
    const { preset, carriedContent } = getWritingHelperContinueState(suggestion)
    const guidance = buildWritingHelperGuidance(suggestion)
    onOpenWritingHelper({
      content: carriedContent === 'revision-preview' ? revisionCandidate!.candidateText : content,
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
        revisionSession: multiPassResult?.revisionSession
          ? {
              id: multiPassResult.sessionId ?? 'revision-session',
              chapterId: multiPassResult.revisionSession.chapterId,
              state: multiPassResult.revisionSession.state,
              iteration: multiPassResult.revisionSession.iteration,
              comparisonSummary: multiPassResult.revisionSession.comparisonSummary ?? null,
            }
          : null,
      },
    })
  }

  useEffect(() => { resetRecommendationStates(result?.suggestions ?? []); setRevisionCandidate(null); setRevisionLoadingId(null); setRevisionMessage(null) }, [result?.suggestions, resetRecommendationStates])

  const decisionStyle = result ? getDecisionStyle(result.decision) : null
  const primaryFeedback = result?.dimensions.find((dimension) => dimension.feedback && dimension.feedback !== t.evaluationNoFeedback)?.feedback ?? t.evaluationNoFeedback
  const previewSuggestions = result?.suggestions.slice(0, 2) ?? []
  const remainingSuggestionCount = Math.max(0, (result?.suggestions.length ?? 0) - previewSuggestions.length)
  const scopeSubject = workspaceSummary.chapterLabel ?? workspaceSummary.projectLabel ?? (isZh ? '当前草稿' : 'the current draft')
  const writerWorkflowPresets: EvaluationWorkflowPreset[] = [
    { id: 'next-step', title: isZh ? '找出下一步写作重点' : 'Find the next writing move', description: isZh ? '让系统基于当前项目范围，为这一段内容推荐最合适的写作流程。' : 'Route this draft through the workflow that best fits the current project scope.', action: () => handleWorkflowRoute({ task: isZh ? `围绕${scopeSubject}判断下一步最合适的写作流程，并说明为什么。` : `Choose the best next writing workflow for ${scopeSubject} and explain why.`, level: 'L3' }) },
    { id: 'revision-plan', title: isZh ? '制定修订计划' : 'Plan a revision pass', description: isZh ? '按当前章节与设定整理下一轮修订清单，优先处理连贯性、角色动机和节奏。' : 'Build the next revision pass for this draft with continuity, character motivation, and pacing at the top.', action: () => handleWorkflowPlan({ task: isZh ? `为${scopeSubject}制定下一轮修订计划，优先检查连贯性、角色动机和节奏。` : `Create the next revision plan for ${scopeSubject}, focusing on continuity, motivation, and pacing.`, level: 'L3' }) },
    { id: 'continue-plan', title: isZh ? '继续当前流程' : 'Continue the current workflow', description: isZh ? '如果已经有计划，就继续执行；如果还没有，就先生成一个可执行计划。' : 'Resume the active plan when one exists, or create an executable plan first.', action: () => workflowPlanId.trim() ? handleWorkflowExecute({ planId: workflowPlanId }) : handleWorkflowPlan({ task: isZh ? `继续推进${scopeSubject}的写作流程，并给出当前最安全的下一步。` : `Continue the workflow for ${scopeSubject} and surface the safest next writing step.`, level: 'L3' }) },
  ]
  const renderRevisionPreview = (preview: EvaluationRevisionCandidate) => <RevisionPreviewCard previewTitle={revisionCopy.previewTitle} originalLabel={revisionCopy.sourceLabel} candidateLabel={revisionCopy.candidateLabel} sourceText={preview.sourceText} candidateText={preview.candidateText} primaryActionLabel={preview.selectionSnapshot ? revisionCopy.replaceLabel : revisionCopy.insertedLabel} secondaryActionLabel={preview.selectionSnapshot ? revisionCopy.alternativeLabel : undefined} undoActionLabel={revisionCopy.undoLabel} onPrimaryAction={handleApplyRevisionCandidate} onSecondaryAction={preview.selectionSnapshot ? handleInsertRevisionAlternative : undefined} onUndoAction={handleUndoRevisionApply} />
  const renderSuggestionCard = (suggestion: RecommendationPayload, surface: 'compact' | 'detailed'): ReactNode => {
    const actionState = surface === 'detailed' ? (suggestionStates[suggestion.id] || defaultSuggestionState()) : null
    const preview = revisionCandidate?.suggestionId === suggestion.id && revisionCandidate.surface === surface ? revisionCandidate : null
    const message = revisionMessage?.suggestionId === suggestion.id ? revisionMessage : null
    const continueState = getWritingHelperContinueState(suggestion)
    return (
      <li key={suggestion.id} className="rounded-xl border border-gray-200 bg-white p-3 text-sm text-gray-600 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
        <div className="flex items-start gap-2"><span className="text-blue-500">•</span><div className="flex-1">
          <p className="font-medium text-gray-700 dark:text-dark-text">{suggestion.title}</p>
          <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{suggestion.reason}</p>
          {surface === 'compact' && <p className="mt-2 text-[11px] leading-relaxed text-gray-500 dark:text-dark-text-secondary">{revisionCopy.helperHint}</p>}
          {actionState?.message && <p className={`mt-1 text-xs ${actionState.status === 'error' ? 'text-red-500' : actionState.status === 'success' ? 'text-green-600' : 'text-gray-500'}`}>{actionState.message}</p>}
          {message && <p className={`mt-${surface === 'compact' ? '2' : '1'} text-xs ${message.tone === 'error' ? 'text-red-500' : message.tone === 'success' ? 'text-green-600' : 'text-gray-500'}`}>{message.text}</p>}
          <div className={`flex flex-wrap gap-2 ${surface === 'compact' ? 'mt-3' : 'mt-2'}`}>
            <button type="button" onClick={() => { void handleGenerateRevisionPreview(suggestion, surface) }} disabled={revisionLoadingId === suggestion.id} className={`rounded px-2 py-1 text-xs text-white disabled:opacity-50 ${surface === 'compact' ? 'bg-blue-600' : 'bg-indigo-600'}`}>{revisionLoadingId === suggestion.id ? revisionCopy.triggeringLabel : revisionCopy.triggerLabel}</button>
            {onOpenWritingHelper && <button type="button" onClick={() => handleOpenWritingHelper(suggestion)} className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-700 transition-colors hover:bg-gray-200 dark:bg-dark-border dark:text-dark-text" aria-label={continueState.continueLabel} title={continueState.continueLabel}>{continueState.continueLabel}</button>}
            {onOpenWritingHelper && <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] font-medium text-gray-600 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text-secondary">{continueState.presetInlineLabel}</span>}
            {surface === 'detailed' && <button onClick={() => handleApplySuggestion(suggestion)} disabled={actionState?.mode === 'processing'} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50" aria-label={t.evaluationApply} title={t.evaluationApply}>{t.evaluationApply}</button>}
            {surface === 'detailed' && <button onClick={() => handleUndoSuggestion(suggestion)} disabled={actionState?.mode !== 'rollback-ready' || actionState.status === 'idle'} className="rounded bg-gray-100 px-2 py-1 text-xs dark:bg-dark-border dark:text-dark-text disabled:opacity-50" aria-label={t.evaluationUndo} title={t.evaluationUndo}>{t.evaluationUndo}</button>}
          </div>
          {preview && renderRevisionPreview(preview)}
        </div></div>
      </li>
    )
  }

  if (loading) return <div className={`${panelShellClassName} p-4`}><div className="flex h-full items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" /></div></div>
  if (!hasEvaluableContent) return <div className={`${panelShellClassName} p-4`}><div className="space-y-2 text-center"><div className="text-gray-500 dark:text-dark-text-secondary">{t.evaluationNoContent}</div><div className="text-xs text-gray-400 dark:text-dark-text-muted">{evaluationSourceHint}</div></div></div>
  if (!result || !decisionStyle) {
    return <div className={`${panelShellClassName} p-4`}><div className="rounded-2xl border border-red-100 bg-red-50/80 p-4 text-left shadow-sm dark:border-red-500/20 dark:bg-red-950/20"><div className="text-xs font-semibold uppercase tracking-[0.18em] text-red-600 dark:text-red-300">{evaluationError?.label ?? t.evaluationFailed}</div><p className="mt-2 text-sm font-medium leading-relaxed text-red-700 dark:text-red-200">{evaluationError?.message ?? t.evaluationFailed}</p>{evaluationError?.detail ? <p className="mt-2 text-xs leading-relaxed text-red-600/90 dark:text-red-200/80">{evaluationError.detail}</p> : null}<div className="mt-4 flex flex-wrap gap-2"><button type="button" onClick={() => { void runEvaluation() }} className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 dark:bg-dark-surface dark:text-red-200 dark:hover:bg-red-950/40">{t.evaluationRefresh}</button><button type="button" onClick={onClose} className="rounded-lg border border-red-200 bg-transparent px-3 py-2 text-xs font-semibold text-red-700 transition-colors hover:bg-red-100/80 dark:border-red-500/30 dark:text-red-200 dark:hover:bg-red-950/30">{t.evaluationClose}</button></div></div></div>
  }

  const DecisionIcon = decisionStyle.icon
  return (
    <div ref={dialogRef} tabIndex={-1} className={`${panelShellClassName} flex flex-col`} role="dialog" aria-modal="true" aria-label={t.evaluationTitle}>
      <div className="flex items-center justify-between border-b border-gray-200 p-4 dark:border-dark-border"><div className="flex items-center gap-2"><BarChart3 size={20} className="text-blue-600" /><span className="font-semibold text-gray-900 dark:text-dark-text">{t.evaluationTitle}</span></div><button onClick={onClose} className="rounded text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:text-dark-text" aria-label={t.evaluationClose} title={t.evaluationClose}>×</button></div>
      <div className="space-y-3 border-b border-gray-200 p-4 dark:border-dark-border">
        <EvaluationSourceSection title={evaluationSourceTitle} hint={evaluationSourceHint} sources={availableEvaluationSources} activeKind={activeEvaluationSource?.kind ?? null} onSelect={setSelectedSourceKind} />
        <div className="mb-3 flex items-center justify-between"><span className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.evaluationOverallScore}</span><div className={`rounded-full px-3 py-1 text-sm font-medium ${getScoreColor(result.score)}`}>{result.score.toFixed(1)} / 10</div></div>
        <div className={`flex items-center gap-2 rounded-lg p-3 ${decisionStyle.bg}`}><DecisionIcon size={20} className={decisionStyle.color} /><span className={`font-medium ${decisionStyle.color}`}>{decisionStyle.label}</span></div>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <EvaluationCompactReviewSection
          compactSummaryTitle={compactSummaryTitle}
          compactSummaryHint={compactSummaryHint}
          primaryFeedback={primaryFeedback}
          suggestionsTitle={t.evaluationSuggestions}
          previewSuggestions={previewSuggestions}
          remainingSuggestionCount={remainingSuggestionCount}
          moreSuggestionsHint={moreSuggestionsHint}
          renderPreviewSuggestionItem={(suggestion: RecommendationPayload) => renderSuggestionCard(suggestion, 'compact')}
        />
        <EvaluationDetailedReviewSection title={detailedReviewTitle} hint={detailedReviewHint} open={showDetailedReview} onToggle={() => setShowDetailedReview((prev) => !prev)} dimensionAnalysisTitle={t.evaluationDimensionAnalysis} dimensions={result.dimensions} moduleBreakdownTitle={t.evaluationModuleBreakdown} modules={result.modules} suggestionsTitle={t.evaluationSuggestions} suggestions={result.suggestions} renderSuggestionItem={(suggestion) => renderSuggestionCard(suggestion, 'detailed')} refreshSuggestionsLabel={t.evaluationSuggestionsRefresh} refreshingSuggestionsLabel={t.evaluationSuggestionsRefreshing} batchApplyLabel={t.evaluationBatchApply} batchUndoLabel={t.evaluationBatchUndo} onRefreshSuggestions={() => { void refreshSuggestions() }} onBatchApply={() => { void handleBatchApply() }} onBatchUndo={() => { void handleBatchUndo() }} suggestionsRefreshing={suggestionsRefreshing} batchProcessing={batchState.mode === 'processing'} canBatchUndo={batchState.lastAppliedIds.length > 0} suggestionsRefreshError={suggestionsRefreshError} batchMessage={batchState.message ?? null} batchStatus={batchState.status} />
        <EvaluationSupportToolsSection title={supportToolsTitle} hint={supportToolsHint} open={showSupportTools} onToggle={() => setShowSupportTools((prev) => !prev)} qualityTitle={t.evaluationQualityCheckTitle} qualityRunLabel={t.evaluationQualityCheckRun} qualityRunningLabel={t.evaluationQualityCheckRunning} qualityChecking={qualityChecking} qualityCheckError={qualityCheckError} qualityCheckResult={qualityCheckResult} qualityDecisionLabel={t.evaluationQualityCheckDecision} qualityTotalLabel={t.evaluationQualityCheckTotal} qualityLockLabel={t.evaluationQualityCheckLock} qualityStyleLabel={t.evaluationQualityCheckStyle} qualityLogicLabel={t.evaluationQualityCheckLogic} qualityFeedbackLabel={t.evaluationQualityCheckFeedback} onRunQualityCheck={() => { void runNovelQualityCheck() }} isZh={isZh} content={content} multiPassTarget={multiPassTarget} multiPassMaxIter={multiPassMaxIter} multiPassRunning={multiPassRunning} multiPassResult={multiPassResult} onMultiPassTargetChange={setMultiPassTarget} onMultiPassMaxIterChange={setMultiPassMaxIter} onRunMultiPass={() => { void handleMultiPassRevision() }} consistencyTitle={t.evaluationConsistencyTitle} consistencyRunLabel={t.evaluationConsistencyRun} consistencyRunningLabel={t.evaluationConsistencyRunning} consistencyChecking={consistencyChecking} consistencyCheckError={consistencyCheckError} consistencyCheckResult={consistencyCheckResult ? { runId: consistencyCheckResult.runId, combined: consistencyCheckResult.combined } : null} consistencyRunIdLabel={t.evaluationConsistencyRunId} consistencyScoreLabel={t.evaluationConsistencyScore} consistencyConflictsLabel={t.evaluationConsistencyConflicts} consistencySummaryLabel={t.evaluationConsistencySummary} hasMeaningfulScope={workspaceSummary.hasMeaningfulScope} noScopeHint={noConsistencyScopeHint} onRunConsistency={() => { void runWorkspaceConsistencyCheck() }} moduleBreakdownTitle={t.evaluationModuleBreakdown} workflowProps={{ isZh, writerWorkflowTitle, writerWorkflowHint, writerAdvancedTitle, writerAdvancedHint, scopeChips: workspaceSummary.scopeChips, hasMeaningfulScope: workspaceSummary.hasMeaningfulScope, onOpenAutomation, presets: writerWorkflowPresets, showAdvancedWorkflow, onToggleAdvancedWorkflow: () => setShowAdvancedWorkflow((prev) => !prev), workflowTask, workflowLevel, workflowPlanId, workflowStepId, workflowLifecycleAction, workflowConfirmToken, workflowWaitingConfirmation, workflowGateReason, workflowResult: workflowResult || null, workflowStates, setWorkflowTask, setWorkflowLevel, setWorkflowPlanId, setWorkflowStepId, setWorkflowLifecycleAction: (value) => setWorkflowLifecycleAction(value as WorkflowLifecycleAction), setWorkflowConfirmToken, onWorkflowRoute: () => { void handleWorkflowRoute() }, onWorkflowPlan: () => { void handleWorkflowPlan() }, onWorkflowExecute: () => { void handleWorkflowExecute() }, onWorkflowLifecycle: () => { void handleWorkflowLifecycle() }, onWorkflowConfirmAndContinue: () => { void handleWorkflowConfirmAndContinue() }, onRetryWorkflowAction: (action) => { void retryWorkflowAction(action) }, labels: { taskPlaceholder: t.evaluationWorkflowTaskPlaceholder, levelPlaceholder: t.evaluationWorkflowLevelPlaceholder, planIdPlaceholder: t.evaluationWorkflowPlanIdPlaceholder, stepIdPlaceholder: t.evaluationWorkflowStepIdPlaceholder, lifecycleActionLabel: t.evaluationWorkflowLifecycleActionLabel, lifecycleStatus: t.evaluationWorkflowLifecycleStatus, lifecycleStart: t.evaluationWorkflowLifecycleStart, lifecyclePause: t.evaluationWorkflowLifecyclePause, lifecycleResume: t.evaluationWorkflowLifecycleResume, lifecycleStop: t.evaluationWorkflowLifecycleStop, route: t.evaluationWorkflowRoute, plan: t.evaluationWorkflowPlan, execute: t.evaluationWorkflowExecute, lifecycle: t.evaluationWorkflowLifecycle, waitingConfirmation: t.evaluationWorkflowWaitingConfirmation, gateReason: t.evaluationWorkflowGateReason, confirmTokenPlaceholder: t.evaluationWorkflowConfirmTokenPlaceholder, confirmAndContinue: t.evaluationWorkflowConfirmAndContinue, retry: t.evaluationWorkflowRetry } }} checkpointDescription={checkpointDescription} checkpointPlaceholder={t.evaluationCheckpointPlaceholder} checkpointError={checkpointError} checkpoints={checkpoints} saveLabel={t.save} refreshLabel={t.evaluationRefresh} restoreLabel={t.restore} onCheckpointDescriptionChange={setCheckpointDescription} onCreateCheckpoint={() => { void handleCreateCheckpoint() }} onRefreshCheckpoints={() => { void refreshCheckpoints() }} onRestoreCheckpoint={(id) => { void handleRestoreCheckpoint(id) }} />
      </div>
    </div>
  )
}
