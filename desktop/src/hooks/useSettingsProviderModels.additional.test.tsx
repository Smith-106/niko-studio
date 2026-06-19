import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fetchProviderModelsMock = vi.hoisted(() => vi.fn())
const checkBackendHealthMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  fetchProviderModels: fetchProviderModelsMock,
  checkBackendHealth: checkBackendHealthMock,
}))

import type { LLMProvider } from '../stores/settingsStore'
import { useSettingsProviderModels } from './useSettingsProviderModels'

const texts = {
  settingsModelNameRequired: 'required',
  settingsModelNameTooLong: 'too long',
  settingsModelNameWhitespace: 'whitespace',
  settingsInvalidCustomModel: 'invalid custom model',
  settingsFetchModelsFailedWithReason: 'failed: {error}',
  settingsFetchModelsFailed: 'failed',
  settingsPresetModels: 'Preset',
  settingsFetchedModels: 'Fetched',
  settingsCustomModels: 'Custom',
  settingsDefaultModelValidateFetchFailed: 'validate fetch failed',
  settingsDefaultModelAvailableViaGateway: 'available via gateway',
  settingsDefaultModelAvailableViaDirect: 'available via direct',
  settingsDefaultModelUnavailable: 'default unavailable',
  settingsDefaultModelValidateFailed: 'validate failed',
}

function buildProvider(overrides: Partial<LLMProvider> = {}): LLMProvider {
  return {
    id: 'openai',
    name: 'OpenAI',
    enabled: true,
    apiKey: 'sk-test',
    baseUrl: 'https://api.openai.com',
    models: ['gpt-4o', 'gpt-4o-mini'],
    defaultModel: 'gpt-4o',
    fetchedModels: [],
    customModels: [],
    modelSelectionMode: 'list',
    ...overrides,
  }
}

describe('useSettingsProviderModels additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('matches provider names before model lists and ignores updates for unknown providers', () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider()
    const otherProvider = buildProvider({
      id: 'anthropic',
      name: 'Anthropic',
      models: ['claude-3-5-sonnet'],
      defaultModel: 'claude-3-5-sonnet',
    })

    const { result } = renderHook(() =>
      useSettingsProviderModels({
        llmProviders: [provider, otherProvider],
        onProviderChange,
        texts,
      }),
    )

    act(() => {
      result.current.setProviderSearch('openai')
    })

    expect(result.current.filteredProviders.map((item) => item.id)).toEqual(['openai'])

    act(() => {
      result.current.updateLocalProvider('missing-provider', { defaultModel: 'noop' })
    })

    expect(onProviderChange).not.toHaveBeenCalled()
  })

  it('uses the generic refresh error when the backend omits a reason', async () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider()
    fetchProviderModelsMock.mockResolvedValue({ success: false })

    const { result } = renderHook(() =>
      useSettingsProviderModels({
        llmProviders: [provider],
        onProviderChange,
        texts,
      }),
    )

    await act(async () => {
      await result.current.refreshProviderModels(provider)
    })

    expect(result.current.modelSyncError.openai).toBe('failed')
    expect(result.current.modelSyncLoading.openai).toBe(false)
    expect(onProviderChange).not.toHaveBeenCalled()
  })

  it('validates empty and oversized custom model inputs and preserves updates when no models exist', () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider({
      models: [],
      fetchedModels: [],
      customModels: [],
      defaultModel: '',
    })

    const { result } = renderHook(() =>
      useSettingsProviderModels({
        llmProviders: [provider],
        onProviderChange,
        texts,
      }),
    )

    act(() => {
      result.current.applyCustomModel(provider)
    })
    expect(result.current.modelSyncError.openai).toBe('required')

    act(() => {
      result.current.setCustomModelInputs({ openai: 'x'.repeat(121) })
    })
    act(() => {
      result.current.applyCustomModel(provider)
    })
    expect(result.current.modelSyncError.openai).toBe('too long')

    act(() => {
      result.current.updateLocalProvider('openai', { enabled: false })
    })
    expect(onProviderChange).toHaveBeenLastCalledWith('openai', { enabled: false })
  })
})
