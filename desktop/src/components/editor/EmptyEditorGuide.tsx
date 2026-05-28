import { useI18n } from '../../i18n'

interface EmptyEditorGuideProps {
  onAIContinue: () => void
  onAddCharacter: () => void
  onFromTemplate: () => void
}

export function EmptyEditorGuide({ onAIContinue, onAddCharacter, onFromTemplate }: EmptyEditorGuideProps) {
  const { language } = useI18n()
  const isZh = language === 'zh'

  const actions = [
    {
      icon: '✨',
      title: isZh ? '试试 AI 续写' : 'Try AI Continue',
      desc: isZh ? '让 AI 帮你续写故事' : 'Let AI continue your story',
      onClick: onAIContinue,
    },
    {
      icon: '👤',
      title: isZh ? '添加角色' : 'Add Character',
      desc: isZh ? '创建故事中的角色' : 'Create characters for your story',
      onClick: onAddCharacter,
    },
    {
      icon: '📋',
      title: isZh ? '从模板开始' : 'Start from Template',
      desc: isZh ? '使用预设模板快速开始' : 'Quick start with a template',
      onClick: onFromTemplate,
    },
  ]

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="pointer-events-auto flex flex-col items-center gap-6 max-w-md">
        <div className="text-gray-400 dark:text-gray-500 text-lg">
          {isZh ? '开始创作你的故事...' : 'Start writing your story...'}
        </div>
        <div className="flex gap-3">
          {actions.map(action => (
            <button
              key={action.title}
              onClick={action.onClick}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group"
            >
              <span className="text-2xl">{action.icon}</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                {action.title}
              </span>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {action.desc}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}