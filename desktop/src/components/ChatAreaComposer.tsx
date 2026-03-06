import type { RefObject } from 'react'
import { Mic, Paperclip, Send } from 'lucide-react'

interface ChatAreaComposerProps {
  input: string
  isLoading: boolean
  sendDisabled: boolean
  inputPlaceholder: string
  uploadLabel: string
  voiceInputLabel: string
  sendLabel: string
  cancelLabel: string
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
  fileInputRef,
  onInputChange,
  onKeyDown,
  onFileUpload,
  onOpenFilePicker,
  onCancelStream,
  onSend,
}: ChatAreaComposerProps) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1 relative">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder={inputPlaceholder}
          className="w-full px-4 py-3 pr-20 border border-gray-300 dark:border-dark-border dark:bg-dark-surface dark:text-dark-text rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={1}
          style={{ minHeight: '48px', maxHeight: '200px' }}
        />
        <div className="absolute right-2 bottom-2 flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.pdf,.docx"
            onChange={onFileUpload}
            className="hidden"
          />
          <button
            onClick={onOpenFilePicker}
            aria-label={uploadLabel}
            title={uploadLabel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
            type="button"
          >
            <Paperclip size={18} />
          </button>
          <button
            aria-label={voiceInputLabel}
            title={voiceInputLabel}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text transition-colors"
            type="button"
          >
            <Mic size={18} />
          </button>
        </div>
      </div>
      {isLoading ? (
        <button
          onClick={onCancelStream}
          className="px-4 py-3 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors"
          type="button"
        >
          {cancelLabel}
        </button>
      ) : (
        <button
          onClick={onSend}
          aria-label={sendLabel}
          title={sendLabel}
          disabled={sendDisabled}
          className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          type="button"
        >
          <Send size={20} />
        </button>
      )}
    </div>
  )
}
