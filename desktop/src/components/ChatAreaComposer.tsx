import { useState, useEffect, useCallback } from 'react'
import type { RefObject } from 'react'
import { BookmarkPlus, Check, Copy, MicOff, Paperclip, Send, Square, Trash2, X } from 'lucide-react'

interface ChatAreaComposerProps {
  input: string
  isLoading: boolean
  sendDisabled: boolean
  inputPlaceholder: string
  uploadLabel: string
  voiceInputLabel: string
  voiceInputStatusLabel: string
  sendLabel: string
  cancelLabel: string
  sendShortcutLabel: string
  sendShortcutHint: string
  fileInputRef: RefObject<HTMLInputElement>
  inputRef: RefObject<HTMLTextAreaElement>
  onInputChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onOpenFilePicker: () => void
  onCancelStream: () => void
  onSend: () => void
  onToggleKnowledgePanel?: () => void
  onClearDraft?: () => void
  lastAssistantContent?: string
}

export function ChatAreaComposer({
  input,
  isLoading,
  sendDisabled,
  inputPlaceholder,
  uploadLabel,
  voiceInputLabel,
  voiceInputStatusLabel,
  sendLabel,
  cancelLabel,
  sendShortcutHint,
  fileInputRef,
  inputRef,
  onInputChange,
  onKeyDown,
  onFileUpload,
  onOpenFilePicker,
  onCancelStream,
  onSend,
  onToggleKnowledgePanel,
  onClearDraft,
  lastAssistantContent,
}: ChatAreaComposerProps) {
  const [copied, setCopied] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<File[]>([])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const files = Array.from(e.dataTransfer.files).filter((f) => {
      const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
      return ['.txt', '.md', '.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.gif'].some((a) => ext === a.slice(1))
    })
    if (files.length > 0) {
      setPendingFiles((prev) => [...prev, ...files])
    }
  }, [])

  const removeFile = useCallback((index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
  }, [])

  const copyLastReply = () => {
    if (!lastAssistantContent) return
    navigator.clipboard?.writeText(lastAssistantContent).then(() => {
      setCopied(true)
    }).catch(() => {})
  }

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(id)
  }, [copied])

  return (
    <div className="flex items-end gap-3 mt-4">
      <div
        className={`flex-1 rounded-2xl border bg-white px-4 py-3 shadow-sm dark:bg-dark-surface focus-within:ring-1 focus-within:ring-primary-500/50 transition-all relative ${isDragging ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-gray-200 dark:border-dark-border'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-primary-50/80 dark:bg-primary-900/20 pointer-events-none">
            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">Drop files here</span>
          </div>
        )}
        <textarea
          id="chat-composer-input"
          name="chat-composer-input"
          ref={inputRef}
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          aria-label={inputPlaceholder}
          placeholder={inputPlaceholder}
          className="w-full resize-none border-0 bg-transparent py-1 text-[15px] leading-relaxed text-gray-900 focus:outline-none focus:ring-0 dark:text-dark-text custom-scrollbar"
          rows={Math.min(8, Math.max(3, input.split('\n').length))}
          style={{ minHeight: '72px', maxHeight: '200px' }}
        />
        {pendingFiles.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {pendingFiles.map((file, i) => (
              <span key={`${file.name}-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-dark-border text-gray-700 dark:text-dark-text">
                <Paperclip size={10} />
                {file.name}
                <button
                  onClick={() => removeFile(i)}
                  className="ml-0.5 rounded-full hover:bg-gray-200 dark:hover:bg-dark-bg"
                  aria-label={`remove ${file.name}`}
                  type="button"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex items-center justify-between gap-2 px-1 border-t border-gray-100 dark:border-dark-border/50 pt-2">
          <div className="flex items-center gap-1">
            <input
              id="chat-composer-upload-input"
              name="chat-composer-upload-input"
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              multiple
              aria-label={uploadLabel}
              onChange={onFileUpload}
              className="hidden"
            />
            <button
              onClick={onOpenFilePicker}
              aria-label={uploadLabel}
              title={uploadLabel}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-bg dark:hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
              type="button"
            >
              <Paperclip size={15} />
            </button>
            {onToggleKnowledgePanel && (
              <button
                onClick={onToggleKnowledgePanel}
                aria-label="attach context"
                title="attach context"
                className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-bg dark:hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                type="button"
              >
                <BookmarkPlus size={15} />
              </button>
            )}
            {onClearDraft && (
              <button
                onClick={onClearDraft}
                aria-label="clear draft"
                tabIndex={input.length === 0 ? -1 : undefined}
                title="clear draft"
                className={`rounded-lg p-1.5 text-gray-400 transition-all hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-bg dark:hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${input.length > 0 ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                type="button"
              >
                <Trash2 size={15} />
              </button>
            )}
            {lastAssistantContent && (
              <>
                <button
                  onClick={copyLastReply}
                  aria-label={copied ? 'copied!' : 'copy last reply'}
                  title="copy last reply"
                  className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-bg dark:hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                  type="button"
                >
                  {copied ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
                {copied !== undefined && <span role="status" className="sr-only">{copied ? 'Copied!' : ''}</span>}
              </>
            )}
            <div
              role="status"
              aria-label={`${voiceInputLabel}: ${voiceInputStatusLabel}`}
              title={`${voiceInputLabel}: ${voiceInputStatusLabel}`}
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] text-gray-400 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text-muted"
            >
              <MicOff size={11} />
            </div>
          </div>
          <span className="text-[10px] text-gray-400 dark:text-dark-text-muted shrink-0">
            {sendShortcutHint}
          </span>
        </div>
      </div>
      {isLoading ? (
        <button
          onClick={onCancelStream}
          aria-label={cancelLabel}
          title={cancelLabel}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-danger-500 text-white transition-all hover:bg-danger-600 active:scale-95 shadow-sm"
          type="button"
        >
          <Square size={18} className="fill-current" />
        </button>
      ) : (
        <button
          onMouseDown={(e) => {
            e.preventDefault()
            if (!sendDisabled) onSend()
          }}
          onClick={onSend}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={sendDisabled}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white transition-colors hover:bg-primary-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 shadow-sm cursor-pointer"
          type="button"
        >
          <Send size={18} className="ml-0.5" />
        </button>
      )}
    </div>
  )
}

