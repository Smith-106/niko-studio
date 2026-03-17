import { useCallback, useEffect, useRef, useState } from 'react'
import { createCheckpoint, restoreCheckpoint } from '../api/client'

type ConnectionState = 'connected' | 'degraded' | 'disconnected' | 'reconnecting'

type RecoverStatus = {
  type: 'error' | 'success' | 'info'
  message: string
  detail?: string
}

interface UseChatRecoveryOptions {
  connectionState: ConnectionState
  t: {
    streamReconnecting: string
    streamRecovered: string
    streamInterrupted: string
    streamRestoreBeforeSendSuccess: string
    restoreFailed: string
  }
}

export function useChatRecovery({ connectionState, t }: UseChatRecoveryOptions) {
  const [recoverableCheckpointId, setRecoverableCheckpointId] = useState<string | null>(null)
  const [recoverStatus, setRecoverStatus] = useState<RecoverStatus | null>(null)

  const previousConnectionStateRef = useRef<ConnectionState | null>(null)

  useEffect(() => {
    const previous = previousConnectionStateRef.current
    if (connectionState === previous) {
      return
    }

    if (connectionState === 'reconnecting') {
      setRecoverStatus({ type: 'error', message: t.streamReconnecting })
    } else if (connectionState === 'connected' && previous === 'reconnecting') {
      setRecoverStatus({ type: 'success', message: t.streamRecovered })
    } else if (connectionState === 'disconnected') {
      setRecoverStatus({ type: 'error', message: t.streamInterrupted })
    }

    previousConnectionStateRef.current = connectionState
  }, [connectionState, t])

  const createBeforeSendCheckpoint = useCallback(async (label: string) => {
    const checkpointResponse = await createCheckpoint(label)
    const checkpointId = checkpointResponse.success && checkpointResponse.data?.checkpoint_id
      ? checkpointResponse.data.checkpoint_id
      : null
    if (checkpointId) {
      setRecoverableCheckpointId(checkpointId)
    }
    return checkpointId
  }, [])

  const restoreToCheckpoint = useCallback(async () => {
    if (!recoverableCheckpointId) return

    try {
      const response = await restoreCheckpoint(recoverableCheckpointId)
      if (response.success) {
        setRecoverStatus({ type: 'success', message: t.streamRestoreBeforeSendSuccess })
        setRecoverableCheckpointId(null)
      } else {
        setRecoverStatus({ type: 'error', message: response.error || t.restoreFailed })
      }
    } catch {
      setRecoverStatus({ type: 'error', message: t.restoreFailed })
    }
  }, [recoverableCheckpointId, t])

  return {
    recoverableCheckpointId,
    setRecoverableCheckpointId,
    recoverStatus,
    setRecoverStatus,
    createBeforeSendCheckpoint,
    restoreToCheckpoint,
  }
}
