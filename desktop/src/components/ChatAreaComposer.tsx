import type { RefObject } from 'react'
import { MicOff, Paperclip, Send, Square } from 'lucide-react'

interface ChatAreaComposerProps {
  input: string
  isLoading: boolean
  sendDisabled: boolean
  inputPlaceholder: string
  uploadLabel: string
  voiceInputLabel: string
  sendLabel: string
  cancelLabel: string
  sendShortcutLabel: string
  sendShortcutHint: string
  fileInputRef: RefObject<HTMLInputElement>
  onInputChange: (value: string) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onFileUpload: (event: React.ChangeEvent<HTMLInputElement>) => void
  onOpenFilePicker: () => void
  onCancelStream: () => void
  onSend: () => void
}

export function ChatAreaComposer({
  input,
  isLoading,
  sendDisabled,
  inputPlaceholder,
  uploadLabel,
  voiceInputLabel,
  sendLabel,
  cancelLabel,
  sendShortcutLabel,
  sendShortcutHint,
  fileInputRef,
  onInputChange,
  onKeyDown,
  onFileUpload,
  onOpenFilePicker,
  onCancelStream,
  onSend,
}: ChatAreaComposerProps) {
  return (
    <div className="flex items-end gap-3">
      <div className="flex-1 rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm dark:border-dark-border dark:bg-dark-surface">
        <div className="relative">
          <textarea
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder={inputPlaceholder}
            className="w-full resize-none border-0 bg-transparent px-1 py-1 pr-24 text-sm text-gray-900 focus:outline-none focus:ring-0 dark:text-dark-text"
            rows={1}
            style={{ minHeight: '48px', maxHeight: '200px' }}
          />
          <div className="absolute right-0 bottom-0 flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,.docx"
              multiple
              onChange={onFileUpload}
              className="hidden"
            />
            <button
              onClick={onOpenFilePicker}
              aria-label={uploadLabel}
              title={uploadLabel}
              className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-dark-bg dark:hover:text-dark-text"
              type="button"
            >
              <Paperclip size={18} />
            </button>
            <button
              aria-label={voiceInputLabel}
              title={voiceInputLabel}
              className="cursor-not-allowed rounded-lg p-2 text-gray-300 dark:text-gray-600"
              type="button"
              disabled
            >
              <MicOff size={18} />
            </button>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3 px-1">
          <span className="text-xs text-gray-500 dark:text-dark-text-secondary">
            {sendShortcutLabel}: {sendShortcutHint}
          </span>
          <span className="text-xs text-gray-400 dark:text-dark-text-secondary">
            {isLoading ? cancelLabel : sendLabel}
          </span>
        </div>
      </div>
      {isLoading ? (
        <button
          onClick={onCancelStream}
          aria-label={cancelLabel}
          title={cancelLabel}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-600 text-white transition-colors hover:bg-rose-700"
          type="button"
        >
          <Square size={18} />
        </button>
      ) : (
        <button
          onClick={onSend}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={sendDisabled}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <Send size={20} />
        </button>
      )}
    </div>
  )
}
