import { useEffect, useRef, useState } from 'react'
import { listCheckpoints, restoreCheckpoint } from '../api/client'
import type { DialogCloseReason } from './useDialogFocusTrap'
import { useAppStore } from '../stores/appStore'

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
  const currentConversationId = useAppStore((state) => state.currentConversationId)
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const [checkpointMenuOpen, setCheckpointMenuOpen] = useState(false)
  const checkpointMenuContainerRef = useRef<HTMLDivElement | null>(null)
  const checkpointMenuTriggerRef = useRef<HTMLButtonElement | null>(null)
  const [checkpointsLoading, setCheckpointsLoading] = useState(false)
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [restoreStatus, setRestoreStatus] = useState<RestoreStatus | null>(null)

  const resolveCheckpointWorkspace = () => ({
    ...currentWorkspace,
    workflow: {
      ...currentWorkspace.workflow,
      sessionId: currentWorkspace.workflow.sessionId ?? currentConversationId,
    },
    chat: {
      ...currentWorkspace.chat,
      conversationId: currentWorkspace.chat.conversationId ?? currentConversationId,
    },
  })

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

    document.addEventListener('mousedown', handlePointerDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [checkpointMenuOpen])

  const closeCheckpointMenu = (_reason?: DialogCloseReason) => {
    setCheckpointMenuOpen(false)
  }

  const refreshCheckpoints = async () => {
    setCheckpointsLoading(true)
    try {
      const response = await listCheckpoints(10, resolveCheckpointWorkspace())
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
      const response = await restoreCheckpoint(checkpointId, resolveCheckpointWorkspace())
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
    checkpointMenuTriggerRef,
    checkpointsLoading,
    checkpoints,
    restoreStatus,
    closeCheckpointMenu,
    handleToggleCheckpointMenu,
    handleRestoreCheckpoint,
  }
}
