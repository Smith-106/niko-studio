import { useState, useCallback, useMemo, useEffect } from 'react'
import { useI18n } from '../i18n'
import { useAppStore } from '../stores/appStore'
import { substitutePlaceholders } from '../services/templateService'
import type { Template, TemplateCategory, TemplatePlaceholder } from '../types/template'

interface TemplateManagerPanelProps {
  onApplyTemplate?: (template: Template) => void
}

const CATEGORY_FILTERS: Array<TemplateCategory | 'all'> = ['all', 'structure', 'genre', 'format', 'custom']

export function TemplateManagerPanel({ onApplyTemplate }: TemplateManagerPanelProps) {
  const { t } = useI18n()
  const {
    templates: customTemplates,
    templatesLoading,
    loadTemplates,
    saveAsTemplate,
    removeTemplate,
    duplicateTemplate,
  } = useAppStore()

  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({})
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  const allTemplates = useMemo(
    () => customTemplates,
    [customTemplates]
  )

  const filtered = useMemo(
    () => categoryFilter === 'all'
      ? allTemplates
      : allTemplates.filter(tmpl => tmpl.category === categoryFilter),
    [allTemplates, categoryFilter]
  )

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template)
    const values: Record<string, string> = {}
    for (const ph of template.placeholders) {
      values[ph.name] = ph.defaultValue
    }
    setPlaceholderValues(values)
  }, [])

  const handlePlaceholderChange = useCallback((name: string, value: string) => {
    setPlaceholderValues(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return

    const result = substitutePlaceholders(selectedTemplate.content, placeholderValues)
    const event = new CustomEvent('template:apply', {
      detail: { templateId: selectedTemplate.id, content: result },
    })
    window.dispatchEvent(event)

    setFeedbackMsg(t.templateManagerApplied)
    setTimeout(() => setFeedbackMsg(null), 2000)
    onApplyTemplate?.(selectedTemplate)
  }, [selectedTemplate, placeholderValues, onApplyTemplate, t])

  const handleSaveAsCustom = useCallback(async () => {
    if (!selectedTemplate) return
    const now = new Date().toISOString()
    const custom: Template = {
      ...selectedTemplate,
      id: `custom-${selectedTemplate.id}-${Date.now()}`,
      isBuiltIn: false,
      category: 'custom',
      createdAt: now,
      updatedAt: now,
    }
    await saveAsTemplate(custom)
  }, [selectedTemplate, saveAsTemplate])

  const handleDuplicate = useCallback(async () => {
    if (!selectedTemplate) return
    await duplicateTemplate(selectedTemplate.id, `${selectedTemplate.title} (copy)`)
  }, [selectedTemplate, duplicateTemplate])

  const handleDelete = useCallback(async () => {
    if (!selectedTemplate) return
    if (!confirm(t.templateManagerDeleteConfirm)) return
    await removeTemplate(selectedTemplate.id)
    setSelectedTemplate(null)
  }, [selectedTemplate, removeTemplate, t])

  const categoryLabel = (cat: TemplateCategory | 'all'): string => {
    if (cat === 'all') return t.templateManagerCategoryAll
    const map: Record<TemplateCategory, string> = {
      structure: t.templateManagerCategoryStructure,
      genre: t.templateManagerCategoryGenre,
      format: t.templateManagerCategoryFormat,
      custom: t.templateManagerCategoryCustom,
    }
    return map[cat]
  }

  return (
    <div className="space-y-4">
      {feedbackMsg && (
        <div className="px-3 py-2 text-xs rounded-lg bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300">
          {feedbackMsg}
        </div>
      )}

      {!selectedTemplate ? (
        <>
          {/* Category filter tabs */}
          <div className="flex gap-1 flex-wrap">
            {CATEGORY_FILTERS.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs rounded-full whitespace-nowrap transition-colors ${
                  categoryFilter === cat
                    ? 'bg-primary-600 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-dark-surface text-gray-600 dark:text-dark-text-secondary hover:text-gray-900 dark:hover:text-dark-text'
                }`}
              >
                {categoryLabel(cat)}
              </button>
            ))}
          </div>

          {/* Template card grid */}
          {templatesLoading && filtered.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-dark-text-secondary text-sm py-8">
              {t.templateManagerLoading}
            </p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-gray-500 dark:text-dark-text-secondary text-sm py-8">
              {t.templateManagerEmptyList}
            </p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map(template => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-dark-border bg-gray-50 dark:bg-dark-surface hover:bg-gray-100 dark:hover:bg-dark-surface2 transition-colors space-y-2"
                >
                  <div className="flex justify-between items-start gap-2">
                    <p className="text-sm font-medium text-gray-800 dark:text-dark-text truncate">
                      {template.title}
                    </p>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      template.category === 'structure'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : template.category === 'genre'
                          ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                          : template.category === 'format'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-gray-100 text-gray-600 dark:bg-dark-border dark:text-dark-text-secondary'
                    }`}>
                      {categoryLabel(template.category)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-dark-text-secondary line-clamp-2">
                    {template.description}
                  </p>
                  <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${
                    template.isBuiltIn
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                      : 'bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-text-secondary'
                  }`}>
                    {template.isBuiltIn ? t.templateManagerBuiltin : t.templateManagerCustom}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <TemplatePreview
          template={selectedTemplate}
          placeholderValues={placeholderValues}
          onPlaceholderChange={handlePlaceholderChange}
          onApply={handleApply}
          onBack={() => setSelectedTemplate(null)}
          onSaveAsCustom={handleSaveAsCustom}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}

// --- Preview sub-component ---

interface TemplatePreviewProps {
  template: Template
  placeholderValues: Record<string, string>
  onPlaceholderChange: (name: string, value: string) => void
  onApply: () => void
  onBack: () => void
  onSaveAsCustom: () => Promise<void>
  onDuplicate: () => Promise<void>
  onDelete: () => Promise<void>
}

function TemplatePreview({
  template,
  placeholderValues,
  onPlaceholderChange,
  onApply,
  onBack,
  onSaveAsCustom,
  onDuplicate,
  onDelete,
}: TemplatePreviewProps) {
  const { t } = useI18n()

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-xs text-primary-600 dark:text-primary-400 hover:opacity-80 transition-opacity">
        &larr; {t.templateManagerPreviewBack}
      </button>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h3 className="text-base font-semibold text-gray-800 dark:text-dark-text">{template.title}</h3>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            template.isBuiltIn
              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-300'
              : 'bg-gray-100 text-gray-500 dark:bg-dark-border dark:text-dark-text-secondary'
          }`}>
            {template.isBuiltIn ? t.templateManagerBuiltin : t.templateManagerCustom}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-dark-text-secondary">{template.description}</p>
      </div>

      {/* Structure outline preview */}
      <div>
        <h4 className="text-xs font-bold text-gray-700 dark:text-dark-text mb-2 uppercase tracking-wider">
          {t.templateManagerPreviewOutline}
        </h4>
        <div className="bg-gray-50 dark:bg-dark-surface rounded-lg p-3 space-y-1">
          <TemplateOutline content={template.content} />
        </div>
      </div>

      {/* Placeholder form */}
      {template.placeholders.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-gray-700 dark:text-dark-text mb-2 uppercase tracking-wider">
            {t.templateManagerPlaceholders}
          </h4>
          <PlaceholderForm
            placeholders={template.placeholders}
            values={placeholderValues}
            onChange={onPlaceholderChange}
          />
        </div>
      )}

      {/* Action buttons */}
      <div className="space-y-2">
        <button
          onClick={onApply}
          className="w-full py-2.5 px-4 bg-primary-600 text-white text-sm font-medium rounded-xl hover:bg-primary-500 shadow-md active:scale-95 transition-all"
        >
          {t.templateManagerApply}
        </button>

        <div className="flex gap-2">
          {template.isBuiltIn && (
            <button
              onClick={() => void onSaveAsCustom()}
              className="flex-1 py-2 text-xs border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-text-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-colors"
            >
              {t.templateManagerSaveAsCustom}
            </button>
          )}
          {!template.isBuiltIn && (
            <>
              <button
                onClick={() => void onDuplicate()}
                className="flex-1 py-2 text-xs border border-gray-200 dark:border-dark-border text-gray-600 dark:text-dark-text-secondary rounded-lg hover:bg-gray-50 dark:hover:bg-dark-surface2 transition-colors"
              >
                {t.templateManagerDuplicate}
              </button>
              <button
                onClick={() => void onDelete()}
                className="flex-1 py-2 text-xs text-red-600 dark:text-red-400 border border-red-200 dark:border-red-500/30 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
              >
                {t.templateManagerDelete}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Template outline renderer ---

function TemplateOutline({ content }: { content: Record<string, unknown> }) {
  const nodes = extractOutlineNodes(content)

  if (nodes.length === 0) {
    return <p className="text-xs text-gray-400 dark:text-dark-text-secondary italic">-</p>
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node, i) => (
        <div
          key={i}
          className={`text-xs ${
            node.level === 1
              ? 'font-semibold text-gray-800 dark:text-dark-text'
              : node.level === 2
                ? 'pl-3 font-medium text-gray-700 dark:text-dark-text-secondary'
                : 'pl-6 text-gray-500 dark:text-dark-text-secondary'
          }`}
        >
          {node.text}
        </div>
      ))}
    </div>
  )
}

function extractOutlineNodes(content: Record<string, unknown>): Array<{ level: number; text: string }> {
  const result: Array<{ level: number; text: string }> = []
  const inner = content.content
  if (!Array.isArray(inner)) return result

  for (const node of inner) {
    if (node.type === 'heading' && typeof node.attrs?.level === 'number') {
      const text = extractTextFromNode(node)
      if (text) result.push({ level: node.attrs.level, text })
    }
  }
  return result
}

function extractTextFromNode(node: Record<string, unknown>): string {
  const parts: string[] = []
  if (typeof node.text === 'string') {
    parts.push(node.text)
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      parts.push(extractTextFromNode(child as Record<string, unknown>))
    }
  }
  return parts.join('')
}

// --- Placeholder form ---

interface PlaceholderFormProps {
  placeholders: TemplatePlaceholder[]
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}

function PlaceholderForm({ placeholders, values, onChange }: PlaceholderFormProps) {
  return (
    <div className="space-y-3">
      {placeholders.map(ph => (
        <div key={ph.name}>
          <label className="block text-xs text-gray-500 dark:text-dark-text-secondary mb-1">
            {ph.label}
          </label>
          {ph.type === 'select' && ph.options ? (
            <select
              value={values[ph.name] ?? ph.defaultValue}
              onChange={e => onChange(ph.name, e.target.value)}
              className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-2.5 py-2 text-sm text-gray-800 dark:text-dark-text focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all"
            >
              {ph.options.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={ph.type === 'number' ? 'number' : 'text'}
              value={values[ph.name] ?? ph.defaultValue}
              onChange={e => onChange(ph.name, e.target.value)}
              placeholder={ph.defaultValue}
              className="w-full bg-gray-50 dark:bg-dark-surface border border-gray-200 dark:border-dark-border rounded-lg px-2.5 py-2 text-sm text-gray-800 dark:text-dark-text placeholder:text-gray-400 dark:placeholder:text-dark-text-secondary focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 outline-none transition-all"
            />
          )}
        </div>
      ))}
    </div>
  )
}
