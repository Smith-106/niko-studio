import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const callApiMock = vi.hoisted(() => vi.fn())
const getResolvedApiBaseMock = vi.hoisted(() => vi.fn(() => 'http://127.0.0.1:18080'))
const getRuntimeGatewayBaseMock = vi.hoisted(() => vi.fn(async () => 'tauri://gateway'))
const isTauriRuntimeMock = vi.hoisted(() => vi.fn(() => false))
const appendWorkspacePayloadMock = vi.hoisted(() => vi.fn((payload) => payload))

vi.mock('./core', () => ({
  callApi: callApiMock,
  getResolvedApiBase: getResolvedApiBaseMock,
  getRuntimeGatewayBase: getRuntimeGatewayBaseMock,
  isTauriRuntime: isTauriRuntimeMock,
}))

vi.mock('./workspace', () => ({
  appendWorkspacePayload: appendWorkspacePayloadMock,
}))

import {
  polishContentCompat,
  processWritingHelper,
  streamWritingHelper,
} from './writing'

function createReader(chunks: string[]) {
  const values = chunks.map((chunk) => ({
    done: false,
    value: new TextEncoder().encode(chunk),
  }))
  values.push({ done: true, value: undefined })
  return {
    read: vi.fn(values.shift ? async () => values.shift() ?? { done: true, value: undefined } : async () => ({ done: true, value: undefined })),
  }
}

describe('writing api bridge additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    callApiMock.mockReset()
    getResolvedApiBaseMock.mockReturnValue('http://127.0.0.1:18080')
    getRuntimeGatewayBaseMock.mockResolvedValue('tauri://gateway')
    isTauriRuntimeMock.mockReturnValue(false)
    appendWorkspacePayloadMock.mockImplementation((payload) => payload)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('posts processWritingHelper payloads through callApi', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'polished text' },
    })

    const workspace = { identity: { projectId: 'proj-1' } } as never
    const payload = {
      content: 'draft',
      mode: 'polish',
      instruction: 'be concise',
      workspace,
    } as never

    const result = await processWritingHelper(payload)

    expect(appendWorkspacePayloadMock).toHaveBeenCalledWith(payload, workspace)
    expect(callApiMock).toHaveBeenCalledWith('/writing/helper', 'POST', payload, expect.any(Object))
    expect(result.success).toBe(true)
  })

  it('streams JSON event payloads and uses the Tauri gateway base when needed', async () => {
    isTauriRuntimeMock.mockReturnValue(true)

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        streaming: true,
        events: [
          { event: 'content', data: { chunk: 'hello', index: 0 } },
          { event: 'done', data: {} },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onContent = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite', workspace: { identity: { projectId: 'proj-1' } } } as never,
      { onContent, onDone, onError },
    )

    expect(getRuntimeGatewayBaseMock).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith(
      'tauri://gateway/writing/stream',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        }),
      }),
    )
    expect(onContent).toHaveBeenCalledWith('hello', 0)
    expect(onDone).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()
  })

  it('streams SSE payloads and reports invalid stream structures', async () => {
    const reader = createReader([
      'event: content\ndata: {"chunk":"A","index":1}\n\n',
      'event: done\ndata: {}\n\n',
    ])
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: { getReader: () => reader },
    })
    vi.stubGlobal('fetch', fetchMock)

    const onContent = vi.fn()
    const onDone = vi.fn()
    const onError = vi.fn()

    await streamWritingHelper(
      { content: 'draft', mode: 'polish' } as never,
      { onContent, onDone, onError },
    )

    expect(onContent).toHaveBeenCalledWith('A', 1)
    expect(onDone).toHaveBeenCalledOnce()
    expect(onError).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        streaming: true,
        events: [{ event: 'content', data: { chunk: 1, index: 'bad' } }],
      }),
    })

    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent, onDone, onError },
    )

    expect(onError).toHaveBeenCalledWith('Invalid writing stream payload')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'text/event-stream' },
      body: {
        getReader: () => createReader(['event: content\ndata: {"chunk":1,"index":"bad"}\n\n']),
      },
    })

    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent, onDone, onError },
    )

    expect(onError).toHaveBeenCalledWith('Invalid writing stream payload')

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        streaming: false,
        events: [],
      }),
    })

    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent, onDone, onError },
    )

    expect(onError).toHaveBeenCalledWith('Invalid writing stream payload')
  })

  it('maps fetch failures, missing bodies, HTTP errors, and aborts into the correct callbacks', async () => {
    const onError = vi.fn()

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        clone: () => ({
          json: async () => ({ error: 'quota exceeded' }),
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        clone: () => ({
          json: async () => {
            throw new Error('bad json')
          },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: undefined,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => createReader(['event: invalid\ndata: {"chunk":"x","index":0}\n\n']),
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => createReader(['event: content\ndata: not-json\n\n']),
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => createReader(['event: content\ndata: "plain-string"\n\n']),
        },
      })
      .mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper({ content: 'draft', mode: 'rewrite' } as never, { onError })
    await streamWritingHelper({ content: 'draft', mode: 'rewrite' } as never, { onError })
    await streamWritingHelper({ content: 'draft', mode: 'rewrite' } as never, { onError })
    await streamWritingHelper({ content: 'draft', mode: 'rewrite' } as never, { onError })
    await streamWritingHelper({ content: 'draft', mode: 'rewrite' } as never, { onError })
    await streamWritingHelper({ content: 'draft', mode: 'rewrite' } as never, { onError })
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onError },
      { signal: new AbortController().signal },
    )

    expect(onError).toHaveBeenNthCalledWith(1, 'quota exceeded')
    expect(onError).toHaveBeenNthCalledWith(2, 'HTTP error: 503')
    expect(onError).toHaveBeenNthCalledWith(3, 'No response body')
    expect(onError).toHaveBeenNthCalledWith(4, 'Invalid writing stream payload')
    expect(onError).toHaveBeenNthCalledWith(5, 'Failed to parse writing stream event')
    expect(onError).toHaveBeenNthCalledWith(6, 'Invalid writing stream payload')
    expect(onError).toHaveBeenCalledTimes(6)
  })

  it('validates polishContentCompat inputs, propagates helper failures, and generates diffs on success', async () => {
    const empty = await polishContentCompat({ originalText: '' })
    expect(empty).toEqual({
      originalText: '',
      polishedText: '',
      diffMarkup: '',
      error: 'originalText is required',
    })

    callApiMock.mockResolvedValueOnce({
      success: false,
      error: 'gateway offline',
    })

    const failed = await polishContentCompat({
      originalText: 'first line',
      polishType: 'business',
      model: 'gpt-test',
      provider: 'openai',
    })
    expect(failed.error).toBe('gateway offline')
    expect(callApiMock).toHaveBeenCalledWith(
      '/writing/helper',
      'POST',
      expect.objectContaining({
        content: 'first line',
        mode: 'polish',
        model: 'gpt-test',
        provider: 'openai',
        detection_evasion_guard_enabled: true,
      }),
      expect.any(Object),
    )

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        processed_text: 'first line\nsecond line updated',
      },
    })

    const success = await polishContentCompat({
      originalText: 'first line\nsecond line',
      polishType: 'creative',
    })

    expect(success.error).toBeUndefined()
    expect(success.polishedText).toBe('first line\nsecond line updated')
    expect(success.diffMarkup).toContain('<del class="diff-del">second line</del>')
    expect(success.diffMarkup).toContain('<ins class="diff-add">second line updated</ins>')
  })

  it('covers stream error events, academic instruction mapping, and diff insert-delete branches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        streaming: true,
        events: [{ event: 'error', data: { error: 'stream failed' } }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const onError = vi.fn()
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone: vi.fn(), onError },
    )

    expect(onError).toHaveBeenCalledWith('stream failed')

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        processed_text: 'line 1\nline 2\nline 3',
      },
    })

    const inserted = await polishContentCompat({
      originalText: 'line 1\nline 3',
      polishType: 'academic',
    })

    expect(callApiMock).toHaveBeenLastCalledWith(
      '/writing/helper',
      'POST',
      expect.objectContaining({
        instruction: expect.any(String),
      }),
      expect.any(Object),
    )
    const academicPayload = callApiMock.mock.calls.at(-1)?.[2] as { instruction?: string } | undefined
    expect(academicPayload?.instruction).toBeTruthy()
    expect(inserted.diffMarkup).toContain('<ins class="diff-add">line 2</ins>')

    callApiMock.mockResolvedValueOnce({
      success: true,
      data: {
        processed_text: 'line 1\nline 3',
      },
    })

    const removed = await polishContentCompat({
      originalText: 'line 1\nline 2\nline 3',
      polishType: 'standard',
    })

    expect(removed.diffMarkup).toContain('<del class="diff-del">line 2</del>')
  })

  it('sends api_key and base_url as headers when streaming', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => 'application/json' },
      json: async () => ({
        streaming: true,
        events: [{ event: 'done', data: {} }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await streamWritingHelper(
      {
        content: 'draft',
        mode: 'rewrite',
        api_key: 'sk-test',
        base_url: 'https://api.test.com/v1',
      } as never,
      { onContent: vi.fn(), onDone: vi.fn(), onError: vi.fn() },
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-LLM-API-Key': 'sk-test',
          'X-LLM-Base-Url': 'https://api.test.com/v1',
        }),
      }),
    )
  })

  it('covers JSON stream validation guards and final-buffer SSE parsing', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          error: 'json payload error',
          streaming: true,
          events: [],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          streaming: true,
          events: [null],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          streaming: true,
          events: [{ event: 'mystery', data: {} }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'application/json' },
        json: async () => ({
          streaming: true,
          events: [{ event: 'done', data: null }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => createReader(['event: done\ndata: {}']),
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => 'text/event-stream' },
        body: {
          getReader: () => {
            const reads = [
              {
                done: false,
                value: new TextEncoder().encode('event: done'),
              },
              {
                done: true,
                value: undefined,
              },
            ]
            return {
              read: vi.fn(async () => reads.shift() ?? { done: true, value: undefined }),
            }
          },
        },
      })
    vi.stubGlobal('fetch', fetchMock)

    const onDone = vi.fn()
    const onError = vi.fn()

    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone, onError },
    )
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone, onError },
    )
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone, onError },
    )
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone, onError },
    )
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone, onError },
    )
    await streamWritingHelper(
      { content: 'draft', mode: 'rewrite' } as never,
      { onContent: vi.fn(), onDone, onError },
    )

    expect(onError).toHaveBeenNthCalledWith(1, 'json payload error')
    expect(onError).toHaveBeenNthCalledWith(2, 'Invalid writing stream payload')
    expect(onError).toHaveBeenNthCalledWith(3, 'Invalid writing stream payload')
    expect(onError).toHaveBeenNthCalledWith(4, 'Invalid writing stream payload')
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
