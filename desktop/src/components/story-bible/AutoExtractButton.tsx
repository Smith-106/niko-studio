import { useState, useCallback } from 'react'
import { Wand2, AlertTriangle, CheckCircle2, RotateCcw, Loader2 } from 'lucide-react'
import {
  sbExtractFromManuscript,
  type ExtractionResult,
  type SbEntityType,
} from '../../api/story-bible'

// ============================================================
// Types
// ============================================================

export interface AutoExtractButtonProps {
  novelId: string
  onExtractionComplete: (result: ExtractionResult) => void
  disabled?: boolean
}

type ExtractionState = 'idle' | 'confirming' | 'loading' | 'success' | 'error'

// ============================================================
// Constants
// ============================================================

const ENTITY_TYPE_LABELS: Record<SbEntityType, string> = {
  character: 'Characters',
  'world-rule': 'World Rules',
  'plot-thread': 'Plot Threads',
  'timeline-event': 'Timeline Events',
}

function confidenceColor(score: number): string {
  if (score >= 0.8) return 'text-green-400'
  if (score >= 0.6) return 'text-blue-400'
  if (score >= 0.3) return 'text-yellow-400'
  return 'text-red-400'
}

function confidenceBgColor(score: number): string {
  if (score >= 0.8) return 'bg-green-500'
  if (score >= 0.6) return 'bg-blue-500'
  if (score >= 0.3) return 'bg-yellow-500'
  return 'bg-red-500'
}

// ============================================================
// Sub-components
// ============================================================

function ConfirmationDialog({
  onConfirm,
  onCancel,
}: {
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-zinc-800 border border-zinc-600 rounded-lg shadow-xl max-w-sm mx-4 p-4">
        <h4 className="text-sm font-semibold text-zinc-200 mb-2">Auto-Extract Entities</h4>
        <p className="text-xs text-zinc-400 mb-4">
          Auto-extract entities from manuscript? This may update existing entities.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] px-3 py-1.5 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="text-[10px] px-3 py-1.5 rounded bg-blue-600/80 text-white hover:bg-blue-600 transition-colors"
          >
            Extract
          </button>
        </div>
      </div>
    </div>
  )
}

function ResultSummary({
  result,
  onDismiss,
}: {
  result: ExtractionResult
  onDismiss: () => void
}) {
  // Count entities by type
  const counts: Partial<Record<SbEntityType, number>> = {}
  for (const entity of result.extracted) {
    counts[entity.type] = (counts[entity.type] || 0) + 1
  }

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800/80 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <CheckCircle2 size={14} className="text-green-400" />
        <span className="text-xs font-medium text-zinc-200">Extraction Complete</span>
      </div>

      {/* Entity counts */}
      <div className="grid grid-cols-2 gap-1.5">
        {(Object.keys(ENTITY_TYPE_LABELS) as SbEntityType[]).map((type) => (
          <div key={type} className="text-[10px] text-zinc-400">
            <span className="text-zinc-200 font-medium">{counts[type] || 0}</span>{' '}
            {ENTITY_TYPE_LABELS[type]}
          </div>
        ))}
      </div>

      {/* Confidence */}
      {result.confidence > 0 && (
        <div className="flex items-center gap-2 pt-1 border-t border-zinc-700/50">
          <span className="text-[10px] text-zinc-500">Confidence</span>
          <div className="flex items-center gap-1.5 flex-1">
            <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${confidenceBgColor(result.confidence)}`}
                style={{ width: `${Math.round(result.confidence * 100)}%` }}
              />
            </div>
            <span className={`text-[10px] font-mono ${confidenceColor(result.confidence)}`}>
              {Math.round(result.confidence * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="pt-1 border-t border-zinc-700/50 space-y-1">
          {result.warnings.map((warning, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-yellow-400">
              <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {/* Conflicts */}
      {result.conflicts.length > 0 && (
        <div className="pt-1 border-t border-zinc-700/50 space-y-1">
          {result.conflicts.map((conflict, i) => (
            <div key={i} className="flex items-start gap-1.5 text-[10px] text-orange-400">
              <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
              <span>[{conflict.type}] {conflict.message}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={onDismiss}
        className="w-full text-[10px] py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
      >
        OK
      </button>
    </div>
  )
}

function ErrorDisplay({
  message,
  onRetry,
  onDismiss,
}: {
  message: string
  onRetry: () => void
  onDismiss: () => void
}) {
  return (
    <div className="rounded border border-red-800/50 bg-red-900/20 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <AlertTriangle size={14} className="text-red-400" />
        <span className="text-xs font-medium text-red-300">Extraction Failed</span>
      </div>
      <p className="text-[10px] text-red-400">{message}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="flex-1 flex items-center justify-center gap-1 text-[10px] py-1 rounded bg-red-600/80 text-white hover:bg-red-600 transition-colors"
        >
          <RotateCcw size={10} />
          Retry
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 text-[10px] py-1 rounded bg-zinc-700 text-zinc-300 hover:bg-zinc-600 transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}

// ============================================================
// Main component
// ============================================================

export function AutoExtractButton({ novelId, onExtractionComplete, disabled }: AutoExtractButtonProps) {
  const [state, setState] = useState<ExtractionState>('idle')
  const [result, setResult] = useState<ExtractionResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')

  const handleClick = useCallback(() => {
    setState('confirming')
  }, [])

  const handleConfirm = useCallback(() => {
    setState('loading')
    setResult(null)
    setErrorMessage('')

    sbExtractFromManuscript(novelId)
      .then((response) => {
        if (response.success && response.data) {
          setResult(response.data)
          setState('success')
          onExtractionComplete(response.data)
        } else {
          setErrorMessage(response.error || 'Unknown error occurred')
          setState('error')
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : 'Unknown error occurred'
        setErrorMessage(msg)
        setState('error')
      })
  }, [novelId, onExtractionComplete])

  const handleCancel = useCallback(() => {
    setState('idle')
  }, [])

  const handleDismiss = useCallback(() => {
    setState('idle')
    setResult(null)
    setErrorMessage('')
  }, [])

  const handleRetry = useCallback(() => {
    setState('idle')
    setResult(null)
    setErrorMessage('')
    // Trigger confirmation again on retry
    setState('confirming')
  }, [])

  return (
    <>
      {/* Trigger button */}
      {state === 'idle' && (
        <button
          type="button"
          onClick={handleClick}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-1.5 text-[10px] py-1.5 rounded bg-blue-600/80 hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <Wand2 size={12} />
          Auto-Extract
        </button>
      )}

      {/* Loading state */}
      {state === 'loading' && (
        <div className="flex items-center justify-center gap-2 text-[10px] py-1.5 rounded bg-blue-600/40 text-blue-300">
          <Loader2 size={12} className="animate-spin" />
          Extracting...
        </div>
      )}

      {/* Confirmation dialog */}
      {state === 'confirming' && (
        <ConfirmationDialog onConfirm={handleConfirm} onCancel={handleCancel} />
      )}

      {/* Success — result summary */}
      {state === 'success' && result && (
        <ResultSummary result={result} onDismiss={handleDismiss} />
      )}

      {/* Error state */}
      {state === 'error' && (
        <ErrorDisplay message={errorMessage} onRetry={handleRetry} onDismiss={handleDismiss} />
      )}
    </>
  )
}
