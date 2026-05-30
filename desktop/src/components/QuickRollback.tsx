import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { quickRollbackWorkflow } from '../api/client'

interface QuickRollbackProps {
  isLoading: boolean
  quickRollbackAdvancedToggle: string
  quickRollbackSummary: string
  quickRollbackTitle: string
  quickRollbackPlanIdPlaceholder: string
  quickRollbackCheckpointIdPlaceholder: string
  quickRollbackReasonPlaceholder: string
  quickRollbackAction: string
  quickRollbackMissingRequired: string
  quickRollbackFailed: string
  quickRollbackSuccess: string
  autoExpand?: boolean
}

export const QuickRollback = React.memo(function QuickRollback({
  isLoading,
  quickRollbackAdvancedToggle,
  quickRollbackSummary,
  quickRollbackTitle,
  quickRollbackPlanIdPlaceholder,
  quickRollbackCheckpointIdPlaceholder,
  quickRollbackReasonPlaceholder,
  quickRollbackAction,
  quickRollbackMissingRequired,
  quickRollbackFailed,
  quickRollbackSuccess,
  autoExpand,
}: QuickRollbackProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [planId, setPlanId] = useState('')
  const [checkpointId, setCheckpointId] = useState('')
  const [reason, setReason] = useState('')
  const [status, setStatus] = useState<{ type: 'error' | 'success'; message: string } | null>(null)

  useEffect(() => {
    if (autoExpand && !showAdvanced) {
      setShowAdvanced(true)
    }
  }, [autoExpand])

  const handleRollback = async () => {
    const trimmedPlanId = planId.trim()
    const trimmedCheckpointId = checkpointId.trim()

    if (!trimmedPlanId || !trimmedCheckpointId || isLoading) {
      setStatus({ type: 'error', message: quickRollbackMissingRequired })
      return
    }

    const setFailed = (message?: string) => {
      setStatus({ type: 'error', message: message || quickRollbackFailed })
    }

    try {
      const response = await quickRollbackWorkflow(trimmedPlanId, trimmedCheckpointId, reason.trim() || undefined)
      if (response.success) {
        setStatus({ type: 'success', message: quickRollbackSuccess })
      } else {
        setFailed(response.error)
      }
    } catch {
      setFailed()
    }
  }

  return (
    <div className="mb-3">
      <button
        type="button"
        onClick={() => setShowAdvanced((prev) => !prev)}
        className={`w-full flex items-center justify-between text-xs font-medium transition-colors py-1 ${
          autoExpand
            ? 'text-amber-500 dark:text-amber-400 hover:text-amber-600 dark:hover:text-amber-300'
            : 'text-gray-400 dark:text-dark-text-muted hover:text-gray-600 dark:hover:text-dark-text-secondary'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <RotateCcw size={11} />
          {quickRollbackAdvancedToggle}
        </span>
        {showAdvanced ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {showAdvanced && (
        <div className="animate-fade-in mt-2 mb-1">
          <p className="text-[11px] leading-relaxed text-gray-400 dark:text-dark-text-muted mb-3">
            {quickRollbackSummary}
          </p>
          <div className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-dark-text-muted mb-2">{quickRollbackTitle}</div>
          <div className="grid grid-cols-1 gap-2">
            <input
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              placeholder={quickRollbackPlanIdPlaceholder}
              aria-label={quickRollbackPlanIdPlaceholder}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-800 dark:text-dark-text rounded-lg focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
            />
            <input
              value={checkpointId}
              onChange={(event) => setCheckpointId(event.target.value)}
              placeholder={quickRollbackCheckpointIdPlaceholder}
              aria-label={quickRollbackCheckpointIdPlaceholder}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-800 dark:text-dark-text rounded-lg focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
            />
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={quickRollbackReasonPlaceholder}
              aria-label={quickRollbackReasonPlaceholder}
              className="px-3 py-1.5 text-xs bg-gray-50 dark:bg-dark-bg border border-gray-200 dark:border-dark-border text-gray-800 dark:text-dark-text rounded-lg focus:ring-1 focus:ring-primary-500/50 outline-none transition-all"
            />
          </div>
          <div className="flex items-center justify-between mt-2">
            <button
              onClick={handleRollback}
              type="button"
              className="px-4 py-1.5 text-xs font-medium bg-amber-500 text-white rounded-lg shadow-sm hover:bg-amber-600 active:scale-[0.98] disabled:opacity-50 transition-all"
              disabled={isLoading}
            >
              {quickRollbackAction}
            </button>
            {status && (
              <span className={`text-[11px] font-medium px-2 py-1 rounded-lg ${status.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400'}`}>
                {status.message}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
