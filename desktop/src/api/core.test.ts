import { beforeEach, describe, expect, it, vi } from 'vitest'

const callTauriApiMock = vi.hoisted(() => vi.fn())

vi.mock('./transport', () => ({
  callTauriApi: callTauriApiMock,
  checkTauriBackendHealth: vi.fn(),
  getRuntimeGatewayBase: vi.fn(),
  isTauriRuntime: vi.fn(() => true),
  normalizeGatewayBaseUrl: (value: string) => value.replace(/\/+$/, ''),
  startTauriBackend: vi.fn(),
}))

import { callApi } from './core'

describe('callApi Tauri bridge', () => {
  beforeEach(() => {
    callTauriApiMock.mockReset()
  })

  it('maps tauri non-2xx response payload into ApiResponse error', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 403,
      body: JSON.stringify({ error: 'UI Bridge is disabled', status: 'disabled' }),
    })

    const response = await callApi('/ui-bridge/workflow/route', 'POST', { task: 'route this' })

    expect(response).toEqual({
      success: false,
      error: 'UI Bridge is disabled',
      errorData: { error: 'UI Bridge is disabled', status: 'disabled' },
    })
  })

  it('returns tauri 2xx response payload as success data', async () => {
    callTauriApiMock.mockResolvedValue({
      statusCode: 200,
      body: JSON.stringify({ plan_id: 'plan-1', step_id: 'step-1' }),
    })

    const response = await callApi<{ plan_id: string; step_id: string }>(
      '/workflow/execute',
      'POST',
      { plan_id: 'plan-1' },
    )

    expect(response).toEqual({
      success: true,
      data: { plan_id: 'plan-1', step_id: 'step-1' },
    })
  })
})
