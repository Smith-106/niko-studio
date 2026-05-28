import { useI18n } from '../../i18n'

interface KeyboardShortcutsPanelProps {
  onClose: () => void
}

const SHORTCUTS = {
  zh: [
    { keys: 'Ctrl+S', desc: '保存' },
    { keys: 'Ctrl+/', desc: '快捷键帮助' },
    { keys: 'Ctrl+Z', desc: '撤销' },
    { keys: 'Ctrl+Shift+Z', desc: '重做' },
    { keys: 'Ctrl+B', desc: '加粗' },
    { keys: 'Ctrl+I', desc: '斜体' },
    { keys: 'Ctrl+U', desc: '下划线' },
    { keys: '/', desc: 'AI 指令菜单' },
  ],
  en: [
    { keys: 'Ctrl+S', desc: 'Save' },
    { keys: 'Ctrl+/', desc: 'Keyboard shortcuts' },
    { keys: 'Ctrl+Z', desc: 'Undo' },
    { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
    { keys: 'Ctrl+B', desc: 'Bold' },
    { keys: 'Ctrl+I', desc: 'Italic' },
    { keys: 'Ctrl+U', desc: 'Underline' },
    { keys: '/', desc: 'AI slash commands' },
  ],
}

export function KeyboardShortcutsPanel({ onClose }: KeyboardShortcutsPanelProps) {
  const { language } = useI18n()
  const shortcuts = SHORTCUTS[language === 'zh' ? 'zh' : 'en']
  const title = language === 'zh' ? '快捷键' : 'Keyboard Shortcuts'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-xl border border-gray-200 dark:border-dark-border p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">{title}</h3>
        <div className="space-y-2">
          {shortcuts.map(s => (
            <div key={s.keys} className="flex items-center justify-between">
              <span className="text-gray-600 dark:text-gray-400">{s.desc}</span>
              <kbd className="px-2 py-1 rounded bg-gray-100 dark:bg-dark-surface2 text-gray-800 dark:text-gray-200 text-xs font-mono border border-gray-200 dark:border-dark-border">{s.keys}</kbd>
            </div>
          ))}
        </div>
        <button onClick={onClose} className="mt-4 w-full px-4 py-2 rounded-lg border border-gray-200 dark:border-dark-border text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-colors text-sm">
          {language === 'zh' ? '关闭' : 'Close'}
        </button>
      </div>
    </div>
  )
}
