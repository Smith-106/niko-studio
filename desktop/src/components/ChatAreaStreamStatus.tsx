interface ChatAreaStatus {
  type: 'success' | 'error'
  message: string
}

interface ChatAreaStreamStatusProps {
  recoverStatus: ChatAreaStatus | null
  recoverableCheckpointId: string | null
  restoreBeforeSendLabel: string
  onRestoreToCheckpoint: () => void
  uploadStatus: ChatAreaStatus | null
}

export function ChatAreaStreamStatus({
  recoverStatus,
  recoverableCheckpointId,
  restoreBeforeSendLabel,
  onRestoreToCheckpoint,
  uploadStatus,
}: ChatAreaStreamStatusProps) {
  return (
    <>
      {recoverStatus && (
        <div
          className={`px-4 py-2 text-xs ${
            recoverStatus.type === 'success'
              ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
              : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <span>{recoverStatus.message}</span>
            {recoverableCheckpointId && recoverStatus.type === 'error' && (
              <button
                onClick={onRestoreToCheckpoint}
                className="px-2 py-1 rounded bg-white/80 dark:bg-dark-border dark:text-dark-text"
                type="button"
              >
                {restoreBeforeSendLabel}
              </button>
            )}
          </div>
        </div>
      )}

      {uploadStatus && (
        <div
          className={`px-4 py-2 text-xs ${
            uploadStatus.type === 'success'
              ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
              : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
          }`}
        >
          {uploadStatus.message}
        </div>
      )}
    </>
  )
}
