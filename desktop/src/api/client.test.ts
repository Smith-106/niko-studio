import { beforeEach, describe, expect, it, vi } from 'vitest'
import { chatStream, type ChatRequest } from './client'

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
    expect(onDone).toHaveBeenCalledWith({ status: 'completed', skills_used: ['a'] })
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

  it('calls onError when fetch throws', async () => {
    const onError = vi.fn()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new Error('AbortError')
    }))

    await chatStream(request, { onError })

    expect(onError).toHaveBeenCalled()
    consoleErrorSpy.mockRestore()
  })
})
