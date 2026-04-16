import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../i18n', async () => {
  const actual = await vi.importActual<typeof import('../i18n')>('../i18n')

  return {
    ...actual,
    useI18n: () => ({
      t: actual.translations.en,
      translate: (key: keyof typeof actual.translations.en) => actual.translations.en[key],
      language: 'en',
    }),
  }
})

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')

  return {
    ...actual,
    checkBackendHealth: vi.fn(),
    getGatewayHealth: vi.fn(),
    getGatewayMetrics: vi.fn(),
    listGatewayTools: vi.fn(),
    listGatewayServiceConfigs: vi.fn(),
    createGatewayServiceConfig: vi.fn(),
    probeGatewayServiceHealth: vi.fn(),
    setGatewayServiceEnabled: vi.fn(),
    updateGatewayServiceConfig: vi.fn(),
  }
})

import {
  checkBackendHealth,
  deriveGatewayRuntimeState,
  getGatewayHealth,
  getGatewayMetrics,
  listGatewayServiceConfigs,
  listGatewayTools,
  type GatewayHealth,
} from '../api/client'
import { McpStatusPanel } from './McpStatusPanel'

const mockedCheckBackendHealth = vi.mocked(checkBackendHealth)
const mockedGetGatewayHealth = vi.mocked(getGatewayHealth)
const mockedGetGatewayMetrics = vi.mocked(getGatewayMetrics)
const mockedListGatewayTools = vi.mocked(listGatewayTools)
const mockedListGatewayServiceConfigs = vi.mocked(listGatewayServiceConfigs)

beforeEach(() => {
  vi.clearAllMocks()

  mockedCheckBackendHealth.mockResolvedValue(true)
  mockedGetGatewayHealth.mockResolvedValue({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      services: {
        memory: 'ok',
        search: 'ok',
      },
      mcp_runtime: {
        session_id: 'gw-session-123',
        connection_state: 'connected',
        reconnect_state: 'idle',
        reconnect_attempts: 0,
        last_error: null,
        servers: {},
      },
    },
  })
  mockedGetGatewayMetrics.mockResolvedValue({
    success: true,
    data: {
      status: 'ok',
      metrics: {
        requests_total: 12,
        requests_failed_total: 0,
        requests_success_total: 12,
        latency_ms_avg: 120,
        latency_ms_max: 200,
      },
    },
  })
  mockedListGatewayTools.mockResolvedValue({
    success: true,
    data: {
      memory: ['recall'],
    },
  })
  mockedListGatewayServiceConfigs.mockResolvedValue({
    success: true,
    data: {
      services: [],
    },
  })
})

describe('deriveGatewayRuntimeState', () => {
  it('falls back to disconnected when runtime is missing and backend is unhealthy', () => {
    const health: GatewayHealth = {
      status: 'degraded',
      version: '1.0.0',
      services: { memory: 'error' },
    }

    const result = deriveGatewayRuntimeState(health, false)

    expect(result.connectionState).toBe('disconnected')
    expect(result.reconnectState).toBe('failed')
    expect(result.sessionId).toBeNull()
    expect(result.reconnectAttempts).toBe(0)
  })

  it('falls back to degraded when services contain non-ok values', () => {
    const health: GatewayHealth = {
      status: 'degraded',
      version: '1.0.0',
      services: { memory: 'ok', search: 'error' },
    }

    const result = deriveGatewayRuntimeState(health, true)

    expect(result.connectionState).toBe('degraded')
    expect(result.reconnectState).toBe('failed')
  })

  it('prefers runtime payload when available', () => {
    const health: GatewayHealth = {
      status: 'healthy',
      version: '1.0.0',
      services: { memory: 'ok' },
      mcp_runtime: {
        session_id: 'gw-session-123',
        connection_state: 'reconnecting',
        reconnect_state: 'retrying',
        reconnect_attempts: 3,
        last_error: 'search:error',
        servers: {
          search: { state: 'reconnecting', loading: true, last_error: 'timeout' },
        },
      },
    }

    const result = deriveGatewayRuntimeState(health, true)

    expect(result.connectionState).toBe('reconnecting')
    expect(result.reconnectState).toBe('retrying')
    expect(result.sessionId).toBe('gw-session-123')
    expect(result.reconnectAttempts).toBe(3)
    expect(result.lastError).toBe('search:error')
    expect(result.servers.search).toEqual({ state: 'reconnecting', loading: true, last_error: 'timeout' })
  })
})

describe('McpStatusPanel', () => {
  it('renders the softened top-level connection framing in the detailed diagnostics view', async () => {
    render(<McpStatusPanel onClose={() => {}} />)

    await waitFor(() => {
      expect(mockedListGatewayServiceConfigs).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText('Connection details')).toBeInTheDocument()
    expect(screen.getByText('Connection status')).toBeInTheDocument()
    expect(screen.getByText('Connection')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()

    expect(screen.queryByText('Gateway status')).not.toBeInTheDocument()
    expect(screen.queryByText('Gateway health')).not.toBeInTheDocument()
    expect(screen.queryByText('Reconnect')).not.toBeInTheDocument()
  })
})
