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

import { polishContentCompat } from './writing'

describe('writing branch-gap additional coverage', () => {
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

  // Lines 345-346: ternary false branches in generateDiffMarkup
  // when polished text has more lines than original (line 345 false branch: originalLine = '')
  it('generates diff markup when polished text has more lines than original', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'line1\nline2\nline3' },
    })

    const result = await polishContentCompat({
      originalText: 'line1\nline2',
      polishType: 'standard',
    })

    expect(result.polishedText).toBe('line1\nline2\nline3')
    // line3 is an addition — should be wrapped in <ins>
    expect(result.diffMarkup).toContain('<ins class="diff-add">line3</ins>')
  })

  // Lines 345-346: when original text has more lines than polished (line 346 false branch: polishedLine = '')
  it('generates diff markup when original text has more lines than polished', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: 'line1' },
    })

    const result = await polishContentCompat({
      originalText: 'line1\nline2\nline3',
      polishType: 'standard',
    })

    expect(result.polishedText).toBe('line1')
    // removed lines should be wrapped in <del>
    expect(result.diffMarkup).toContain('<del class="diff-del">line2</del>')
    expect(result.diffMarkup).toContain('<del class="diff-del">line3</del>')
  })

  // Line 413: response.data.processed_text || '' — the empty string fallback
  it('returns empty polishedText when API succeeds but processed_text is falsy', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: null },
    })

    const result = await polishContentCompat({
      originalText: 'some text',
      polishType: 'standard',
    })

    expect(result.polishedText).toBe('')
    // generateDiffMarkup runs with originalText and empty polishedText
    expect(result.diffMarkup).toContain('<del class="diff-del">some text</del>')
  })

  it('returns empty polishedText when API succeeds but processed_text is empty string', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: { processed_text: '' },
    })

    const result = await polishContentCompat({
      originalText: 'some text',
      polishType: 'standard',
    })

    expect(result.polishedText).toBe('')
    // generateDiffMarkup runs with originalText and empty string polishedText
    expect(result.diffMarkup).toContain('<del class="diff-del">some text</del>')
  })

  it('returns empty polishedText when API succeeds but processed_text is undefined', async () => {
    callApiMock.mockResolvedValue({
      success: true,
      data: {},
    })

    const result = await polishContentCompat({
      originalText: 'some text',
      polishType: 'standard',
    })

    expect(result.polishedText).toBe('')
    // generateDiffMarkup runs with originalText and empty string polishedText
    expect(result.diffMarkup).toContain('<del class="diff-del">some text</del>')
  })
})
