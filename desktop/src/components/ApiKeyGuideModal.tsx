import { useI18n } from '../i18n'

interface ApiKeyGuideModalProps {
  onClose: () => void
  onOpenSettings: () => void
}

export function ApiKeyGuideModal({ onClose, onOpenSettings }: ApiKeyGuideModalProps) {
  const { language } = useI18n()

  const title = language === 'zh' ? '配置 AI 写作助手' : 'Configure AI Writing Assistant'
  const desc = language === 'zh'
    ? 'AI 写作功能需要配置 LLM 服务提供商和 API Key。请在设置中完成配置。'
    : 'AI writing features require an LLM provider and API key. Please configure in Settings.'
  const btnSettings = language === 'zh' ? '前往设置' : 'Go to Settings'
  const btnLater = language === 'zh' ? '稍后配置' : 'Configure Later'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-200 dark:border-dark-border p-8 max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
            <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.686-5.686A6 6 0 0117 4z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
          <p className="text-gray-500 dark:text-gray-400 text-center">{desc}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-colors"
            >
              {btnLater}
            </button>
            <button
              onClick={() => { onClose(); onOpenSettings(); }}
              className="flex-1 px-4 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 transition-colors"
            >
              {btnSettings}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
