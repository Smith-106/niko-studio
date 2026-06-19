import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tauriEventMocks = vi.hoisted(() => ({
  listen: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: tauriEventMocks.listen,
}))

vi.mock('../i18n', async () => {
  const actual = await vi.importActual<typeof import('../i18n')>('../i18n')

  return {
    ...actual,
    useI18n: () => ({
      t: actual.translations.en,
      translate: (key: keyof typeof actual.translations.en) => actual.translations.en[key],
      language: 'en',
    }),
  }
})

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client')

  return {
    ...actual,
    checkBackendHealth: vi.fn(),
    getGatewayHealth: vi.fn(),
    getGatewayMetrics: vi.fn(),
    listGatewayTools: vi.fn(),
    listGatewayServiceConfigs: vi.fn(),
    createGatewayServiceConfig: vi.fn(),
    probeGatewayServiceHealth: vi.fn(),
    setGatewayServiceEnabled: vi.fn(),
    updateGatewayServiceConfig: vi.fn(),
    restartGatewayBackend: vi.fn(),
  }
})

import {
  checkBackendHealth,
  createGatewayServiceConfig,
  getGatewayHealth,
  getGatewayMetrics,
  listGatewayServiceConfigs,
  listGatewayTools,
  probeGatewayServiceHealth,
  restartGatewayBackend,
  setGatewayServiceEnabled,
  updateGatewayServiceConfig,
  type GatewayServiceConfig,
} from '../api/client'
import { McpStatusPanel } from './McpStatusPanel'

const mockedCheckBackendHealth = vi.mocked(checkBackendHealth)
const mockedCreateGatewayServiceConfig = vi.mocked(createGatewayServiceConfig)
const mockedGetGatewayHealth = vi.mocked(getGatewayHealth)
const mockedGetGatewayMetrics = vi.mocked(getGatewayMetrics)
const mockedListGatewayServiceConfigs = vi.mocked(listGatewayServiceConfigs)
const mockedListGatewayTools = vi.mocked(listGatewayTools)
const mockedProbeGatewayServiceHealth = vi.mocked(probeGatewayServiceHealth)
const mockedRestartGatewayBackend = vi.mocked(restartGatewayBackend)
const mockedSetGatewayServiceEnabled = vi.mocked(setGatewayServiceEnabled)
const mockedUpdateGatewayServiceConfig = vi.mocked(updateGatewayServiceConfig)
const scrollIntoViewMock = vi.fn()

const autoHealButtonName = '\u4e00\u952e\u6df1\u5ea6\u81ea\u6108\u4e0e\u91cd\u542f'
const autoHealSuccessSummaryPattern = /\u7f51\u5173\u91cd\u542f\u53ca\u5065\u5eb7\u81ea\u68c0\u5747\u5df2\u6210\u529f/
const clearTerminalTitle = '\u6e05\u7a7a\u7ec8\u7aef'
const terminalEmptyPattern = /\u63a7\u5236\u53f0\u9759\u9ed8\u4e2d/
const runtimeHealthLogPattern = /\u7f51\u5173\u5df2\u5728\u540e\u53f0\u6210\u529f\u91cd\u65b0\u62c9\u8d77/
const autoHealStopSummaryPattern = /\u81ea\u6108\u4e2d\u65ad\uff1arestart denied/
const autoHealStopLogPattern = /\u81ea\u6108\u7ec8\u6b62\uff1arestart denied/
const autoHealFatalSummaryPattern = /\u81ea\u6108\u8bca\u65ad\u5931\u8d25\uff1aError: fatal/
const autoHealFatalLogPattern = /\u81f4\u547d\u8fd0\u884c\u65f6\u5f02\u5e38\uff1aError: fatal/

type GatewayHealthResponse = Awaited<ReturnType<typeof getGatewayHealth>>
type GatewayMetricsResponse = Awaited<ReturnType<typeof getGatewayMetrics>>
type GatewayToolsResponse = Awaited<ReturnType<typeof listGatewayTools>>
type GatewayServiceConfigsResponse = Awaited<ReturnType<typeof listGatewayServiceConfigs>>

function buildServiceConfig(overrides: Partial<GatewayServiceConfig> = {}): GatewayServiceConfig {
  return {
    id: 'search-service',
    name: 'Search Service',
    path: '/search',
    enabled: true,
    builtin: false,
    transport: 'http',
    health_url: 'http://127.0.0.1:4000/health',
    status: 'ok',
    ...overrides,
  }
}

function setupBaseMocks(services: GatewayServiceConfig[] = []) {
  mockedCheckBackendHealth.mockResolvedValue(true)
  mockedGetGatewayHealth.mockResolvedValue({
    success: true,
    data: {
      status: 'healthy',
      version: '1.0.0',
      services: {
        memory: 'ok',
        search: 'ok',
        workflow: 'ok',
      },
      mcp_runtime: {
        session_id: 'gw-session-123',
        connection_state: 'connected',
        reconnect_state: 'idle',
        reconnect_attempts: 0,
        last_error: null,
        diagnostic: null,
        servers: {},
      },
    },
  })
  mockedGetGatewayMetrics.mockResolvedValue({
    success: true,
    data: {
      status: 'ok',
      metrics: {
        requests_total: 12,
        requests_failed_total: 1,
        requests_success_total: 11,
        latency_ms_avg: 120,
        latency_ms_max: 200,
      },
    },
  })
  mockedListGatewayTools.mockResolvedValue({
    success: true,
    data: {
      memory: ['recall', 'store'],
      search: ['query'],
    },
  })
  mockedListGatewayServiceConfigs.mockResolvedValue({
    success: true,
    data: {
      services,
    },
  })
  mockedCreateGatewayServiceConfig.mockResolvedValue({
    success: true,
    data: {
      service: buildServiceConfig({ id: 'search2', name: 'search2', path: '/search2' }),
    },
  })
  mockedUpdateGatewayServiceConfig.mockResolvedValue({
    success: true,
    data: {
      service: buildServiceConfig({ name: 'Search Service v2' }),
    },
  })
  mockedSetGatewayServiceEnabled.mockResolvedValue({
    success: true,
    data: {
      service: buildServiceConfig({ enabled: false }),
    },
  })
  mockedProbeGatewayServiceHealth.mockResolvedValue({
    success: true,
    data: {
      service: {
        id: 'search-service',
        status: 'ok',
        enabled: true,
        checked_at: '2026-06-03T00:00:00Z',
      },
    },
  })
  mockedRestartGatewayBackend.mockResolvedValue({
    success: true,
    data: 'http://127.0.0.1:4312',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
  tauriEventMocks.listen.mockResolvedValue(vi.fn())
  setupBaseMocks()
})

async function waitForPanelReady() {
  await waitFor(() => {
    expect(mockedListGatewayServiceConfigs).toHaveBeenCalled()
  })
}

describe('McpStatusPanel additional coverage', () => {
  it('listens to gateway logs, scrolls terminal, and closes on Escape', async () => {
    let logListener: ((event: { payload: string }) => void) | null = null
    const unlisten = vi.fn()
    const onClose = vi.fn()

    tauriEventMocks.listen.mockImplementation(async (_eventName, handler) => {
      logListener = handler as (event: { payload: string }) => void
      return unlisten
    })

    const { unmount } = render(<McpStatusPanel onClose={onClose} />)
    await waitForPanelReady()

    await waitFor(() => {
      expect(tauriEventMocks.listen).toHaveBeenCalledWith('gateway-log', expect.any(Function))
    })

    await act(async () => {
      logListener?.({ payload: 'gateway booted successfully' })
    })

    expect(screen.getByText('gateway booted successfully')).toBeInTheDocument()
    expect(scrollIntoViewMock).toHaveBeenCalled()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(unlisten).toHaveBeenCalledTimes(1)
  })

  it('runs auto-heal successfully, uses the default base label, and clears terminal logs', async () => {
    const user = userEvent.setup()

    mockedRestartGatewayBackend.mockResolvedValueOnce({
      success: true,
      data: '',
    })

    render(<McpStatusPanel onClose={() => {}} />)
    await waitForPanelReady()

    await user.click(screen.getByRole('button', { name: autoHealButtonName }))

    await waitFor(() => {
      expect(mockedRestartGatewayBackend).toHaveBeenCalledTimes(1)
    })

    expect(screen.getByText(autoHealSuccessSummaryPattern)).toBeInTheDocument()
    expect(screen.getByText(runtimeHealthLogPattern)).toBeInTheDocument()
    expect(screen.getByText(/default/)).toBeInTheDocument()
    expect(mockedGetGatewayHealth).toHaveBeenCalledTimes(2)

    await user.click(screen.getByTitle(clearTerminalTitle))

    expect(screen.getByText(terminalEmptyPattern)).toBeInTheDocument()
  })

  it('creates services and performs rename, toggle, and probe actions', async () => {
    const user = userEvent.setup()

    setupBaseMocks([buildServiceConfig()])
    render(<McpStatusPanel onClose={() => {}} />)
    await waitForPanelReady()

    await user.click(screen.getByRole('button', { name: 'Add service' }))
    expect(screen.getByText('Please provide a service ID first')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Service ID'), ' Search2 ')
    await user.click(screen.getByRole('button', { name: 'Add service' }))

    await waitFor(() => {
      expect(mockedCreateGatewayServiceConfig).toHaveBeenCalledWith({
        id: 'search2',
        name: 'search2',
        path: '/search2',
        enabled: true,
      })
    })

    expect(screen.getByLabelText('Service ID')).toHaveValue('')
    expect(screen.getAllByLabelText('Service name (optional)')[0]).toHaveValue('')
    expect(screen.getByLabelText('Path (optional)')).toHaveValue('')

    const nameInput = screen.getByDisplayValue('Search Service')
    await user.clear(nameInput)
    await user.type(nameInput, 'Search Service v2')
    await user.click(screen.getByRole('button', { name: 'Save name' }))

    await waitFor(() => {
      expect(mockedUpdateGatewayServiceConfig).toHaveBeenCalledWith('search-service', {
        name: 'Search Service v2',
        enabled: true,
      })
    })

    await user.click(screen.getByRole('button', { name: 'Disable' }))
    await waitFor(() => {
      expect(mockedSetGatewayServiceEnabled).toHaveBeenCalledWith('search-service', false)
    })

    await user.click(screen.getByRole('button', { name: 'Health check' }))
    await waitFor(() => {
      expect(mockedProbeGatewayServiceHealth).toHaveBeenCalledWith('search-service')
    })
  })

  it('renders degraded fallback runtime state and empty sections when partial refresh data is missing', async () => {
    mockedCheckBackendHealth.mockRejectedValueOnce(new Error('health rejected'))
    mockedGetGatewayHealth.mockResolvedValueOnce({
      success: false,
      error: 'gateway unavailable',
      errorData: {
        mcp_runtime: {
          session_id: null,
          connection_state: 'stalled',
          reconnect_state: 'cooldown',
          reconnect_attempts: 7,
          last_error: 'runtime offline',
          diagnostic: {
            failure_class: 'runtime_unavailable',
            detail: 'runtime offline',
            action: 'Restart gateway',
          },
          servers: {},
        },
      },
    } as GatewayHealthResponse)
    mockedGetGatewayMetrics.mockResolvedValueOnce({
      success: false,
    } as GatewayMetricsResponse)
    mockedListGatewayTools.mockResolvedValueOnce({
      success: false,
    } as GatewayToolsResponse)
    mockedListGatewayServiceConfigs.mockResolvedValueOnce({
      success: false,
    } as GatewayServiceConfigsResponse)

    render(<McpStatusPanel onClose={() => {}} />)

    expect(await screen.findByText('Some status data failed to load. Information below may be incomplete.')).toBeInTheDocument()
    expect(screen.getAllByText('Runtime unavailable').length).toBeGreaterThan(0)
    expect(screen.getAllByText('runtime offline').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Restart gateway').length).toBeGreaterThan(0)
    expect(screen.getByText('stalled')).toHaveClass('text-gray-600')
    expect(screen.getByText('cooldown')).toBeInTheDocument()
    expect(screen.getByText('#7')).toBeInTheDocument()
    expect(screen.getByText('N/A')).toBeInTheDocument()
    expect(screen.getByText('No metrics data')).toBeInTheDocument()
    expect(screen.getByText('No tool data')).toBeInTheDocument()
    expect(screen.getByText('No service config data')).toBeInTheDocument()
  })

  it('uses generic action fallbacks, covers no-op rename, and preserves builtin toggle affordances', async () => {
    const user = userEvent.setup()

    setupBaseMocks([
      buildServiceConfig(),
      buildServiceConfig({
        id: 'builtin-service',
        name: 'Built-in Service',
        enabled: false,
        builtin: true,
        status: 'stalled',
        path: '/builtin',
      }),
    ])
    mockedCreateGatewayServiceConfig.mockResolvedValueOnce({
      success: false,
    } as Awaited<ReturnType<typeof createGatewayServiceConfig>>)
    mockedUpdateGatewayServiceConfig.mockResolvedValueOnce({
      success: false,
    } as Awaited<ReturnType<typeof updateGatewayServiceConfig>>)
    mockedSetGatewayServiceEnabled.mockResolvedValueOnce({
      success: false,
    } as Awaited<ReturnType<typeof setGatewayServiceEnabled>>)
    mockedProbeGatewayServiceHealth.mockResolvedValueOnce({
      success: false,
    } as Awaited<ReturnType<typeof probeGatewayServiceHealth>>)

    render(<McpStatusPanel onClose={() => {}} />)
    await waitForPanelReady()

    await user.type(screen.getByLabelText('Service ID'), ' new-service ')
    await user.type(screen.getAllByLabelText('Service name (optional)')[0], ' New Service ')
    await user.type(screen.getByLabelText('Path (optional)'), ' /custom ')
    await user.click(screen.getByRole('button', { name: 'Add service' }))

    expect(await screen.findByText('Create failed')).toBeInTheDocument()
    expect(mockedCreateGatewayServiceConfig).toHaveBeenCalledWith({
      id: 'new-service',
      name: 'New Service',
      path: '/custom',
      enabled: true,
    })

    await user.click(screen.getAllByRole('button', { name: 'Save name' })[0])
    expect(mockedUpdateGatewayServiceConfig).not.toHaveBeenCalled()

    const firstServiceNameInput = screen.getByDisplayValue('Search Service')
    await user.clear(firstServiceNameInput)
    await user.type(firstServiceNameInput, 'Search Service v3')
    await user.click(screen.getAllByRole('button', { name: 'Save name' })[0])

    await waitFor(() => {
      expect(mockedUpdateGatewayServiceConfig).toHaveBeenCalledWith('search-service', {
        name: 'Search Service v3',
        enabled: true,
      })
    })
    expect(await screen.findByText('Update failed')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Disable' }))
    await waitFor(() => {
      expect(mockedSetGatewayServiceEnabled).toHaveBeenCalledWith('search-service', false)
    })
    expect(await screen.findByText('Update failed')).toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Health check' })[0])

    expect(await screen.findByText('Probe failed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Enable' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Enable' })).toHaveAttribute(
      'title',
      'Built-in services cannot be disabled',
    )
    expect(screen.getByText('stalled')).toBeInTheDocument()
  })

  it('shows action errors, auto-heal failures, and tauri listen warnings', async () => {
    const user = userEvent.setup()
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    setupBaseMocks([buildServiceConfig()])
    mockedProbeGatewayServiceHealth.mockResolvedValueOnce({
      success: false,
      error: 'probe down',
    })
    mockedRestartGatewayBackend.mockResolvedValueOnce({
      success: false,
      error: 'restart denied',
    })
    mockedRestartGatewayBackend.mockRejectedValueOnce(new Error('fatal'))
    tauriEventMocks.listen.mockRejectedValueOnce(new Error('not tauri'))

    render(<McpStatusPanel onClose={() => {}} />)
    await waitForPanelReady()

    await waitFor(() => {
      expect(warnSpy).toHaveBeenCalled()
    })

    await user.click(screen.getByRole('button', { name: 'Health check' }))
    await waitFor(() => {
      expect(
        screen.queryByText('probe down') ?? screen.queryByText('Probe failed'),
      ).toBeTruthy()
    })

    await user.click(screen.getByRole('button', { name: autoHealButtonName }))
    expect(await screen.findByText(autoHealStopSummaryPattern)).toBeInTheDocument()
    expect(screen.getByText(autoHealStopLogPattern)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: autoHealButtonName }))
    expect(await screen.findByText(autoHealFatalSummaryPattern)).toBeInTheDocument()
    expect(screen.getByText(autoHealFatalLogPattern)).toBeInTheDocument()

    warnSpy.mockRestore()
  })

  it('shows the hard refresh failure state when status loading throws synchronously', async () => {
    mockedCheckBackendHealth.mockImplementationOnce(() => {
      throw new Error('sync boom')
    })

    render(<McpStatusPanel onClose={() => {}} />)

    expect((await screen.findAllByText('Failed to load status. Please try again later.')).length).toBeGreaterThan(0)
    expect(screen.getByText('No metrics data')).toBeInTheDocument()
    expect(screen.getByText('No tool data')).toBeInTheDocument()
    expect(screen.getByText('No service config data')).toBeInTheDocument()
  })

  it('covers the gateway health rejected branch (lines 164-167)', async () => {
    mockedCheckBackendHealth.mockResolvedValueOnce(true)
    mockedGetGatewayHealth.mockRejectedValueOnce(new Error('gateway health rejected'))
    mockedGetGatewayMetrics.mockResolvedValueOnce({
      success: true,
      data: {
        status: 'ok',
        metrics: {
          requests_total: 1,
          requests_failed_total: 0,
          requests_success_total: 1,
          latency_ms_avg: 50,
          latency_ms_max: 50,
        },
      },
    } as GatewayMetricsResponse)
    mockedListGatewayTools.mockResolvedValueOnce({
      success: true,
      data: { memory: ['recall'] },
    } as GatewayToolsResponse)
    mockedListGatewayServiceConfigs.mockResolvedValueOnce({
      success: true,
      data: { services: [] },
    } as GatewayServiceConfigsResponse)

    render(<McpStatusPanel onClose={() => {}} />)
    await waitForPanelReady()

    expect(await screen.findByText('Some status data failed to load. Information below may be incomplete.')).toBeInTheDocument()
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50 ms').length).toBeGreaterThan(0)
  })
})
