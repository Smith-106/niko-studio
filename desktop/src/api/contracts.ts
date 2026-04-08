import type { ProjectWorkspaceContext } from '@/types/workspace'

export interface GatewayMetrics {
  requests_total: number
  requests_failed_total: number
  requests_success_total: number
  latency_ms_avg: number
  latency_ms_max: number
}

export type WritingHelperMode =
  | 'polish'
  | 'summarize'
  | 'outline'
  | 'rewrite'
  | 'expand'

export interface WritingHelperRequest {
  content: string
  mode?: WritingHelperMode
  max_sentences?: number
  max_items?: number
  instruction?: string
  workspace?: ProjectWorkspaceContext
  detection_evasion_guard_enabled?: boolean
  api_key?: string
  base_url?: string
  model?: string
  provider?: string
}

export interface WritingHelperResponse {
  mode: WritingHelperMode
  processed_text?: string
  outline?: string[]
  stats?: Record<string, number>
}

export interface StreamWritingHelperRequest {
  content: string
  mode?: string
  instruction?: string
  workspace?: ProjectWorkspaceContext
  model?: string
  provider?: string
  api_key?: string
  base_url?: string
}

export type GatewayConnectionState =
  | 'connected'
  | 'degraded'
  | 'disconnected'
  | 'reconnecting'

export type GatewayReconnectState =
  | 'idle'
  | 'probing'
  | 'backoff'
  | 'retrying'
  | 'recovered'
  | 'failed'

export interface GatewayRuntimeServerState {
  state: GatewayConnectionState
  loading: boolean
  last_error?: string | null
}

export interface GatewayServiceConfig {
  id: string
  name: string
  path: string
  enabled: boolean
  builtin: boolean
  transport: string
  health_url?: string | null
  status?: string
}

export interface GatewayRuntime {
  session_id?: string
  connection_state?: GatewayConnectionState
  reconnect_state?: GatewayReconnectState
  last_probe_at?: string
  reconnect_attempts?: number
  last_error?: string | null
  servers?: Record<string, GatewayRuntimeServerState>
  service_configs?: GatewayServiceConfig[]
}

export interface GatewayRuntimeView {
  connectionState: GatewayConnectionState
  reconnectState: GatewayReconnectState
  sessionId: string | null
  reconnectAttempts: number
  lastError: string | null
  lastProbeAt: string | null
  servers: Record<string, GatewayRuntimeServerState>
}

export interface GatewayServiceConfigInput {
  id?: string
  service_id?: string
  name?: string
  path?: string
  enabled?: boolean
  transport?: string
  health_url?: string | null
}

export interface GatewayServiceProbeResult {
  service: {
    id: string
    status: string
    enabled: boolean
    checked_at: string
  }
}

export interface GatewayHealth {
  status: string
  version: string
  services: Record<string, string>
  engine_health?: Record<string, { status: string; error?: string }>
  agents?: string[]
  skills_count?: number
  mcp_runtime?: GatewayRuntime
}
