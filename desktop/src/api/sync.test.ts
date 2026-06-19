import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import { getSyncStatus, syncFull, syncPull, syncPush } from './sync'

describe('sync api', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('gets sync status from the status endpoint', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { lastSyncAt: 0, isConfigured: false } })

    await getSyncStatus()

    expect(callApiMock).toHaveBeenCalledWith('/sync/status', 'GET')
  })

  it('pushes and pulls sync payloads with optional keys', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { success: true, timestamp: 1 } })

    await syncPush('https://remote.test/repo', {
      authToken: 'token-1',
      keys: ['chapter-1', 'chapter-2'],
    })
    await syncPull('https://remote.test/repo', {
      authToken: 'token-2',
      keys: ['chapter-3'],
    })

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/sync/push', 'POST', {
      remoteUrl: 'https://remote.test/repo',
      authToken: 'token-1',
      keys: ['chapter-1', 'chapter-2'],
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/sync/pull', 'POST', {
      remoteUrl: 'https://remote.test/repo',
      authToken: 'token-2',
      keys: ['chapter-3'],
    })
  })

  it('runs full sync with auth token only', async () => {
    callApiMock.mockResolvedValue({ success: true, data: { success: true, timestamp: 2 } })

    await syncFull('https://remote.test/repo', {
      authToken: 'token-3',
    })

    expect(callApiMock).toHaveBeenCalledWith('/sync/full', 'POST', {
      remoteUrl: 'https://remote.test/repo',
      authToken: 'token-3',
    })
  })
})
