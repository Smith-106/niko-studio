import type {
  GatewayServiceConfig,
  GatewayServiceConfigInput,
  GatewayServiceProbeResult,
} from '../contracts'

import { type ApiResponse, callApi } from '../core'

export async function listGatewayServiceConfigs(): Promise<ApiResponse<{ services: GatewayServiceConfig[] }>> {
  return callApi('/admin/mcp/services', 'GET')
}

export async function createGatewayServiceConfig(
  payload: GatewayServiceConfigInput,
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi('/admin/mcp/services', 'POST', payload as Record<string, unknown>)
}

export async function updateGatewayServiceConfig(
  serviceId: string,
  payload: GatewayServiceConfigInput,
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi(`/admin/mcp/services/${encodeURIComponent(serviceId)}`, 'PUT', payload as Record<string, unknown>)
}

export async function setGatewayServiceEnabled(
  serviceId: string,
  enabled: boolean,
): Promise<ApiResponse<{ service: GatewayServiceConfig }>> {
  return callApi(`/admin/mcp/services/${encodeURIComponent(serviceId)}/enabled`, 'POST', { enabled })
}

export async function probeGatewayServiceHealth(
  serviceId: string,
): Promise<ApiResponse<GatewayServiceProbeResult>> {
  return callApi(`/admin/mcp/services/${encodeURIComponent(serviceId)}/probe`, 'POST')
}

export async function deleteGatewayServiceConfig(
  serviceId: string,
): Promise<ApiResponse<{ success: boolean }>> {
  return callApi(`/admin/mcp/services/${encodeURIComponent(serviceId)}`, 'DELETE')
}
