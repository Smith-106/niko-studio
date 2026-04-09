import { GENERIC_API_ERROR_MESSAGE, type ApiResponse, callApi, getErrorName, normalizeGatewayBaseUrl } from '../core'

export interface ModelFetchResult {
  models: string[]
  source: 'gateway' | 'direct'
}

function deduplicateModels(models: string[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const model of models) {
    const normalized = model.trim()
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(normalized)
  }

  return result
}

function normalizeModelName(model: string): string {
  if (model.startsWith('models/')) {
    return model.slice('models/'.length)
  }
  return model
}

function extractModelsFromPayload(payload: unknown): string[] {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    const parsed = payload
      .map((item) => {
        if (typeof item === 'string') return item
        if (!item || typeof item !== 'object') return ''
        const record = item as Record<string, unknown>
        if (typeof record.id === 'string') return record.id
        if (typeof record.name === 'string') return normalizeModelName(record.name)
        if (typeof record.model === 'string') return record.model
        return ''
      })
      .filter(Boolean)

    return deduplicateModels(parsed)
  }

  if (typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const candidateKeys = ['models', 'data', 'items', 'result']

    for (const key of candidateKeys) {
      if (record[key] !== undefined) {
        const models = extractModelsFromPayload(record[key])
        if (models.length > 0) {
          return models
        }
      }
    }
  }

  return []
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`)
  }
  return response.json()
}

function buildModelFetchError(gatewayReason: string, directReason: string): string {
  return `gateway=${gatewayReason}; direct=${directReason}`
}

export async function fetchProviderModels(
  providerId: string,
  baseUrl: string,
  apiKey: string,
): Promise<ApiResponse<ModelFetchResult>> {
  let gatewayReason = 'request_failed'

  try {
    const gatewayRes = await callApi<unknown>(`/models?provider=${encodeURIComponent(providerId)}`, 'GET')
    if (gatewayRes.success && gatewayRes.data) {
      const gatewayModels = extractModelsFromPayload(gatewayRes.data)
      if (gatewayModels.length > 0) {
        return { success: true, data: { models: gatewayModels, source: 'gateway' } }
      }
      gatewayReason = 'empty_models'
    } else {
      gatewayReason = (gatewayRes.error ?? '').trim() || 'request_failed'
    }
  } catch (error) {
    gatewayReason = getErrorName(error)
    console.error(`Gateway models fallback failed (${gatewayReason})`)
  }

  const normalizedBase = normalizeGatewayBaseUrl(baseUrl.trim())
  const trimmedApiKey = apiKey.trim()
  let payload: unknown

  try {
    switch (providerId) {
      case 'local': {
        payload = await requestJson(`${normalizedBase}/api/tags`)
        break
      }
      case 'google': {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        payload = await requestJson(`${normalizedBase}/v1beta/models?key=${encodeURIComponent(trimmedApiKey)}`)
        break
      }
      case 'anthropic': {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        payload = await requestJson(`${normalizedBase}/v1/models`, {
          headers: {
            'x-api-key': trimmedApiKey,
            'anthropic-version': '2023-06-01',
          },
        })
        break
      }
      case 'openai':
      case 'openrouter':
      default: {
        if (!trimmedApiKey) {
          return { success: false, error: buildModelFetchError(gatewayReason, 'api_key_required') }
        }
        const openaiBaseUrl = normalizedBase.includes('/v1') ? normalizedBase : `${normalizedBase}/v1`
        payload = await requestJson(`${openaiBaseUrl}/models`, {
          headers: {
            Authorization: `Bearer ${trimmedApiKey}`,
          },
        })
        break
      }
    }

    const models = extractModelsFromPayload(payload)
    if (models.length === 0) {
      return {
        success: false,
        error: buildModelFetchError(gatewayReason, 'empty_models'),
      }
    }

    return { success: true, data: { models, source: 'direct' } }
  } catch (error) {
    const directReason = error instanceof Error ? error.message : GENERIC_API_ERROR_MESSAGE
    console.error(`Fetch provider models failed (${getErrorName(error)})`)
    return {
      success: false,
      error: buildModelFetchError(gatewayReason, directReason),
    }
  }
}
