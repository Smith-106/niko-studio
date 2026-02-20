import { useMemo, useState } from 'react'
import { Search, Star, X } from 'lucide-react'
import type { PromptTemplate, PromptTemplateCategory } from '../stores/settingsStore'
import { useI18n } from '../i18n'

export interface ApplyTemplatePayload {
  text: string
  mode: 'replace' | 'append'
  templateId: string
  variableValues: Record<string, string>
}

interface PromptTemplatePanelProps {
  templates: PromptTemplate[]
  variablePresets: Record<string, Record<string, string>>
  onToggleFavorite: (templateId: string) => void
  onApplyTemplate: (payload: ApplyTemplatePayload) => void
  onClose: () => void
}

const categoryOrder: Array<'all' | PromptTemplateCategory> = [
  'all',
  'brainstorm',
  'outline',
  'character',
  'rewrite',
  'analysis',
  'custom',
]

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const renderTemplateContent = (template: PromptTemplate, values: Record<string, string>): string => {
  let next = template.content
  for (const variable of template.variables) {
    const key = `{${variable.id}}`
    const reg = new RegExp(escapeRegExp(key), 'g')
    next = next.replace(reg, values[variable.id] ?? '')
  }
  return next
}

export function PromptTemplatePanel({
  templates,
  variablePresets,
  onToggleFavorite,
  onApplyTemplate,
  onClose,
}: PromptTemplatePanelProps) {
  const { t } = useI18n()
  const [selectedCategory, setSelectedCategory] = useState<'all' | PromptTemplateCategory>('all')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(templates[0]?.id ?? '')
  const [applyMode, setApplyMode] = useState<'replace' | 'append'>('replace')
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const filteredTemplates = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase()
    return templates.filter((template) => {
      if (selectedCategory !== 'all' && template.category !== selectedCategory) {
        return false
      }
      if (favoriteOnly && !template.isFavorite) {
        return false
      }
      if (!keyword) {
        return true
      }
      return (
        template.title.toLowerCase().includes(keyword)
        || template.content.toLowerCase().includes(keyword)
      )
    })
  }, [favoriteOnly, searchKeyword, selectedCategory, templates])

  const selectedTemplate = useMemo(
    () => filteredTemplates.find((template) => template.id === selectedTemplateId) ?? filteredTemplates[0],
    [filteredTemplates, selectedTemplateId]
  )

  const resolveVariableValue = (template: PromptTemplate, variableId: string): string => {
    if (variableValues[variableId] !== undefined) {
      return variableValues[variableId]
    }
    const preset = variablePresets[template.id]?.[variableId]
    if (preset !== undefined) {
      return preset
    }
    const variable = template.variables.find((item) => item.id === variableId)
    return variable?.defaultValue ?? ''
  }

  const handleApply = () => {
    if (!selectedTemplate) return

    const nextValues: Record<string, string> = {}
    const nextErrors: Record<string, string> = {}

    for (const variable of selectedTemplate.variables) {
      const value = resolveVariableValue(selectedTemplate, variable.id).trim()
      if (variable.required && !value) {
        nextErrors[variable.id] = t.templateRequiredHint
      }
      nextValues[variable.id] = value
    }

    setValidationErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) {
      return
    }

    const text = renderTemplateContent(selectedTemplate, nextValues)
    onApplyTemplate({
      text,
      mode: applyMode,
      templateId: selectedTemplate.id,
      variableValues: nextValues,
    })
  }

  return (
    <div
      className="fixed right-0 top-12 bottom-0 w-96 bg-white dark:bg-dark-surface border-l border-gray-200 dark:border-dark-border shadow-lg flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-label={t.templateLibraryTitle}
    >
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-dark-border">
        <div className="font-semibold text-gray-900 dark:text-dark-text">{t.templateLibraryTitle}</div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
          aria-label={t.templateClosePanel}
        >
          <X size={18} />
        </button>
      </div>

      <div className="p-4 border-b border-gray-200 dark:border-dark-border space-y-3">
        <div className="flex flex-wrap gap-2">
          {categoryOrder.map((category) => {
            const labelMap: Record<typeof categoryOrder[number], string> = {
              all: t.templateCategoryAll,
              brainstorm: t.templateCategoryBrainstorm,
              outline: t.templateCategoryOutline,
              character: t.templateCategoryCharacter,
              rewrite: t.templateCategoryRewrite,
              analysis: t.templateCategoryAnalysis,
              custom: t.templateCategoryCustom,
            }
            const label = labelMap[category]
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-2 py-1 text-xs rounded-full transition-colors ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFavoriteOnly((prev) => !prev)}
            className={`px-2 py-1 text-xs rounded transition-colors flex items-center gap-1 ${
              favoriteOnly
                ? 'bg-amber-500 text-white'
                : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'
            }`}
          >
            <Star size={14} />
            {favoriteOnly ? t.templateFavoriteOnlyOn : t.templateFavoriteOnlyOff}
          </button>
        </div>

        <div className="relative">
          <Search size={14} className="absolute left-2 top-2.5 text-gray-400" />
          <input
            value={searchKeyword}
            onChange={(event) => setSearchKeyword(event.target.value)}
            placeholder={t.templateSearchPlaceholder}
            className="w-full pl-7 pr-3 py-2 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
          />
        </div>
      </div>

      <div className="flex-1 overflow-hidden grid grid-cols-2">
        <div className="border-r border-gray-200 dark:border-dark-border overflow-y-auto">
          {filteredTemplates.length === 0 ? (
            <div className="p-3 text-sm text-gray-500 dark:text-dark-text-secondary">{t.templateNoMatch}</div>
          ) : (
            <ul className="p-2 space-y-2">
              {filteredTemplates.map((template) => {
                const selected = selectedTemplate?.id === template.id
                return (
                  <li key={template.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setSelectedTemplateId(template.id)
                        setValidationErrors({})
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          setSelectedTemplateId(template.id)
                          setValidationErrors({})
                        }
                      }}
                      className={`w-full text-left p-2 rounded border transition-colors cursor-pointer ${
                        selected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-dark-border hover:bg-gray-50 dark:hover:bg-dark-bg'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">{template.title}</span>
                        <button
                          type="button"
                          aria-label={template.isFavorite ? t.templateUnfavorite : t.templateFavorite}
                          onClick={(event) => {
                            event.stopPropagation()
                            onToggleFavorite(template.id)
                          }}
                          className={`cursor-pointer ${template.isFavorite ? 'text-amber-500' : 'text-gray-400'}`}
                        >
                          <Star size={14} fill={template.isFavorite ? 'currentColor' : 'none'} />
                        </button>
                      </div>
                      <p className="mt-1 text-xs text-gray-500 dark:text-dark-text-secondary line-clamp-2">
                        {template.content}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="p-3 overflow-y-auto">
          {!selectedTemplate ? (
            <div className="text-sm text-gray-500 dark:text-dark-text-secondary">{t.templateEmptyList}</div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-gray-800 dark:text-dark-text">{selectedTemplate.title}</h3>

              <div className="space-y-2">
                {selectedTemplate.variables.map((variable) => {
                  const value = resolveVariableValue(selectedTemplate, variable.id)
                  return (
                    <div key={variable.id}>
                      <label htmlFor={`template-var-${variable.id}`} className="block text-xs text-gray-600 dark:text-dark-text-secondary mb-1">
                        {variable.label}
                        {variable.required ? ' *' : ''}
                      </label>
                      <input
                        id={`template-var-${variable.id}`}
                        value={value}
                        onChange={(event) => {
                          setVariableValues((prev) => ({ ...prev, [variable.id]: event.target.value }))
                          setValidationErrors((prev) => {
                            const { [variable.id]: _ignored, ...rest } = prev
                            return rest
                          })
                        }}
                        placeholder={variable.description || variable.defaultValue || ''}
                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text rounded"
                      />
                      {validationErrors[variable.id] && (
                        <p className="mt-1 text-xs text-red-500">{validationErrors[variable.id]}</p>
                      )}
                    </div>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setApplyMode('replace')}
                  className={`px-2 py-1 text-xs rounded ${
                    applyMode === 'replace'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'
                  }`}
                >
                  {t.templateApplyReplace}
                </button>
                <button
                  onClick={() => setApplyMode('append')}
                  className={`px-2 py-1 text-xs rounded ${
                    applyMode === 'append'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text'
                  }`}
                >
                  {t.templateApplyAppend}
                </button>
              </div>

              <button
                onClick={handleApply}
                className="w-full px-3 py-2 text-sm rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                {t.templateApplyAction}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
