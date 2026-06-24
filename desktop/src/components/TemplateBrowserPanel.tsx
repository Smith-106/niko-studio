import React, { useCallback, useEffect, useState } from 'react'
import { useAppStore } from '../stores/appStore'
import type { Template, TemplateCategory, TemplatePlaceholder } from '../types/template'
import { substitutePlaceholders } from '../services/templateService'
import { IntelligenceBadge, SectionHeader } from './intelligence'

interface PanelProps {
  onClose: () => void
}

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  structure: '结构',
  genre: '类型',
  format: '格式',
  plot: '剧情',
  custom: '自定义',
}

export const TemplateBrowserPanel: React.FC<PanelProps> = ({ onClose }) => {
  const {
    templates,
    templatesLoading,
    templatesError,
    loadTemplates,
    saveAsTemplate,
    removeTemplate,
    duplicateTemplate,
  } = useAppStore()

  const [categoryFilter, setCategoryFilter] = useState<TemplateCategory | 'all'>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({})

  useEffect(() => {
    loadTemplates()
  }, [loadTemplates])

  useEffect(() => {
    if (categoryFilter !== 'all') {
      loadTemplates(categoryFilter)
    } else {
      loadTemplates()
    }
  }, [categoryFilter, loadTemplates])

  const filteredTemplates = categoryFilter === 'all'
    ? templates
    : templates.filter((t) => t.category === categoryFilter)

  const handleSelectTemplate = useCallback((template: Template) => {
    setSelectedTemplate(template)
    const values: Record<string, string> = {}
    for (const ph of template.placeholders) {
      values[ph.name] = ph.defaultValue
    }
    setPlaceholderValues(values)
  }, [])

  const handlePlaceholderChange = useCallback((name: string, value: string) => {
    setPlaceholderValues((prev) => ({ ...prev, [name]: value }))
  }, [])

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return
    const result = substitutePlaceholders(selectedTemplate.content, placeholderValues)
    // The applied template content is dispatched through the editor integration
    const event = new CustomEvent('template:apply', {
      detail: { templateId: selectedTemplate.id, content: result },
    })
    window.dispatchEvent(event)
    onClose()
  }, [selectedTemplate, placeholderValues, onClose])

  const handleDuplicate = useCallback(async (id: string) => {
    const title = prompt('输入新模板标题:')
    if (!title) return
    await duplicateTemplate(id, title)
  }, [duplicateTemplate])

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('确认删除此模板？')) return
    await removeTemplate(id)
    if (selectedTemplate?.id === id) setSelectedTemplate(null)
  }, [removeTemplate, selectedTemplate])

  return (
    <div
      className="w-[400px] h-full bg-white dark:bg-dark-bg border-l border-gray-200 dark:border-dark-border text-gray-900 dark:text-dark-text flex flex-col"
      role="region"
      aria-label="模板库"
    >
      <div className="p-4 border-b border-dark-border flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-sm font-bold uppercase tracking-wider">模板库</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaveDialog(true)}
              className="text-xs text-primary-cta hover:opacity-80 px-2 py-1"
            >
              保存为模板
            </button>
            <button onClick={onClose} className="text-gray-400 hover:text-white text-lg">&times;</button>
          </div>
        </div>
      </div>

      <div className="flex gap-1 p-3 border-b border-dark-border flex-shrink-0 overflow-x-auto">
        {(['all', 'structure', 'genre', 'format', 'plot', 'custom'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(cat)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              categoryFilter === cat
                ? 'bg-primary-cta text-white'
                : 'bg-dark-surface-sunken text-dark-text-muted hover:text-white'
            }`}
          >
            {cat === 'all' ? '全部' : CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {templatesError && (
        <div className="px-4 py-2 text-xs text-danger-500 bg-danger-500/10">{templatesError}</div>
      )}

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {templatesLoading && !filteredTemplates.length ? (
          <p className="text-center text-dark-text-muted text-sm">加载中...</p>
        ) : selectedTemplate ? (
          <TemplatePreview
            template={selectedTemplate}
            placeholderValues={placeholderValues}
            onPlaceholderChange={handlePlaceholderChange}
            onApply={handleApply}
            onBack={() => setSelectedTemplate(null)}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
          />
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => handleSelectTemplate(template)}
                className="w-full text-left p-3 rounded bg-dark-surface-sunken hover:bg-dark-surface transition-colors"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{template.title}</p>
                    <p className="text-xs text-dark-text-muted mt-0.5">{template.description}</p>
                  </div>
                  <IntelligenceBadge variant={template.isBuiltIn ? 'success' : 'warning'}>
                    {template.isBuiltIn ? '内置' : '自定义'}
                  </IntelligenceBadge>
                </div>
              </button>
            ))}
            {filteredTemplates.length === 0 && (
              <p className="text-center text-dark-text-muted text-sm py-8">暂无模板</p>
            )}
          </div>
        )}
      </div>

      {showSaveDialog && (
        <SaveAsTemplateDialog
          onSave={async (template) => {
            await saveAsTemplate(template)
            setShowSaveDialog(false)
          }}
          onClose={() => setShowSaveDialog(false)}
        />
      )}
    </div>
  )
}

interface TemplatePreviewProps {
  template: Template
  placeholderValues: Record<string, string>
  onPlaceholderChange: (name: string, value: string) => void
  onApply: () => void
  onBack: () => void
  onDuplicate: (id: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}

const TemplatePreview: React.FC<TemplatePreviewProps> = ({
  template,
  placeholderValues,
  onPlaceholderChange,
  onApply,
  onBack,
  onDuplicate,
  onDelete,
}) => {
  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-primary-cta hover:opacity-80">&larr; 返回列表</button>

      <div>
        <h3 className="text-base font-semibold">{template.title}</h3>
        <p className="text-xs text-dark-text-muted mt-1">{template.description}</p>
      </div>

      {template.placeholders.length > 0 && (
        <div>
          <SectionHeader title="填充变量" />
          <PlaceholderForm
            placeholders={template.placeholders}
            values={placeholderValues}
            onChange={onPlaceholderChange}
          />
        </div>
      )}

      <div className="space-y-2">
        <button
          onClick={onApply}
          className="w-full py-2 px-4 bg-primary-cta text-white text-sm font-medium rounded hover:opacity-90 transition-opacity"
        >
          应用模板
        </button>

        <div className="flex gap-2">
          {!template.isBuiltIn && (
            <button
              onClick={() => onDelete(template.id)}
              className="flex-1 py-1.5 text-xs text-danger-500 border border-danger-500/30 rounded hover:bg-danger-500/10"
            >
              删除
            </button>
          )}
          <button
            onClick={() => onDuplicate(template.id)}
            className="flex-1 py-1.5 text-xs text-dark-text-muted border border-dark-border rounded hover:text-white"
          >
            复制
          </button>
        </div>
      </div>
    </div>
  )
}

interface PlaceholderFormProps {
  placeholders: TemplatePlaceholder[]
  values: Record<string, string>
  onChange: (name: string, value: string) => void
}

const PlaceholderForm: React.FC<PlaceholderFormProps> = ({ placeholders, values, onChange }) => {
  return (
    <div className="space-y-3">
      {placeholders.map((ph) => (
        <div key={ph.name}>
          <label className="block text-xs text-dark-text-muted mb-1">
            {ph.label}
            {ph.type !== 'select' && (
              <span className="ml-1 text-dark-text-muted/50">({ph.name})</span>
            )}
          </label>
          {ph.type === 'select' && ph.options ? (
            <select
              value={values[ph.name] ?? ph.defaultValue}
              onChange={(e) => onChange(ph.name, e.target.value)}
              className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
            >
              {ph.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type={ph.type === 'number' ? 'number' : 'text'}
              value={values[ph.name] ?? ph.defaultValue}
              onChange={(e) => onChange(ph.name, e.target.value)}
              placeholder={ph.defaultValue}
              className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white placeholder:text-dark-text-muted/50"
            />
          )}
        </div>
      ))}
    </div>
  )
}

interface SaveAsTemplateDialogProps {
  onSave: (template: Template) => Promise<void>
  onClose: () => void
}

const SaveAsTemplateDialog: React.FC<SaveAsTemplateDialogProps> = ({ onSave, onClose }) => {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<TemplateCategory>('custom')

  const handleSave = async () => {
    if (!title.trim()) return
    const now = new Date().toISOString()
    const template: Template = {
      id: crypto.randomUUID().slice(0, 8),
      title: title.trim(),
      description: description.trim(),
      category,
      content: { type: 'doc', content: [] },
      placeholders: [],
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now,
    }
    await onSave(template)
  }

  return (
    <div className="border-t border-dark-border p-4 bg-dark-bg-1 space-y-3">
      <SectionHeader title="保存为模板" />
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="模板标题"
        className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="描述"
        rows={2}
        className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white resize-none"
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as TemplateCategory)}
        className="w-full bg-dark-surface-sunken border border-dark-border rounded px-2 py-1.5 text-sm text-white"
      >
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <option key={key} value={key}>{label}</option>
        ))}
      </select>
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={!title.trim()}
          className="flex-1 py-1.5 text-sm bg-primary-cta text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          保存
        </button>
        <button
          onClick={onClose}
          className="flex-1 py-1.5 text-sm border border-dark-border text-dark-text-muted rounded hover:text-white"
        >
          取消
        </button>
      </div>
    </div>
  )
}
