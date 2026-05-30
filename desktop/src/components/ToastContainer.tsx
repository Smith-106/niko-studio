import React, { useState, useEffect, useCallback } from 'react'
import type { ToastItem, ToastType } from '../hooks/useToast'

interface ToastContainerProps {
  toasts: ToastItem[]
  onDismiss: (id: number) => void
}

const typeStyles: Record<ToastType, { bg: string; border: string; text: string; stripe: string; shadow: string }> = {
  success: {
    bg: 'bg-green-50 bg-white/80 dark:bg-[#0d1e13]/70 backdrop-blur-md',
    border: 'border-emerald-500/25 dark:border-emerald-500/15',
    text: 'text-green-700 text-slate-800 dark:text-emerald-300',
    stripe: 'bg-gradient-to-b from-emerald-400 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.35)]',
    shadow: 'shadow-[0_8px_32px_rgba(16,185,129,0.06)]',
  },
  error: {
    bg: 'bg-red-50 bg-white/80 dark:bg-[#230d0d]/70 backdrop-blur-md',
    border: 'border-rose-500/25 dark:border-rose-500/15',
    text: 'text-red-700 text-slate-800 dark:text-rose-300',
    stripe: 'bg-gradient-to-b from-rose-400 to-red-500 shadow-[0_0_10px_rgba(244,63,94,0.35)]',
    shadow: 'shadow-[0_8px_32px_rgba(244,63,94,0.06)]',
  },
  info: {
    bg: 'bg-blue-50 bg-white/80 dark:bg-[#0a1224]/70 backdrop-blur-md',
    border: 'border-indigo-500/25 dark:border-indigo-500/15',
    text: 'text-blue-700 text-slate-800 dark:text-indigo-300',
    stripe: 'bg-gradient-to-b from-indigo-400 to-primary-500 shadow-[0_0_10px_rgba(99,102,241,0.35)]',
    shadow: 'shadow-[0_8px_32px_rgba(99,102,241,0.06)]',
  },
}

const typeIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-[10px] font-bold ring-1 ring-emerald-500/25">
      ✓
    </span>
  ),
  error: (
    <span className="w-5 h-5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center text-[10px] font-bold ring-1 ring-rose-500/25">
      ✕
    </span>
  ),
  info: (
    <span className="w-5 h-5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-[10px] font-bold ring-1 ring-indigo-500/25">
      ℹ
    </span>
  ),
}

function ToastItemView({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const [exiting, setExiting] = useState(false)

  const handleDismiss = useCallback(() => {
    setExiting(true)
    const isTest = typeof process !== 'undefined' && process.env.NODE_ENV === 'test'
    if (isTest) {
      onDismiss(toast.id)
    } else {
      setTimeout(() => onDismiss(toast.id), 250)
    }
  }, [onDismiss, toast.id])

  useEffect(() => {
    const timer = setTimeout(handleDismiss, 5000)
    return () => clearTimeout(timer)
  }, [handleDismiss])

  const style = typeStyles[toast.type]

  return (
    <div
      className={`flex items-center gap-3 pr-5 py-3 rounded-xl border relative overflow-hidden select-none transition-all duration-300 hover:scale-[1.02] active:scale-95 cursor-pointer max-w-sm ${
        style.bg
      } ${style.border} ${style.shadow} ${style.text} ${
        exiting ? 'animate-slide-out-right' : 'animate-slide-in-right'
      }`}
      onClick={handleDismiss}
      role="alert"
    >
      {/* Gradient Indicator Stripe */}
      <div className={`w-1 absolute left-0 top-0 bottom-0 ${style.stripe} animate-pulse-subtle`} />

      <div className="pl-3.5 shrink-0">{typeIcons[toast.type]}</div>
      <span className="text-[11px] font-bold tracking-wide leading-relaxed select-text">{toast.message}</span>
    </div>
  )
}

export const ToastContainer = React.memo(function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5">
      {toasts.map((toast) => (
        <ToastItemView key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
})