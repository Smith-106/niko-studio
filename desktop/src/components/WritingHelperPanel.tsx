import { useEffect, useMemo, useRef, useState } from 'react'
import { processWritingHelper, polishContent, type WritingHelperMode } from '../api/client'
import { useSettingsStore } from '../stores/settingsStore'
import { useI18n, type Translations } from '../i18n'
import { useDialogFocusTrap } from '../hooks/useDialogFocusTrap'

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

const MODE_OPTIONS: Array<{ value: WritingHelperMode; labelKey: keyof Translations }> = [
  { value: 'polish', labelKey: 'writingHelperModePolish' },
  { value: 'rewrite', labelKey: 'writingHelperModeRewrite' },
  { value: 'expand', labelKey: 'writingHelperModeExpand' },
  { value: 'summarize', labelKey: 'writingHelperModeSummarize' },
  { value: 'outline', labelKey: 'writingHelperModeOutline' },
]

export function WritingHelperPanel({ onClose, onOpenSettings, draftState, onDraftStateChange, onClearDraft }: WritingHelperPanelProps) {
  const dialogRef = useRef<HTMLDivElement | null>(null)
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
  const buttonDisabled = useMemo(() => loading || content.trim().length === 0, [loading, content])

  useEffect(() => {
    onDraftStateChange?.({ content, mode, maxSentences, maxItems })
  }, [content, mode, maxSentences, maxItems, onDraftStateChange])

  useDialogFocusTrap({
    containerRef: dialogRef,
    onClose,
  })

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
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in" role="dialog" aria-modal="true" aria-label={t.writingHelperTitle}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-3xl rounded-2xl bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border shadow-2xl overflow-hidden transform transition-all"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-dark-border/50 bg-slate-50 dark:bg-dark-surface2/50">
          <div className="flex items-center gap-3">
            <h2 className="text-[15px] font-semibold text-gray-800 dark:text-dark-text tracking-wide">{t.writingHelperTitle}</h2>
            <span
              className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border ${
                detectionEvasionGuardEnabled
                  ? 'bg-success-50 text-success-700 border-success-200 dark:bg-success-900/20 dark:text-success-400 dark:border-success-500/20'
                  : 'bg-warning-50 text-warning-700 border-warning-200 dark:bg-warning-900/20 dark:text-warning-400 dark:border-warning-500/20'
              }`}
            >
              {translate('writingHelperGuardStatus', {
                status: detectionEvasionGuardEnabled ? t.writingHelperGuardOn : t.writingHelperGuardOff,
              })}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-dark-text dark:hover:bg-dark-border rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            aria-label={t.writingHelperClose}
            title={t.writingHelperClose}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div className="p-6 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[11px] font-medium text-gray-500 dark:text-dark-text-muted">
              {t.writingHelperHint}
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-[11px] font-medium text-gray-600 dark:text-dark-text-secondary cursor-pointer hover:text-gray-800 dark:hover:text-dark-text transition-colors">
                <input
                  type="checkbox"
                  checked={useLegacyPolish}
                  onChange={(event) => updateSettings({ writingHelperUseLegacyPolish: event.target.checked })}
                  className="rounded text-primary-600 focus:ring-primary-500 bg-gray-50 border-gray-300 dark:bg-dark-bg dark:border-dark-border"
                />
                {t.writingHelperLegacyPolish}
              </label>
              <button
                onClick={onOpenSettings}
                className="px-3 py-1.5 text-[11px] font-medium rounded-md bg-white dark:bg-dark-bg border border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-surface2 text-gray-700 dark:text-dark-text transition-all shadow-sm active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
              >
                {t.writingHelperOpenSettings}
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-dark-bg p-4 rounded-xl border border-gray-100 dark:border-dark-border/50">
            <label className="text-xs font-semibold text-gray-700 dark:text-dark-text flex flex-col gap-1.5">
              {t.writingHelperMode}
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as WritingHelperMode)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none shadow-sm transition-all"
              >
                {MODE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t[option.labelKey]}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-semibold text-gray-700 dark:text-dark-text flex flex-col gap-1.5">
              {t.writingHelperMaxSentences}
              <input
                type="number"
                min={1}
                value={maxSentences}
                onChange={(event) => setMaxSentences(Number(event.target.value) || 1)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none shadow-sm transition-all"
              />
            </label>

            <label className="text-xs font-semibold text-gray-700 dark:text-dark-text flex flex-col gap-1.5">
              {t.writingHelperMaxItems}
              <input
                type="number"
                min={1}
                value={maxItems}
                onChange={(event) => setMaxItems(Number(event.target.value) || 1)}
                className="px-3 py-2 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface text-sm text-gray-800 dark:text-dark-text focus:ring-1 focus:ring-primary-500/50 outline-none shadow-sm transition-all"
              />
            </label>
          </div>

          <label className="text-sm font-semibold text-gray-800 dark:text-dark-text flex flex-col gap-2">
            {t.writingHelperInputText}
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={6}
              placeholder={t.writingHelperInputPlaceholder}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50/50 dark:bg-dark-bg text-[14px] leading-relaxed text-gray-900 dark:text-dark-text focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none shadow-inner transition-all custom-scrollbar resize-y"
            />
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={buttonDisabled}
              className="px-5 py-2.5 text-sm font-medium rounded-lg bg-primary-600 text-white shadow-sm hover:bg-primary-500 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
              title={buttonDisabled ? (loading ? t.writingHelperRunning : t.writingHelperInputPlaceholder) : undefined}
            >
              {loading && <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-transparent animate-spin" />}
              {loading ? t.writingHelperRunning : t.writingHelperRun}
            </button>
            <button
              onClick={handleClearDraft}
              disabled={loading}
              className="px-4 py-2.5 text-sm font-medium rounded-lg bg-white dark:bg-dark-surface border border-gray-200 dark:border-dark-border text-gray-700 dark:text-dark-text hover:bg-gray-50 dark:hover:bg-dark-surface2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-dark-bg"
            >
              {t.writingHelperClearDraft}
            </button>
            {error && <span className="text-[13px] font-medium text-danger-500 ml-2 px-2 py-1 bg-danger-50 dark:bg-danger-900/10 rounded">{error}</span>}
          </div>

          {result && (
            <div className="rounded-xl border border-primary-100 dark:border-primary-500/20 p-5 bg-primary-50/50 dark:bg-primary-900/10 shadow-sm mt-4 animate-fade-in">
              <div className="text-[11px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse-subtle"></span>
                {translate('writingHelperModePrefix', { mode: result.mode ?? '' })}
              </div>
              {result.processedText && (
                <div className="prose prose-sm dark:prose-invert max-w-none text-gray-800 dark:text-dark-text font-serif leading-relaxed">
                  {result.processedText}
                </div>
              )}
              {result.outline && result.outline.length > 0 && (
                <ul className="list-disc pl-6 text-sm text-gray-800 dark:text-dark-text space-y-2 font-serif mt-2">
                  {result.outline.map((item, index) => (
                    <li key={`${item}-${index}`} className="leading-relaxed pl-1 marker:text-primary-400">{item}</li>
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
