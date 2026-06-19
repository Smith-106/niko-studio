/**
 * Contract verification tests for plugins.ts (CF-007, CF-008)
 * PluginResult type completely different from backend shape
 * registerPlugin expects { id, status } but backend returns { id, name }
 */
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())

vi.mock('../core', () => ({
  callApi: callApiMock,
}))

import { listPlugins, executePlugin, registerPlugin } from '../plugins'
import type { PluginInfo, PluginResult, PluginManifest } from '../plugins'

describe('CF-007: executePlugin PluginResult type mismatch', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('executePlugin: frontend PluginResult { success, output, error } vs backend { pluginId, pluginName, score, ... }', async () => {
    // Actual backend response from plugin-engine
    const backendRawBody = {
      results: [
        {
          pluginId: 'plugin-1',
          pluginName: 'Narrative Guard',
          score: 85,
          maxScore: 100,
          evidence: 'consistent pacing throughout',
          suggestions: ['consider varying sentence rhythm'],
          details: { chapterScores: [80, 85, 90] },
        },
      ],
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await executePlugin('plugin-1', 'draft text')

    expect(result.success).toBe(true)
    const actualResult = (result.data as Record<string, unknown>).results[0] as Record<string, unknown>

    // CF-007 CRITICAL MISMATCH: Frontend PluginResult = { success, output, error? }
    // Backend actual shape = { pluginId, pluginName, score, maxScore, evidence, suggestions, details }
    // None of the expected frontend fields exist in the actual response:
    expect(actualResult.success).toBeUndefined()
    expect(actualResult.output).toBeUndefined()
    expect(actualResult.error).toBeUndefined()
    // All the actual fields are missing from the frontend type:
    expect(actualResult.pluginId).toBe('plugin-1')
    expect(actualResult.score).toBe(85)
    expect(actualResult.evidence).toBe('consistent pacing throughout')
  })
})

describe('CF-008: registerPlugin response shape mismatch', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('registerPlugin: frontend expects { id, status } but backend returns { id, name }', async () => {
    const manifest: PluginManifest = {
      id: 'plugin-1',
      name: 'Narrative Guard',
      version: '1.0.0',
      description: 'Checks pacing',
      dimension: 'pacing',
      rules: [{ keyword: 'pacing', score: 0.9, evidence: 'slow section', suggestion: 'tighten' }],
    }

    // Actual backend response from pluginRegisterEndpoint
    const backendRawBody = { id: 'plugin-1', name: 'Narrative Guard' }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await registerPlugin(manifest)

    // CF-008 MISMATCH: Frontend type = { id: string; status: string }
    // Backend returns { id: string; name: string }
    expect((result.data as Record<string, unknown>).id).toBe('plugin-1')
    expect((result.data as Record<string, unknown>).status).toBeUndefined()
    expect((result.data as Record<string, unknown>).name).toBe('Narrative Guard')
  })
})

describe('W-017: listPlugins PluginInfo.enabled never populated', () => {
  beforeEach(() => {
    callApiMock.mockReset()
  })

  it('listPlugins: backend omits enabled field but frontend type includes it', async () => {
    // Backend only returns { id, name, version, description, dimension }
    const backendRawBody = {
      plugins: [
        { id: 'plugin-1', name: 'Narrative Guard', version: '1.0.0', description: 'Checks pacing', dimension: 'pacing' },
      ],
    }
    callApiMock.mockResolvedValue({ success: true, data: backendRawBody })

    const result = await listPlugins()

    const plugin = (result.data as Record<string, unknown>).plugins[0] as Record<string, unknown>
    expect(plugin.id).toBe('plugin-1')
    // W-017: 'enabled' is in PluginInfo type but never returned by backend
    expect(plugin.enabled).toBeUndefined()
  })
})
