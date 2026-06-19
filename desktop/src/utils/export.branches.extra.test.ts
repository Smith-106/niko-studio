import { describe, expect, it, vi } from 'vitest'

// Mock downloadBlob so no real file I/O happens
vi.mock('./download', () => ({
  downloadBlob: vi.fn(),
}))

// Mock URL globals for Blob handling
vi.stubGlobal('URL', {
  createObjectURL: vi.fn(() => 'blob:mock'),
  revokeObjectURL: vi.fn(),
})

import { exportToMarkdown, exportToHtml } from './export'
import { downloadBlob } from './download'

const mockedDownloadBlob = vi.mocked(downloadBlob)

describe('export.ts branch coverage — ?? [] fallbacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // These tests exercise the `?? []` fallback branch where node.content is null/undefined.
  // We only verify that the function executes without throwing and calls downloadBlob.
  // The branch coverage is achieved by executing the code paths.

  // Line 27: heading without content → ?? [] fallback
  it('handles heading node with undefined content in markdown', () => {
    const json = { type: 'doc', content: [{ type: 'heading', attrs: { level: 2 } }] as unknown[] }
    expect(() => exportToMarkdown(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 45: bulletList without content → ?? [] fallback
  it('handles bulletList node with undefined content in markdown', () => {
    const json = { type: 'doc', content: [{ type: 'bulletList' }] as unknown[] }
    expect(() => exportToMarkdown(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 48: orderedList without content → ?? [] fallback
  it('handles orderedList node with undefined content in markdown', () => {
    const json = { type: 'doc', content: [{ type: 'orderedList' }] as unknown[] }
    expect(() => exportToMarkdown(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 59: codeBlock without content → ?? [] fallback
  it('handles codeBlock node with undefined content in markdown', () => {
    const json = { type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 'js' } }] as unknown[] }
    expect(() => exportToMarkdown(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 69: table without content → ?? [] fallback
  it('handles table node with undefined content in markdown', () => {
    const json = { type: 'doc', content: [{ type: 'table' }] as unknown[] }
    expect(() => exportToMarkdown(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 89: tableCell/tableHeader without content → ?? [] fallback
  it('handles tableCell/tableHeader with undefined content in markdown', () => {
    const json = {
      type: 'doc',
      content: [{
        type: 'table',
        content: [{
          type: 'tableRow',
          content: [
            { type: 'tableHeader' },
            { type: 'tableCell' },
          ],
        }],
      }],
    }
    expect(() => exportToMarkdown(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 123: doc HTML without content → ?? [] fallback
  it('handles doc node with undefined content in HTML', () => {
    const json = { type: 'doc' }
    expect(() => exportToHtml(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 166: codeBlock HTML without content → ?? [] fallback
  it('handles codeBlock node with undefined content in HTML', () => {
    const json = { type: 'doc', content: [{ type: 'codeBlock', attrs: { language: 'ts' } }] as unknown[] }
    expect(() => exportToHtml(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })

  // Line 176: table HTML without content → ?? [] fallback
  it('handles table node with undefined content in HTML', () => {
    const json = { type: 'doc', content: [{ type: 'table' }] as unknown[] }
    expect(() => exportToHtml(json)).not.toThrow()
    expect(mockedDownloadBlob).toHaveBeenCalledTimes(1)
  })
})
