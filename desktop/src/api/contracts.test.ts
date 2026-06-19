import './contracts'
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
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'Search integration degraded',
      },
    }
    const health: GatewayHealth = {
      status: 'degraded',
      version: '2.0.0',
      services: {},
      diagnostic: {
        failure_class: 'integration_degraded',
        summary: 'Search integration degraded',
      },
      mcp_runtime: runtime,
    }
    expect(health.mcp_runtime?.connection_state).toBe('reconnecting')
    expect(health.mcp_runtime?.reconnect_attempts).toBe(3)
    expect(health.mcp_runtime?.last_error).toBe('search service unavailable')
    expect(health.mcp_runtime?.diagnostic?.failure_class).toBe('integration_degraded')
  })

  it('GatewayHealthErrorResponse accepts structured runtime diagnostics', () => {
    const payload: import('./contracts').GatewayHealthErrorResponse = {
      error: 'gateway offline',
      status: 'error',
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: 'Gateway offline',
      },
      mcp_runtime: {
        connection_state: 'disconnected',
        reconnect_state: 'failed',
        last_error: 'gateway offline',
        diagnostic: {
          failure_class: 'runtime_unavailable',
          summary: 'Gateway offline',
          action: 'Start gateway',
        },
      },
    }
    expect(payload.mcp_runtime?.diagnostic?.failure_class).toBe('runtime_unavailable')
    expect(payload.diagnostic?.summary).toBe('Gateway offline')
  })

  it('FailurePresentationInput accepts parser prerequisite metadata', () => {
    const input: import('./contracts').FailurePresentationInput = {
      message: 'upload failed',
      errorData: {
        error_code: 'PARSER_PREREQUISITE_MISSING',
        detail: 'mammoth is required',
        action: 'Install mammoth',
        dependency: 'mammoth',
      },
    }
    expect(input.errorData?.dependency).toBe('mammoth')
  })

  it('RuntimeDiagnosticPresentation captures failure-class messaging', () => {
    const presentation: import('./contracts').RuntimeDiagnosticPresentation = {
      label: 'Runtime unavailable',
      message: 'Start gateway',
      detail: 'gateway offline',
      action: 'Start gateway',
      tone: 'danger',
      failureClass: 'runtime_unavailable',
    }
    expect(presentation.failureClass).toBe('runtime_unavailable')
    expect(presentation.tone).toBe('danger')
  })

  it('RuntimeFailureTranslations covers diagnostic copy', () => {
    const translations: import('./contracts').RuntimeFailureTranslations = {
      runtimeUnavailableLabel: 'Runtime unavailable',
      runtimeUnavailableMessage: 'Start gateway',
      packagedPrerequisiteMissingLabel: 'Missing prerequisite',
      packagedPrerequisiteMissingMessage: 'Install dependency',
      embeddingAuthorityUnavailableLabel: 'Embedding unavailable',
      embeddingAuthorityUnavailableMessage: 'Restore provider',
      parserMissingLabel: 'Parser missing',
      parserMissingMessage: 'Install parser',
      integrationDegradedLabel: 'Integration degraded',
      integrationDegradedMessage: 'Repair service',
    }
    expect(translations.parserMissingLabel).toBe('Parser missing')
  })

  it('GatewayRuntimeServerState supports both last_error and lastError forms', () => {
    const serverState: GatewayRuntime['servers'] = {
      search: { state: 'disconnected', loading: false, last_error: 'timeout', lastError: 'timeout', enabled: true },
    }
    expect(serverState.search.last_error).toBe('timeout')
    expect(serverState.search.lastError).toBe('timeout')
  })

  it('GatewayFailureClass covers all runtime diagnostic states', () => {
    const failureClasses: import('./contracts').GatewayFailureClass[] = [
      'runtime_unavailable',
      'packaged_prerequisite_missing',
      'embedding_authority_unavailable',
      'parser_missing',
      'integration_degraded',
    ]
    expect(failureClasses).toHaveLength(5)
  })

  it('GatewayRuntimeDiagnosticPrerequisite accepts install metadata', () => {
    const prerequisite: import('./contracts').GatewayRuntimeDiagnosticPrerequisite = {
      kind: 'parser',
      dependency: 'mammoth',
      install_command: 'npm install mammoth',
    }
    expect(prerequisite.install_command).toBe('npm install mammoth')
  })

  it('GatewayApiErrorData can carry health diagnostics', () => {
    const errorData: import('./contracts').GatewayApiErrorData = {
      error: 'gateway offline',
      diagnostic: {
        failure_class: 'runtime_unavailable',
        summary: 'Gateway offline',
      },
    }
    expect(errorData.diagnostic?.failure_class).toBe('runtime_unavailable')
  })

  it('FailurePresentationResult preserves diagnostic detail', () => {
    const result: import('./contracts').FailurePresentationResult = {
      message: 'Install parser',
      detail: 'mammoth missing',
      diagnostic: {
        failureClass: 'parser_missing',
        detail: 'mammoth missing',
      },
    }
    expect(result.diagnostic?.failureClass).toBe('parser_missing')
  })

  it('RuntimeDiagnosticSummary stores actionable runtime guidance', () => {
    const summary: import('./contracts').RuntimeDiagnosticSummary = {
      title: 'Runtime unavailable',
      detail: 'gateway offline',
      action: 'Start gateway',
      tone: 'danger',
      failureClass: 'runtime_unavailable',
    }
    expect(summary.action).toBe('Start gateway')
  })

  it('RuntimeFailureMatrix maps all failure classes', () => {
    const matrix: import('./contracts').RuntimeFailureMatrix = {
      runtime_unavailable: { title: 'Runtime unavailable', summary: 'Start gateway', tone: 'danger' },
      packaged_prerequisite_missing: { title: 'Missing prerequisite', summary: 'Install dependency', tone: 'danger' },
      embedding_authority_unavailable: { title: 'Embedding unavailable', summary: 'Restore provider', tone: 'warning' },
      parser_missing: { title: 'Parser missing', summary: 'Install parser', tone: 'warning' },
      integration_degraded: { title: 'Integration degraded', summary: 'Repair service', tone: 'warning' },
    }
    expect(Object.keys(matrix)).toHaveLength(5)
  })

  it('RuntimePresentationTranslations extends runtime copy with generic fetch fallback', () => {
    const translations: import('./contracts').RuntimePresentationTranslations = {
      runtimeUnavailableLabel: 'Runtime unavailable',
      runtimeUnavailableMessage: 'Start gateway',
      packagedPrerequisiteMissingLabel: 'Missing prerequisite',
      packagedPrerequisiteMissingMessage: 'Install dependency',
      embeddingAuthorityUnavailableLabel: 'Embedding unavailable',
      embeddingAuthorityUnavailableMessage: 'Restore provider',
      parserMissingLabel: 'Parser missing',
      parserMissingMessage: 'Install parser',
      integrationDegradedLabel: 'Integration degraded',
      integrationDegradedMessage: 'Repair service',
      mcpFetchFailed: 'Fetch failed',
    }
    expect(translations.mcpFetchFailed).toBe('Fetch failed')
  })

  it('RuntimeDiagnosticTranslations extends runtime copy with availability fallback', () => {
    const translations: import('./contracts').RuntimeDiagnosticTranslations = {
      runtimeUnavailableLabel: 'Runtime unavailable',
      runtimeUnavailableMessage: 'Start gateway',
      packagedPrerequisiteMissingLabel: 'Missing prerequisite',
      packagedPrerequisiteMissingMessage: 'Install dependency',
      embeddingAuthorityUnavailableLabel: 'Embedding unavailable',
      embeddingAuthorityUnavailableMessage: 'Restore provider',
      parserMissingLabel: 'Parser missing',
      parserMissingMessage: 'Install parser',
      integrationDegradedLabel: 'Integration degraded',
      integrationDegradedMessage: 'Repair service',
      mcpNotAvailable: 'N/A',
    }
    expect(translations.mcpNotAvailable).toBe('N/A')
  })

  it('FailurePresentationDiagnostic accepts snake_case and camelCase compatible payloads', () => {
    const diagnostic: import('./contracts').FailurePresentationDiagnostic = {
      failureClass: 'integration_degraded',
      summary: 'Search degraded',
      detail: 'search timeout',
      action: 'Retry search',
      prerequisite: {
        kind: 'integration',
        service: 'search',
      },
    }
    expect(diagnostic.prerequisite?.service).toBe('search')
  })

  it('FailurePresentationErrorData can carry runtime and parser fields together', () => {
    const errorData: import('./contracts').FailurePresentationErrorData = {
      error_code: 'PARSER_PREREQUISITE_MISSING',
      dependency: 'mammoth',
      mcp_runtime: {
        last_error: 'gateway offline',
      },
    }
    expect(errorData.error_code).toBe('PARSER_PREREQUISITE_MISSING')
    expect(errorData.mcp_runtime?.last_error).toBe('gateway offline')
  })

  it('GatewayHealth accepts top-level diagnostic without runtime payload', () => {
    const health: GatewayHealth = {
      status: 'degraded',
      version: '2.0.0',
      services: {},
      diagnostic: {
        failure_class: 'packaged_prerequisite_missing',
        summary: 'Python missing',
      },
    }
    expect(health.diagnostic?.failure_class).toBe('packaged_prerequisite_missing')
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
      diagnostic: null,
      servers: {},
    }
    expect(view.connectionState).toBe('connected')
    expect(view.sessionId).toBe('session-abc')
    expect(view.lastError).toBeNull()
  })
})
