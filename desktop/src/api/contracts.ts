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
  skill_ids?: string[]
  workspace?: ProjectWorkspaceContext
  detection_evasion_guard_enabled?: boolean
  /** @deprecated Use X-LLM-API-Key header instead. Kept for backward compatibility. */
  api_key?: string
  /** @deprecated Use X-LLM-Base-Url header instead. Kept for backward compatibility. */
  base_url?: string
  model?: string
  provider?: string
}

export interface WritingHelperResponse {
  mode: WritingHelperMode
  processed_text?: string
  outline?: string[]
  skills_used?: string[]
  stats?: Record<string, number>
}

export interface StreamWritingHelperRequest {
  content: string
  mode?: string
  instruction?: string
  skill_ids?: string[]
  workspace?: ProjectWorkspaceContext
  model?: string
  provider?: string
  /** @deprecated Use X-LLM-API-Key header instead. Kept for backward compatibility. */
  api_key?: string
  /** @deprecated Use X-LLM-Base-Url header instead. Kept for backward compatibility. */
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

export type GatewayFailureClass =
  | 'runtime_unavailable'
  | 'packaged_prerequisite_missing'
  | 'embedding_authority_unavailable'
  | 'parser_missing'
  | 'integration_degraded'

export interface GatewayRuntimeDiagnosticPrerequisite {
  kind?: 'runtime' | 'package' | 'embedding' | 'parser' | 'integration'
  dependency?: string | null
  service?: string | null
  detail?: string | null
  action?: string | null
  install_command?: string | null
}

export interface GatewayRuntimeDiagnostic {
  failure_class?: GatewayFailureClass
  summary?: string | null
  detail?: string | null
  action?: string | null
  affected_services?: string[]
  prerequisite?: GatewayRuntimeDiagnosticPrerequisite | null
}

export interface GatewayRuntimeServerState {
  state: GatewayConnectionState
  loading: boolean
  last_error?: string | null
  lastError?: string | null
  enabled?: boolean
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
  diagnostic?: GatewayRuntimeDiagnostic | null
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
  diagnostic: GatewayRuntimeDiagnostic | null
  servers: Record<string, GatewayRuntimeServerState>
}

export interface GatewayHealthErrorResponse {
  error: string
  status?: string
  mcp_runtime?: GatewayRuntime
  diagnostic?: GatewayRuntimeDiagnostic | null
}

export interface GatewayApiErrorData {
  error?: string
  diagnostic?: GatewayRuntimeDiagnostic | null
  mcp_runtime?: GatewayRuntime
  status?: string
}

export interface FailurePresentationDiagnostic {
  failureClass?: GatewayFailureClass | null
  summary?: string | null
  detail?: string | null
  action?: string | null
  prerequisite?: GatewayRuntimeDiagnosticPrerequisite | null
}

export interface FailurePresentationErrorData {
  diagnostic?: FailurePresentationDiagnostic | null
  mcp_runtime?: {
    diagnostic?: FailurePresentationDiagnostic | null
    last_error?: string | null
  } | null
  error_code?: string
  detail?: string | null
  action?: string | null
  dependency?: string | null
  parser?: string | null
  service?: string | null
}

export interface FailurePresentationInput {
  message?: string | null
  diagnostics?: FailurePresentationDiagnostic | null
  errorData?: FailurePresentationErrorData | null
}

export interface FailurePresentationResult {
  message: string
  detail: string | null
  diagnostic: FailurePresentationDiagnostic | null
}

export interface RuntimeDiagnosticPresentation {
  label: string
  message: string
  detail: string | null
  action: string | null
  tone: 'danger' | 'warning' | 'info'
  failureClass: GatewayFailureClass | null
}

export interface RuntimeDiagnosticSummary {
  title: string
  detail: string | null
  action: string | null
  tone: 'danger' | 'warning' | 'info'
  failureClass: GatewayFailureClass | null
}

export interface RuntimeFailureMatrixEntry {
  title: string
  summary: string
  tone: 'danger' | 'warning' | 'info'
}

export type RuntimeFailureMatrix = Record<GatewayFailureClass, RuntimeFailureMatrixEntry>

export interface RuntimeFailureTranslations {
  runtimeUnavailableLabel: string
  runtimeUnavailableMessage: string
  packagedPrerequisiteMissingLabel: string
  packagedPrerequisiteMissingMessage: string
  embeddingAuthorityUnavailableLabel: string
  embeddingAuthorityUnavailableMessage: string
  parserMissingLabel: string
  parserMissingMessage: string
  integrationDegradedLabel: string
  integrationDegradedMessage: string
}

export interface RuntimePresentationTranslations extends RuntimeFailureTranslations {
  mcpFetchFailed: string
}

export interface RuntimeDiagnosticTranslations extends RuntimeFailureTranslations {
  mcpNotAvailable: string
}

export interface GatewayHealth {
  status: string
  version: string
  services: Record<string, string>
  engine_health?: Record<string, { status: string; error?: string }>
  agents?: string[]
  skills_count?: number
  diagnostic?: GatewayRuntimeDiagnostic | null
  mcp_runtime?: GatewayRuntime
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

