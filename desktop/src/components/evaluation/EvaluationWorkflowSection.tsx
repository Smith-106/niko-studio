import { ChevronDown, ChevronRight } from 'lucide-react'

import type { WorkflowAction, WorkflowLifecycleAction } from '../../hooks/useEvaluationWorkflow'

export type EvaluationWorkflowPreset = {
  id: string
  title: string
  description: string
  action: () => void | Promise<void>
}

export function EvaluationWorkflowSection({
  isZh,
  writerWorkflowTitle,
  writerWorkflowHint,
  writerAdvancedTitle,
  writerAdvancedHint,
  scopeChips,
  hasMeaningfulScope,
  onOpenAutomation,
  presets,
  showAdvancedWorkflow,
  onToggleAdvancedWorkflow,
  workflowTask,
  workflowLevel,
  workflowPlanId,
  workflowStepId,
  workflowLifecycleAction,
  workflowConfirmToken,
  workflowWaitingConfirmation,
  workflowGateReason,
  workflowResult,
  workflowStates,
  setWorkflowTask,
  setWorkflowLevel,
  setWorkflowPlanId,
  setWorkflowStepId,
  setWorkflowLifecycleAction,
  setWorkflowConfirmToken,
  onWorkflowRoute,
  onWorkflowPlan,
  onWorkflowExecute,
  onWorkflowLifecycle,
  onWorkflowConfirmAndContinue,
  onRetryWorkflowAction,
  labels,
}: {
  isZh: boolean
  writerWorkflowTitle: string
  writerWorkflowHint: string
  writerAdvancedTitle: string
  writerAdvancedHint: string
  scopeChips: string[]
  hasMeaningfulScope: boolean
  onOpenAutomation?: () => void
  presets: EvaluationWorkflowPreset[]
  showAdvancedWorkflow: boolean
  onToggleAdvancedWorkflow: () => void
  workflowTask: string
  workflowLevel: string
  workflowPlanId: string
  workflowStepId: string
  workflowLifecycleAction: WorkflowLifecycleAction
  workflowConfirmToken: string
  workflowWaitingConfirmation: boolean
  workflowGateReason: string | null
  workflowResult: string | null
  workflowStates: Record<WorkflowAction, { status: string; message?: string | null }>
  setWorkflowTask: (value: string) => void
  setWorkflowLevel: (value: string) => void
  setWorkflowPlanId: (value: string) => void
  setWorkflowStepId: (value: string) => void
  setWorkflowLifecycleAction: (value: WorkflowLifecycleAction) => void
  setWorkflowConfirmToken: (value: string) => void
  onWorkflowRoute: () => void
  onWorkflowPlan: () => void
  onWorkflowExecute: () => void
  onWorkflowLifecycle: () => void
  onWorkflowConfirmAndContinue: () => void
  onRetryWorkflowAction: (action: WorkflowAction) => void
  labels: {
    taskPlaceholder: string
    levelPlaceholder: string
    planIdPlaceholder: string
    stepIdPlaceholder: string
    lifecycleActionLabel: string
    lifecycleStatus: string
    lifecycleStart: string
    lifecyclePause: string
    lifecycleResume: string
    lifecycleStop: string
    route: string
    plan: string
    execute: string
    lifecycle: string
    waitingConfirmation: string
    gateReason: string
    confirmTokenPlaceholder: string
    confirmAndContinue: string
    retry: string
  }
}) {
  return (
    <div className="border-t border-gray-200 pt-4 dark:border-dark-border">
      <h3 className="text-sm font-medium text-gray-700 dark:text-dark-text">{writerWorkflowTitle}</h3>
      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">{writerWorkflowHint}</p>
      {hasMeaningfulScope && (
        <div className="mt-3 flex flex-wrap gap-2">
          {scopeChips.map((chip) => (
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
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => {
              void preset.action()
            }}
            className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-primary-200 hover:bg-primary-50/60 dark:border-dark-border dark:bg-dark-bg dark:hover:border-primary-500/30 dark:hover:bg-dark-surface"
          >
            <div className="text-sm font-medium text-gray-800 dark:text-dark-text">{preset.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">{preset.description}</div>
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-bg/70">
        <button
          type="button"
          onClick={onToggleAdvancedWorkflow}
          className="flex w-full items-start justify-between gap-3 text-left"
          aria-expanded={showAdvancedWorkflow}
          aria-label={writerAdvancedTitle}
        >
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">{writerAdvancedTitle}</div>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-dark-text-secondary">{writerAdvancedHint}</p>
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
                placeholder={labels.taskPlaceholder}
                aria-label={labels.taskPlaceholder}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
              />
              <input
                value={workflowLevel}
                onChange={(e) => setWorkflowLevel(e.target.value)}
                placeholder={labels.levelPlaceholder}
                aria-label={labels.levelPlaceholder}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
              />
              <input
                value={workflowPlanId}
                onChange={(e) => setWorkflowPlanId(e.target.value)}
                placeholder={labels.planIdPlaceholder}
                aria-label={labels.planIdPlaceholder}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
              />
              <input
                value={workflowStepId}
                onChange={(e) => setWorkflowStepId(e.target.value)}
                placeholder={labels.stepIdPlaceholder}
                aria-label={labels.stepIdPlaceholder}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
              />
              <select
                value={workflowLifecycleAction}
                onChange={(e) => setWorkflowLifecycleAction(e.target.value as WorkflowLifecycleAction)}
                aria-label={labels.lifecycleActionLabel}
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
              >
                <option value="status">{labels.lifecycleStatus}</option>
                <option value="start">{labels.lifecycleStart}</option>
                <option value="pause">{labels.lifecyclePause}</option>
                <option value="resume">{labels.lifecycleResume}</option>
                <option value="stop">{labels.lifecycleStop}</option>
              </select>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={onWorkflowRoute} disabled={workflowStates.route.status === 'loading'} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50" aria-label={labels.route} title={labels.route}>{labels.route}</button>
              <button onClick={onWorkflowPlan} disabled={workflowStates.plan.status === 'loading'} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50" aria-label={labels.plan} title={labels.plan}>{labels.plan}</button>
              <button onClick={onWorkflowExecute} disabled={workflowStates.execute.status === 'loading'} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50" aria-label={labels.execute} title={labels.execute}>{labels.execute}</button>
              <button onClick={onWorkflowLifecycle} disabled={workflowStates.lifecycle.status === 'loading'} className="rounded bg-blue-600 px-2 py-1 text-xs text-white disabled:opacity-50" aria-label={labels.lifecycle} title={labels.lifecycle}>{labels.lifecycle}</button>
            </div>

            {workflowWaitingConfirmation && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs dark:border-amber-700 dark:bg-amber-900/10">
                <div className="font-medium text-amber-700 dark:text-amber-200">{labels.waitingConfirmation}</div>
                {workflowGateReason && <div className="mt-1 text-amber-700/80 dark:text-amber-200/80">{labels.gateReason}: {workflowGateReason}</div>}
                <div className="mt-2 flex gap-2">
                  <input
                    value={workflowConfirmToken}
                    onChange={(e) => setWorkflowConfirmToken(e.target.value)}
                    placeholder={labels.confirmTokenPlaceholder}
                    aria-label={labels.confirmTokenPlaceholder}
                    className="flex-1 rounded border border-amber-200 px-2 py-1 text-xs dark:border-amber-700 dark:bg-dark-bg dark:text-dark-text"
                  />
                  <button
                    onClick={onWorkflowConfirmAndContinue}
                    disabled={workflowStates.execute.status === 'loading'}
                    className="rounded bg-amber-600 px-2 py-1 text-xs text-white disabled:opacity-50"
                    aria-label={labels.confirmAndContinue}
                    title={labels.confirmAndContinue}
                  >
                    {labels.confirmAndContinue}
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2 text-xs">
              {(['route', 'plan', 'execute', 'lifecycle'] as const).map((action) => {
                const state = workflowStates[action]
                if (state.status === 'idle' || !state.message) {
                  return null
                }
                return (
                  <div key={action} className="flex items-center justify-between gap-2">
                    <span className={state.status === 'error' ? 'text-red-500' : state.status === 'success' ? 'text-green-600' : 'text-gray-500'}>
                      {labels[action]}: {state.message}
                    </span>
                    {state.status === 'error' && (
                      <button
                        onClick={() => onRetryWorkflowAction(action)}
                        className="rounded bg-gray-100 px-2 py-1 dark:bg-dark-border dark:text-dark-text"
                        aria-label={labels.retry}
                        title={labels.retry}
                      >
                        {labels.retry}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {workflowResult && (
              <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded border border-gray-200 bg-gray-50 p-2 text-[11px] text-gray-700 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-secondary">
                {workflowResult}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  )
}
