import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyRecommendation,
  batchApplyRecommendations,
  chatStream,
  mergeRecommendationBatchResults,
  type ChatRequest,
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
