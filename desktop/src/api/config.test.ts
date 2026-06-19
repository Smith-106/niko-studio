import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
}))

import {
  getConfig,
  getSecrets,
  MODIFIABLE_FIELDS,
  reloadConfig,
  SECRET_FIELDS,
  updateConfig,
  updateSecrets,
} from './config'

describe('config api bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('injects the default modifiable field list when the backend omits it', async () => {
    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'ok',
        config: { version: '11.0.0' },
      },
    })

    const response = await getConfig()

    expect(callApiMock).toHaveBeenCalledWith('/config', 'GET')
    expect(response).toEqual({
      success: true,
      data: {
        status: 'ok',
        config: { version: '11.0.0' },
        modifiable_fields: MODIFIABLE_FIELDS,
      },
    })
  })

  it('preserves backend-provided modifiable fields and passes through failures unchanged', async () => {
    callApiMock
      .mockResolvedValueOnce({
        success: true,
        data: {
          status: 'ok',
          config: { version: '11.0.0' },
          modifiable_fields: ['version'],
        },
      })
      .mockResolvedValueOnce({
        success: false,
        error: 'gateway offline',
      })

    const success = await getConfig()
    const failure = await getConfig()

    expect(success.data?.modifiable_fields).toEqual(['version'])
    expect(failure).toEqual({
      success: false,
      error: 'gateway offline',
    })
  })

  it('posts config and secret mutation payloads to the expected endpoints', async () => {
    callApiMock.mockResolvedValue({ success: true, data: {} })

    await updateConfig({ version: '11.0.1' })
    await getSecrets()
    await updateSecrets({ 'agent.openai_api_key': 'sk-test' })
    await reloadConfig()

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/config', 'PUT', {
      fields: { version: '11.0.1' },
    })
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/config/secrets', 'GET')
    expect(callApiMock).toHaveBeenNthCalledWith(3, '/config/secrets', 'PUT', {
      secrets: { 'agent.openai_api_key': 'sk-test' },
    })
    expect(callApiMock).toHaveBeenNthCalledWith(4, '/config/reload', 'POST')
    expect(SECRET_FIELDS).toContain('agent.openai_api_key')
    expect(MODIFIABLE_FIELDS).toContain('gateway.ui_bridge_enabled')
  })
})
