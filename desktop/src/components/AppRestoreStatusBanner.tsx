interface RestoreStatus {
  type: 'success' | 'error'
  message: string
}

interface AppRestoreStatusBannerProps {
  restoreStatus: RestoreStatus | null
}

export function AppRestoreStatusBanner({ restoreStatus }: AppRestoreStatusBannerProps) {
  if (!restoreStatus) {
    return null
  }

  return (
    <div
      className={`px-4 py-2 text-xs animate-fade-in ${
        restoreStatus.type === 'success'
          ? 'text-green-700 bg-green-50 dark:bg-green-900/20 dark:text-green-400'
          : 'text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400'
      }`}
    >
      {restoreStatus.message}
    </div>
  )
}
