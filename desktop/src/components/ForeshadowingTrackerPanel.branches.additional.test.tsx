import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ForeshadowingTrackerPanel } from './ForeshadowingTrackerPanel'

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const { mockConfig, useI18nMock, resetMockConfig } = vi.hoisted(() => {
  const config = {
    // useState call index — must be reset before each render
    useStateCallIdx: 0,
    // Override initial values per useState call index:
    // 0=items, 1=stats, 2=loading, 3=error, 4=stateFilter
    initialValues: null as Array<unknown> | null,
    // When true, setters are no-ops (state never updates after initial render)
    freezeState: false,
    // When true, setItems (idx 0 setter) throws on non-empty arrays
    throwOnSetItems: false,
  }

  const resetMockConfig = () => {
    config.useStateCallIdx = 0
    config.initialValues = null
    config.freezeState = false
    config.throwOnSetItems = false
  }

  const i18nT = {
    foreshadowTitle: '伏笔追踪',
    foreshadowSummary: '概览',
    foreshadowTotal: '总计',
    foreshadowPlanted: '已埋设',
    foreshadowHinted: '已暗示',
    foreshadowHarvested: '已回收',
    foreshadowHints: '线索',
    foreshadowImportance: '重要度',
    foreshadowNoData: '暂无伏笔数据 — 在故事中埋设伏笔后这里会自动显示。',
    intelligenceLoading: '加载中…',
    intelligenceError: '加载失败，请稍后重试。',
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
  AccordionWrapper: ({ items }: { items: Array<{ id: string; content: ReactNode }> }) => (
    <div data-testid="accordion">{items.map(i => <div key={i.id}>{i.id}</div>)}</div>
  ),
  IntelligenceBadge: ({ variant, children }: { variant: string; children: ReactNode }) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
  MetricValue: ({ value, label }: { value: unknown; label: string }) => (
    <div>{`${label}:${String(value)}`}</div>
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
      // idx 0 = setItems — throw if configured
      if (idx === 0 && mockConfig.throwOnSetItems) {
        const nextValue = typeof action === 'function' ? action(value) : action
        if (Array.isArray(nextValue) && nextValue.length > 0) {
          throw new Error('setItems failed')
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

describe('ForeshadowingTrackerPanel — branch coverage', () => {
  beforeEach(() => {
    resetMockConfig()
  })

  // Line 65: catch block — setError(t.intelligenceError)
  it('shows error message when fetchData catches an exception', async () => {
    // When setItems throws on the example data, the catch block runs
    // and calls setError(t.intelligenceError)
    mockConfig.throwOnSetItems = true

    render(<ForeshadowingTrackerPanel onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByText('加载失败，请稍后重试。')).toBeInTheDocument()
    })
  })

  // Line 180: no-data message when filteredItems.length === 0
  it('shows no-data message when no items match the filter', async () => {
    // useState call order: 0=items, 1=stats, 2=loading, 3=error, 4=stateFilter
    // Set items to empty, loading to false, error to null, stateFilter to 'all'
    // so the component renders the empty-data branch
    mockConfig.initialValues = [[], null, false, null, 'all']
    mockConfig.freezeState = true

    render(<ForeshadowingTrackerPanel onClose={vi.fn()} />)

    expect(screen.getByText('暂无伏笔数据 — 在故事中埋设伏笔后这里会自动显示。')).toBeInTheDocument()
  })
})
