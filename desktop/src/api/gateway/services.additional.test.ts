import { beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import {
  createGatewayServiceConfig,
  deleteGatewayServiceConfig,
  listGatewayServiceConfigs,
  probeGatewayServiceHealth,
  setGatewayServiceEnabled,
  updateGatewayServiceConfig,
} from './services'

describe('gateway services api bridge', () => {
  beforeEach(() => {
    callApiMock.mockReset()
    callApiMock.mockResolvedValue({ success: true, data: {} })
  })

  it('routes list, create, update, enable, probe, and delete requests to the expected endpoints', async () => {
    const payload = {
      serviceId: 'memory/local service',
      label: 'Memory Local',
      command: 'node service.js',
    } as unknown as Record<string, unknown>

    await listGatewayServiceConfigs()
    await createGatewayServiceConfig(payload as never)
    await updateGatewayServiceConfig('memory/local service', payload as never)
    await setGatewayServiceEnabled('memory/local service', false)
    await probeGatewayServiceHealth('memory/local service')
    await deleteGatewayServiceConfig('memory/local service')

    expect(callApiMock).toHaveBeenNthCalledWith(1, '/admin/mcp/services', 'GET')
    expect(callApiMock).toHaveBeenNthCalledWith(2, '/admin/mcp/services', 'POST', payload)
    expect(callApiMock).toHaveBeenNthCalledWith(
      3,
      '/admin/mcp/services/memory%2Flocal%20service',
      'PUT',
      payload,
    )
    expect(callApiMock).toHaveBeenNthCalledWith(
      4,
      '/admin/mcp/services/memory%2Flocal%20service/enabled',
      'POST',
      { enabled: false },
    )
    expect(callApiMock).toHaveBeenNthCalledWith(
      5,
      '/admin/mcp/services/memory%2Flocal%20service/probe',
      'POST',
    )
    expect(callApiMock).toHaveBeenNthCalledWith(
      6,
      '/admin/mcp/services/memory%2Flocal%20service',
      'DELETE',
    )
  })
})
