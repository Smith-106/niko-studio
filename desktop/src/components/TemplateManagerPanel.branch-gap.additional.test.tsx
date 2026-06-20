import { render, screen, within } from '@testing-library/react'
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

const { resetTemplateStoreMock, templateStoreState, useAppStoreMock } = vi.hoisted(() => {
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
    id: 'tpl-gap-1',
    title: '分支模板',
    description: '用于分支缺口覆盖',
    category: 'structure',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '大纲标题' }],
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

describe('TemplateManagerPanel branch-gap coverage', () => {
  beforeEach(() => {
    resetTemplateStoreMock()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('renders custom-category badge color branch for template cards (line ~164)', async () => {
    const customCatTemplate = createTemplate({
      id: 'tpl-custom-cat',
      title: '自定义类别模板',
      category: 'custom',
    })

    templateStoreState.templates = [customCatTemplate]

    render(<TemplateManagerPanel />)

    const card = screen.getByRole('button', { name: /自定义类别模板/ })
    expect(card).toBeInTheDocument()

    // The custom category badge should use the gray/dark-bg styling branch
    const badge = within(card).getByText('自定义')
    expect(badge).toBeInTheDocument()
    expect(badge.className).toContain('text-gray-600')
  })

  it('renders text-type placeholder input (not number, not select)', async () => {
    const user = userEvent.setup()

    const template = createTemplate({
      id: 'tpl-text-ph',
      title: '文本变量模板',
      placeholders: [
        {
          name: 'protagonist',
          label: '主角',
          defaultValue: '默认人物',
          type: 'text',
        },
      ],
    })

    templateStoreState.templates = [template]

    render(<TemplateManagerPanel />)

    await user.click(screen.getByRole('button', { name: /文本变量模板/ }))

    // Text-type placeholder should render as an input with type="text"
    const input = screen.getByDisplayValue('默认人物')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('type', 'text')
    expect(input).toHaveAttribute('placeholder', '默认人物')
  })

  it('covers the template card format-category badge branch', async () => {
    const formatTemplate = createTemplate({
      id: 'tpl-format-badge',
      title: '格式类模板',
      category: 'format',
    })

    templateStoreState.templates = [formatTemplate]

    render(<TemplateManagerPanel />)

    const card = screen.getByRole('button', { name: /格式类模板/ })
    const badge = within(card).getByText('格式')
    // Format category uses amber styling
    expect(badge.className).toContain('text-amber-700')
  })

  it('covers the template card genre-category badge branch', async () => {
    const genreTemplate = createTemplate({
      id: 'tpl-genre-badge',
      title: '类型类模板',
      category: 'genre',
    })

    templateStoreState.templates = [genreTemplate]

    render(<TemplateManagerPanel />)

    const card = screen.getByRole('button', { name: /类型类模板/ })
    const badge = within(card).getByText('类型')
    // Genre category uses purple styling
    expect(badge.className).toContain('text-purple-700')
  })
})
