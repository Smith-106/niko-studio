import { act, renderHook, waitFor } from '@testing-library/react'
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

describe('useSettingsProviderModels', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('filters providers, toggles API key visibility, and groups deduplicated models', () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider({
      fetchedModels: ['gpt-4.1', 'gpt-4o'],
      customModels: ['custom-model', 'gpt-4.1'],
    })
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

    expect(result.current.filteredProviders).toHaveLength(2)

    act(() => {
      result.current.setProviderSearch('claude')
    })
    expect(result.current.filteredProviders.map((item) => item.id)).toEqual(['anthropic'])

    act(() => {
      result.current.toggleShowApiKey('openai')
    })
    expect(result.current.showApiKeys.openai).toBe(true)

    act(() => {
      result.current.toggleShowApiKey('openai')
    })
    expect(result.current.showApiKeys.openai).toBe(false)

    expect(result.current.getModelGroups(provider)).toEqual([
      { label: 'Preset', models: ['gpt-4o', 'gpt-4o-mini'] },
      { label: 'Fetched', models: ['gpt-4.1', 'gpt-4o'] },
      { label: 'Custom', models: ['custom-model', 'gpt-4.1'] },
    ])
  })

  it('refreshes provider models and coerces the default model onto an available entry', async () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider({
      defaultModel: 'missing-model',
    })

    fetchProviderModelsMock.mockResolvedValue({
      success: true,
      data: {
        models: ['gpt-4.1', 'gpt-4o'],
      },
    })

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

    expect(fetchProviderModelsMock).toHaveBeenCalledWith('openai', 'https://api.openai.com', 'sk-test')
    expect(onProviderChange).toHaveBeenCalledWith('openai', expect.objectContaining({
      fetchedModels: ['gpt-4.1', 'gpt-4o'],
      defaultModel: 'gpt-4o',
      modelSelectionMode: 'list',
      lastModelSyncAt: expect.any(String),
    }))
    expect(result.current.modelSyncLoading.openai).toBe(false)
    expect(result.current.modelSyncError.openai).toBeNull()
  })

  it('records fetch errors, thrown errors, invalid custom models, and successful custom model updates', async () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider({
      customModels: ['custom-model'],
    })

    fetchProviderModelsMock
      .mockResolvedValueOnce({ success: false, error: '403 forbidden' })
      .mockRejectedValueOnce(new Error('network down'))

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
    expect(result.current.modelSyncError.openai).toBe('failed: 403 forbidden')

    await act(async () => {
      await result.current.refreshProviderModels(provider)
    })
    expect(result.current.modelSyncError.openai).toBe('failed')

    act(() => {
      result.current.setCustomModelInputs({ openai: 'bad model' })
    })
    act(() => {
      result.current.applyCustomModel(provider)
    })
    expect(result.current.modelSyncError.openai).toBe('whitespace')
    expect(onProviderChange).not.toHaveBeenCalled()

    act(() => {
      result.current.setCustomModelInputs({ openai: 'custom-model' })
    })
    act(() => {
      result.current.applyCustomModel(provider)
    })
    expect(onProviderChange).toHaveBeenCalledWith('openai', {
      customModels: ['custom-model'],
      defaultModel: 'custom-model',
      modelSelectionMode: 'custom',
    })
    expect(result.current.customModelInputs.openai).toBe('')
    expect(result.current.modelSyncError.openai).toBeNull()
  })

  it('validates default models via gateway and direct sources, and reports unavailable/failure states', async () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider({
      defaultModel: 'gpt-4.1',
    })

    fetchProviderModelsMock
      .mockResolvedValueOnce({ success: true, data: { models: ['gpt-4.1'], source: 'gateway' } })
      .mockResolvedValueOnce({ success: true, data: { models: ['gpt-4.1'], source: 'direct' } })
      .mockResolvedValueOnce({ success: true, data: { models: ['other-model'], source: 'gateway' } })
      .mockResolvedValueOnce({ success: false, data: { models: [] } })
      .mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() =>
      useSettingsProviderModels({
        llmProviders: [provider],
        onProviderChange,
        texts,
      }),
    )

    await act(async () => {
      await result.current.validateProviderDefaultModel(provider)
    })
    expect(result.current.modelValidateMessage.openai).toEqual({
      type: 'success',
      text: 'available via gateway',
    })

    await act(async () => {
      await result.current.validateProviderDefaultModel(provider)
    })
    expect(result.current.modelValidateMessage.openai).toEqual({
      type: 'success',
      text: 'available via direct',
    })

    await act(async () => {
      await result.current.validateProviderDefaultModel(provider)
    })
    expect(result.current.modelValidateMessage.openai).toEqual({
      type: 'error',
      text: 'default unavailable',
    })

    await act(async () => {
      await result.current.validateProviderDefaultModel(provider)
    })
    expect(result.current.modelValidateMessage.openai).toEqual({
      type: 'error',
      text: 'validate fetch failed',
    })

    await act(async () => {
      await result.current.validateProviderDefaultModel(provider)
    })
    expect(result.current.modelValidateMessage.openai).toEqual({
      type: 'error',
      text: 'validate failed',
    })
    expect(result.current.modelValidateLoading.openai).toBe(false)
  })

  it('tests provider connectivity and maps healthy, unhealthy, and thrown checks', async () => {
    const onProviderChange = vi.fn()
    const provider = buildProvider()

    checkBackendHealthMock
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockRejectedValueOnce(new Error('boom'))

    const { result } = renderHook(() =>
      useSettingsProviderModels({
        llmProviders: [provider],
        onProviderChange,
        texts,
      }),
    )

    await act(async () => {
      await result.current.testConnection(provider)
    })
    expect(result.current.testResults.openai).toBe('success')
    expect(result.current.testingProvider).toBeNull()

    await act(async () => {
      await result.current.testConnection(provider)
    })
    expect(result.current.testResults.openai).toBe('error')

    await act(async () => {
      await result.current.testConnection(provider)
    })
    expect(result.current.testResults.openai).toBe('error')
    expect(checkBackendHealthMock).toHaveBeenCalledTimes(3)
  })
})
