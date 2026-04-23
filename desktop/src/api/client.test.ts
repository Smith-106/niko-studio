import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSettingsStore } from '@/stores/settingsStore'
import {
  applyRecommendation,
  agentWrite,
  batchApplyRecommendations,
  chat,
  chatStream,
  createGatewayServiceConfig,
  createCheckpoint,
  createPlan,
  deriveGatewayRuntimeState,
  evaluateContent,
  executePlan,
  fetchProviderModels,
  getResolvedApiBase,
  listGatewayServiceConfigs,
  mergeRecommendationBatchResults,
  novelQualityCheck,
  probeGatewayServiceHealth,
  processWritingHelper,
  polishContent,
  polishContentCompat,
  quickRollbackWorkflow,
  resolveWorkspaceContext,
  restoreCheckpoint,
  routeWorkflow,
  searchMemory,
  setGatewayServiceEnabled,
  updateGatewayServiceConfig,
  listCheckpoints,
  workflowLifecycle,
  workflowSchedulerRegister,
  workflowSchedulerList,
  workflowSchedulerPause,
  workflowSchedulerResume,
  workflowSchedulerRunNow,
  workflowSchedulerImportLitePlan,
  type AutomationTaskDefinition,
  type ChatRequest,
  type GatewayHealth,
  type ProjectWorkspaceContext,
} from './client'

function createSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
    },
  })
}

describe('gateway base resolution', () => {
  const env = import.meta.env as Record<string, string | undefined>
  let previousNikoGatewayUrl: string | undefined
  let previousViteGatewayUrl: string | undefined
  let previousApiBaseUrl: string

  beforeEach(() => {
    previousNikoGatewayUrl = env.NIKO_GATEWAY_URL
    previousViteGatewayUrl = env.VITE_NIKO_GATEWAY_URL
    previousApiBaseUrl = useSettingsStore.getState().settings.apiBaseUrl

    delete env.NIKO_GATEWAY_URL
    delete env.VITE_NIKO_GATEWAY_URL
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: '',
      },
    }))
  })

  afterEach(() => {
    if (previousNikoGatewayUrl === undefined) {
      delete env.NIKO_GATEWAY_URL
    } else {
      env.NIKO_GATEWAY_URL = previousNikoGatewayUrl
    }

    if (previousViteGatewayUrl === undefined) {
      delete env.VITE_NIKO_GATEWAY_URL
    } else {
      env.VITE_NIKO_GATEWAY_URL = previousViteGatewayUrl
    }

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: previousApiBaseUrl,
      },
    }))
  })

  it('prefers NIKO_GATEWAY_URL over settings and VITE fallback', () => {
    env.NIKO_GATEWAY_URL = 'http://env-niko.example.com/'
    env.VITE_NIKO_GATEWAY_URL = 'http://env-vite.example.com/'
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: 'http://settings.example.com/',
      },
    }))

    expect(getResolvedApiBase()).toBe('http://env-niko.example.com')
  })

  it('falls back to settings when gateway env vars are absent', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        apiBaseUrl: 'http://settings.example.com/',
      },
    }))

    expect(getResolvedApiBase()).toBe('http://settings.example.com')
  })

  it('falls back to default base when env and settings are empty', () => {
    expect(getResolvedApiBase()).toBe('http://127.0.0.1:8000')
  })
})

describe('fetchProviderModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns combined gateway/direct reason when gateway 404 and direct fails', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'provider_not_found' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'unauthorized' }),
      }))

    const result = await fetchProviderModels('openai', 'https://api.openai.com', 'sk-test')

    expect(result.success).toBe(false)
    expect(result.error).toBe('gateway=provider_not_found; direct=HTTP error: 401')
    consoleErrorSpy.mockRestore()
  })

  it('falls back to direct source when gateway returns empty models', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', provider: 'openai', models: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ id: 'gpt-4o' }] }),
      }))

    const result = await fetchProviderModels('openai', 'https://api.openai.com', 'sk-test')

    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      models: ['gpt-4o'],
      source: 'direct',
    })
  })

  it('returns explicit empty_models reasons when both gateway and direct have no models', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', provider: 'openai', models: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      }))

    const result = await fetchProviderModels('openai', 'https://api.openai.com', 'sk-test')

    expect(result.success).toBe(false)
    expect(result.error).toBe('gateway=empty_models; direct=empty_models')
  })
})

describe('recommendation helpers', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('merges batch result counts by status', () => {
    const merged = mergeRecommendationBatchResults([
      { recommendation_id: 'rec-01', status: 'applied' },
      { recommendation_id: 'rec-02', status: 'failed', error: 'boom' },
      { recommendation_id: 'rec-03', status: 'undone' },
    ])

    expect(merged).toEqual({
      total: 3,
      applied: 1,
      undone: 1,
      failed: 1,
      results: [
        { recommendation_id: 'rec-01', status: 'applied' },
        { recommendation_id: 'rec-02', status: 'failed', error: 'boom' },
        { recommendation_id: 'rec-03', status: 'undone' },
      ],
    })
  })

  it('normalizes string recommendation payload in applyRecommendation', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plan_id: 'plan-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ step_id: 'step-1' }),
      })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await applyRecommendation('task', '增加悬念')

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/workflow/plan'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          task: 'task',
          level: undefined,
          recommendations: [
            {
              id: 'rec-01',
              title: '增加悬念',
              reason: '增加悬念',
              action: 'apply',
            },
          ],
        }),
      })
    )

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/workflow/execute'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          plan_id: 'plan-1',
          step_id: undefined,
          recommendations: [
            {
              id: 'rec-01',
              title: '增加悬念',
              reason: '增加悬念',
              action: 'apply',
            },
          ],
        }),
      })
    )

    expect(response).toEqual({
      success: true,
      data: {
        recommendation_id: 'rec-01',
        status: 'applied',
        plan_id: 'plan-1',
        step_id: 'step-1',
        message: 'recommendation applied',
      },
    })
  })

  it('returns batch summary for mixed recommendation results', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plan_id: 'plan-a' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ step_id: 'step-a' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ plan_id: 'plan-b' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'failed', error: 'execute failed' }),
      })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await batchApplyRecommendations('task', ['建议 A', '建议 B'])

    expect(response.success).toBe(true)
    expect(response.data).toEqual({
      total: 2,
      applied: 1,
      undone: 0,
      failed: 1,
      results: [
        {
          recommendation_id: 'rec-01',
          status: 'applied',
          plan_id: 'plan-a',
          step_id: 'step-a',
          message: 'recommendation applied',
        },
        {
          recommendation_id: 'rec-02',
          status: 'failed',
          plan_id: 'plan-b',
          error: 'execute failed',
        },
      ],
    })
  })
})

describe('gateway runtime mapping', () => {
  it('falls back to backend/services when mcp_runtime is missing', () => {
    const health: GatewayHealth = {
      status: 'degraded',
      version: '8.0.0',
      services: {
        memory: 'ok',
        graph: 'ok',
        search: 'error',
      },
    }

    const result = deriveGatewayRuntimeState(health, true)

    expect(result.connectionState).toBe('degraded')
    expect(result.reconnectState).toBe('failed')
    expect(result.sessionId).toBeNull()
    expect(result.reconnectAttempts).toBe(0)
  })

  it('prefers mcp_runtime fields when provided', () => {
    const health: GatewayHealth = {
      status: 'degraded',
      version: '8.0.0',
      services: {
        memory: 'ok',
        graph: 'ok',
      },
      mcp_runtime: {
        session_id: 'gw-20260220-xyz',
        connection_state: 'reconnecting',
        reconnect_state: 'retrying',
        reconnect_attempts: 2,
        last_error: 'search:error',
      },
    }

    const result = deriveGatewayRuntimeState(health, true)

    expect(result.connectionState).toBe('reconnecting')
    expect(result.reconnectState).toBe('retrying')
    expect(result.sessionId).toBe('gw-20260220-xyz')
    expect(result.reconnectAttempts).toBe(2)
    expect(result.lastError).toBe('search:error')
  })
})

describe('gateway service config APIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends PUT payload when updating gateway service config', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ service: { id: 'search', name: 'Search v2', enabled: true } }),
    })
    vi.stubGlobal('fetch', fetchSpy)

    await updateGatewayServiceConfig('search', { name: 'Search v2', enabled: true })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/admin/mcp/services/search'),
      expect.objectContaining({
        method: 'PUT',
        body: JSON.stringify({ name: 'Search v2', enabled: true }),
      })
    )
  })

  it('calls list/create/toggle/probe gateway service endpoints', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ services: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ service: { id: 'search2', enabled: true } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ service: { id: 'search2', enabled: false } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ service: { id: 'search2', status: 'disabled', enabled: false, checked_at: '2026-02-20T10:00:00Z' } }),
      })

    vi.stubGlobal('fetch', fetchSpy)

    await listGatewayServiceConfigs()
    await createGatewayServiceConfig({ id: 'search2', name: 'Search 2', path: '/search2', enabled: true })
    await setGatewayServiceEnabled('search2', false)
    await probeGatewayServiceHealth('search2')

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/admin/mcp/services'),
      expect.objectContaining({ method: 'GET' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/admin/mcp/services'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ id: 'search2', name: 'Search 2', path: '/search2', enabled: true }),
      })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/admin/mcp/services/search2/enabled'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ enabled: false }),
      })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('/admin/mcp/services/search2/probe'),
      expect.objectContaining({ method: 'POST' })
    )
  })
})

describe('workflow bridge and quality-check APIs', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts payload to /critic/evaluate with quality_goals', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ total_score: 90, actionable_feedback: 'ok' }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await evaluateContent('章节内容', { scene_id: 's1' }, ['logic'], { coherence: 88 })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/critic/evaluate'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '章节内容',
          scene_card: { scene_id: 's1' },
          dimensions: ['logic'],
          quality_goals: { coherence: 88 },
        }),
      })
    )
    expect(response.success).toBe(true)
  })

  it('posts payload to /writing/quality and not the stale novel alias', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ decision: 'REVISE', total_score: 72, actionable_feedback: 'improve pacing' }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await novelQualityCheck('章节内容', { scene_id: 's1' }, ['logic'], { coherence: 80 })

    const [requestUrl, requestInit] = fetchSpy.mock.calls[0] ?? []

    expect(requestUrl).toBe(`${getResolvedApiBase()}/writing/quality`)
    expect(requestUrl).not.toContain('/api/novel/quality-check')
    expect(requestInit).toEqual(expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '章节内容',
          scene_card: { scene_id: 's1' },
          dimensions: ['logic'],
          quality_goals: { coherence: 80 },
        }),
      }))
    expect(response).toEqual({
      success: true,
      data: { decision: 'REVISE', total_score: 72, actionable_feedback: 'improve pacing' },
    })
  })

  it('maps non-2xx JSON error payload for novelQualityCheck', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ error: 'content is required' }),
    }))

    const response = await novelQualityCheck('')

    expect(response.success).toBe(false)
    expect(response.error).toBe('content is required')
  })

  it('maps non-2xx response without error field for novelQualityCheck', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'server exploded' }),
    }))

    const response = await novelQualityCheck('章节内容')

    expect(response.success).toBe(false)
    expect(response.error).toBe('HTTP error: 500')
  })

  it('maps fetch rejection for novelQualityCheck', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('network down')
    }))

    const response = await novelQualityCheck('章节内容')

    expect(response.success).toBe(false)
    expect(response.error).toBe('Request failed. Please try again.')
    consoleErrorSpy.mockRestore()
  })

  it('routes workflow calls by workflowBackendMode', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', plan_id: 'plan-1', step_id: 's-1' }) })

    vi.stubGlobal('fetch', fetchSpy)

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        workflowBackendMode: 'standard',
      },
    }))

    await routeWorkflow('task-a', 'L3')
    await createPlan('task-a', 'L3', ['建议'])
    await executePlan('plan-1', undefined, ['建议'])
    await workflowLifecycle('plan-1', 'status')

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/workflow/route'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/workflow/plan'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/workflow/execute'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('/workflow/lifecycle'),
      expect.objectContaining({ method: 'POST' })
    )

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        workflowBackendMode: 'uiBridge',
      },
    }))

    await routeWorkflow('task-b', 'L3')
    await createPlan('task-b', 'L3', ['建议'])
    await executePlan('plan-2', undefined, ['建议'])
    await workflowLifecycle('plan-2', 'status')

    expect(fetchSpy).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('/ui-bridge/workflow/route'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('/ui-bridge/workflow/plan'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      7,
      expect.stringContaining('/ui-bridge/workflow/execute'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      8,
      expect.stringContaining('/ui-bridge/workflow/lifecycle'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('uses the current rollback and checkpoint endpoints', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok', restored: true, plan_id: 'plan-1', checkpoint_id: 'cp-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ checkpoint_id: 'cp-1', commit_hash: 'abc123' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'ok' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ id: 'cp-1', description: 'Initial checkpoint', created_at: '2026-04-09T00:00:00Z' }]),
      })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(quickRollbackWorkflow('plan-1', 'cp-1', 'undo risky step')).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({ restored: true, plan_id: 'plan-1', checkpoint_id: 'cp-1' }),
    })
    await createCheckpoint('Initial checkpoint', true)
    await expect(restoreCheckpoint('cp-1')).resolves.toMatchObject({
      success: true,
      data: expect.objectContaining({ status: 'ok' }),
    })
    await listCheckpoints(5)

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/workflow/rollback'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/checkpoint/create'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/checkpoint/restore'),
      expect.objectContaining({ method: 'POST' })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('/checkpoint/list'),
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('surfaces rollback and restore failure payloads as client errors', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          plan_id: 'plan-1',
          checkpoint_id: 'cp-missing',
          restored: false,
          restore: { error: "Checkpoint 'cp-missing' not found" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 'waiting_confirmation',
          error: 'destructive restore requires secondary confirmation',
        }),
      })

    vi.stubGlobal('fetch', fetchSpy)

    await expect(quickRollbackWorkflow('plan-1', 'cp-missing', 'undo risky step')).resolves.toEqual({
      success: false,
      error: "Checkpoint 'cp-missing' not found",
    })
    await expect(restoreCheckpoint('cp-1')).resolves.toEqual({
      success: false,
      error: 'destructive restore requires secondary confirmation',
    })
  })


  it('routes scheduler workflow calls by workflowBackendMode and includes scheduler payloads', async () => {
    const fetchSpy = vi.fn()
      .mockResolvedValue({ ok: true, json: async () => ({ status: 'ok', tasks: [], task: { task_id: 'sched-1' } }) })

    vi.stubGlobal('fetch', fetchSpy)

    const schedulerTask: AutomationTaskDefinition = {
      task_id: 'sched-1',
      title: 'Nightly Automation',
      task: '推进项目到完成',
      level: 'L3',
      schedule_rule: { cadence: 'cron', cron: '0 2 * * *', timezone: 'Asia/Shanghai', enabled: true },
      trigger_rule: { type: 'manual_run_now', run_now: true as const },
      backend_mode_policy: { mode: 'inherit' as const, fallback_mode: 'standard' as const },
      progression_policy: {
        success_statuses: ['completed' as const],
        approval_policy: {
          tiers: [
            {
              tier: 'critical' as const,
              requires_confirmation: true,
              gate_status_on_hold: 'waiting_confirmation' as const,
            },
          ],
          default_gate_status: 'waiting_confirmation' as const,
        },
        failure_policy: {
          retry: {
            max_retries: 2,
            strategy: 'fixed' as const,
            base_delay_ms: 1000,
          },
          on_retry_exhausted: 'manual_takeover' as const,
          manual_takeover_status: 'gate_blocked' as const,
        },
      },
    }

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        workflowBackendMode: 'standard',
      },
    }))

    await workflowSchedulerRegister(schedulerTask, true)
    await workflowSchedulerList(10)
    await workflowSchedulerPause('sched-1')
    await workflowSchedulerResume('sched-1')
    await workflowSchedulerRunNow('sched-1', [{ title: '保留冲突' }], undefined, 'confirm-token')

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/workflow/scheduler/register'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ task: schedulerTask, enabled: true }),
      })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/workflow/scheduler/list'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ limit: 10 }),
      })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining('/workflow/scheduler/pause'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ task_id: 'sched-1' }),
      })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      4,
      expect.stringContaining('/workflow/scheduler/resume'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ task_id: 'sched-1' }),
      })
    )
    expect(fetchSpy).toHaveBeenNthCalledWith(
      5,
      expect.stringContaining('/workflow/scheduler/run-now'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          task_id: 'sched-1',
          confirm_token: 'confirm-token',
          recommendations: [{
            id: 'rec-01',
            title: '保留冲突',
            reason: '',
            action: 'apply',
          }],
        }),
      })
    )

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        workflowBackendMode: 'uiBridge',
      },
    }))

    await workflowSchedulerList(5)

    expect(fetchSpy).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('/ui-bridge/workflow/scheduler/list'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ limit: 5 }),
      })
    )
  })


  it('routes scheduler import-lite-plan calls by workflowBackendMode with normalized payload', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        session_id: 'sess-1',
        imported: 2,
        registered: 2,
        updated: 0,
        failed: 0,
        total_tasks: 2,
        tasks: [],
        failures: [],
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        workflowBackendMode: 'standard',
      },
    }))

    await workflowSchedulerImportLitePlan('sess-1', 'L5', true)

    expect(fetchSpy).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('/workflow/scheduler/import-lite-plan'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          session_id: 'sess-1',
          force_level: 'L5',
          enabled: true,
        }),
      }),
    )

    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        workflowBackendMode: 'uiBridge',
      },
    }))

    await workflowSchedulerImportLitePlan(undefined, 'L5', true)

    expect(fetchSpy).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/ui-bridge/workflow/scheduler/import-lite-plan'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          force_level: 'L5',
          enabled: true,
        }),
      }),
    )
  })

  it('attaches authoritative workspace context to scheduler payloads', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'registered', task: { task_id: 'sched-workspace' } }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const workspace: ProjectWorkspaceContext = {
      schemaVersion: '2026-04-08',
      identity: {
        workspaceId: 'atlas-workspace',
        projectId: 'atlas-project',
        projectName: 'atlas-project',
        workspaceRoot: '/tmp/atlas',
      },
      manuscript: {
        manuscriptId: null,
        title: null,
        chapterId: 'chapter-9',
        chapterTitle: null,
        chapterNumber: 9,
      },
      storyBible: {
        storyBibleId: null,
        draftId: 'draft-9',
        version: null,
        storage: 'local-draft',
      },
      knowledge: {
        focusEntityId: 'hero-9',
        graphEntityIds: ['hero-9'],
        memoryEntryIds: [],
      },
      workflow: {
        sessionId: 'workflow-session-9',
        planId: null,
        level: 'L3',
      },
      chat: {
        conversationId: 'conversation-9',
        comparisonEnabled: false,
      },
      compatibility: {
        additiveContract: true,
        migratedLegacyFields: [],
        notes: [],
      },
    }

    const schedulerTask: AutomationTaskDefinition = {
      task_id: 'sched-workspace',
      title: 'Workspace Automation',
      task: '推进项目到完成',
      level: 'L3',
      trigger_rule: { type: 'manual_run_now' as const, run_now: true as const },
      backend_mode_policy: { mode: 'inherit' as const, fallback_mode: 'standard' as const },
      progression_policy: {
        success_statuses: ['completed' as const],
        approval_policy: {
          tiers: [
            { tier: 'critical' as const, requires_confirmation: true, gate_status_on_hold: 'waiting_confirmation' as const },
          ],
          default_gate_status: 'waiting_confirmation' as const,
        },
        failure_policy: {
          retry: { max_retries: 2, strategy: 'fixed' as const, base_delay_ms: 1000 },
          on_retry_exhausted: 'manual_takeover' as const,
          manual_takeover_status: 'gate_blocked' as const,
        },
      },
    }

    await workflowSchedulerRegister(schedulerTask, true, 'standard', workspace)

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/workflow/scheduler/register')
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      task: { task_id: 'sched-workspace' },
      workspace: {
        identity: {
          projectId: 'atlas-project',
        },
        workflow: {
          sessionId: 'workflow-session-9',
        },
      },
    })
  })

  it('attaches authoritative workspace context to workflow plan payloads', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', plan_id: 'plan-workspace' }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await createPlan(
      'task-workspace',
      'L3',
      ['建议'],
      'standard',
      {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'atlas-project',
          workspaceRoot: '/tmp/atlas',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: 'chapter-8',
          chapterTitle: null,
          chapterNumber: 8,
        },
        storyBible: {
          storyBibleId: null,
          draftId: 'draft-8',
          version: null,
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-8',
          graphEntityIds: ['hero-8'],
          memoryEntryIds: [],
        },
        workflow: {
          sessionId: 'workflow-session-8',
          planId: null,
          level: 'L3',
        },
        chat: {
          conversationId: 'conversation-8',
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    )

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/workflow/plan')
    expect(init.method).toBe('POST')
    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      task: 'task-workspace',
      workspace: {
        identity: {
          projectId: 'atlas-project',
        },
        workflow: {
          sessionId: 'workflow-session-8',
        },
      },
    })
  })
})

describe('agent api surface', () => {
  const agentWorkspace: NonNullable<Parameters<typeof agentWrite>[4]> = {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'atlas-project',
      workspaceRoot: '/tmp/atlas',
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: 'chapter-12',
      chapterTitle: null,
      chapterNumber: 12,
    },
    storyBible: {
      storyBibleId: null,
      draftId: 'draft-12',
      version: null,
      storage: 'local-draft',
    },
    knowledge: {
      focusEntityId: 'hero-12',
      graphEntityIds: ['hero-12'],
      memoryEntryIds: [],
    },
    workflow: {
      sessionId: 'workflow-session-12',
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: 'conversation-12',
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts canonical workspace payload to /agent/write when provided', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'generated', wordcount: 321 }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await agentWrite(
      { scene_id: 'scene-12', task: 'write this scene' },
      ['writer'],
      1200,
      { coherence: 85 },
      agentWorkspace,
    )

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/agent/write')
    expect(init.method).toBe('POST')

    const body = JSON.parse(String(init.body))
    expect(body).toMatchObject({
      scene_card: {
        scene_id: 'scene-12',
        task: 'write this scene',
      },
      skills: ['writer'],
      word_target: 1200,
      quality_goals: { coherence: 85 },
      workspace: {
        identity: {
          projectId: 'atlas-project',
        },
        manuscript: {
          chapterId: 'chapter-12',
        },
        workflow: {
          sessionId: 'workflow-session-12',
        },
      },
    })
  })

  it('keeps /agent/write payload additive when workspace is absent', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'generated', wordcount: 21 }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await agentWrite({ scene_id: 'scene-plain', task: 'plain write' }, ['writer'])

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))

    expect(body).toMatchObject({
      scene_card: {
        scene_id: 'scene-plain',
        task: 'plain write',
      },
      skills: ['writer'],
    })
    expect(body).not.toHaveProperty('workspace')
  })
})

describe('writing helper API', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts payload to writing-helper endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'outline', outline: ['第一段。'] }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await processWritingHelper({
      content: '第一段。',
      mode: 'outline',
      max_items: 1,
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/writing-helper/process'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: '第一段。', mode: 'outline', max_items: 1 }),
      })
    )
    expect(response.success).toBe(true)
    expect(response.data).toEqual({ mode: 'outline', outline: ['第一段。'] })
  })

  it('posts rewrite mode payload to writing-helper endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'rewrite', processed_text: '改写后文本。' }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await processWritingHelper({
      content: '原始文本。',
      mode: 'rewrite',
      instruction: '更简洁',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/writing-helper/process'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ content: '原始文本。', mode: 'rewrite', instruction: '更简洁' }),
      })
    )
    expect(response.success).toBe(true)
    expect(response.data).toEqual({ mode: 'rewrite', processed_text: '改写后文本。' })
  })

  it('maps legacy polish request to writing-helper endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'polish', processed_text: '润色后文本。' }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await polishContentCompat({
      originalText: '原始文本。',
      polishType: 'academic',
      llmApiUrl: 'https://example.com/v1/chat/completions',
      llmApiKey: 'dummy',
      model: 'gpt-4o',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/writing-helper/process'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '原始文本。',
          mode: 'polish',
          instruction: '使用更正式、学术的书面表达',
          detection_evasion_guard_enabled: true,
          model: 'gpt-4o',
        }),
      })
    )

    expect(response).toEqual({
      originalText: '原始文本。',
      polishedText: '润色后文本。',
      diffMarkup: '<del class="diff-del">原始文本。</del>\n<ins class="diff-add">润色后文本。</ins>',
    })
  })

  it('exposes polishContent alias with same behavior', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'polish', processed_text: '别名润色结果。' }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await polishContent({
      originalText: '原始文本。',
      polishType: 'business',
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/writing-helper/process'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          content: '原始文本。',
          mode: 'polish',
          instruction: '使用更专业、商务化表达',
          detection_evasion_guard_enabled: true,
        }),
      })
    )

    expect(response).toEqual({
      originalText: '原始文本。',
      polishedText: '别名润色结果。',
      diffMarkup: '<del class="diff-del">原始文本。</del>\n<ins class="diff-add">别名润色结果。</ins>',
    })
  })

  it('returns validation error when originalText is empty', async () => {
    const response = await polishContentCompat({
      originalText: '   ',
      polishType: 'standard',
    })

    expect(response).toEqual({
      originalText: '   ',
      polishedText: '',
      diffMarkup: '',
      error: 'originalText is required',
    })
  })
})

describe('chat request payload', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends comparison payload to /chat when enabled', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'ok', skills_used: [] }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await chat({
      messages: [{ role: 'user', content: 'hello' }],
      workflowLevel: 'L3',
      skills: [],
      allowLlmFallback: true,
      qualityGoals: {
        naturalness: 91,
        readability: 82,
        coherence: 78,
        style_consistency: 84,
        humanization_preset: 'human_writing',
        custom_humanization_instruction: '',
        sentence_entropy_target: 55,
        rhythm_variability_target: 55,
      },
      comparison: {
        enabled: true,
        controlModel: 'gpt-4-turbo',
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/chat'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'hello' }],
          workflowLevel: 'L3',
          skills: [],
          allowLlmFallback: true,
          qualityGoals: {
            naturalness: 91,
            readability: 82,
            coherence: 78,
            style_consistency: 84,
            humanization_preset: 'human_writing',
            custom_humanization_instruction: '',
            sentence_entropy_target: 55,
            rhythm_variability_target: 55,
          },
          comparison: {
            enabled: true,
            controlModel: 'gpt-4-turbo',
          },
        }),
      })
    )
  })

  it('sends canonical workspace payload and legacy chat context together', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: 'ok', skills_used: [] }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await chat({
      messages: [{ role: 'user', content: 'hello workspace' }],
      workflowLevel: 'L3',
      skills: [],
      allowLlmFallback: true,
      workspace: {
        schemaVersion: '2026-04-08',
        identity: {
          workspaceId: 'atlas-workspace',
          projectId: 'atlas-project',
          projectName: 'atlas-project',
          workspaceRoot: '/tmp/atlas',
        },
        manuscript: {
          manuscriptId: null,
          title: null,
          chapterId: 'chapter-11',
          chapterTitle: null,
          chapterNumber: 11,
        },
        storyBible: {
          storyBibleId: null,
          draftId: 'draft-11',
          version: null,
          storage: 'local-draft',
        },
        knowledge: {
          focusEntityId: 'hero-11',
          graphEntityIds: ['hero-11'],
          memoryEntryIds: [],
        },
        workflow: {
          sessionId: 'workflow-session-11',
          planId: null,
          level: 'L3',
        },
        chat: {
          conversationId: 'conversation-11',
          comparisonEnabled: false,
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: [],
          notes: [],
        },
      },
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.context).toEqual({
      projectId: 'atlas-project',
      chapterId: 'chapter-11',
    })
    expect(body.workspace.workflow.sessionId).toBe('workflow-session-11')
  })
})

describe('workspace api surface', () => {
  const memoryWorkspace: NonNullable<NonNullable<Parameters<typeof searchMemory>[1]>['workspace']> = {
    schemaVersion: '2026-04-08',
    identity: {
      workspaceId: 'atlas-workspace',
      projectId: 'atlas-project',
      projectName: 'atlas-project',
      workspaceRoot: '/tmp/atlas',
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: 'chapter-13',
      chapterTitle: null,
      chapterNumber: 13,
    },
    storyBible: {
      storyBibleId: null,
      draftId: 'draft-13',
      version: null,
      storage: 'local-draft',
    },
    knowledge: {
      focusEntityId: 'hero-13',
      graphEntityIds: ['hero-13'],
      memoryEntryIds: [],
    },
    workflow: {
      sessionId: 'workflow-session-13',
      planId: null,
      level: 'L3',
    },
    chat: {
      conversationId: 'conversation-13',
      comparisonEnabled: false,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
  }

  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('resolves canonical workspace context through the dedicated endpoint', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workspace: {
          identity: {
            projectId: 'atlas-project',
          },
        },
        summary: {
          projectId: 'atlas-project',
        },
        compatibility: {
          additiveContract: true,
          migratedLegacyFields: ['project_id'],
        },
      }),
    })

    vi.stubGlobal('fetch', fetchSpy)

    const response = await resolveWorkspaceContext({
      project_id: 'atlas-project',
      session_id: 'session-12',
      context: {
        chapterId: 'chapter-12',
      },
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/workspace/context'),
      expect.objectContaining({
        method: 'POST',
      }),
    )
    expect(response.success).toBe(true)
    expect(response.data?.workspace.identity.projectId).toBe('atlas-project')
  })

  it('keeps memory scope generic when searchMemory receives workspace context', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await searchMemory('plot outline', {
      workspace: memoryWorkspace,
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.project_id).toBe('atlas-project')
    expect(body.session_id).toBe('workflow-session-13')
    expect(body.entity_id).toBeUndefined()
  })

  it('preserves explicit entity scoping when searchMemory requests it', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await searchMemory('plot outline', {
      entity_id: 'hero-13',
      workspace: memoryWorkspace,
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.project_id).toBe('atlas-project')
    expect(body.session_id).toBe('workflow-session-13')
    expect(body.entity_id).toBe('hero-13')
  })

  it('includes the focused entity only when searchMemory explicitly requests it', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ([]),
    })

    vi.stubGlobal('fetch', fetchSpy)

    await searchMemory('plot outline', {
      use_focus_entity: true,
      workspace: memoryWorkspace,
    })

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    const body = JSON.parse(String(init.body))
    expect(body.project_id).toBe('atlas-project')
    expect(body.session_id).toBe('workflow-session-13')
    expect(body.entity_id).toBe('hero-13')
  })
})

describe('chatStream', () => {
  const request: ChatRequest = {
    messages: [{ role: 'user', content: 'hello' }],
    workflowLevel: 'L3',
    skills: [],
    allowLlmFallback: true,
  }

  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0)
      return 1
    })
  })

  it('parses SSE content and done events', async () => {
    const onContent = vi.fn()
    const onDone = vi.fn()

    const sseChunk = [
      'event: content\n',
      'data: {"chunk":"Hello","index":0}\n',
      '\n',
      'event: content\n',
      'data: {"chunk":" World","index":1}\n',
      '\n',
      'event: done\n',
      'data: {"status":"completed","skills_used":["a"]}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onContent, onDone })

    expect(onContent).toHaveBeenCalledWith('Hello', 0)
    expect(onContent).toHaveBeenCalledWith(' World', 1)
    expect(onDone).toHaveBeenCalledWith(expect.objectContaining({
      status: 'completed',
      skills_used: ['a'],
    }))
  })

  it('forwards AbortSignal to fetch', async () => {
    const controller = new AbortController()
    const fetchSpy = vi.fn(async (...args: Parameters<typeof fetch>) => {
      const init = args[1] as RequestInit
      expect(init.signal).toBe(controller.signal)
      return createSseResponse([])
    })
    vi.stubGlobal('fetch', fetchSpy)

    await chatStream(request, {}, { signal: controller.signal })

    expect(fetchSpy).toHaveBeenCalledOnce()
  })

  it('maps canonical interrupted terminal payload', async () => {
    const onError = vi.fn()

    const sseChunk = [
      'event: error\n',
      'data: {"error":"stream interrupted","terminal":"interrupted","status":"aborted"}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      'stream interrupted',
      expect.objectContaining({ terminal: 'interrupted' })
    )
  })

  it('maps recovered terminal with legacy decision fallback', async () => {
    const onDone = vi.fn()

    const sseChunk = [
      'event: done\n',
      'data: {"status":"completed","terminal":"recovered","legacy_contract_fields":{"decision":"soft_go","terminal":"done"}}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        terminal: 'done',
        decision: 'soft_go',
      })
    )
  })

  it('maps error event terminal payload', async () => {
    const onError = vi.fn()

    const sseChunk = [
      'event: error\n',
      'data: {"error":"boom","terminal":"error","diagnostics":{"error_type":"RuntimeError"}}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      'boom',
      expect.objectContaining({ terminal: 'error' })
    )
  })

  it('maps interrupted terminal when fetch throws abort-like error', async () => {
    const onError = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('AbortError')
    }))

    await chatStream(request, { onError }, { signal: new AbortController().signal })

    expect(onError).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ terminal: 'interrupted' })
    )
    consoleErrorSpy.mockRestore()
  })
})
