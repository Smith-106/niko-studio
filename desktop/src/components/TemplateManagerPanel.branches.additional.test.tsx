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
    id: 'tpl-branch-1',
    title: '结构模板',
    description: '用于分支覆盖测试',
    category: 'structure',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '主线大纲' }],
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

describe('TemplateManagerPanel additional branch coverage', () => {
  beforeEach(() => {
    resetTemplateStoreMock()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('filters templates by category when a non-all filter is selected (line 41)', async () => {
    const user = userEvent.setup()

    const structureTemplate = createTemplate({
      id: 'tpl-structure',
      title: '结构模板A',
      category: 'structure',
    })
    const genreTemplate = createTemplate({
      id: 'tpl-genre',
      title: '类型模板B',
      category: 'genre',
    })
    const formatTemplate = createTemplate({
      id: 'tpl-format',
      title: '格式模板C',
      category: 'format',
    })

    templateStoreState.templates = [structureTemplate, genreTemplate, formatTemplate]

    render(<TemplateManagerPanel />)

    // All three templates should be visible with "all" filter
    expect(screen.getByRole('button', { name: /结构模板A/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /类型模板B/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /格式模板C/ })).toBeInTheDocument()

    // Click "类型" filter — should show only genre templates
    await user.click(screen.getByRole('button', { name: '类型' }))

    expect(screen.queryByRole('button', { name: /结构模板A/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /类型模板B/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /格式模板C/ })).not.toBeInTheDocument()

    // Click "格式" filter — should show only format templates
    await user.click(screen.getByRole('button', { name: '格式' }))

    expect(screen.queryByRole('button', { name: /结构模板A/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /类型模板B/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /格式模板C/ })).toBeInTheDocument()

    // Click "结构" filter — should show only structure templates
    await user.click(screen.getByRole('button', { name: '结构' }))

    expect(screen.getByRole('button', { name: /结构模板A/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /类型模板B/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /格式模板C/ })).not.toBeInTheDocument()
  })

  it('renders select placeholder with options dropdown (line 383)', async () => {
    const user = userEvent.setup()

    const template = createTemplate({
      id: 'tpl-select',
      title: '选择模板',
      placeholders: [
        {
          name: 'mood',
          label: '氛围',
          defaultValue: '紧张',
          type: 'select',
          options: ['紧张', '轻松', '神秘'],
        },
      ],
    })

    templateStoreState.templates = [template]

    render(<TemplateManagerPanel />)

    // Click to preview the template
    await user.click(screen.getByRole('button', { name: /选择模板/ }))

    // The select element should be rendered with options
    const moodSelect = screen.getByRole('combobox', { name: '' })
    expect(moodSelect).toBeInTheDocument()
    expect(moodSelect).toHaveValue('紧张')

    // All options should be present
    expect(screen.getByRole('option', { name: '紧张' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '轻松' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '神秘' })).toBeInTheDocument()

    // Select a different option
    await user.selectOptions(moodSelect, '轻松')
    expect(moodSelect).toHaveValue('轻松')
  })

  it('renders number placeholder with number input type (lines 393-394)', async () => {
    const user = userEvent.setup()

    const template = createTemplate({
      id: 'tpl-number',
      title: '数字模板',
      placeholders: [
        {
          name: 'chapterCount',
          label: '章节数量',
          defaultValue: '5',
          type: 'number',
        },
      ],
    })

    templateStoreState.templates = [template]

    render(<TemplateManagerPanel />)

    // Click to preview the template
    await user.click(screen.getByRole('button', { name: /数字模板/ }))

    // The input should be of type "number"
    const numberInput = screen.getByDisplayValue('5')
    expect(numberInput).toBeInTheDocument()
    expect(numberInput).toHaveAttribute('type', 'number')

    // Change the number value
    await user.clear(numberInput)
    await user.type(numberInput, '10')
    expect(numberInput).toHaveValue(10)
  })
})
