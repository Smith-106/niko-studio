import { useEffect, useState } from 'react'
import { deriveGatewayRuntimeState, getGatewayHealth, type GatewayRuntimeView } from '../api/client'

interface UseAppRuntimeHealthOptions {
  backendStatus: boolean
  checkBackend: () => void | Promise<void>
}

export function useAppRuntimeHealth({ backendStatus, checkBackend }: UseAppRuntimeHealthOptions) {
  const [runtimeView, setRuntimeView] = useState<GatewayRuntimeView | null>(null)

  useEffect(() => {
    checkBackend()

    const fetchGatewayRuntime = async () => {
      try {
        const response = await getGatewayHealth()
        if (response.success && response.data) {
          setRuntimeView(deriveGatewayRuntimeState(response.data, backendStatus))
          return
        }
      } catch {
        // ignore runtime fetch error
      }
      setRuntimeView(deriveGatewayRuntimeState(null, backendStatus))
    }

    void fetchGatewayRuntime()

    let interval: ReturnType<typeof setInterval> | null = setInterval(() => {
      void checkBackend()
      void fetchGatewayRuntime()
    }, 30000)

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (interval) {
          clearInterval(interval)
          interval = null
        }
      } else {
        void checkBackend()
        void fetchGatewayRuntime()
        if (!interval) {
          interval = setInterval(() => {
            void checkBackend()
            void fetchGatewayRuntime()
          }, 30000)
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      if (interval) {
        clearInterval(interval)
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [backendStatus, checkBackend])

  return runtimeView
}
