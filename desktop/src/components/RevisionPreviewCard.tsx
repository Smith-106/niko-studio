import { useState, useCallback, useMemo } from 'react'
import { AlertTriangle, ArrowLeftRight } from 'lucide-react'

interface RevisionPreviewCardProps {
  previewTitle: string
  originalLabel: string
  candidateLabel: string
  sourceText: string
  candidateText: string
  primaryActionLabel: string
  secondaryActionLabel?: string
  undoActionLabel: string
  onPrimaryAction: () => void
  onSecondaryAction?: () => void
  onUndoAction: () => void
  className?: string
  sourceTextClassName?: string
  candidateTextClassName?: string
  actionsClassName?: string
  /** Enable confirmation dialog before undo/rollback operations */
  confirmRollback?: boolean
  /** Integrity check hook called before rollback to verify data consistency.
   *  Return true to proceed, false to abort. */
  onIntegrityCheck?: () => boolean
}

// ---------------------------------------------------------------------------
// Diff computation (line-level)
// ---------------------------------------------------------------------------

interface DiffLine {
  type: 'same' | 'added' | 'removed'
  text: string
}

function computeLineDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split('\n')
  const afterLines = after.split('\n')

  // Use a simple LCS-based diff to identify added/removed/same lines
  const m = beforeLines.length
  const n = afterLines.length

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (beforeLines[i - 1] === afterLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to produce diff
  const result: DiffLine[] = []
  let i = m
  let j = n
  const reversed: DiffLine[] = []

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && beforeLines[i - 1] === afterLines[j - 1]) {
      reversed.push({ type: 'same', text: beforeLines[i - 1]! })
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: 'added', text: afterLines[j - 1]! })
      j--
    } else {
      reversed.push({ type: 'removed', text: beforeLines[i - 1]! })
      i--
    }
  }

  reversed.reverse()
  result.push(...reversed)
  return result
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------

function verifyIntegrity(sourceText: string, candidateText: string): { ok: boolean; issues: string[] } {
  const issues: string[] = []

  if (!sourceText || sourceText.trim().length === 0) {
    issues.push('Source text is empty')
  }
  if (!candidateText || candidateText.trim().length === 0) {
    issues.push('Candidate text is empty')
  }
  if (sourceText === candidateText) {
    issues.push('Source and candidate texts are identical (no changes)')
  }

  // Check for extreme size disparity (potential data corruption indicator)
  const ratio = candidateText.length / Math.max(sourceText.length, 1)
  if (ratio > 20) {
    issues.push(`Candidate is ${ratio.toFixed(0)}x longer than source (possible corruption)`)
  }
  if (ratio < 0.05 && sourceText.length > 50) {
    issues.push(`Candidate is ${((1 - ratio) * 100).toFixed(0)}% shorter than source (possible truncation)`)
  }

  return { ok: issues.length === 0, issues }
}

// ---------------------------------------------------------------------------
// Confirmation Dialog
// ---------------------------------------------------------------------------

interface ConfirmationDialogProps {
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
  integrityIssues?: string[]
}

function ConfirmationDialog({
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  integrityIssues,
}: ConfirmationDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div
        className="mx-4 max-w-sm rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-dark-border dark:bg-dark-bg"
        role="alertdialog"
        aria-modal="true"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0 text-amber-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-dark-text">
              Confirm Rollback
            </h3>
            <p className="mt-1 text-xs text-gray-600 dark:text-dark-text-secondary">
              {message}
            </p>
            {integrityIssues && integrityIssues.length > 0 && (
              <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 dark:border-red-800/30 dark:bg-red-900/10">
                <p className="text-[11px] font-medium text-red-700 dark:text-red-400">
                  Integrity warnings:
                </p>
                <ul className="mt-1 list-inside list-disc text-[11px] text-red-600 dark:text-red-300">
                  {integrityIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-gray-100 dark:bg-dark-border dark:text-dark-text hover:bg-gray-200 dark:hover:bg-dark-border2 active:scale-95 transition-all"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all shadow-sm"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Diff View
// ---------------------------------------------------------------------------

interface DiffViewProps {
  before: string
  after: string
}

function DiffView({ before, after }: DiffViewProps) {
  const diffLines = useMemo(() => computeLineDiff(before, after), [before, after])

  const hasChanges = diffLines.some((l) => l.type !== 'same')

  if (!hasChanges) {
    return (
      <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-dark-border dark:bg-dark-surface">
        <p className="text-center text-[11px] text-gray-400 dark:text-dark-text-muted">
          No differences detected
        </p>
      </div>
    )
  }

  return (
    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 dark:border-dark-border dark:bg-dark-surface">
      <div className="sticky top-0 z-10 flex items-center gap-1.5 border-b border-gray-200 bg-gray-100 px-2 py-1 dark:border-dark-border dark:bg-dark-border">
        <ArrowLeftRight className="h-3 w-3 text-gray-500" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted">
          Diff
        </span>
      </div>
      <pre className="p-2 text-[11px] leading-relaxed font-mono">
        {diffLines.map((line, idx) => {
          const key = `${idx}-${line.type}`
          if (line.type === 'removed') {
            return (
              <div key={key} className="bg-red-50 text-red-700 dark:bg-red-900/15 dark:text-red-400">
                <span className="mr-2 select-none text-red-400 dark:text-red-600">-</span>
                {line.text}
              </div>
            )
          }
          if (line.type === 'added') {
            return (
              <div key={key} className="bg-green-50 text-green-700 dark:bg-green-900/15 dark:text-green-400">
                <span className="mr-2 select-none text-green-400 dark:text-green-600">+</span>
                {line.text}
              </div>
            )
          }
          return (
            <div key={key} className="text-gray-500 dark:text-dark-text-muted">
              <span className="mr-2 select-none">&nbsp;</span>
              {line.text}
            </div>
          )
        })}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RevisionPreviewCard
// ---------------------------------------------------------------------------

export function RevisionPreviewCard({
  previewTitle,
  originalLabel,
  candidateLabel,
  sourceText,
  candidateText,
  primaryActionLabel,
  secondaryActionLabel,
  undoActionLabel,
  onPrimaryAction,
  onSecondaryAction,
  onUndoAction,
  className,
  sourceTextClassName,
  candidateTextClassName,
  actionsClassName,
  confirmRollback = false,
  onIntegrityCheck,
}: RevisionPreviewCardProps) {
  const [showDiff, setShowDiff] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [integrityResult, setIntegrityResult] = useState<{ ok: boolean; issues: string[] } | null>(null)

  const handleUndoClick = useCallback(() => {
    // Run integrity check first
    if (onIntegrityCheck) {
      const passed = onIntegrityCheck()
      if (!passed) {
        setShowConfirmDialog(true)
        return
      }
    }

    // Built-in integrity verification
    const result = verifyIntegrity(sourceText, candidateText)
    setIntegrityResult(result)

    if (!result.ok) {
      // Show confirmation dialog with integrity warnings
      setShowConfirmDialog(true)
      return
    }

    // If confirmRollback is enabled, show dialog even with clean integrity
    if (confirmRollback) {
      setShowConfirmDialog(true)
      return
    }

    // No confirmation needed, proceed directly
    onUndoAction()
  }, [onIntegrityCheck, sourceText, candidateText, confirmRollback, onUndoAction])

  const handleConfirmRollback = useCallback(() => {
    setShowConfirmDialog(false)
    setIntegrityResult(null)
    onUndoAction()
  }, [onUndoAction])

  const handleCancelRollback = useCallback(() => {
    setShowConfirmDialog(false)
    setIntegrityResult(null)
  }, [])

  const toggleDiff = useCallback(() => {
    setShowDiff((prev) => !prev)
  }, [])

  return (
    <div className={className ?? 'mt-3 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 dark:border-dark-border dark:bg-dark-surface'}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
        {previewTitle}
      </div>
      <div className="mt-3 space-y-3">
        <div className="rounded-xl border border-gray-200 bg-white p-3 dark:border-dark-border dark:bg-dark-bg">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-dark-text-muted">
            {originalLabel}
          </div>
          <p className={sourceTextClassName ?? 'mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-700 dark:text-dark-text'}>
            {sourceText}
          </p>
        </div>
        <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-3 dark:border-primary-500/20 dark:bg-primary-900/10">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-700 dark:text-primary-300">
            {candidateLabel}
          </div>
          <p className={candidateTextClassName ?? 'mt-2 whitespace-pre-wrap text-xs leading-relaxed text-gray-800 dark:text-dark-text'}>
            {candidateText}
          </p>
        </div>
      </div>

      {/* Diff toggle button */}
      <button
        type="button"
        onClick={toggleDiff}
        className="mt-2 flex items-center gap-1 text-[10px] font-medium text-gray-400 hover:text-gray-600 dark:text-dark-text-muted dark:hover:text-dark-text-secondary transition-colors"
      >
        <ArrowLeftRight className="h-3 w-3" />
        {showDiff ? 'Hide diff' : 'Show diff'}
      </button>

      {showDiff && <DiffView before={sourceText} after={candidateText} />}

      <div className={actionsClassName ?? 'mt-3 flex flex-wrap gap-2'}>
        <button
          type="button"
          onClick={onPrimaryAction}
          className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-primary-600 text-white hover:bg-primary-500 active:scale-95 transition-all shadow-sm"
        >
          {primaryActionLabel}
        </button>
        {secondaryActionLabel && onSecondaryAction && (
          <button
            type="button"
            onClick={onSecondaryAction}
            className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 active:scale-95 transition-all shadow-sm"
          >
            {secondaryActionLabel}
          </button>
        )}
        <button
          type="button"
          onClick={handleUndoClick}
          className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-gray-100 dark:bg-dark-border dark:text-dark-text text-gray-700 hover:bg-gray-200 dark:hover:bg-dark-border2 active:scale-95 transition-all"
        >
          {undoActionLabel}
        </button>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <ConfirmationDialog
          message="Are you sure you want to undo the last revision? This will revert the applied changes."
          confirmLabel={undoActionLabel}
          cancelLabel="Cancel"
          onConfirm={handleConfirmRollback}
          onCancel={handleCancelRollback}
          integrityIssues={integrityResult && !integrityResult.ok ? integrityResult.issues : undefined}
        />
      )}
    </div>
  )
}
