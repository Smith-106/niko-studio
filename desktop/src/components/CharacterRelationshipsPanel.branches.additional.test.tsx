import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { CharacterRelationshipsPanel } from './CharacterRelationshipsPanel'

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const { mockConfig, useI18nMock, resetMockConfig } = vi.hoisted(() => {
  const config = {
    // useState call index — must be reset before each render
    useStateCallIdx: 0,
    // Override initial values per useState call index:
    // 0 = network, 1 = loading, 2 = error, 3 = typeFilter
    initialValues: null as Array<unknown> | null,
    // When true, setters are no-ops (state never updates after initial render)
    freezeState: false,
    // When true, setNetwork (idx 0 setter) throws on non-null values
    throwOnSetNetwork: false,
  }

  const resetMockConfig = () => {
    config.useStateCallIdx = 0
    config.initialValues = null
    config.freezeState = false
    config.throwOnSetNetwork = false
  }

  const i18nT = {
    charRelTitle: '角色关系',
    charRelNoData: '暂无角色关系 — 添加角色后这里会自动显示。',
    intelligenceLoading: '加载中…',
    intelligenceError: '加载失败',
    intelligenceClose: '关闭',
    intelligenceAll: '全部',
  }

  const useI18nMock = () => ({
    t: i18nT,
    translate: (k: string) => k,
    language: 'zh' as const,
  })

  return { mockConfig: config, useI18nMock, resetMockConfig }
})

// ---------------------------------------------------------------------------
// Mock: useI18n
// ---------------------------------------------------------------------------

vi.mock('../i18n', () => ({
  useI18n: useI18nMock,
}))

// ---------------------------------------------------------------------------
// Mock: intelligence sub-components
// ---------------------------------------------------------------------------

vi.mock('./intelligence', () => ({
  IntelligenceBadge: ({ variant, children }: { variant: string; children: ReactNode }) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
  ProgressBar: ({ value }: { value: number }) => <div data-testid="progress-bar">{value}</div>,
}))

// ---------------------------------------------------------------------------
// Mock: react — wrap useState to control initial values and setter behavior
// ---------------------------------------------------------------------------

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')

  const wrappedUseState = function (initialState: unknown): [unknown, React.Dispatch<React.SetStateAction<unknown>>] {
    const idx = mockConfig.useStateCallIdx++

    const effectiveInitial = mockConfig.initialValues?.[idx] ?? initialState

    const [value, setValue] = (actual.useState as typeof wrappedUseState)(effectiveInitial)

    if (mockConfig.freezeState) {
      return [value, () => {}]
    }

    const wrappedSetValue = (action: unknown) => {
      // idx 0 = setNetwork — throw if configured
      if (idx === 0 && mockConfig.throwOnSetNetwork) {
        const nextValue = typeof action === 'function' ? action(value) : action
        if (nextValue !== null && nextValue !== undefined) {
          throw new Error('setNetwork failed')
        }
      }
      setValue(action)
    }

    return [value, wrappedSetValue]
  }

  return {
    ...actual,
    useState: wrappedUseState,
    useEffect: actual.useEffect,
    useMemo: actual.useMemo,
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CharacterRelationshipsPanel — branch coverage', () => {
  beforeEach(() => {
    resetMockConfig()
  })

  it('shows error message when fetchData catches an exception (line 35)', async () => {
    // When setNetwork throws on the example data, the catch block runs
    // and calls setError(t.intelligenceError)
    mockConfig.throwOnSetNetwork = true

    render(<CharacterRelationshipsPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument()
    })
  })

  it('shows no-data message when network is null without error (line 124)', async () => {
    // Freeze state so that loading stays true initially,
    // then we need a different approach: set network initial to null,
    // loading initial to false, error initial to null.
    // useState call order: 0=network, 1=loading, 2=error, 3=typeFilter
    mockConfig.initialValues = [null, false, null, 'all']
    mockConfig.freezeState = true

    render(<CharacterRelationshipsPanel onClose={vi.fn()} />)

    // With loading=false, error=null, network=null → line 124 renders
    expect(screen.getByText('暂无角色关系 — 添加角色后这里会自动显示。')).toBeInTheDocument()
  })
})
