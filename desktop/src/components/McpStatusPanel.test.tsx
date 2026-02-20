import { describe, expect, it } from 'vitest'
import { deriveGatewayRuntimeState, type GatewayHealth } from '../api/client'

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
