import { useEffect, useRef, useState } from 'react'
import { listCheckpoints, restoreCheckpoint } from '../api/client'

interface CheckpointItem {
  id: string
  description: string
  created_at: string
}

interface RestoreStatus {
  type: 'success' | 'error'
  message: string
}

interface UseAppCheckpointMenuOptions {
  restoreFailedText: string
  restoreSuccessText: string
}

export function useAppCheckpointMenu({ restoreFailedText, restoreSuccessText }: UseAppCheckpointMenuOptions) {
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false)
  const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null)

  useEffect(() => {
    if (!restoreStatus) return

    const timer = setTimeout(() => setRestoreStatus(null), 2500)
    return () => clearTimeout(timer)
  }, [restoreStatus])

  useEffect(() => {
    if (!checkpointMenuOpen) return

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (checkpointMenuContainerRef.current?.contains(target)) return
      setCheckpointMenuOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setCheckpointMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [checkpointMenuOpen])

  const refreshCheckpoints = async () => {
    setCheckpointsLoading(true)
    try {
      const response = await listCheckpoints(10)
      if (response.success && Array.isArray(response.data)) {
        setCheckpoints(response.data)
      } else {
        setCheckpoints([])
        setRestoreStatus({ type: 'error', message: response.error || restoreFailedText })
      }
    } catch {
      setCheckpoints([])
      setRestoreStatus({ type: 'error', message: restoreFailedText })
    } finally {
      setCheckpointsLoading(false)
    }
  }

  const handleToggleCheckpointMenu = async () => {
    const nextOpen = !checkpointMenuOpen
    setCheckpointMenuOpen(nextOpen)
    if (nextOpen) {
      await refreshCheckpoints()
    }
  }

  const handleRestoreCheckpoint = async (checkpointId: string) => {
    try {
      const response = await restoreCheckpoint(checkpointId)
      if (response.success) {
        setRestoreStatus({ type: 'success', message: restoreSuccessText })
        setCheckpointMenuOpen(false)
      } else {
        setRestoreStatus({ type: 'error', message: response.error || restoreFailedText })
      }
    } catch {
      setRestoreStatus({ type: 'error', message: restoreFailedText })
    }
  }

  return {
    checkpointMenuOpen,
    checkpointMenuContainerRef,
    checkpointsLoading,
    checkpoints,
    restoreStatus,
    handleToggleCheckpointMenu,
    handleRestoreCheckpoint,
  }
}
