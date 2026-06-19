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
        diagnostic: null,
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
  it('renders structured runtime diagnostics for degraded gateway health', async () => {
    mockedGetGatewayHealth.mockResolvedValue({
      success: false,
      error: 'gateway offline',
      errorData: {
        status: 'degraded',
        diagnostic: {
          failure_class: 'parser_missing',
          summary: 'Document parser prerequisite is missing.',
          detail: 'mammoth is required',
          action: 'Install mammoth and retry.',
        },
        mcp_runtime: {
          connection_state: 'disconnected',
          reconnect_state: 'failed',
          reconnect_attempts: 2,
          last_error: 'mammoth is required',
          diagnostic: {
            failure_class: 'parser_missing',
            summary: 'Document parser prerequisite is missing.',
            detail: 'mammoth is required',
            action: 'Install mammoth and retry.',
          },
          servers: {},
        },
      },
    })

    render(<McpStatusPanel onClose={() => {}} />)

    await waitFor(() => {
      expect(mockedListGatewayServiceConfigs).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByRole('dialog', { name: 'Service diagnostics panel' })).toBeInTheDocument()
    expect(await screen.findByText('Runtime diagnostics')).toBeInTheDocument()
    expect(screen.getAllByText('Document parser missing').length).toBeGreaterThan(0)
    expect(screen.getAllByText('mammoth is required').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Install mammoth and retry.').length).toBeGreaterThan(0)
  })
})
