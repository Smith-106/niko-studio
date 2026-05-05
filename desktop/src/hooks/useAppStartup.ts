import { useEffect } from 'react'
import { useTheme } from './useTheme'
import { useAppBackendBootstrap } from './useAppBackendBootstrap'
import { useAppUpdate } from './useAppUpdate'

export function useAppStartup(notifyUpdate?: (msg: string) => void) {
  useTheme()
  useAppBackendBootstrap()
  const { checkForUpdate } = useAppUpdate(notifyUpdate)
  useEffect(() => { checkForUpdate() }, [checkForUpdate])
}
