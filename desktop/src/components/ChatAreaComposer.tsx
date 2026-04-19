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
  inputRef: RefObject<HTMLTextAreaElement>
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
  inputRef,
  onInputChange,
  onKeyDown,
  onFileUpload,
  onOpenFilePicker,
  onCancelStream,
  onSend,
}: ChatAreaComposerProps) {
  return (
    <div className="flex items-end gap-3 mt-4">
      <div className="flex-1 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm dark:border-dark-border dark:bg-dark-surface focus-within:ring-1 focus-within:ring-primary-500/50 transition-all">
        <div className="relative">
          <textarea
            id="chat-composer-input"
            name="chat-composer-input"
            ref={inputRef}
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={onKeyDown}
            aria-label={inputPlaceholder}
            placeholder={inputPlaceholder}
            className="w-full resize-none border-0 bg-transparent py-1 pr-24 text-[15px] leading-relaxed text-gray-900 focus:outline-none focus:ring-0 dark:text-dark-text custom-scrollbar"
            rows={Math.min(8, Math.max(1, input.split('\n').length))}
            style={{ minHeight: '28px', maxHeight: '200px' }}
          />
          <div className="absolute right-0 bottom-0 flex items-center gap-1 bg-white dark:bg-dark-surface">
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
        <div className="mt-2 flex items-center justify-between gap-3 px-1 border-t border-gray-100 dark:border-dark-border/50 pt-2">
          <span className="text-[11px] text-gray-400 dark:text-dark-text-muted">
            {sendShortcutLabel}: <kbd className="font-sans px-1 py-0.5 bg-gray-100 dark:bg-dark-bg rounded border border-gray-200 dark:border-dark-border">{sendShortcutHint}</kbd>
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
          onClick={onSend}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={sendDisabled}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-600 text-white transition-all hover:bg-primary-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 shadow-sm"
          type="button"
        >
          <Send size={18} className="ml-0.5" />
        </button>
      )}
    </div>
  )
}

