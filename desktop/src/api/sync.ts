import { type ApiResponse, callApi } from './core'

export interface SyncStatus {
  lastSyncAt: number
  isConfigured: boolean
}

export interface SyncResult {
  success: boolean
  timestamp: number
  pushed?: number
  pulled?: number
  conflicts?: number
  error?: string
}

export async function getSyncStatus(): Promise<ApiResponse<SyncStatus>> {
  return callApi<SyncStatus>('/sync/status', 'GET')
}

export async function syncPush(
  remoteUrl: string,
  options?: { authToken?: string; keys?: string[] },
): Promise<ApiResponse<SyncResult>> {
  return callApi<SyncResult>('/sync/push', 'POST', {
    remoteUrl,
    authToken: options?.authToken,
    keys: options?.keys,
  })
}

export async function syncPull(
  remoteUrl: string,
  options?: { authToken?: string; keys?: string[] },
): Promise<ApiResponse<SyncResult>> {
  return callApi<SyncResult>('/sync/pull', 'POST', {
    remoteUrl,
    authToken: options?.authToken,
    keys: options?.keys,
  })
}

export async function syncFull(
  remoteUrl: string,
  options?: { authToken?: string },
): Promise<ApiResponse<SyncResult>> {
  return callApi<SyncResult>('/sync/full', 'POST', {
    remoteUrl,
    authToken: options?.authToken,
  })
}
