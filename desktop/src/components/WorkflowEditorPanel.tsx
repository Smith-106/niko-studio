import React, { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import { useI18n } from '../i18n'
import type { Workflow, WorkflowStep, WorkflowExecution, AgentMode, InputSource, CheckpointType } from '../types/workflow'

interface PanelProps {
  onClose: () => void
}

function emptyStep(index: number): WorkflowStep {
  return {
    id: crypto.randomUUID().slice(0, 8),
    name: '',
    agentMode: 'writing',
    prompt: '',
    inputSource: index === 0 ? 'chapter_content' : 'previous_step',
    checkpoint: 'none',
    enabled: true,
  }
}

const MODE_ICON_MAP: Record<AgentMode, string> = {
  writing: '✍️',
  analysis: '🔍',
  evaluation: '📊',
  custom: '⚙️',
}

function ConfirmDeleteDialog({ message, cancelLabel, confirmLabel, onConfirm, onCancel }: { message: string; cancelLabel: string; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded">
      <div className="bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-xl p-4 mx-4 shadow-xl max-w-[280px] w-full">
        <p className="text-sm font-medium text-gray-900 dark:text-dark-text">{message}</p>
        <div className="flex gap-2 mt-3">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-1.5 text-sm font-medium border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-3 py-1.5 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-500 transition-colors"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export const WorkflowEditorPanel: React.FC<PanelProps> = ({ onClose }) => {
  const {
    workflows,
    activeExecution,
    workflowsLoading,
    workflowsError,
    fetchWorkflows,
    saveWorkflow,
    deleteWorkflow,
    startExecution,
    approveStep: storeApproveStep,
    rejectStep: storeRejectStep,
  } = useAppStore()

  const { t } = useI18n()
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null)
  const [view, setView] = useState<'list' | 'edit' | 'execution'>('list')
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const handleSelectWorkflow = useCallback((wf: Workflow) => {
    setSelectedWorkflow({ ...wf, steps: wf.steps.map((s) => ({ ...s })) })
    setView('edit')
  }, [])

  const handleCreateWorkflow = useCallback(() => {
    const now = new Date().toISOString()
    const wf: Workflow = {
      id: crypto.randomUUID().slice(0, 8),
      name: '',
      description: '',
      steps: [emptyStep(0)],
      isBuiltin: false,
      createdAt: now,
      updatedAt: now,
    }
    setSelectedWorkflow(wf)
    setView('edit')
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedWorkflow || !selectedWorkflow.name.trim()) return
    await saveWorkflow(selectedWorkflow)
    setSelectedWorkflow(null)
    setView('list')
  }, [selectedWorkflow, saveWorkflow])

  const handleDelete = useCallback(async (id: string) => {
    await deleteWorkflow(id)
    setDeleteTargetId(null)
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(null)
      setView('list')
    }
  }, [deleteWorkflow, selectedWorkflow])

  const updateStep = useCallback((stepId: string, updates: Partial<WorkflowStep>) => {
    setSelectedWorkflow((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        steps: prev.steps.map((s) => (s.id === stepId ? { ...s, ...updates } : s)),
      }
    })
  }, [])

  const addStep = useCallback(() => {
    setSelectedWorkflow((prev) => {
      if (!prev) return prev
      return { ...prev, steps: [...prev.steps, emptyStep(prev.steps.length)] }
    })
  }, [])

  const removeStep = useCallback((stepId: string) => {
    setSelectedWorkflow((prev) => {
      if (!prev) return prev
      return { ...prev, steps: prev.steps.filter((s) => s.id !== stepId) }
    })
  }, [])

  const handleStartExecution = useCallback((wf: Workflow) => {
    if (!wf.steps.some((s) => s.enabled)) return
    startExecution(
      wf.id,
      '',
      () => '',
      () => '',
      () => '',
    )
    setView('execution')
  }, [startExecution])

  const handleApprove = useCallback((modifiedOutput?: string) => {
    storeApproveStep(() => '', () => '', () => '', modifiedOutput)
  }, [storeApproveStep])

  const handleReject = useCallback(() => {
    storeRejectStep()
    setView('list')
  }, [storeRejectStep])

  const modeOptions: { value: AgentMode; label: string }[] = [
    { value: 'writing', label: t.workflowModeWriting },
    { value: 'analysis', label: t.workflowModeAnalysis },
    { value: 'evaluation', label: t.workflowModeEvaluation },
    { value: 'custom', label: t.workflowModeCustom },
  ]

  const inputSourceOptions: { value: InputSource; label: string }[] = [
    { value: 'previous_step', label: t.workflowInputPreviousStep },
    { value: 'chapter_content', label: t.workflowInputChapterContent },
    { value: 'story_bible', label: t.workflowInputStoryBible },
    { value: 'outline', label: t.workflowInputOutline },
  ]

  const checkpointOptions: { value: CheckpointType; label: string }[] = [
    { value: 'none', label: t.workflowCheckpointNone },
    { value: 'review', label: t.workflowCheckpointReview },
    { value: 'approve', label: t.workflowCheckpointApprove },
  ]

  return (
    <div
      className="w-[400px] h-full bg-white dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text flex flex-col"
      role="region"
      aria-label={t.workflowTitle}
    >
      <div className="p-4 border-b border-gray-200 dark:border-dark-border shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider">{t.workflowTitle}</h2>
          <div className="flex items-center gap-2">
            {view !== 'list' && (
              <button
                onClick={() => setView('list')}
                className="text-xs text-gray-500 dark:text-dark-text-muted hover:text-gray-700 dark:hover:text-dark-text px-2 py-1 transition-colors"
              >
                {t.workflowBackToList}
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text text-lg transition-colors">&times;</button>
          </div>
        </div>
      </div>

      {workflowsError && (
        <div className="px-4 py-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/10">{workflowsError}</div>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar relative">
        {view === 'list' && (
          <WorkflowList
            workflows={workflows}
            loading={workflowsLoading}
            deleteTargetId={deleteTargetId}
            onSelect={handleSelectWorkflow}
            onCreate={handleCreateWorkflow}
            onDelete={handleDelete}
            onCancelDelete={() => setDeleteTargetId(null)}
            onRequestDelete={setDeleteTargetId}
            onExecute={handleStartExecution}
          />
        )}

        {view === 'edit' && selectedWorkflow && (
          <StepEditor
            workflow={selectedWorkflow}
            modeOptions={modeOptions}
            inputSourceOptions={inputSourceOptions}
            checkpointOptions={checkpointOptions}
            onUpdateName={(name) => setSelectedWorkflow((prev) => prev ? { ...prev, name } : prev)}
            onUpdateDescription={(desc) => setSelectedWorkflow((prev) => prev ? { ...prev, description: desc } : prev)}
            onUpdateStep={updateStep}
            onAddStep={addStep}
            onRemoveStep={removeStep}
            onSave={handleSave}
          />
        )}

        {view === 'execution' && activeExecution && (
          <ExecutionView
            execution={activeExecution}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </div>
    </div>
  )
}

// --- Sub-components ---

interface WorkflowListProps {
  workflows: Workflow[]
  loading: boolean
  deleteTargetId: string | null
  onSelect: (wf: Workflow) => void
  onCreate: () => void
  onDelete: (id: string) => void
  onCancelDelete: () => void
  onRequestDelete: (id: string) => void
  onExecute: (wf: Workflow) => void
}

const WorkflowList: React.FC<WorkflowListProps> = ({
  workflows,
  loading,
  deleteTargetId,
  onSelect,
  onCreate,
  onDelete,
  onCancelDelete,
  onRequestDelete,
  onExecute,
}) => {
  const { t, translate } = useI18n()
  return (
    <div className="p-4 space-y-2">
      <button
        onClick={onCreate}
        className="w-full py-2 px-4 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors"
      >
        {t.workflowCreateNew}
      </button>

      {loading && !workflows.length ? (
        <p className="text-center text-gray-500 dark:text-dark-text-muted text-sm py-4">{t.workflowLoading}</p>
      ) : (
        workflows.map((wf) => (
          <div
            key={wf.id}
            className="relative p-3 rounded-lg bg-gray-50 dark:bg-dark-surface/70 hover:bg-gray-100 dark:hover:bg-dark-surface border border-gray-200/60 dark:border-dark-border/60 transition-colors cursor-pointer"
            onClick={() => onSelect(wf)}
          >
            {deleteTargetId === wf.id && (
              <ConfirmDeleteDialog
                message={t.workflowConfirmDelete}
                cancelLabel={t.workflowConfirmDeleteNo}
                confirmLabel={t.workflowConfirmDeleteYes}
                onConfirm={() => onDelete(wf.id)}
                onCancel={onCancelDelete}
              />
            )}
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{wf.name || t.workflowUnnamed}</p>
                <p className="text-xs text-gray-500 dark:text-dark-text-muted mt-0.5">
                  {translate('workflowStepCount', { count: wf.steps.length })}
                </p>
                {/* 流程可视化：步骤缩略图 */}
                <div className="flex items-center gap-1 mt-2">
                  {wf.steps.filter((s) => s.enabled).map((step, i) => (
                    <React.Fragment key={step.id}>
                      {i > 0 && <div className="w-3 h-px bg-primary-400/40" />}
                      <div
                        className="w-6 h-6 rounded-md bg-primary-600/15 border border-primary-500/30 flex items-center justify-center text-[10px]"
                        title={step.name || t.workflowUnnamedStep}
                      >
                        {MODE_ICON_MAP[step.agentMode]}
                      </div>
                    </React.Fragment>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {!wf.isBuiltin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onRequestDelete(wf.id) }}
                    className="text-xs text-red-500 hover:text-red-400 px-1.5 py-0.5 rounded transition-colors"
                  >
                    {t.workflowDelete}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onExecute(wf) }}
                  className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 px-1.5 py-0.5 rounded transition-colors"
                >
                  {t.workflowRun}
                </button>
              </div>
            </div>
          </div>
        ))
      )}

      {!loading && workflows.length === 0 && (
        <p className="text-center text-gray-500 dark:text-dark-text-muted text-sm py-8">{t.workflowEmpty}</p>
      )}
    </div>
  )
}

interface StepEditorProps {
  workflow: Workflow
  modeOptions: { value: AgentMode; label: string }[]
  inputSourceOptions: { value: InputSource; label: string }[]
  checkpointOptions: { value: CheckpointType; label: string }[]
  onUpdateName: (name: string) => void
  onUpdateDescription: (desc: string) => void
  onUpdateStep: (stepId: string, updates: Partial<WorkflowStep>) => void
  onAddStep: () => void
  onRemoveStep: (stepId: string) => void
  onSave: () => void
}

const inputClass = 'w-full bg-gray-50 dark:bg-dark-surface/70 border border-gray-200 dark:border-dark-border rounded-lg px-3 py-1.5 text-sm text-gray-900 dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-primary-500/50 transition-colors'

const StepEditor: React.FC<StepEditorProps> = ({
  workflow,
  modeOptions,
  inputSourceOptions,
  checkpointOptions,
  onUpdateName,
  onUpdateDescription,
  onUpdateStep,
  onAddStep,
  onRemoveStep,
  onSave,
}) => {
  const { t } = useI18n()
  const [activeStepId, setActiveStepId] = useState<string | null>(
    workflow.steps[0]?.id ?? null,
  )
  const activeStep = workflow.steps.find((s) => s.id === activeStepId)

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <input
          value={workflow.name}
          onChange={(e) => onUpdateName(e.target.value)}
          placeholder={t.workflowNamePlaceholder}
          className={inputClass}
        />
        <textarea
          value={workflow.description}
          onChange={(e) => onUpdateDescription(e.target.value)}
          placeholder={t.workflowDescriptionPlaceholder}
          rows={2}
          className={`${inputClass} resize-none`}
        />
      </div>

      {/* 流程可视化：步骤管线 */}
      <div className="flex justify-between items-center">
        <span className="text-xs text-gray-500 dark:text-dark-text-muted uppercase tracking-wider font-semibold">{t.workflowSteps}</span>
        <button onClick={onAddStep} className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500 transition-colors">
          {t.workflowAddStep}
        </button>
      </div>

      {/* 步骤管线图 */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
        {workflow.steps.map((step, i) => (
          <React.Fragment key={step.id}>
            {i > 0 && (
              <div className="flex items-center shrink-0">
                <div className="w-4 h-px bg-primary-400/40" />
                <div className="w-0 h-0 border-t-[4px] border-b-[4px] border-l-[6px] border-transparent border-l-primary-400/40" />
              </div>
            )}
            <button
              onClick={() => setActiveStepId(step.id)}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                step.id === activeStepId
                  ? 'bg-primary-600/20 border border-primary-500/40 text-primary-700 dark:text-primary-300 shadow-sm'
                  : 'bg-gray-50 dark:bg-dark-surface/70 border border-gray-200/60 dark:border-dark-border/60 text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface'
              } ${!step.enabled ? 'opacity-40' : ''}`}
            >
              <span>{MODE_ICON_MAP[step.agentMode]}</span>
              <span className="truncate max-w-[80px]">{step.name || t.workflowUnnamedStep}</span>
            </button>
          </React.Fragment>
        ))}
      </div>

      {activeStep && (
        <div className="space-y-3 border-t border-gray-200 dark:border-dark-border pt-4">
          <input
            value={activeStep.name}
            onChange={(e) => onUpdateStep(activeStep.id, { name: e.target.value })}
            placeholder={t.workflowNamePlaceholder}
            className={inputClass}
          />

          <div>
            <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1 font-medium">{t.workflowModeLabel}</label>
            <select
              value={activeStep.agentMode}
              onChange={(e) => onUpdateStep(activeStep.id, { agentMode: e.target.value as AgentMode })}
              className={inputClass}
            >
              {modeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1 font-medium">{t.workflowPromptLabel}</label>
            <textarea
              value={activeStep.prompt}
              onChange={(e) => onUpdateStep(activeStep.id, { prompt: e.target.value })}
              placeholder={t.workflowPromptPlaceholder}
              rows={3}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1 font-medium">{t.workflowInputSourceLabel}</label>
              <select
                value={activeStep.inputSource}
                onChange={(e) => onUpdateStep(activeStep.id, { inputSource: e.target.value as InputSource })}
                className={inputClass}
              >
                {inputSourceOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-dark-text-muted mb-1 font-medium">{t.workflowCheckpointLabel}</label>
              <select
                value={activeStep.checkpoint}
                onChange={(e) => onUpdateStep(activeStep.id, { checkpoint: e.target.value as CheckpointType })}
                className={inputClass}
              >
                {checkpointOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-gray-500 dark:text-dark-text-muted cursor-pointer select-none">
              <input
                type="checkbox"
                checked={activeStep.enabled}
                onChange={(e) => onUpdateStep(activeStep.id, { enabled: e.target.checked })}
                className="accent-primary-600 rounded"
              />
              {t.workflowEnableStep}
            </label>
            {workflow.steps.length > 1 && (
              <button
                onClick={() => onRemoveStep(activeStep.id)}
                className="text-xs text-red-500 hover:text-red-400 transition-colors"
              >
                {t.workflowDelete}
              </button>
            )}
          </div>
        </div>
      )}

      <button
        onClick={onSave}
        disabled={!workflow.name.trim()}
        className="w-full py-2 px-4 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t.workflowSave}
      </button>
    </div>
  )
}

interface ExecutionViewProps {
  execution: WorkflowExecution
  onApprove: (modifiedOutput?: string) => void
  onReject: () => void
}

const ExecutionView: React.FC<ExecutionViewProps> = ({ execution, onApprove, onReject }) => {
  const { t, translate } = useI18n()
  const [modifiedOutput, setModifiedOutput] = useState<string>('')
  const [editingOutput, setEditingOutput] = useState(false)
  const lastResult = execution.stepResults[execution.stepResults.length - 1]

  const statusConfig: Record<string, { bg: string; text: string }> = {
    running: { bg: 'bg-blue-500/15', text: 'text-blue-600 dark:text-blue-400' },
    paused: { bg: 'bg-amber-500/15', text: 'text-amber-600 dark:text-amber-400' },
    completed: { bg: 'bg-green-500/15', text: 'text-green-600 dark:text-green-400' },
    failed: { bg: 'bg-red-500/15', text: 'text-red-600 dark:text-red-400' },
    idle: { bg: 'bg-gray-500/15', text: 'text-gray-600 dark:text-gray-400' },
  }
  const config = statusConfig[execution.status] ?? statusConfig.idle

  return (
    <div className="p-4 space-y-4">
      {/* 执行状态 + 步骤进度 */}
      <div className="flex items-center gap-3">
        <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.bg} ${config.text}`}>
          {execution.status}
        </span>
        <span className="text-xs text-gray-500 dark:text-dark-text-muted">
          {translate('workflowExecutionStep', { step: execution.currentStepIndex + 1 })}
        </span>
      </div>

      {/* 步骤进度条 */}
      <div className="flex items-center gap-1">
        {execution.stepResults.map((result, i) => (
          <React.Fragment key={i}>
            {i > 0 && <div className="w-2 h-px bg-gray-300 dark:bg-dark-border" />}
            <div
              className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
                result.status === 'completed'
                  ? 'bg-green-500/20 text-green-600 dark:text-green-400 border border-green-500/30'
                  : result.status === 'failed'
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/30'
                  : 'bg-gray-200 dark:bg-dark-surface border border-gray-300 dark:border-dark-border text-gray-500'
              }`}
            >
              {i + 1}
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* 步骤结果 */}
      <div className="space-y-2">
        {execution.stepResults.map((result, i) => (
          <div
            key={i}
            className={`p-3 rounded-lg text-xs border ${
              result.status === 'completed'
                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30'
                : result.status === 'failed'
                ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30'
                : 'bg-gray-50 dark:bg-dark-surface/70 border-gray-200 dark:border-dark-border'
            }`}
          >
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-900 dark:text-dark-text">{translate('workflowExecutionStep', { step: result.stepIndex + 1 })}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                result.status === 'completed' ? 'bg-green-500/15 text-green-600 dark:text-green-400'
                : result.status === 'failed' ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-gray-200 dark:bg-dark-surface text-gray-500 dark:text-dark-text-muted'
              }`}>{result.status}</span>
            </div>
            {result.output && (
              <p className="text-gray-600 dark:text-dark-text-muted line-clamp-3 whitespace-pre-wrap text-[11px]">{result.output}</p>
            )}
          </div>
        ))}
      </div>

      {/* 检查点审阅 */}
      {execution.status === 'paused' && lastResult && (
        <div className="border-t border-gray-200 dark:border-dark-border pt-4 space-y-3">
          <span className="text-xs text-amber-600 dark:text-amber-400 uppercase tracking-wider font-semibold">{t.workflowCheckpointReviewOutput}</span>

          {editingOutput ? (
            <textarea
              value={modifiedOutput}
              onChange={(e) => setModifiedOutput(e.target.value)}
              rows={6}
              className={`${inputClass} resize-none`}
            />
          ) : (
            <div className="bg-gray-50 dark:bg-dark-surface/70 border border-gray-200 dark:border-dark-border rounded-lg p-3 text-xs text-gray-600 dark:text-dark-text-muted max-h-40 overflow-y-auto whitespace-pre-wrap">
              {lastResult.output}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                if (editingOutput) {
                  onApprove(modifiedOutput || undefined)
                  setEditingOutput(false)
                } else {
                  onApprove()
                }
              }}
              className="flex-1 py-1.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-500 transition-colors"
            >
              {editingOutput ? t.workflowSubmitModifiedContinue : t.workflowApproveContinue}
            </button>
            <button
              onClick={() => {
                setModifiedOutput(lastResult.output)
                setEditingOutput(true)
              }}
              className="flex-1 py-1.5 text-sm font-medium border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-text-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-colors"
            >
              {t.workflowModify}
            </button>
            <button
              onClick={onReject}
              className="flex-1 py-1.5 text-sm font-medium border border-red-300 dark:border-red-800/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            >
              {t.workflowReject}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
