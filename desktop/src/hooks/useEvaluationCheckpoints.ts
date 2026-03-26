import { useState } from 'react'
import { createCheckpoint, listCheckpoints, restoreCheckpoint } from '../api/client'

export interface CheckpointItem {
  id: string
  description: string
  created_at: string
}

interface UseEvaluationCheckpointsOptions {
  t: {
    loadingCheckpoints: string
    evaluationCheckpointPlaceholder: string
    save: string
    restoreFailed: string
  }
  onRestoreSuccess: (checkpointId: string) => Promise<void> | void
}

export function useEvaluationCheckpoints({ t, onRestoreSuccess }: UseEvaluationCheckpointsOptions) {
  const [checkpointDescription, setCheckpointDescription] = useState('')
  const [checkpoints, setCheckpoints] = useState<CheckpointItem[]>([])
  const [checkpointError, setCheckpointError] = useState<string | null>(null)

  const refreshCheckpoints = async () => {
    setCheckpointError(null)
    try {
      const response = await listCheckpoints(20)
      if (response.success && Array.isArray(response.data)) {
        setCheckpoints(response.data)
      } else {
        setCheckpointError(t.loadingCheckpoints)
      }
    } catch {
      setCheckpointError(t.loadingCheckpoints)
    }
  }

  const handleCreateCheckpoint = async () => {
    setCheckpointError(null)
    try {
      const response = await createCheckpoint(checkpointDescription || t.evaluationCheckpointPlaceholder)
      if (response.success) {
        setCheckpointDescription('')
        await refreshCheckpoints()
      } else {
        setCheckpointError(response.error || t.save)
      }
    } catch {
      setCheckpointError(t.save)
    }
  }

  const handleRestoreCheckpoint = async (checkpointId: string) => {
    setCheckpointError(null)
    try {
      const response = await restoreCheckpoint(checkpointId)
      if (response.success) {
        await onRestoreSuccess(checkpointId)
        await refreshCheckpoints()
      } else {
        setCheckpointError(response.error || t.restoreFailed)
      }
    } catch {
      setCheckpointError(t.restoreFailed)
    }
  }

  return {
    checkpointDescription,
    checkpoints,
    checkpointError,
    setCheckpointDescription,
    refreshCheckpoints,
    handleCreateCheckpoint,
    handleRestoreCheckpoint,
  }
}
