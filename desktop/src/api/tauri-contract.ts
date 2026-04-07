export const TAURI_GATEWAY_COMMANDS = {
  getGatewayBase: 'get_gateway_base',
  setGatewayBaseOverride: 'set_gateway_base_override',
  startBackend: 'start_backend',
  checkBackendHealth: 'check_backend_health',
  callApi: 'call_api',
} as const

export type GatewayRequestMethod = 'GET' | 'POST' | 'PUT'

export interface TauriGatewayApiRequest extends Record<string, unknown> {
  endpoint: string
  method: GatewayRequestMethod
  body: string | null
}
