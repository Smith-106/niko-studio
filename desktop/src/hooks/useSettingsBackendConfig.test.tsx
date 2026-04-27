import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('../api/config', () => ({
  getSecrets: vi.fn().mockResolvedValue({ success: true, data: { secrets: {} } }),
}))

vi.mock('../stores/settingsStore', () => ({
  useSettingsStore: () => ({
    settings: {
      backendConfig: {
        config: null,
        syncStatus: 'idle',
        modifiableFields: [],
      },
    },
    loadBackendConfig: vi.fn(),
    updateBackendConfig: vi.fn(),
    updateSecrets: vi.fn(),
    reloadBackendConfig: vi.fn(),
  }),
}))

import {
  formatBackendFieldValue,
  MASKED_SECRET_VALUE,
  useSettingsBackendConfig,
} from './useSettingsBackendConfig'

describe('formatBackendFieldValue', () => {
  it('joins arrays with ", "', () => {
    expect(formatBackendFieldValue(['a', 'b', 'c'])).toBe('a, b, c')
  })

  it('returns empty string for empty arrays', () => {
    expect(formatBackendFieldValue([])).toBe('')
  })

  it('returns empty string for null', () => {
    expect(formatBackendFieldValue(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(formatBackendFieldValue(undefined)).toBe('')
  })

  it('converts numbers to strings', () => {
    expect(formatBackendFieldValue(42)).toBe('42')
  })

  it('converts booleans to strings', () => {
    expect(formatBackendFieldValue(true)).toBe('true')
    expect(formatBackendFieldValue(false)).toBe('false')
  })

  it('passes strings through unchanged', () => {
    expect(formatBackendFieldValue('hello')).toBe('hello')
  })

  it('converts objects via String()', () => {
    expect(formatBackendFieldValue({ key: 'val' })).toBe('[object Object]')
  })
})

describe('MASKED_SECRET_VALUE', () => {
  it('equals "***MASKED***"', () => {
    expect(MASKED_SECRET_VALUE).toBe('***MASKED***')
  })
})

describe('useSettingsBackendConfig', () => {
  it('renders without error (smoke test)', () => {
    const { result } = renderHook(() =>
      useSettingsBackendConfig({
        isOpen: false,
        isActive: false,
        settingsUnknownError: 'Unknown error',
      }),
    )

    expect(result.current).toBeDefined()
    expect(result.current.backendConfigDraft).toBeNull()
    expect(result.current.backendSecrets).toEqual({})
    expect(result.current.backendSecretsDraft).toEqual({})
    expect(result.current.backendConfigSaving).toBe(false)
    expect(result.current.backendSecretsSaving).toBe(false)
  })
})
