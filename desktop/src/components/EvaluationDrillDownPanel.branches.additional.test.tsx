import { type ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EvaluationDrillDownPanel } from './EvaluationDrillDownPanel'

// ---------------------------------------------------------------------------
// Hoisted mock state — shared between mock factories and test code
// ---------------------------------------------------------------------------

const { mockConfig, useI18nMock, resetMockConfig } = vi.hoisted(() => {
  const config = {
    // useState call index — must be reset before each render
    useStateCallIdx: 0,
    // When true, setEvaluationData (idx 0 setter) throws on object values
    throwOnSetEvaluationData: false,
    // Override initial values per useState call index
    // 0 = evaluationData, 1 = loading, 2 = error
    initialValues: null as Array<unknown> | null,
    // When true, setters are no-ops (state never updates after initial)
    freezeState: false,
  }

  const resetMockConfig = () => {
    config.useStateCallIdx = 0
    config.throwOnSetEvaluationData = false
    config.initialValues = null
    config.freezeState = false
  }

  // i18n mock
  const i18nT = {
    evalDrillTitle: '评估详情',
    evalDrillOverall: '综合评分',
    evalDrillDimensions: '维度评分',
    evalDrillDetailFor: '评估详情 —',
    evalDrillNoData: '暂无评估数据',
    intelligenceLoading: '加载中…',
    intelligenceError: '加载失败',
    intelligenceClose: '关闭',
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
  AccordionWrapper: ({
    items,
  }: {
    items: Array<{ id: string; header: ReactNode; content: ReactNode }>
  }) => (
    <div data-testid="accordion-wrapper">
      {items.map((item) => (
        <div key={item.id}>
          <div>{item.header}</div>
          <div>{item.content}</div>
        </div>
      ))}
    </div>
  ),
  IntelligenceBadge: ({ variant, children }: { variant: string; children: ReactNode }) => (
    <span data-testid={`badge-${variant}`}>{children}</span>
  ),
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
  ProgressBar: ({ value }: { value: number }) => <div data-testid="progress-bar">{value}</div>,
}))

// ---------------------------------------------------------------------------
// Mock: react — wrap useState with controllable behavior
// ---------------------------------------------------------------------------

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')

  const wrappedUseState = function (initialState: unknown): [unknown, React.Dispatch<React.SetStateAction<unknown>>] {
    const idx = mockConfig.useStateCallIdx++

    // Use overridden initial value if configured for this index
    const effectiveInitial = mockConfig.initialValues?.[idx] ?? initialState

    const [value, setValue] = (actual.useState as typeof wrappedUseState)(effectiveInitial)

    // Wrap the setter
    const wrappedSetter = (newValue: unknown) => {
      // Freeze mode: setters are no-ops — state stays at initial values
      if (mockConfig.freezeState) return

      // Trigger catch block: make setEvaluationData (idx=0) throw
      // when called with an object value (the hardcoded exampleData)
      if (mockConfig.throwOnSetEvaluationData && idx === 0 && typeof newValue === 'object' && newValue !== null) {
        throw new Error('simulated setEvaluationData failure')
      }

      setValue(newValue)
    }

    return [value, wrappedSetter]
  }

  return {
    ...actual,
    useState: wrappedUseState,
  }
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks()
  resetMockConfig()
})

describe('EvaluationDrillDownPanel branch coverage additional', () => {
  // -------------------------------------------------------------------------
  // Line 41: catch block — setError(t.intelligenceError)
  // -------------------------------------------------------------------------

  it('sets error message when fetchData catches an exception (line 41)', async () => {
    mockConfig.throwOnSetEvaluationData = true

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    // The catch block calls setError(t.intelligenceError) which renders "加载失败"
    await waitFor(() => {
      expect(screen.getByText('加载失败')).toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Line 101: no data message — loading=false, error=null, evaluationData=null
  // -------------------------------------------------------------------------

  it('shows no-data message when evaluationData is null and loading is false (line 101)', async () => {
    mockConfig.initialValues = [
      null,   // evaluationData = null
      false,  // loading = false
      null,   // error = null
    ]
    mockConfig.freezeState = true // prevent useEffect from overwriting evaluationData

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    // evaluationData=null, loading=false, error=null → line 101 renders no-data message
    expect(screen.getByText('暂无评估数据')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // IntelligenceBadge variant branches (line 55)
  // -------------------------------------------------------------------------

  it('renders warning badge variant for scores between 60 and 79', async () => {
    mockConfig.initialValues = [
      {
        decision: 'REVISE' as const,
        total_score: 65,
        lock_score: 65,
        style_score: 65,
        logic_score: 65,
        actionable_feedback: 'test',
        module_scores: { pacing: 65 },
        suggestions: [],
      },
      false,  // loading = false
      null,   // error = null
    ]
    mockConfig.freezeState = true

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    expect(screen.getByTestId('badge-warning')).toBeInTheDocument()
  })

  it('renders danger badge variant for scores below 60', async () => {
    mockConfig.initialValues = [
      {
        decision: 'REWRITE' as const,
        total_score: 40,
        lock_score: 40,
        style_score: 40,
        logic_score: 40,
        actionable_feedback: 'test',
        module_scores: { pacing: 40 },
        suggestions: [],
      },
      false,  // loading = false
      null,   // error = null
    ]
    mockConfig.freezeState = true

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    expect(screen.getByTestId('badge-danger')).toBeInTheDocument()
  })

  it('renders success badge variant for scores 80 and above', async () => {
    mockConfig.initialValues = [
      {
        decision: 'APPROVED' as const,
        total_score: 95,
        lock_score: 95,
        style_score: 95,
        logic_score: 95,
        actionable_feedback: 'test',
        module_scores: { pacing: 95 },
        suggestions: [],
      },
      false,  // loading = false
      null,   // error = null
    ]
    mockConfig.freezeState = true

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    expect(screen.getByTestId('badge-success')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Error display branch (line 96)
  // -------------------------------------------------------------------------

  it('shows error message when error state is set', async () => {
    mockConfig.initialValues = [
      null,                       // evaluationData = null
      false,                      // loading = false
      '自定义错误信息',            // error = string
    ]
    mockConfig.freezeState = true

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    expect(screen.getByText('自定义错误信息')).toBeInTheDocument()
  })

  // -------------------------------------------------------------------------
  // Loading state branch (line 95)
  // -------------------------------------------------------------------------

  it('shows loading message when loading is true and no error', async () => {
    mockConfig.initialValues = [
      null,   // evaluationData = null
      true,   // loading = true
      null,   // error = null
    ]
    mockConfig.freezeState = true

    const onClose = vi.fn()
    render(<EvaluationDrillDownPanel onClose={onClose} />)

    expect(screen.getByText('加载中…')).toBeInTheDocument()
  })
})
