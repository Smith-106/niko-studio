import { describe, expect, it } from 'vitest'
import type {
  GatewayConnectionState,
  GatewayHealth,
  GatewayMetrics,
  GatewayReconnectState,
  GatewayRuntime,
  GatewayRuntimeView,
  GatewayServiceConfig,
  GatewayServiceConfigInput,
  GatewayServiceProbeResult,
  WritingHelperMode,
  WritingHelperRequest,
  WritingHelperResponse,
} from './contracts'

describe('contracts type compilation', () => {
  it('GatewayMetrics accepts valid numeric fields', () => {
    const metrics: GatewayMetrics = {
      requests_total: 100,
      requests_failed_total: 5,
      requests_success_total: 95,
      latency_ms_avg: 42,
      latency_ms_max: 200,
    }
    expect(metrics.requests_total).toBe(100)
    expect(metrics.latency_ms_avg).toBe(42)
  })

  it('GatewayConnectionState covers all known states', () => {
    const states: GatewayConnectionState[] = [
      'connected',
      'degraded',
      'disconnected',
      'reconnecting',
    ]
    expect(states).toHaveLength(4)
  })

  it('GatewayReconnectState covers all known states', () => {
    const states: GatewayReconnectState[] = [
      'idle',
      'probing',
      'backoff',
      'retrying',
      'recovered',
      'failed',
    ]
    expect(states).toHaveLength(6)
  })

  it('GatewayHealth accepts full service payload', () => {
    const health: GatewayHealth = {
      status: 'ok',
      version: '1.0.0',
      services: {
        memory: 'ok',
        graph: 'ok',
        search: 'degraded',
      },
      engine_health: {
        memory: { status: 'ok' },
        graph: { status: 'error', error: 'connection refused' },
      },
      agents: ['writer', 'critic'],
      skills_count: 12,
    }
    expect(health.services.search).toBe('degraded')
    expect(health.agents).toEqual(['writer', 'critic'])
    expect(health.engine_health?.graph?.error).toBe('connection refused')
  })

  it('GatewayHealth accepts minimal payload', () => {
    const health: GatewayHealth = {
      status: 'degraded',
      version: '0.9.0',
      services: {},
    }
    expect(health.status).toBe('degraded')
    expect(health.agents).toBeUndefined()
  })

  it('GatewayHealth accepts mcp_runtime with reconnect fields', () => {
    const runtime: GatewayRuntime = {
      session_id: 'session-123',
      connection_state: 'reconnecting',
      reconnect_state: 'backoff',
      reconnect_attempts: 3,
      last_error: 'search service unavailable',
      last_probe_at: '2026-04-21T10:00:00Z',
    }
    const health: GatewayHealth = {
      status: 'degraded',
      version: '2.0.0',
      services: {},
      mcp_runtime: runtime,
    }
    expect(health.mcp_runtime?.connection_state).toBe('reconnecting')
    expect(health.mcp_runtime?.reconnect_attempts).toBe(3)
    expect(health.mcp_runtime?.last_error).toBe('search service unavailable')
  })

  it('GatewayRuntimeServerState holds per-server state', () => {
    const serverState: GatewayRuntime['servers'] = {
      memory: { state: 'connected', loading: false },
      search: { state: 'disconnected', loading: false, last_error: 'timeout' },
    }
    expect(serverState.memory.state).toBe('connected')
    expect(serverState.search.last_error).toBe('timeout')
  })

  it('GatewayServiceConfig has all required fields', () => {
    const config: GatewayServiceConfig = {
      id: 'search',
      name: 'Search Service',
      path: '/search',
      enabled: true,
      builtin: false,
      transport: 'stdio',
      health_url: null,
      status: 'ok',
    }
    expect(config.id).toBe('search')
    expect(config.builtin).toBe(false)
  })

  it('GatewayServiceConfigInput allows partial fields', () => {
    const input: GatewayServiceConfigInput = {
      name: 'New Service',
    }
    expect(input.name).toBe('New Service')
    expect(input.id).toBeUndefined()
  })

  it('GatewayServiceProbeResult contains service status', () => {
    const probe: GatewayServiceProbeResult = {
      service: {
        id: 'memory',
        status: 'ok',
        enabled: true,
        checked_at: '2026-04-21T10:00:00Z',
      },
    }
    expect(probe.service.id).toBe('memory')
    expect(probe.service.checked_at).toBe('2026-04-21T10:00:00Z')
  })
})

describe('WritingHelperRequest types', () => {
  const validModes: WritingHelperMode[] = [
    'polish',
    'summarize',
    'outline',
    'rewrite',
    'expand',
  ]

  it('covers all writing helper modes', () => {
    expect(validModes).toHaveLength(5)
  })

  it('WritingHelperRequest accepts content-only payload', () => {
    const request: WritingHelperRequest = { content: 'hello' }
    expect(request.content).toBe('hello')
    expect(request.mode).toBeUndefined()
  })

  it('WritingHelperRequest accepts full payload', () => {
    const request: WritingHelperRequest = {
      content: 'hello world',
      mode: 'outline',
      max_items: 10,
      instruction: 'make it concise',
      detection_evasion_guard_enabled: true,
      model: 'gpt-4o',
      provider: 'openai',
    }
    expect(request.mode).toBe('outline')
    expect(request.max_items).toBe(10)
  })

  it('WritingHelperResponse can represent processed text', () => {
    const response: WritingHelperResponse = {
      mode: 'polish',
      processed_text: 'polished text here',
    }
    expect(response.processed_text).toBe('polished text here')
  })

  it('WritingHelperResponse can represent outline mode', () => {
    const response: WritingHelperResponse = {
      mode: 'outline',
      outline: ['Point 1', 'Point 2', 'Point 3'],
      stats: { word_count: 42 },
    }
    expect(response.outline).toHaveLength(3)
    expect(response.stats?.word_count).toBe(42)
  })
})

describe('StreamWritingHelperRequest', () => {
  it('accepts content with optional streaming fields', () => {
    const request: import('./contracts').StreamWritingHelperRequest = {
      content: 'stream this',
      mode: 'rewrite',
      instruction: 'make shorter',
    }
    expect(request.content).toBe('stream this')
  })
})

describe('GatewayRuntimeView', () => {
  it('has all required view fields with defaults', () => {
    const view: GatewayRuntimeView = {
      connectionState: 'connected',
      reconnectState: 'idle',
      sessionId: 'session-abc',
      reconnectAttempts: 0,
      lastError: null,
      lastProbeAt: '2026-04-21T10:00:00Z',
      servers: {},
    }
    expect(view.connectionState).toBe('connected')
    expect(view.sessionId).toBe('session-abc')
    expect(view.lastError).toBeNull()
  })
})
