import { useEffect, useMemo, useState } from 'react'
import { processWritingHelper, polishContent, type WritingHelperMode } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n } from '../i18n'

interface WritingHelperPanelDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}

interface WritingHelperPanelProps {
  onClose: () => void
  onOpenSettings: () => void
  draftState?: WritingHelperPanelDraftState
  onDraftStateChange?: (draft: WritingHelperPanelDraftState) => void
  onClearDraft?: () => void
}

const MODE_OPTIONS: Array<{ value: WritingHelperMode; label: string }> = [
  { value: 'polish', label: '润色（polish）' },
  { value: 'rewrite', label: '改写（rewrite）' },
  { value: 'expand', label: '扩写（expand）' },
  { value: 'summarize', label: '摘要（summarize）' },
  { value: 'outline', label: '提纲（outline）' },
]

export function WritingHelperPanel({ onClose, onOpenSettings, draftState, onDraftStateChange, onClearDraft }: WritingHelperPanelProps) {
  const detectionEvasionGuardEnabled = useSettingsStore((state) => state.settings.detectionEvasionGuardEnabled)
  const useLegacyPolish = useSettingsStore((state) => state.settings.writingHelperUseLegacyPolish)
  const updateSettings = useSettingsStore((state) => state.updateSettings)
  const { t, translate } = useI18n()
  const [content, setContent] = useState(draftState?.content ?? '')
  const [mode, setMode] = useState<WritingHelperMode>(draftState?.mode ?? 'polish')
  const [maxSentences, setMaxSentences] = useState(draftState?.maxSentences ?? 3)
  const [maxItems, setMaxItems] = useState(draftState?.maxItems ?? 6)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ processedText?: string; outline?: string[]; mode?: string } | null>(null)

  useEffect(() => {
    onDraftStateChange?.({ content, mode, maxSentences, maxItems })
  }, [content, mode, maxSentences, maxItems, onDraftStateChange])

  const buttonDisabled = useMemo(() => loading || !content.trim(), [loading, content])

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      if (mode === 'polish' && useLegacyPolish) {
        const legacyResponse = await polishContent({
          originalText: content,
          polishType: 'standard',
        })

        if (legacyResponse.error) {
          setError(legacyResponse.error)
          return
        }

        setResult({
          mode: 'polish',
          processedText: legacyResponse.polishedText,
        })
        return
      }

      const response = await processWritingHelper({
        content,
        mode,
        max_sentences: maxSentences,
        max_items: maxItems,
        detection_evasion_guard_enabled: detectionEvasionGuardEnabled,
      })

      if (!response.success || !response.data) {
        setError(response.error || t.writingHelperFailed)
        return
      }

      setResult({
        mode: response.data.mode,
        processedText: response.data.processed_text,
        outline: Array.isArray(response.data.outline) ? response.data.outline : undefined,
      })
    } catch (submitError) {
      setError(String(submitError))
    } finally {
      setLoading(false)
    }
  }

  const handleClearDraft = () => {
    setContent('')
    setMode('polish')
    setMaxSentences(3)
    setMaxItems(6)
    setError(null)
    setResult(null)
    onClearDraft?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-dark-border">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-800 dark:text-dark-text">Writing Helper</h2>
            <span
              className={`px-2 py-0.5 text-[11px] rounded-full ${
                detectionEvasionGuardEnabled
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
              }`}
            >
              {translate('writingHelperGuardStatus', {
                status: detectionEvasionGuardEnabled ? t.writingHelperGuardOn : t.writingHelperGuardOff,
              })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 text-xs rounded bg-gray-100 dark:bg-dark-border dark:text-dark-text"
          >
            {t.writingHelperClose}
          </button>
        </div>

        <div className="p-4 pb-0">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] text-gray-500 dark:text-dark-text-secondary">
              {t.writingHelperHint}
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[11px] text-gray-600 dark:text-dark-text-secondary">
                <input
                  type="checkbox"
                  checked={useLegacyPolish}
                  onChange={(event) => updateSettings({ writingHelperUseLegacyPolish: event.target.checked })}
                />
                {t.writingHelperLegacyPolish}
              </label>
              <button
                onClick={onOpenSettings}
                className="px-2 py-1 text-[11px] rounded bg-gray-100 hover:bg-gray-200 dark:bg-dark-border dark:hover:bg-gray-600 dark:text-dark-text"
              >
                {t.writingHelperOpenSettings}
              </button>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
              模式
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as WritingHelperMode)}
                className="px-2 py-2 rounded border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm"
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
              最大句数（摘要）
              <input
                type="number"
                min={1}
                value={maxSentences}
                onChange={(event) => setMaxSentences(Number(event.target.value) || 1)}
                className="px-2 py-2 rounded border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm"
              />
            </label>

            <label className="text-xs text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
              最大条目（提纲）
              <input
                type="number"
                min={1}
                value={maxItems}
                onChange={(event) => setMaxItems(Number(event.target.value) || 1)}
                className="px-2 py-2 rounded border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm"
              />
            </label>
          </div>

          <label className="text-xs text-gray-600 dark:text-dark-text-secondary flex flex-col gap-1">
            输入文本
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={8}
              placeholder="请输入待处理文本"
              className="w-full px-3 py-2 rounded border border-gray-300 dark:border-dark-border bg-white dark:bg-dark-bg text-sm"
            />
          </label>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSubmit}
              disabled={buttonDisabled}
              className="px-3 py-2 text-sm rounded bg-blue-600 text-white disabled:bg-blue-300"
            >
              {loading ? t.writingHelperRunning : t.writingHelperRun}
            </button>
            <button
              onClick={handleClearDraft}
              disabled={loading}
              className="px-3 py-2 text-sm rounded bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:text-gray-400 dark:bg-dark-border dark:hover:bg-gray-600 dark:text-dark-text"
            >
              {t.writingHelperClearDraft}
            </button>
            {error && <span className="text-xs text-red-600">{error}</span>}
          </div>

          {result && (
            <div className="rounded border border-gray-200 dark:border-dark-border p-3 bg-gray-50 dark:bg-dark-bg">
              <div className="text-xs text-gray-500 dark:text-dark-text-secondary mb-2">{translate('writingHelperModePrefix', { mode: result.mode ?? '' })}</div>
              {result.processedText && (
                <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-dark-text">{result.processedText}</pre>
              )}
              {result.outline && result.outline.length > 0 && (
                <ul className="list-disc pl-5 text-sm text-gray-800 dark:text-dark-text space-y-1">
                  {result.outline.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
