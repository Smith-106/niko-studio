import React from 'react'

interface ChatAreaStatus {
  type: 'success' | 'error' | 'info'
  message: string
  detail?: string
}

type UploadStage = 'reading' | 'uploading' | 'injecting' | 'done' | 'error'
type UploadErrorCategory = 'format' | 'size' | 'network' | 'prerequisite' | 'service'

interface UploadStatus {
  type: 'success' | 'error' | 'info'
  stage: UploadStage
  progress: number
  message: string
  errorCategory?: UploadErrorCategory
}

interface ChatAreaStreamStatusProps {
  recoverStatus: ChatAreaStatus | null
  recoverableCheckpointId: string | null
  restoreBeforeSendLabel: string
  retryLastSendLabel: string
  copyErrorLabel: string
  errorCategoryLabel: string
  onRestoreToCheckpoint: () => void
  onRetryLastSend: () => void
  onCopyRecoverError: () => Promise<boolean>
  onDismissStatus?: () => void
  uploadStatus: UploadStatus | null
}

const STATUS_CLASS = {
  success: 'text-success-700 bg-success-50 border-success-100 dark:bg-success-900/20 dark:text-success-400 dark:border-success-500/20',
  error: 'text-danger-700 bg-danger-50 border-danger-100 dark:bg-danger-900/20 dark:text-danger-400 dark:border-danger-500/20',
  info: 'text-primary-700 bg-primary-50 border-primary-100 dark:bg-primary-900/20 dark:text-primary-300 dark:border-primary-500/20',
}

export const ChatAreaStreamStatus = React.memo(function ChatAreaStreamStatus({
  recoverStatus,
  recoverableCheckpointId,
  restoreBeforeSendLabel,
  retryLastSendLabel,
  copyErrorLabel,
  errorCategoryLabel,
  onRestoreToCheckpoint,
  onRetryLastSend,
  onCopyRecoverError,
  onDismissStatus,
  uploadStatus,
}: ChatAreaStreamStatusProps) {
  return (
    <div className="space-y-2 mb-2 animate-fade-in">
      {recoverStatus && (
        <div className={`px-4 py-3 text-xs rounded-xl border shadow-sm ${STATUS_CLASS[recoverStatus.type]}`}>
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium leading-relaxed">{recoverStatus.message}</span>
              {onDismissStatus && (
                <button
                  onClick={onDismissStatus}
                  className="shrink-0 text-current opacity-50 hover:opacity-100 transition-opacity leading-none"
                  type="button"
                  aria-label="dismiss"
                >
                  ✕
                </button>
              )}
            </div>
            {recoverStatus.type === 'error' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onRetryLastSend}
                  className="px-3 py-1.5 rounded-lg bg-white/80 dark:bg-dark-surface dark:text-dark-text border border-gray-200 dark:border-dark-border hover:bg-white dark:hover:bg-dark-surface2 transition-all active:scale-95 shadow-sm font-semibold"
                  type="button"
                >
                  {retryLastSendLabel}
                </button>
                {recoverableCheckpointId && (
                  <button
                    onClick={onRestoreToCheckpoint}
                    className="px-3 py-1.5 rounded-lg bg-white/80 dark:bg-dark-surface dark:text-dark-text border border-gray-200 dark:border-dark-border hover:bg-white dark:hover:bg-dark-surface2 transition-all active:scale-95 shadow-sm font-semibold"
                    type="button"
                  >
                    {restoreBeforeSendLabel}
                  </button>
                )}
                <button
                  onClick={() => {
                    void onCopyRecoverError()
                  }}
                  className="px-3 py-1.5 rounded-lg bg-white/80 dark:bg-dark-surface dark:text-dark-text border border-gray-200 dark:border-dark-border hover:bg-white dark:hover:bg-dark-surface2 transition-all active:scale-95 shadow-sm font-semibold"
                  type="button"
                >
                  {copyErrorLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {uploadStatus && (
        <div className={`px-4 py-3 text-xs rounded-xl border shadow-sm ${STATUS_CLASS[uploadStatus.type]}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{uploadStatus.message}</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-200/50 dark:bg-black/20 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-current transition-all duration-300" 
                  style={{ width: `${Math.max(0, Math.min(100, Math.round(uploadStatus.progress)))}%` }}
                />
              </div>
              <span className="font-bold min-w-[32px] text-right">{Math.max(0, Math.min(100, Math.round(uploadStatus.progress)))}%</span>
            </div>
          </div>
          {uploadStatus.errorCategory && (
            <div className="mt-2 text-[10px] font-bold uppercase tracking-wider opacity-70">
              {errorCategoryLabel}: {uploadStatus.errorCategory}
            </div>
          )}
        </div>
      )}
    </div>
  )
})
