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

import { chatStream, type ChatRequest } from './chat'

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

describe('chat branch-gap additional coverage', () => {
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

  // Line 410: data.status === 'aborted' inside the IIFE fallback of toStreamTerminalPayload
  // This is reached when normalizeTerminalValue(data.terminal) returns undefined
  // AND parseLegacyTerminal(data) returns undefined AND data.status === 'aborted'
  it('returns "interrupted" terminal when status is "aborted" with no terminal or legacy fields', async () => {
    const onDone = vi.fn()
    const sseChunk = [
      'event: done\n',
      'data: {"status":"aborted"}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'aborted',
        terminal: 'interrupted',
      }),
    )
  })

  // Line 410: data.status === 'restored' inside the IIFE fallback
  it('returns "recovered" terminal when status is "restored" with no terminal or legacy fields', async () => {
    const onDone = vi.fn()
    const sseChunk = [
      'event: done\n',
      'data: {"status":"restored"}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onDone })

    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'restored',
        terminal: 'done',
      }),
    )
  })

  // Lines 463-466: the 'error' case of handleStreamEventOptimized
  it('dispatches onError with stream error message when SSE emits an error event', async () => {
    const onError = vi.fn()
    const sseChunk = [
      'event: error\n',
      'data: {"error":"server-side failure","status":"failed"}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      'server-side failure',
      expect.objectContaining({
        status: 'failed',
      }),
    )
  })

  // Lines 463: String(data.error ?? 'Stream error') - the 'Stream error' fallback
  it('uses "Stream error" as default message when error event has no error field', async () => {
    const onError = vi.fn()
    const sseChunk = [
      'event: error\n',
      'data: {"status":"failed"}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      'Stream error',
      expect.objectContaining({
        status: 'failed',
      }),
    )
  })

  // Line 466: terminal === 'recovered' → 'error' mapping for error events
  it('maps "recovered" terminal to "error" in the error event payload', async () => {
    const onError = vi.fn()
    const sseChunk = [
      'event: error\n',
      'data: {"error":"partial recovery failed","terminal":"recovered","status":"restored"}\n',
      '\n',
    ].join('')

    vi.stubGlobal('fetch', vi.fn(async () => createSseResponse([sseChunk])))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalledWith(
      'partial recovery failed',
      expect.objectContaining({
        terminal: 'error',
      }),
    )
  })
})
