import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from './download'

const originalCreateObjectURL = URL.createObjectURL
const originalRevokeObjectURL = URL.revokeObjectURL

describe('downloadBlob', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => 'blob:test-download'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(() => {}),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    if (originalCreateObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectURL,
      })
    } else {
      delete (URL as typeof URL & { createObjectURL?: typeof URL.createObjectURL }).createObjectURL
    }
    if (originalRevokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectURL,
      })
    } else {
      delete (URL as typeof URL & { revokeObjectURL?: typeof URL.revokeObjectURL }).revokeObjectURL
    }
    document.body.innerHTML = ''
  })

  it('creates a temporary anchor, clicks it, and cleans it up after the timeout', () => {
    const appendSpy = vi.spyOn(document.body, 'appendChild')
    const removeSpy = vi.spyOn(document.body, 'removeChild')
    const blob = new Blob(['hello world'], { type: 'text/plain' })

    downloadBlob(blob, 'draft.txt')

    const anchor = document.body.querySelector('a') as HTMLAnchorElement
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(appendSpy).toHaveBeenCalledWith(anchor)
    expect(anchor.getAttribute('href')).toBe('blob:test-download')
    expect(anchor.download).toBe('draft.txt')
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(100)

    expect(removeSpy).toHaveBeenCalledWith(anchor)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-download')
  })

  it('swallows teardown errors during deferred cleanup', () => {
    vi.spyOn(document.body, 'removeChild').mockImplementationOnce(() => {
      throw new Error('DOM already torn down')
    })

    expect(() => downloadBlob(new Blob(['bye']), 'broken.txt')).not.toThrow()
    expect(() => vi.advanceTimersByTime(100)).not.toThrow()
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()
  })
})
