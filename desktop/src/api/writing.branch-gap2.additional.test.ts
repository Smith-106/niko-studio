import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getResolvedApiBaseMock = vi.hoisted(() => vi.fn(() => 'http://127.0.0.1:18080'))
const getRuntimeGatewayBaseMock = vi.hoisted(() => vi.fn(async () => 'tauri://gateway'))
const isTauriRuntimeMock = vi.hoisted(() => vi.fn(() => false))
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload) => payload))

vi.mock('./core', () => ({
  callApi: vi.fn(),
  getResolvedApiBase: getResolvedApiBaseMock,
  getRuntimeGatewayBase: getRuntimeGatewayBaseMock,
  isTauriRuntime: isTauriRuntimeMock,
}))

vi.mock('./workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

import { streamWritingHelper } from './writing'

function createReader(chunks: string[]) {
  const values = chunks.map((chunk) => ({
    done: false,
    value: new TextEncoder().encode(chunk),
  }))
  values.push({ done: true, value: undefined })
  return {
    read: vi.fn(async () => values.shift() ?? { done: true, value: undefined }),
  }
}

describe('writing branch-gap additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    getResolvedApiBaseMock.mockReturnValue('http://127.0.0.1:18080')
    getRuntimeGatewayBaseMock.mockResolvedValue('tauri://gateway')
    isTauriRuntimeMock.mockReturnValue(false)
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // Line 107: dispatchWritingStreamEvent error branch — data.error is undefined/null
  // This covers `String(data.error ?? 'Stream error')` where data.error is falsy
  it('uses fallback "Stream error" when error event data.error is undefined', async () => {
    const onError = vi.fn()

    const sseChunk = [
      'event: error\n',
      'data: {}\n', // no "error" field
      '\n',
    ].join('')

    const reader = createReader([sseChunk])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    expect(onError).toHaveBeenCalledWith('Stream error')
  })

  // Line 107: data.error is null
  it('uses fallback "Stream error" when error event data.error is null', async () => {
    const onError = vi.fn()

    const sseChunk = [
      'event: error\n',
      'data: {"error":null}\n',
      '\n',
    ].join('')

    const reader = createReader([sseChunk])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    expect(onError).toHaveBeenCalledWith('Stream error')
  })

  // Line 107: data.error is empty string — ?? does NOT trigger for empty string
  // Since ?? only triggers for null/undefined, String("") returns ""
  it('passes through empty string when error event data.error is empty string', async () => {
    const onError = vi.fn()

    const sseChunk = [
      'event: error\n',
      'data: {"error":""}\n',
      '\n',
    ].join('')

    const reader = createReader([sseChunk])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    // Empty string is defined, so ?? doesn't trigger — String("") returns ""
    expect(onError).toHaveBeenCalledWith('')
  })

  // Line 309: Content-Type does NOT include 'text/event-stream' — JSON fallback path
  it('falls back to JSON event consumption when Content-Type is not SSE', async () => {
    const onContent = vi.fn()
    const onDone = vi.fn()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === 'content-type') return 'application/json'
          return null
        },
      },
      json: async () => ({
        streaming: true,
        events: [
          { event: 'content', data: { chunk: 'JSON content', index: 0 } },
          { event: 'done', data: {} },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent, onDone, onError: vi.fn() },
    )

    expect(onContent).toHaveBeenCalledWith('JSON content', 0)
    expect(onDone).toHaveBeenCalledOnce()
  })

  // Line 309: Content-Type header is null/missing
  it('falls back to JSON event consumption when Content-Type header is missing', async () => {
    const onContent = vi.fn()
    const onDone = vi.fn()

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => null,
      },
      json: async () => ({
        streaming: true,
        events: [
          { event: 'content', data: { chunk: 'fallback JSON', index: 0 } },
          { event: 'done', data: {} },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent, onDone, onError: vi.fn() },
    )

    expect(onContent).toHaveBeenCalledWith('fallback JSON', 0)
    expect(onDone).toHaveBeenCalledOnce()
  })

  // Line 318: err.name !== 'AbortError' — non-abort errors call onError
  it('calls onError for non-abort fetch errors', async () => {
    const onError = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    expect(onError).toHaveBeenCalledWith('Failed to fetch')
    consoleErrorSpy.mockRestore()
  })

  // Line 318: err is not an Error instance — String(err) path
  it('calls onError with String(err) when thrown value is not an Error', async () => {
    const onError = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const fetchMock = vi.fn().mockRejectedValue('string error')
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    expect(onError).toHaveBeenCalledWith('string error')
    consoleErrorSpy.mockRestore()
  })

  // Line 317: AbortError — should NOT call onError
  it('does not call onError for AbortError', async () => {
    const onError = vi.fn()

    const abortError = new DOMException('The operation was aborted', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
      { signal: new AbortController().signal },
    )

    expect(onError).not.toHaveBeenCalled()
  })

  // Line 107: dispatchWritingStreamEvent error — data.error is a valid string
  it('passes through the error message when error event data.error is a string', async () => {
    const onError = vi.fn()

    const sseChunk = [
      'event: error\n',
      'data: {"error":"specific stream error"}\n',
      '\n',
    ].join('')

    const reader = createReader([sseChunk])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      { content: 'prompt', mode: 'generate' },
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    expect(onError).toHaveBeenCalledWith('specific stream error')
  })
})
