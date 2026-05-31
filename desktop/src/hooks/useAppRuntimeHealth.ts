import { useEffect, useRef, useState } from 'react'
import { getGatewayHealth, mergeGatewayHealthState, type GatewayRuntimeView } from '../api/client'

interface UseAppRuntimeHealthOptions {
  backendStatus: boolean
  checkBackend: () => void | Promise<void>
}

export function useAppRuntimeHealth({ backendStatus, checkBackend }: UseAppRuntimeHealthOptions) {
  const [runtimeView, setRuntimeView] = useState<GatewayRuntimeView | null>(null)
  // Use ref to track interval so visibility handler clears previous before creating new
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    checkBackend()

    const fetchGatewayRuntime = async () => {
      try {
        const response = await getGatewayHealth()
        setRuntimeView(mergeGatewayHealthState(backendStatus, response))
      } catch {
        setRuntimeView(mergeGatewayHealthState(backendStatus, null))
      }
    }

    void fetchGatewayRuntime()

    const startInterval = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        void checkBackend()
        void fetchGatewayRuntime()
      }, 30000)
    }

    startInterval()

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      } else {
        void checkBackend()
        void fetchGatewayRuntime()
        startInterval()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [backendStatus, checkBackend])

  return runtimeView
}
