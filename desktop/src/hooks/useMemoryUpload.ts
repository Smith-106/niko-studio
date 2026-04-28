import { useCallback, useRef, useState } from 'react'
import { type MemoryUploadErrorResponse, uploadMemoryFile } from '../api/client'

const BASE64_CHUNK_SIZE = 0x8000

type UploadStage = 'reading' | 'uploading' | 'injecting' | 'done' | 'error'

type UploadErrorCategory = 'format' | 'size' | 'network' | 'prerequisite' | 'service'

interface UploadStatus {
  type: 'error' | 'success' | 'info'
  stage: UploadStage
  progress: number
  message: string
  errorCategory?: UploadErrorCategory
}

interface UseMemoryUploadOptions {
  t: {
    sessionCreateFailedRetry: string
    uploadUnsupportedFormat: string
    uploadStageReading: string
    uploadStageUploading: string
    uploadStageInjecting: string
    uploadErrorFormat: string
    uploadErrorSize: string
    uploadErrorNetwork: string
    uploadErrorPrerequisite: string
    uploadErrorService: string
    uploadMultipleProgress: string
    uploadMultipleComplete: string
  }
  translate: (key: 'uploadInjectedChunks' | 'uploadMultipleProgress' | 'uploadMultipleComplete', vars: { fileName?: string; chunks?: number; current?: number; total?: number; success?: number }) => string
  currentConversationId: string | null
  createConversation: () => void
  getCurrentConversationId: () => string | null
}

// Encode binary data in fixed-size chunks so large uploads avoid repeated
// string reallocation from per-byte concatenation in the render thread.
function toBase64(bytes: Uint8Array): string {
  let binary = ''

  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_SIZE))
  }

  return btoa(binary)
}

export function useMemoryUpload({
  t,
  translate,
  currentConversationId,
  createConversation,
  getCurrentConversationId,
}: UseMemoryUploadOptions) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const classifyUploadError = (
    errorMessage: string | undefined,
    errorData?: MemoryUploadErrorResponse,
  ): UploadErrorCategory => {
    if (errorData?.error_code === 'PARSER_PREREQUISITE_MISSING' || errorData?.error_code === 'ASYNC_PARSER_REQUIRED') {
      return 'prerequisite'
    }

    const text = (errorMessage || '').toLowerCase()
    if (text.includes('413') || text.includes('payload') || text.includes('too large') || text.includes('size')) {
      return 'size'
    }
    if (text.includes('network') || text.includes('fetch') || text.includes('timeout') || text.includes('failed to fetch')) {
      return 'network'
    }
    if (text.includes('parser') || text.includes('dependency') || text.includes('install with: npm install')) {
      return 'prerequisite'
    }
    if (text.includes('format') || text.includes('extension') || text.includes('unsupported')) {
      return 'format'
    }
    return 'service'
  }

  const getUploadErrorMessage = (category: UploadErrorCategory): string => {
    if (category === 'format') return t.uploadErrorFormat
    if (category === 'size') return t.uploadErrorSize
    if (category === 'network') return t.uploadErrorNetwork
    if (category === 'prerequisite') return t.uploadErrorPrerequisite
    return t.uploadErrorService
  }

  const formatUploadErrorDetail = (
    errorMessage: string | undefined,
    errorData?: MemoryUploadErrorResponse,
  ): string => {
    if (errorData?.detail && errorData.detail.trim()) {
      const action = errorData.action && errorData.action.trim() ? ` ${errorData.action.trim()}` : ''
      return `${errorData.detail.trim()}${action}`
    }
    return errorMessage ?? ''
  }

  const setUploadStage = (stage: UploadStage, message: string, progress: number, errorCategory?: UploadErrorCategory) => {
    setUploadStatus({
      type: stage === 'error' ? 'error' : stage === 'done' ? 'success' : 'info',
      stage,
      progress,
      message,
      errorCategory,
    })
  }

  const openPicker = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    event.target.value = ''

    if (!files || files.length === 0) {
      return
    }

    const fileArray = Array.from(files)
    const totalFiles = fileArray.length

    let uploadSessionId = currentConversationId
    if (!uploadSessionId) {
      createConversation()
      uploadSessionId = getCurrentConversationId()
    }

    if (!uploadSessionId) {
      setUploadStage('error', t.sessionCreateFailedRetry, 100, 'service')
      return
    }

    const allowedExtensions = ['txt', 'md', 'pdf', 'docx']
    let successCount = 0
    let lastChunks = 0

    for (let index = 0; index < fileArray.length; index += 1) {
      const file = fileArray[index]
      const fileIndex = index + 1

      if (totalFiles > 1) {
        setUploadStage('reading', translate('uploadMultipleProgress', { current: fileIndex, total: totalFiles }), Math.round((fileIndex / totalFiles) * 100))
      } else {
        setUploadStage('reading', t.uploadStageReading, 20)
      }

      const extension = file.name.split('.').pop()?.toLowerCase()
      if (!extension || !allowedExtensions.includes(extension)) {
        if (totalFiles === 1) {
          setUploadStage('error', t.uploadUnsupportedFormat, 100, 'format')
          return
        }
        continue
      }

      try {
        const buffer = await file.arrayBuffer()
        const fileContentBase64 = toBase64(new Uint8Array(buffer))

        setUploadStage('uploading', totalFiles > 1 ? translate('uploadMultipleProgress', { current: fileIndex, total: totalFiles }) : t.uploadStageUploading, Math.round((fileIndex / totalFiles) * 60 + 20))
        const response = await uploadMemoryFile({
          file_name: file.name,
          file_content_base64: fileContentBase64,
          session_id: uploadSessionId,
        })

        if (!response.success || !response.data) {
          if (totalFiles === 1) {
            const category = classifyUploadError(response.error, response.errorData)
            const detail = formatUploadErrorDetail(response.error, response.errorData)
            const message = detail
              ? `${getUploadErrorMessage(category)} (${detail})`
              : getUploadErrorMessage(category)
            setUploadStage('error', message, 100, category)
            return
          }
          continue
        }

        lastChunks = response.data.chunks
        setUploadStage('injecting', t.uploadStageInjecting, Math.round((fileIndex / totalFiles) * 85 + 10))
        successCount += 1
      } catch (error) {
        if (totalFiles === 1) {
          const category = classifyUploadError(error instanceof Error ? error.message : undefined)
          const baseMessage = getUploadErrorMessage(category)
          const detail = error instanceof Error ? error.message : ''
          const message = detail ? `${baseMessage} (${detail})` : baseMessage
          setUploadStage('error', message, 100, category)
          return
        }
      }
    }

    if (totalFiles > 1) {
      setUploadStage('done', translate('uploadMultipleComplete', { success: successCount, total: totalFiles }), 100)
    } else if (successCount === 1) {
      setUploadStage('done', translate('uploadInjectedChunks', { fileName: fileArray[0].name, chunks: lastChunks }), 100)
    }
  }, [createConversation, currentConversationId, getCurrentConversationId, t, translate])

  return {
    uploadStatus,
    setUploadStatus,
    fileInputRef,
    openPicker,
    handleFileUpload,
  }
}
