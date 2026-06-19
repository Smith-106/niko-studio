import { act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useMemoryUpload } from './useMemoryUpload'

const uploadMemoryFileMock = vi.hoisted(() => vi.fn())

vi.mock('../api/client', () => ({
  uploadMemoryFile: uploadMemoryFileMock,
}))

const defaultT = {
  sessionCreateFailedRetry: 'Failed to create session',
  uploadUnsupportedFormat: 'Unsupported format',
  uploadStageReading: 'Reading file...',
  uploadStageUploading: 'Uploading...',
  uploadStageInjecting: 'Injecting...',
  uploadErrorFormat: 'Format error',
  uploadErrorSize: 'Size error',
  uploadErrorNetwork: 'Network error',
  uploadErrorPrerequisite: 'Parser prerequisite error',
  uploadErrorService: 'Service error',
  uploadMultipleProgress: 'Uploading {current}/{total}...',
  uploadMultipleComplete: 'Done: {success}/{total}',
}

const defaultTranslate = (key: string, vars: Record<string, unknown>) => {
  const template = {
    uploadInjectedChunks: 'Injected {chunks} chunks from {fileName}',
    uploadMultipleProgress: 'Uploading {current}/{total}...',
    uploadMultipleComplete: 'Complete: {success}/{total}',
  }[key] ?? key
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''))
}

function createFile(name: string, content: string, type = 'text/plain'): File {
  const encoder = new TextEncoder()
  const bytes = encoder.encode(content)
  const file = new File([bytes], name, { type })
  if (typeof file.arrayBuffer !== 'function') {
    file.arrayBuffer = () => Promise.resolve(bytes.buffer as ArrayBuffer)
  }
  return file
}

function createChangeEvent(files: File[]): React.ChangeEvent<HTMLInputElement> {
  return {
    target: {
      files,
      value: '',
    },
  } as unknown as React.ChangeEvent<HTMLInputElement>
}

describe('useMemoryUpload extra branch coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Line 65: error_code === 'ASYNC_PARSER_REQUIRED'
  it('classifies ASYNC_PARSER_REQUIRED as prerequisite', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      error: 'async parser required',
      errorData: {
        error_code: 'ASYNC_PARSER_REQUIRED',
        detail: 'Async parser is required for this file.',
      },
    })

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    await act(async () => {
      await result.current.handleFileUpload(createChangeEvent([createFile('notes.txt', 'text')]))
    })

    expect(result.current.uploadStatus?.errorCategory).toBe('prerequisite')
    expect(result.current.uploadStatus?.message).toContain('Async parser is required')
  })

  // Line 98: errorData.action missing (short-circuit) and line 101: errorMessage ?? ''
  it('formats error detail without action and falls back when errorMessage is undefined', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      // 不传入 error 字段，触发 errorMessage undefined 的 ?? '' 分支
      errorData: {
        detail: 'Missing dependency',
        // action 字段故意省略，触发 errorData.action 短路
      },
    })

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    await act(async () => {
      await result.current.handleFileUpload(createChangeEvent([createFile('notes.txt', 'text')]))
    })

    expect(result.current.uploadStatus?.message).toBe('Service error (Missing dependency)')
  })

  // Line 101: errorMessage truthy branch of ?? '' when detail is absent
  it('returns plain errorMessage when errorData detail is absent', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      error: 'plain error',
      errorData: {
        // detail 省略
      },
    })

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    await act(async () => {
      await result.current.handleFileUpload(createChangeEvent([createFile('notes.txt', 'text')]))
    })

    expect(result.current.uploadStatus?.message).toBe('Service error (plain error)')
  })

  // Line 101: errorMessage nullish fallback of ?? '' when both detail and error are absent
  it('falls back to empty detail when errorData and error are absent', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      errorData: {},
    })

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    await act(async () => {
      await result.current.handleFileUpload(createChangeEvent([createFile('notes.txt', 'text')]))
    })

    expect(result.current.uploadStatus?.message).toBe('Service error')
  })

  // Lines 192, 194, 195: catch block with non-Error throw and empty detail
  it('handles non-Error throws and empty error messages in catch block', async () => {
    uploadMemoryFileMock.mockRejectedValue('plain string error')

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    await act(async () => {
      await result.current.handleFileUpload(createChangeEvent([createFile('notes.txt', 'text')]))
    })

    expect(result.current.uploadStatus?.errorCategory).toBe('service')
    expect(result.current.uploadStatus?.message).toBe('Service error')
  })

  it('handles Error with empty message in catch block', async () => {
    uploadMemoryFileMock.mockRejectedValue(new Error(''))

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    await act(async () => {
      await result.current.handleFileUpload(createChangeEvent([createFile('notes.txt', 'text')]))
    })

    expect(result.current.uploadStatus?.message).toBe('Service error')
  })
})
