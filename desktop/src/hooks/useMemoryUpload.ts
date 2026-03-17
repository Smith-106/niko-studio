import { useCallback, useRef, useState } from 'react'
import { uploadMemoryFile } from '../api/client'

type UploadStage = 'reading' | 'uploading' | 'injecting' | 'done' | 'error'

type UploadErrorCategory = 'format' | 'size' | 'network' | 'service'

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
    uploadErrorService: string
  }
  translate: (key: 'uploadInjectedChunks' | 'uploadInjectedContext', vars: { fileName: string; chunks: number }) => string
  currentConversationId: string | null
  createConversation: () => void
  getCurrentConversationId: () => string | null
  addMessage: (role: 'user' | 'assistant', content: string) => void
}

export function useMemoryUpload({
  t,
  translate,
  currentConversationId,
  createConversation,
  getCurrentConversationId,
  addMessage,
}: UseMemoryUploadOptions) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const classifyUploadError = (errorMessage: string | undefined): UploadErrorCategory => {
    const text = (errorMessage || '').toLowerCase()
    if (text.includes('413') || text.includes('payload') || text.includes('too large') || text.includes('size')) {
      return 'size'
    }
    if (text.includes('network') || text.includes('fetch') || text.includes('timeout') || text.includes('failed to fetch')) {
      return 'network'
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
    return t.uploadErrorService
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
    const file = event.target.files?.[0]
    event.target.value = ''

    if (!file) {
      return
    }

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
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!extension || !allowedExtensions.includes(extension)) {
      setUploadStage('error', t.uploadUnsupportedFormat, 100, 'format')
      return
    }

    setUploadStage('reading', t.uploadStageReading, 20)

    try {
      const buffer = await file.arrayBuffer()
      const bytes = new Uint8Array(buffer)
      let binary = ''
      for (let index = 0; index < bytes.length; index += 1) {
        binary += String.fromCharCode(bytes[index])
      }
      const fileContentBase64 = btoa(binary)

      setUploadStage('uploading', t.uploadStageUploading, 60)
      const response = await uploadMemoryFile({
        file_name: file.name,
        file_content_base64: fileContentBase64,
        session_id: uploadSessionId,
      })

      if (!response.success || !response.data) {
        const category = classifyUploadError(response.error)
        const message = response.error
          ? `${getUploadErrorMessage(category)} (${response.error})`
          : getUploadErrorMessage(category)
        setUploadStage('error', message, 100, category)
        return
      }

      setUploadStage('injecting', t.uploadStageInjecting, 85)
      setUploadStage(
        'done',
        translate('uploadInjectedChunks', { fileName: file.name, chunks: response.data.chunks }),
        100
      )
      addMessage('assistant', translate('uploadInjectedContext', { fileName: file.name, chunks: response.data.chunks }))
    } catch (error) {
      const category = classifyUploadError(error instanceof Error ? error.message : undefined)
      const baseMessage = getUploadErrorMessage(category)
      const detail = error instanceof Error ? error.message : ''
      const message = detail ? `${baseMessage} (${detail})` : baseMessage
      setUploadStage('error', message, 100, category)
    }
  }, [addMessage, createConversation, currentConversationId, getCurrentConversationId, t, translate])

  return {
    uploadStatus,
    setUploadStatus,
    fileInputRef,
    openPicker,
    handleFileUpload,
  }
}
