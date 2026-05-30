import { Sparkles, Users, FileStack, ArrowRight } from 'lucide-react'
import { useI18n } from '../../i18n'
import type { LucideIcon } from 'lucide-react'

interface EmptyEditorGuideProps {
  onAIContinue: () => void
  onAddCharacter: () => void
  onFromTemplate: () => void
}

interface GuideStep {
  step: number
  icon: LucideIcon
  title: string
  desc: string
  onClick: () => void
}

export function EmptyEditorGuide({ onAIContinue, onAddCharacter, onFromTemplate }: EmptyEditorGuideProps) {
  const { language } = useI18n()
  const isZh = language === 'zh'

  const steps: GuideStep[] = [
    {
      step: 1,
      icon: Sparkles,
      title: isZh ? 'AI 续写' : 'AI Continue',
      desc: isZh ? '让 AI 帮你续写故事' : 'Let AI continue your story',
      onClick: onAIContinue,
    },
    {
      step: 2,
      icon: Users,
      title: isZh ? '添加角色' : 'Add Character',
      desc: isZh ? '创建故事中的角色' : 'Create characters for your story',
      onClick: onAddCharacter,
    },
    {
      step: 3,
      icon: FileStack,
      title: isZh ? '从模板开始' : 'Start from Template',
      desc: isZh ? '使用预设模板快速开始' : 'Quick start with a template',
      onClick: onFromTemplate,
    },
  ]

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
      <div className="pointer-events-auto flex flex-col items-center gap-8 max-w-lg">
        <div className="flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-primary-50 dark:bg-primary-900/10 flex items-center justify-center border border-primary-100 dark:border-primary-500/20 shadow-sm">
            <Sparkles size={20} className="text-primary-500 dark:text-primary-400" />
          </div>
          <div className="text-gray-500 dark:text-gray-400 text-base font-medium">
            {isZh ? '开始创作你的故事' : 'Start writing your story'}
          </div>
          <div className="text-gray-400 dark:text-gray-500 text-sm">
            {isZh ? '选择一个方式开始，或直接输入' : 'Pick a way to start, or just type'}
          </div>
        </div>
        <div className="flex items-center gap-0">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <div key={step.step} className="flex items-center">
                {index > 0 && (
                  <ArrowRight size={16} className="text-gray-300 dark:text-dark-border mx-1 shrink-0" />
                )}
                <button
                  onClick={step.onClick}
                  className="flex flex-col items-center gap-2.5 p-5 rounded-xl border border-gray-200 dark:border-dark-border hover:border-primary-300 dark:hover:border-primary-700 hover:bg-primary-50/50 dark:hover:bg-primary-900/10 transition-all group shadow-[var(--shadow-tiny)] hover:shadow-[var(--shadow-default)]"
                >
                  <span className="w-10 h-10 rounded-xl bg-white dark:bg-dark-surface flex items-center justify-center border border-gray-100 dark:border-dark-border group-hover:border-primary-200 dark:group-hover:border-primary-700 group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 transition-colors shadow-sm">
                    <Icon size={18} className="text-gray-500 dark:text-dark-text-secondary group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                  </span>
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">
                    {step.title}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed text-center">
                    {step.desc}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
