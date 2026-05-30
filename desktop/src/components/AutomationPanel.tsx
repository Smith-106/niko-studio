import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  workflowLifecycle,
  workflowSchedulerImportLitePlan,
  workflowSchedulerList,
  workflowSchedulerPause,
  workflowSchedulerResume,
  workflowSchedulerRunNow,
  type WorkflowSchedulerTaskRecord,
} from '../api/client'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { useI18n } from '../i18n'

interface AutomationPanelProps {
  onClose: () => void
  onOpenSettings: () => void
}

type TaskLikeRecord = WorkflowSchedulerTaskRecord & Record<string, unknown>

function readTextField(task: TaskLikeRecord | null, keys: string[]): string | null {
  if (!task) return null
  for (const key of keys) {
    const value = task[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }
  return null
}

function readRetryState(task: TaskLikeRecord | null): string | null {
  if (!task) return null
  const retry = task.retry
  if (retry && typeof retry === 'object') {
    const strategy = (retry as { strategy?: unknown }).strategy
    const maxRetries = (retry as { max_retries?: unknown }).max_retries
    if (typeof strategy === 'string' && typeof maxRetries === 'number') {
      return `${strategy} (${maxRetries})`
    }
  }
  return readTextField(task, ['retry_state', 'retry_status'])
}

function formatTime(value?: string | null): string {
  if (!value) return '--'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function summarizeTaskState(task: TaskLikeRecord | null): {
  blockedReason: string | null
  nextAction: string | null
  approvalState: string
  retryState: string
} {
  if (!task) {
    return {
      blockedReason: null,
      nextAction: null,
      approvalState: '--',
      retryState: '--',
    }
  }

  const blockedReason = readTextField(task, ['blocked_reason', 'gate_reason', 'pending_reason'])
  const nextAction = readTextField(task, ['next_action', 'suggested_action', 'recommended_action'])
  const approvalState = readTextField(task, ['approval_status', 'gate_status'])
    ?? (task.status === 'paused' ? 'paused' : 'ready')
  const retryState = readRetryState(task) ?? '--'

  return {
    blockedReason,
    nextAction,
    approvalState,
    retryState,
  }
}

function getStatusBadgeClass(status: string): string {
  if (status === 'active') {
    return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
  }
  if (status === 'paused') {
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
  }
  return 'bg-gray-100 text-gray-700 dark:bg-dark-border dark:text-dark-text'
}

export function AutomationPanel({ onClose, onOpenSettings }: AutomationPanelProps) {
  const { language } = useI18n()
  const isZh = language === 'zh'
  const workspaceSummary = useWriterWorkspaceSummary()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const refreshButtonRef = useRef<HTMLButtonElement | null>(null)

  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<WorkflowSchedulerTaskRecord[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmToken, setConfirmToken] = useState('')
  const [runStatus, setRunStatus] = useState<string | null>(null)
  const [gateReason, setGateReason] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refreshTasks = useCallback(async () => {
    setLoading(true)
    setError(null)

    const response = await workflowSchedulerList(
      50,
      undefined,
      workspaceSummary.meaningfulWorkspace ?? undefined,
    )

    if (!response.success) {
      setError(response.error ?? (isZh ? '加载自动化任务失败。' : 'Failed to load automation tasks.'))
      setTasks([])
      setLoading(false)
      return
    }

    const payload = response.data as { tasks?: WorkflowSchedulerTaskRecord[] }
    const nextTasks = Array.isArray(payload?.tasks) ? payload.tasks : []
    setTasks(nextTasks)
    setSelectedTaskId((prev) => {
      if (prev && nextTasks.some((task) => task.task_id === prev)) {
        return prev
      }
      return nextTasks[0]?.task_id ?? null
    })
    setLoading(false)
  }, [workspaceSummary.meaningfulWorkspace, isZh])

  useEffect(() => {
    void refreshTasks()
  }, [refreshTasks])

  const selectedTask = useMemo(() => (
    tasks.find((task) => task.task_id === selectedTaskId) ?? null
  ), [tasks, selectedTaskId])

  const selectedTaskRecord = selectedTask as TaskLikeRecord | null
  const stateSummary = summarizeTaskState(selectedTaskRecord)
  const selectedPlanId = selectedTask?.last_plan_id ?? null

  const setWorkflowMessage = useCallback((nextMessage: string) => {
    setMessage(nextMessage)
    setError(null)
  }, [])

  const setWorkflowError = useCallback((nextError: string) => {
    setError(nextError)
    setMessage(null)
  }, [])

  const handlePauseResume = useCallback(async () => {
    if (!selectedTask) return
    const actionKey = selectedTask.status === 'paused' ? 'resume' : 'pause'
    setActionLoading(actionKey)
    setMessage(null)
    setError(null)

    const response = selectedTask.status === 'paused'
      ? await workflowSchedulerResume(selectedTask.task_id, undefined, workspaceSummary.meaningfulWorkspace ?? undefined)
      : await workflowSchedulerPause(selectedTask.task_id, undefined, workspaceSummary.meaningfulWorkspace ?? undefined)

    if (!response.success) {
      setWorkflowError(response.error ?? (isZh ? '更新任务状态失败。' : 'Failed to update task status.'))
      setActionLoading(null)
      return
    }

    setWorkflowMessage(selectedTask.status === 'paused'
      ? (isZh ? '已恢复调度任务。' : 'Scheduler task resumed.')
      : (isZh ? '已暂停调度任务。' : 'Scheduler task paused.'))

    setActionLoading(null)
    await refreshTasks()
  }, [selectedTask, workspaceSummary.meaningfulWorkspace, setWorkflowError, setWorkflowMessage, isZh, refreshTasks])

  const handleRunNow = useCallback(async (useConfirmToken: boolean) => {
    if (!selectedTask) return
    setActionLoading(useConfirmToken ? 'confirm' : 'run-now')
    setMessage(null)
    setError(null)

    const response = await workflowSchedulerRunNow(
      selectedTask.task_id,
      undefined,
      undefined,
      useConfirmToken ? confirmToken : undefined,
      workspaceSummary.meaningfulWorkspace ?? undefined,
    )

    if (!response.success) {
      setWorkflowError(response.error ?? (isZh ? '执行 run-now 失败。' : 'Failed to run task now.'))
      setActionLoading(null)
      return
    }

    const payload = (response.data ?? {}) as Record<string, unknown>
    const executeRecord = payload.execute && typeof payload.execute === 'object'
      ? payload.execute as Record<string, unknown>
      : null
    const currentStatus = typeof payload.status === 'string'
      ? payload.status
      : (typeof executeRecord?.status === 'string' ? executeRecord.status : 'completed')

    const gate = executeRecord?.gate && typeof executeRecord.gate === 'object'
      ? executeRecord.gate as Record<string, unknown>
      : null

    const reason = gate && typeof gate.reason === 'string' ? gate.reason : null

    setRunStatus(currentStatus)
    setGateReason(reason)

    if (currentStatus === 'waiting_confirmation') {
      setWorkflowMessage(isZh ? '任务需要确认后继续。' : 'Task is waiting for confirmation.')
    } else if (currentStatus === 'gate_blocked') {
      setWorkflowMessage(isZh ? '任务进入阻塞状态，请执行恢复操作。' : 'Task is gate-blocked. Run a recovery action.')
    } else {
      setWorkflowMessage(isZh ? '任务已触发执行。' : 'Task execution triggered.')
      setConfirmToken('')
    }

    setActionLoading(null)
    await refreshTasks()
  }, [selectedTask, confirmToken, workspaceSummary.meaningfulWorkspace, setWorkflowError, setWorkflowMessage, isZh, refreshTasks])

  const handlePlanLifecycle = useCallback(async (action: 'pause' | 'resume') => {
    if (!selectedPlanId) {
      setWorkflowError(isZh ? '当前任务缺少 plan_id，无法执行生命周期操作。' : 'Selected task has no plan_id for lifecycle action.')
      return
    }

    setActionLoading(action)
    setMessage(null)
    setError(null)

    const response = await workflowLifecycle(
      selectedPlanId,
      action,
      undefined,
      workspaceSummary.meaningfulWorkspace ?? undefined,
    )

    if (!response.success) {
      setWorkflowError(response.error ?? (isZh ? '生命周期操作失败。' : 'Lifecycle action failed.'))
      setActionLoading(null)
      return
    }

    setWorkflowMessage(action === 'pause'
      ? (isZh ? '计划已暂停。' : 'Plan paused.')
      : (isZh ? '计划已恢复。' : 'Plan resumed.'))

    setActionLoading(null)
    await refreshTasks()
  }, [selectedPlanId, workspaceSummary.meaningfulWorkspace, setWorkflowError, setWorkflowMessage, isZh, refreshTasks])

  const handleImportLitePlan = useCallback(async () => {
    setActionLoading('import-lite-plan')
    setMessage(null)
    setError(null)

    const response = await workflowSchedulerImportLitePlan(
      undefined,
      'L5',
      true,
      undefined,
      workspaceSummary.meaningfulWorkspace ?? undefined,
    )

    if (!response.success) {
      setWorkflowError(response.error ?? (isZh ? '导入 lite-plan 任务失败。' : 'Failed to import lite-plan tasks.'))
      setActionLoading(null)
      return
    }

    const payload = (response.data ?? {}) as Record<string, unknown>
    const imported = typeof payload.imported === 'number' ? payload.imported : 0
    const failed = typeof payload.failed === 'number' ? payload.failed : 0
    const sessionId = typeof payload.session_id === 'string' ? payload.session_id : ''

    const importMessage = isZh
      ? `已导入 ${imported} 条任务${failed > 0 ? `，失败 ${failed} 条` : ''}${sessionId ? `（会话：${sessionId}）` : ''}。`
      : `Imported ${imported} task(s)${failed > 0 ? `, ${failed} failed` : ''}${sessionId ? ` (session: ${sessionId})` : ''}.`

    setWorkflowMessage(importMessage)
    setActionLoading(null)
    await refreshTasks()
  }, [workspaceSummary.meaningfulWorkspace, setWorkflowError, setWorkflowMessage, isZh, refreshTasks])

  const handleClose = useCallback(() => {
    onClose()
  }, [onClose])

  useDialogFocusTrap({
    containerRef: panelRef,
    initialFocusRef: refreshButtonRef,
    onClose: handleClose,
  })

  return (
    <div
      ref={panelRef}
      tabIndex={-1}
      className="h-full w-96 bg-slate-50 dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.1)] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? '自动化面板' : 'Automation panel'}
    >
      <div className="flex items-center justify-between gap-2 p-4 border-b border-gray-200 dark:border-dark-border bg-white/80 dark:bg-dark-surface/80">
        <div>
          <div className="text-sm font-semibold text-gray-800 dark:text-dark-text">
            {isZh ? '自动化任务面板' : 'Automation tasks'}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary">
            {isZh ? '查看状态、审批门、重试与恢复操作。' : 'View status, approval gates, retry, and recovery actions.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            ref={refreshButtonRef}
            type="button"
            onClick={() => {
              void refreshTasks()
            }}
            className="rounded-md border border-gray-200 dark:border-dark-border px-2 py-1 text-xs text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface2"
          >
            {isZh ? '刷新' : 'Refresh'}
          </button>
          <button
            type="button"
            onClick={() => {
              void handleImportLitePlan()
            }}
            disabled={actionLoading !== null}
            className="rounded-md border border-gray-200 dark:border-dark-border px-2 py-1 text-xs text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface2 disabled:opacity-50"
          >
            {actionLoading === 'import-lite-plan'
              ? (isZh ? '导入中...' : 'Importing...')
              : (isZh ? '导入计划' : 'Import plan')}
          </button>
          <button
            type="button"
            onClick={onOpenSettings}
            className="rounded-md border border-gray-200 dark:border-dark-border px-2 py-1 text-xs text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface2"
          >
            {isZh ? '设置' : 'Settings'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-200 dark:border-dark-border px-2 py-1 text-xs text-gray-600 dark:text-dark-text-secondary hover:bg-gray-100 dark:hover:bg-dark-surface2"
          >
            {isZh ? '关闭' : 'Close'}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {workspaceSummary.hasMeaningfulScope && (
          <div className="flex flex-wrap gap-2">
            {workspaceSummary.scopeChips.map((chip) => (
              <span
                key={`automation-scope-${chip}`}
                className="rounded-full bg-primary-50 px-3 py-1 text-[11px] font-medium text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"
              >
                {chip}
              </span>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-950/20 dark:text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-950/20 dark:text-emerald-300">
            {message}
          </div>
        )}

        <section className="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface">
          <div className="border-b border-gray-200 dark:border-dark-border px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-text-muted">
            {isZh ? '任务队列' : 'Task queue'}
          </div>
          {loading ? (
            <div className="px-3 py-4 text-xs text-gray-500 dark:text-dark-text-secondary">
              {isZh ? '加载中...' : 'Loading...'}
            </div>
          ) : tasks.length === 0 ? (
            <div className="px-3 py-4 text-xs text-gray-500 dark:text-dark-text-secondary">
              {isZh ? '暂无自动化任务。' : 'No automation tasks yet.'}
            </div>
          ) : (
            <ul className="max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-dark-border">
              {tasks.map((task) => {
                const active = task.task_id === selectedTaskId
                return (
                  <li key={task.task_id}>
                    <button
                      type="button"
                      onClick={() => setSelectedTaskId(task.task_id)}
                      className={`w-full px-3 py-2 text-left transition-colors ${active ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-gray-50 dark:hover:bg-dark-bg'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-dark-text">{task.title}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${getStatusBadgeClass(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-dark-text-secondary truncate">
                        {task.task}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {selectedTask && (
          <section className="space-y-3">
            <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-text-muted">
                {isZh ? '执行状态' : 'Execution state'}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '运行状态' : 'Run status'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{runStatus ?? selectedTask.status}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '审批状态' : 'Approval state'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{stateSummary.approvalState}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '最后触发' : 'Last trigger'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{selectedTask.last_trigger ?? '--'}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '重试状态' : 'Retry state'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{stateSummary.retryState}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '阻塞原因' : 'Blocked reason'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{gateReason ?? stateSummary.blockedReason ?? '--'}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '下一步动作' : 'Next action'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{stateSummary.nextAction ?? '--'}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '最近更新' : 'Updated at'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text">{formatTime(selectedTask.updated_at)}</div>
                </div>
                <div>
                  <div className="text-gray-500 dark:text-dark-text-secondary">{isZh ? '关联计划' : 'Plan id'}</div>
                  <div className="font-medium text-gray-800 dark:text-dark-text truncate">{selectedPlanId ?? '--'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface p-3 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-dark-text-muted">
                {isZh ? '人工干预' : 'Manual intervention'}
              </div>
              <p className="text-[11px] leading-relaxed text-gray-500 dark:text-dark-text-secondary">
                {isZh
                  ? '常规写作无需处理这里；只有任务等待确认、阻塞或需要手动重试时才展开。'
                  : 'Most writing sessions never need this area. Open it only when a task is waiting for confirmation, blocked, or needs a manual retry.'}
              </p>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handleRunNow(false)
                  }}
                  disabled={actionLoading !== null}
                  className="rounded-md bg-primary-600 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {actionLoading === 'run-now' ? (isZh ? '执行中...' : 'Running...') : (isZh ? '立即执行 / 重试' : 'Run now / Retry')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handlePauseResume()
                  }}
                  disabled={actionLoading !== null}
                  className="rounded-md border border-gray-200 dark:border-dark-border px-2 py-2 text-xs font-medium text-gray-700 dark:text-dark-text disabled:opacity-50"
                >
                  {actionLoading === 'pause' || actionLoading === 'resume'
                    ? (isZh ? '处理中...' : 'Processing...')
                    : (selectedTask.status === 'paused' ? (isZh ? '恢复调度' : 'Resume schedule') : (isZh ? '暂停调度' : 'Pause schedule'))}
                </button>
              </div>

              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-500/30 dark:bg-amber-950/20">
                <div className="text-[11px] font-medium text-amber-800 dark:text-amber-200">
                  {isZh ? '审批门 / 确认令牌' : 'Approval gate / confirm token'}
                </div>
                <input
                  value={confirmToken}
                  onChange={(event) => setConfirmToken(event.target.value)}
                  placeholder={isZh ? '输入 confirm_token 后点击“确认并继续”' : 'Enter confirm_token then click Confirm & Continue'}
                  className="w-full rounded-md border border-amber-200 bg-white px-2 py-1 text-xs text-gray-800 dark:border-amber-500/30 dark:bg-dark-bg dark:text-dark-text"
                />
                <button
                  type="button"
                  onClick={() => {
                    void handleRunNow(true)
                  }}
                  disabled={actionLoading !== null || confirmToken.trim().length === 0}
                  className="w-full rounded-md bg-amber-600 px-2 py-2 text-xs font-medium text-white disabled:opacity-50"
                >
                  {actionLoading === 'confirm' ? (isZh ? '确认中...' : 'Confirming...') : (isZh ? '确认并继续' : 'Confirm & Continue')}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    void handlePlanLifecycle('pause')
                  }}
                  disabled={actionLoading !== null || !selectedPlanId}
                  className="rounded-md border border-red-200 px-2 py-2 text-xs font-medium text-red-700 dark:border-red-500/40 dark:text-red-300 disabled:opacity-50"
                >
                  {isZh ? '拒绝并暂停计划' : 'Reject & Pause plan'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handlePlanLifecycle('resume')
                  }}
                  disabled={actionLoading !== null || !selectedPlanId}
                  className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-500/40 dark:text-emerald-300 disabled:opacity-50"
                >
                  {isZh ? '恢复计划' : 'Resume plan'}
                </button>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
