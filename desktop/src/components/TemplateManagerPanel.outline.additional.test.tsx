import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Template } from '../types/template'

const i18nStrings = {
  templateManagerCategoryAll: '全部',
  templateManagerCategoryStructure: '结构',
  templateManagerCategoryGenre: '类型',
  templateManagerCategoryFormat: '格式',
  templateManagerCategoryCustom: '自定义',
  templateManagerBuiltin: '内置',
  templateManagerCustom: '自定义',
  templateManagerEmptyList: '暂无模板',
  templateManagerPreviewBack: '返回列表',
  templateManagerApply: '应用到当前章节',
  templateManagerSaveAsCustom: '保存为自定义模板',
  templateManagerDuplicate: '复制',
  templateManagerDelete: '删除',
  templateManagerDeleteConfirm: '确认删除此模板？',
  templateManagerApplied: '模板已应用',
  templateManagerPreviewOutline: '结构预览',
  templateManagerLoading: '加载中...',
  templateManagerPlaceholders: '模板变量',
}

const { templateStoreState, resetTemplateStoreMock, useAppStoreMock } = vi.hoisted(() => {
  const templateStoreState = {
    templates: [] as Template[],
    templatesLoading: false,
    loadTemplates: vi.fn(async () => {}),
    saveAsTemplate: vi.fn(async (_template: Template) => {}),
    removeTemplate: vi.fn(async (_templateId: string) => {}),
    duplicateTemplate: vi.fn(async (_templateId: string, _title: string) => ({} as Template)),
  }

  const resetTemplateStoreMock = () => {
    templateStoreState.templates = []
    templateStoreState.templatesLoading = false
    templateStoreState.loadTemplates = vi.fn(async () => {})
    templateStoreState.saveAsTemplate = vi.fn(async (_template: Template) => {})
    templateStoreState.removeTemplate = vi.fn(async (_templateId: string) => {})
    templateStoreState.duplicateTemplate = vi.fn(
      async (_templateId: string, _title: string) => ({} as Template),
    )
  }

  const useAppStoreMock = Object.assign(
    <T,>(selector?: (state: typeof templateStoreState) => T) =>
      selector ? selector(templateStoreState) : (templateStoreState as T),
    {
      getState: () => templateStoreState,
    },
  )

  return { resetTemplateStoreMock, templateStoreState, useAppStoreMock }
})

vi.mock('../i18n', () => ({
  useI18n: () => ({
    t: i18nStrings,
  }),
}))

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../services/templateService', () => ({
  substitutePlaceholders: (content: Record<string, unknown>, values: Record<string, string>) => {
    const json = JSON.stringify(content)
    return JSON.parse(
      json.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? _match),
    ) as Record<string, unknown>
  },
}))

import { TemplateManagerPanel } from './TemplateManagerPanel'

function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'tpl-1',
    title: '三级大纲模板',
    description: '包含 h1/h2/h3 的结构',
    category: 'structure',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '卷一' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '第一章' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: '场景一' }],
        },
        {
          type: 'heading',
          attrs: { level: 4 },
          content: [{ type: 'text', text: '子场景' }],
        },
      ],
    },
    placeholders: [],
    isBuiltIn: true,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('TemplateManagerPanel outline preview branch coverage', () => {
  beforeEach(() => {
    resetTemplateStoreMock()
    vi.restoreAllMocks()
  })

  it('renders outline headings at level 3+ with pl-6 text-gray-500 styling', async () => {
    const user = userEvent.setup()

    const template = createTemplate()
    templateStoreState.templates = [template]

    render(<TemplateManagerPanel />)

    // Click the template to preview it
    await user.click(screen.getByRole('button', { name: /三级大纲模板/ }))

    // All heading levels should be visible
    expect(screen.getByText('卷一')).toBeInTheDocument()
    expect(screen.getByText('第一章')).toBeInTheDocument()
    expect(screen.getByText('场景一')).toBeInTheDocument()
    expect(screen.getByText('子场景')).toBeInTheDocument()

    // Check that level 3 and level 4 headings get the pl-6 text-gray-500 class
    const level3Element = screen.getByText('场景一').closest('div')
    const level4Element = screen.getByText('子场景').closest('div')

    expect(level3Element?.className).toContain('pl-6')
    expect(level3Element?.className).toContain('text-gray-500')
    expect(level4Element?.className).toContain('pl-6')
    expect(level4Element?.className).toContain('text-gray-500')
  })
})
