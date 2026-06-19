import type { ReactNode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { SessionCluster } from '../api/analysis'

const translationStub = {
  sessionTitle: '会话分析',
  intelligenceClose: '关闭',
  sessionSummary: '会话摘要',
  sessionTotalSessions: '总会话数',
  sessionAvgDuration: '平均时长',
  sessionTotalWords: '总字数',
  sessionClusters: '会话簇',
  intelligenceLoading: '加载中',
  intelligenceError: '加载失败',
  sessionNoData: '暂无会话数据',
}

function createCluster(overrides: Partial<SessionCluster> = {}): SessionCluster {
  return {
    id: 'cluster-1',
    name: 'Cluster One',
    description: 'Cluster description',
    intent: 'intent',
    status: 'active',
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-02T14:00:00Z',
    members: [
      {
        clusterId: 'cluster-1',
        sessionId: 'session-1',
        sessionType: 'chapter',
        relevanceScore: 0.88,
        addedAt: '2026-01-01T00:00:00Z',
      },
    ],
    ...overrides,
  }
}

async function loadSessionAnalyticsPanel(options?: {
  clusters?: SessionCluster[]
  loading?: boolean
  error?: string | null
  disableEffect?: boolean
  clusterSetter?: ReturnType<typeof vi.fn>
  loadingSetter?: ReturnType<typeof vi.fn>
  errorSetter?: ReturnType<typeof vi.fn>
}) {
  const {
    clusters = [],
    loading = false,
    error = null,
    disableEffect = true,
    clusterSetter = vi.fn(),
    loadingSetter = vi.fn(),
    errorSetter = vi.fn(),
  } = options ?? {}

  vi.resetModules()

  vi.doMock('../i18n', () => ({
    useI18n: () => ({
      t: translationStub,
    }),
  }))

  vi.doMock('./intelligence', () => ({
    MetricValue: ({ value, label }: { value: unknown; label: string }) => <div>{`${label}:${String(value)}`}</div>,
    SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
    IntelligenceBadge: ({
      variant,
      children,
    }: {
      variant: string
      children: ReactNode
    }) => (
      <span data-testid={`badge-${String(children)}`} data-variant={variant}>
        {children}
      </span>
    ),
  }))

  vi.doMock('react', async () => {
    const actual = await vi.importActual<typeof import('react')>('react')
    let hookCalls = 0

    return {
      ...actual,
      useEffect: (disableEffect
        ? ((() => undefined) as typeof actual.useEffect)
        : actual.useEffect),
      useState: ((initial: unknown) => {
        hookCalls += 1
        if (hookCalls === 1) {
          return [clusters, clusterSetter] as const
        }
        if (hookCalls === 2) {
          return [loading, loadingSetter] as const
        }
        if (hookCalls === 3) {
          return [error, errorSetter] as const
        }
        return actual.useState(initial as never)
      }) as typeof actual.useState,
    }
  })

  const module = await import('./SessionAnalyticsPanel')

  vi.doUnmock('react')
  vi.doUnmock('../i18n')
  vi.doUnmock('./intelligence')

  return module.SessionAnalyticsPanel
}

describe('SessionAnalyticsPanel additional coverage', () => {
  afterEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    vi.doUnmock('react')
    vi.doUnmock('../i18n')
    vi.doUnmock('./intelligence')
  })

  it('renders the empty state after loading finishes without clusters', async () => {
    const SessionAnalyticsPanel = await loadSessionAnalyticsPanel({
      clusters: [],
      loading: false,
      error: null,
    })

    render(<SessionAnalyticsPanel onClose={vi.fn()} />)

    expect(screen.getByText('暂无会话数据')).toBeInTheDocument()
  })

  it('renders warning badges for non-active clusters', async () => {
    const SessionAnalyticsPanel = await loadSessionAnalyticsPanel({
      clusters: [createCluster({ id: 'cluster-warning', name: 'Paused Cluster', status: 'paused' })],
      loading: false,
      error: null,
    })

    render(<SessionAnalyticsPanel onClose={vi.fn()} />)

    expect(screen.getByText('Paused Cluster')).toBeInTheDocument()
    expect(screen.getByTestId('badge-paused')).toHaveAttribute('data-variant', 'warning')
  })

  it('renders the translated error state when loading fails', async () => {
    const SessionAnalyticsPanel = await loadSessionAnalyticsPanel({
      clusters: [],
      loading: false,
      error: '加载失败',
    })

    render(<SessionAnalyticsPanel onClose={vi.fn()} />)

    expect(screen.getByText('加载失败')).toBeInTheDocument()
  })

  it('handles fetch failures by reporting the translated error', async () => {
    const clusterSetter = vi.fn(() => {
      throw new Error('cluster update failed')
    })
    const loadingSetter = vi.fn()
    const errorSetter = vi.fn()
    const SessionAnalyticsPanel = await loadSessionAnalyticsPanel({
      clusters: [],
      loading: true,
      error: null,
      disableEffect: false,
      clusterSetter,
      loadingSetter,
      errorSetter,
    })

    render(<SessionAnalyticsPanel onClose={vi.fn()} />)

    await waitFor(() => expect(clusterSetter).toHaveBeenCalledOnce())
    await waitFor(() => expect(errorSetter).toHaveBeenCalledWith('加载失败'))
    expect(loadingSetter).toHaveBeenCalledWith(true)
    expect(loadingSetter).toHaveBeenCalledWith(false)
  })
})
