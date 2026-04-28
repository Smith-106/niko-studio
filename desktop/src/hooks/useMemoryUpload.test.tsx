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

describe('useMemoryUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('initializes with null upload status', () => {
    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    expect(result.current.uploadStatus).toBeNull()
    expect(result.current.fileInputRef.current).toBeNull()
  })

  it('openPicker triggers fileInputRef click', () => {
    const clickSpy = vi.fn()
    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    const mockInput = { click: clickSpy } as unknown as HTMLInputElement
    ;(result.current.fileInputRef as { current: HTMLInputElement | null }).current = mockInput

    act(() => {
      result.current.openPicker()
    })

    expect(clickSpy).toHaveBeenCalledOnce()
  })

  it('uploads single file successfully', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: true,
      data: {
        status: 'injected',
        file_name: 'notes.txt',
        session_id: 'conv-1',
        chunks: 5,
        memory_ids: ['m1'],
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

    const file = createFile('notes.txt', 'Hello world', 'text/plain')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(uploadMemoryFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        file_name: 'notes.txt',
        session_id: 'conv-1',
      }),
    )
    expect(result.current.uploadStatus?.stage).toBe('done')
    expect(result.current.uploadStatus?.type).toBe('success')
  })

  it('shows error for unsupported file format in single file mode', async () => {
    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    const file = createFile('image.png', 'binary data', 'image/png')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(uploadMemoryFileMock).not.toHaveBeenCalled()
    expect(result.current.uploadStatus?.stage).toBe('error')
    expect(result.current.uploadStatus?.errorCategory).toBe('format')
  })

  it('skips unsupported files in multi-file mode', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: true,
      data: {
        status: 'injected',
        file_name: 'notes.txt',
        session_id: 'conv-1',
        chunks: 3,
        memory_ids: [],
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

    const validFile = createFile('notes.txt', 'text', 'text/plain')
    const invalidFile = createFile('bad.exe', 'binary', 'application/octet-stream')
    const event = createChangeEvent([validFile, invalidFile])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(uploadMemoryFileMock).toHaveBeenCalledOnce()
    expect(result.current.uploadStatus?.stage).toBe('done')
  })

  it('shows size error when upload fails with 413', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      error: '413 Payload Too Large',
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

    const file = createFile('large.txt', 'big content', 'text/plain')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(result.current.uploadStatus?.stage).toBe('error')
    expect(result.current.uploadStatus?.errorCategory).toBe('size')
  })

  it('shows network error for fetch failures', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      error: 'failed to fetch',
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

    const file = createFile('notes.txt', 'text', 'text/plain')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(result.current.uploadStatus?.errorCategory).toBe('network')
  })

  it('shows parser prerequisite error when backend returns structured parser metadata', async () => {
    uploadMemoryFileMock.mockResolvedValue({
      success: false,
      error: 'mammoth is required for DOCX support. Install with: npm install mammoth',
      errorData: {
        error: 'mammoth is required for DOCX support. Install with: npm install mammoth',
        error_code: 'PARSER_PREREQUISITE_MISSING',
        file_name: 'notes.docx',
        file_type: 'docx',
        mode: 'async',
        parser: 'mammoth',
        dependency: 'mammoth',
        install_command: 'npm install mammoth',
        detail: 'DOCX parsing is enabled by configuration, but the required parser dependency is not installed or not loadable.',
        action: 'Install mammoth in the src-ts runtime environment and retry the upload.',
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

    const file = createFile('notes.docx', 'binary data', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(result.current.uploadStatus?.stage).toBe('error')
    expect(result.current.uploadStatus?.errorCategory).toBe('prerequisite')
    expect(result.current.uploadStatus?.message).toContain('Parser prerequisite error')
    expect(result.current.uploadStatus?.message).toContain('Install mammoth in the src-ts runtime environment and retry the upload.')
  })

  it('creates conversation when currentConversationId is null', async () => {
    const createConversationMock = vi.fn()
    const getCurrentConversationIdMock = vi.fn(() => 'conv-new')

    uploadMemoryFileMock.mockResolvedValue({
      success: true,
      data: {
        status: 'injected',
        file_name: 'notes.txt',
        session_id: 'conv-new',
        chunks: 1,
        memory_ids: [],
      },
    })

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: null,
        createConversation: createConversationMock,
        getCurrentConversationId: getCurrentConversationIdMock,
      }),
    )

    const file = createFile('notes.txt', 'text', 'text/plain')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(createConversationMock).toHaveBeenCalled()
    expect(uploadMemoryFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        session_id: 'conv-new',
      }),
    )
  })

  it('handles empty file list gracefully', async () => {
    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: 'conv-1',
        createConversation: vi.fn(),
        getCurrentConversationId: () => 'conv-1',
      }),
    )

    const event = createChangeEvent([])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(uploadMemoryFileMock).not.toHaveBeenCalled()
    expect(result.current.uploadStatus).toBeNull()
  })

  it('shows service error when session creation fails', async () => {
    const createConversationMock = vi.fn()
    const getCurrentConversationIdMock = vi.fn(() => null)

    const { result } = renderHook(() =>
      useMemoryUpload({
        t: defaultT,
        translate: defaultTranslate,
        currentConversationId: null,
        createConversation: createConversationMock,
        getCurrentConversationId: getCurrentConversationIdMock,
      }),
    )

    const file = createFile('notes.txt', 'text', 'text/plain')
    const event = createChangeEvent([file])

    await act(async () => {
      await result.current.handleFileUpload(event)
    })

    expect(result.current.uploadStatus?.stage).toBe('error')
    expect(result.current.uploadStatus?.errorCategory).toBe('service')
  })
})
