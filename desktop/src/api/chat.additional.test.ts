import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const getResolvedApiBaseMock = vi.hoisted(() => vi.fn())
const getRuntimeGatewayBaseMock = vi.hoisted(() => vi.fn())
const isTauriRuntimeMock = vi.hoisted(() => vi.fn())
const appendLegacyChatWorkspacePayloadMock = vi.hoisted(() => vi.fn())
const loggerErrorMock = vi.hoisted(() => vi.fn())

vi.mock('./core', () => ({
  callApi: callApiMock,
  getResolvedApiBase: getResolvedApiBaseMock,
  getRuntimeGatewayBase: getRuntimeGatewayBaseMock,
  isTauriRuntime: isTauriRuntimeMock,
}))

vi.mock('./workspace', () => ({
  appendLegacyChatWorkspacePayload: appendLegacyChatWorkspacePayloadMock,
}))

vi.mock('../utils/logger', () => ({
  logger: {
    error: loggerErrorMock,
  },
}))

import { chat, chatStream, type ChatRequest } from './chat'

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

const request: ChatRequest = {
  messages: [{ role: 'user', content: 'hello' }],
  workflowLevel: 'L3',
  skills: ['canon'],
  allowLlmFallback: true,
}

describe('chat additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    isTauriRuntimeMock.mockReturnValue(false)
    getResolvedApiBaseMock.mockReturnValue('http://127.0.0.1:9527')
    getRuntimeGatewayBaseMock.mockResolvedValue('http://127.0.0.1:8666')
    appendLegacyChatWorkspacePayloadMock.mockImplementation((payload: Record<string, unknown>) => ({
      ...payload,
      appended: true,
    }))
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback): number => {
      cb(0)
      return 1
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards chat requests through callApi with the workspace payload helper', async () => {
    const response = {
      success: true,
      data: {
        content: 'ok',
        skills_used: [],
      },
    }
    callApiMock.mockResolvedValue(response)

    const result = await chat({
      ...request,
      workspace: { identity: { projectId: 'atlas-project' } } as never,
    })

    expect(result).toEqual(response)
    expect(appendLegacyChatWorkspacePayloadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: request.messages,
        workflowLevel: 'L3',
      }),
      expect.objectContaining({
        identity: {
          projectId: 'atlas-project',
        },
      }),
    )
    expect(callApiMock).toHaveBeenCalledWith(
      '/chat',
      'POST',
      expect.objectContaining({
        appended: true,
      }),
    )
  })

  it('dispatches start, routing, progress, evaluation, and done callbacks with legacy terminal fallbacks', async () => {
    const onStart = vi.fn()
    const onRouting = vi.fn()
    const onProgress = vi.fn()
    const onEvaluation = vi.fn()
    const onDone = vi.fn()

    const sseChunk = [
      'event: start\n',
      'data: {}\n',
      '\n',
      'event: routing\n',
      'data: {"level":"L3","scene_type":"draft","skills":["canon"]}\n',
      '\n',
      'event: progress\n',
      'data: {"step":1,"total":3,"message":"Routing"}\n',
      '\n',
      'event: evaluation\n',
      'data: {"score":91,"feedback":"Strong"}\n',
      '\n',
      'event: done\n',
      'data: {"status":"completed","legacy_contract_fields":{"terminal_state":"aborted","decision":"soft_go"}}\n',
      '\n',
    ].join('')

    const fetchMock = vi.fn(async () => createSseResponse([sseChunk]))
    vi.stubGlobal('fetch', fetchMock)

    await chatStream(request, { onStart, onRouting, onProgress, onEvaluation, onDone })

    expect(getRuntimeGatewayBaseMock).not.toHaveBeenCalled()
    expect(getResolvedApiBaseMock).toHaveBeenCalled()
    expect(appendLegacyChatWorkspacePayloadMock).toHaveBeenCalledWith(request, undefined)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://127.0.0.1:9527/chat/stream',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
      }),
    )
    const [, fetchInit] = fetchMock.mock.calls[0] ?? []
    expect(JSON.parse(String(fetchInit?.body))).toMatchObject({
      messages: request.messages,
      workflowLevel: 'L3',
      skills: ['canon'],
      allowLlmFallback: true,
      appended: true,
    })
    expect(onStart).toHaveBeenCalledOnce()
    expect(onRouting).toHaveBeenCalledWith({
      level: 'L3',
      scene_type: 'draft',
      skills: ['canon'],
    })
    expect(onProgress).toHaveBeenCalledWith({
      step: 1,
      total: 3,
      message: 'Routing',
    })
    expect(onEvaluation).toHaveBeenCalledWith({
      score: 91,
      feedback: 'Strong',
    })
    expect(onDone).toHaveBeenCalledWith({
      status: 'completed',
      terminal: 'interrupted',
      diagnostics: undefined,
      skills_used: [],
      decision: 'soft_go',
      writer_metadata: undefined,
    })
  })

  it('uses direct decisions and restored status fallbacks for done events', async () => {
    const onDone = vi.fn()
    const sseChunk = [
      'event: done\n',
      'data: {"status":"restored","decision":"go","skills_used":["canon"]}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith({
      status: 'restored',
      terminal: 'done',
      diagnostics: undefined,
      skills_used: ['canon'],
      decision: 'go',
      writer_metadata: undefined,
    })
  })

  it('returns undefined terminal and decision when legacy contract fields are unsupported', async () => {
    const onDone = vi.fn()
    const sseChunk = [
      'event: done\n',
      'data: {"status":"completed","legacy_contract_fields":{"terminal":"mystery","terminal_state":"weird","status":"unknown","decision":"later"}}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith({
      status: 'completed',
      terminal: undefined,
      diagnostics: undefined,
      skills_used: [],
      decision: undefined,
      writer_metadata: undefined,
    })
  })

  it('reports HTTP errors through onError', async () => {
    const onError = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => new Response('fail', { status: 503 })))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('HTTP error: 503'),
      expect.objectContaining({
        terminal: 'error',
        status: 'failed',
      }),
    )
    expect(loggerErrorMock).toHaveBeenCalledWith('Stream error:', expect.any(Error))
  })

  it('reports missing response bodies through onError', async () => {
    const onError = vi.fn()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        ({
          ok: true,
          status: 200,
          body: undefined,
        }) as Response),
    )

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      expect.stringContaining('No response body'),
      expect.objectContaining({
        terminal: 'error',
        status: 'failed',
      }),
    )
    expect(loggerErrorMock).toHaveBeenCalledWith('Stream error:', expect.any(Error))
  })

  it('uses the Tauri runtime gateway base for chat streams', async () => {
    isTauriRuntimeMock.mockReturnValue(true)
    const onDone = vi.fn()
    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse(['event: done\ndata: {}\n\n'])))

    await chatStream(request, { onDone })

    expect(getRuntimeGatewayBaseMock).toHaveBeenCalledWith(getResolvedApiBaseMock)
  })

  it('forwards writer_metadata in done events', async () => {
    const onDone = vi.fn()
    const sseChunk = [
      'event: done\n',
      'data: {"status":"completed","writer_metadata":{"model":"gpt-test","tokens_used":42}}\n',
      '\n',
    ].join('')
    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        writer_metadata: { model: 'gpt-test', tokens_used: 42 },
      }),
    )
  })

  it('logs JSON parse failures without dispatching content callbacks', async () => {
    const onContent = vi.fn()
    const sseChunk = [
      'event: content\n',
      'data: {"chunk":\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onContent })

    expect(onContent).not.toHaveBeenCalled()
    expect(loggerErrorMock).toHaveBeenCalledWith('Failed to parse SSE data:', expect.any(SyntaxError))
  })

  it('dispatches content events split across multiple chunks (ISS-20260613-009)', async () => {
    const onContent = vi.fn()
    // event: 和 data: 在不同 chunk 到达 — 修复前因 currentEvent 循环内重置而丢失
    const chunk1 = 'event: content\n'
    const chunk2 = 'data: {"chunk":"hello","index":0}\n\n'

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([chunk1, chunk2])))

    await chatStream(request, { onContent })

    expect(onContent).toHaveBeenCalledWith('hello', 0)
  })

  it('dispatches the final event when the stream ends without a trailing blank line (ISS-20260613-009)', async () => {
    const onDone = vi.fn()
    // 流末尾无尾随空行 — 修复前 done 事件会被截留在 currentEvent/currentData 不触发
    const sseChunk = [
      'event: done\n',
      'data: {"status":"completed"}',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    )
  })
})
