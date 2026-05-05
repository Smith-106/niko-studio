import { useCallback, useRef, useState } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { isTauriRuntime } from '../api/transport'

export interface UpdateStatus {
  checking: boolean
  available: boolean
  downloading: boolean
  progress: number
  ready: boolean
  version: string | null
  error: string | null
}

const initialStatus: UpdateStatus = {
  checking: false,
  available: false,
  downloading: false,
  progress: 0,
  ready: false,
  version: null,
  error: null,
}

export function useAppUpdate(onNotify?: (message: string) => void) {
  const [status, setStatus] = useState<UpdateStatus>(initialStatus)
  const checkedRef = useRef(false)

  const checkForUpdate = useCallback(async () => {
    if (!isTauriRuntime() || checkedRef.current) return
    checkedRef.current = true

    try {
      setStatus(s => ({ ...s, checking: true, error: null }))
      const update = await check()

      if (!update) {
        setStatus(s => ({ ...s, checking: false }))
        return
      }

      setStatus({ ...initialStatus, available: true, version: update.version })
      onNotify?.(`New version ${update.version} available`)
    } catch {
      setStatus(s => ({ ...s, checking: false }))
    }
  }, [onNotify])

  const downloadAndInstall = useCallback(async () => {
    try {
      setStatus(s => ({ ...s, downloading: true, progress: 0, error: null }))

      const update = await check()
      if (!update) {
        setStatus(s => ({ ...s, downloading: false, error: 'No update available' }))
        return
      }

      await update.downloadAndInstall(({ event }) => {
        switch (event) {
          case 'Started':
            setStatus(s => ({ ...s, progress: 0 }))
            break
          case 'Progress':
            setStatus(s => ({ ...s, progress: 0 }))
            break
          case 'Finished':
            setStatus(s => ({ ...s, ready: true, downloading: false, progress: 100 }))
            break
        }
      })

      await relaunch()
    } catch (err) {
      setStatus(s => ({
        ...s,
        downloading: false,
        error: err instanceof Error ? err.message : 'Update failed',
      }))
    }
  }, [])

  return { status, checkForUpdate, downloadAndInstall }
}
