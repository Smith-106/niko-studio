import React from 'react'
import type { ToastItem, ToastType } from '../hooks/useToast'

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const typeStyles: Record<ToastType, string> = {
  success: 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400',
  error: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400',
  info: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-700 dark:text-blue-400',
}

const typeIcons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
}

/**
 * Toast notification container.
 * Renders toast notifications in the bottom-right corner.
 */
export const ToastContainer = React.memo(function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 animate-fade-in">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg border shadow-lg text-sm font-medium transition-all cursor-pointer ${typeStyles[toast.type]}`}
          onClick={() => onDismiss(toast.id)}
          role="alert"
        >
          <span className="text-base">{typeIcons[toast.type]}</span>
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  )
})