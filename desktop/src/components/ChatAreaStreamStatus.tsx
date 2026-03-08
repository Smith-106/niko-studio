interface ChatAreaStatus {
  type: 'success' | 'error' | 'info'
  message: string
  detail?: string
}

type UploadStage = 'reading' | 'uploading' | 'injecting' | 'done' | 'error'
type UploadErrorCategory = 'format' | 'size' | 'network' | 'service'

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
  onRestoreToCheckpoint: () => void
  onRetryLastSend: () => void
  onCopyRecoverError: () => Promise<boolean>
  uploadStatus: UploadStatus | null
}

const STATUS_CLASS = {
  success: 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400',
  error: 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
  info: 'text-blue-700 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-300',
}

export function ChatAreaStreamStatus({
  recoverStatus,
  recoverableCheckpointId,
  restoreBeforeSendLabel,
  retryLastSendLabel,
  copyErrorLabel,
  onRestoreToCheckpoint,
  onRetryLastSend,
  onCopyRecoverError,
  uploadStatus,
}: ChatAreaStreamStatusProps) {
  return (
    <>
      {recoverStatus && (
        <div className={`px-4 py-2 text-xs ${STATUS_CLASS[recoverStatus.type]}`}>
          <div className="flex flex-col gap-2">
            <span>{recoverStatus.message}</span>
            {recoverStatus.type === 'error' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={onRetryLastSend}
                  className="px-2 py-1 rounded bg-white/80 dark:bg-dark-border dark:text-dark-text"
                  type="button"
                >
                  {retryLastSendLabel}
                </button>
                {recoverableCheckpointId && (
                  <button
                    onClick={onRestoreToCheckpoint}
                    className="px-2 py-1 rounded bg-white/80 dark:bg-dark-border dark:text-dark-text"
                    type="button"
                  >
                    {restoreBeforeSendLabel}
                  </button>
                )}
                <button
                  onClick={() => {
                    void onCopyRecoverError()
                  }}
                  className="px-2 py-1 rounded bg-white/80 dark:bg-dark-border dark:text-dark-text"
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
        <div className={`px-4 py-2 text-xs ${STATUS_CLASS[uploadStatus.type]}`}>
          <div className="flex items-center justify-between gap-3">
            <span>{uploadStatus.message}</span>
            <span className="font-medium">{Math.max(0, Math.min(100, Math.round(uploadStatus.progress)))}%</span>
          </div>
          {uploadStatus.errorCategory && (
            <div className="mt-1 opacity-80">{uploadStatus.errorCategory}</div>
          )}
        </div>
      )}
    </>
  )
}
