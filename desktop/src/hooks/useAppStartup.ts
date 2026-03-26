import { useTheme } from './useTheme'
import { useAppBackendBootstrap } from './useAppBackendBootstrap'

export function useAppStartup() {
  useTheme()
  useAppBackendBootstrap()
}
