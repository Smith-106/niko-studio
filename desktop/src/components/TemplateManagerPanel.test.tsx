import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Template } from '../types/template'

const substitutePlaceholdersMock = vi.fn(
  (content: Record<string, unknown>, values: Record<string, string>) => {
    const json = JSON.stringify(content)
    return JSON.parse(
      json.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? _match),
    ) as Record<string, unknown>
  },
)

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
  substitutePlaceholders: (...args: Parameters<typeof substitutePlaceholdersMock>) =>
    substitutePlaceholdersMock(...args),
}))

import { TemplateManagerPanel } from './TemplateManagerPanel'

function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'template-1',
    title: '结构模板',
    description: '用于结构测试',
    category: 'structure',
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: '主线大纲' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '冲突升级' }],
        },
      ],
      note: '主角：{{hero}}，语气：{{tone}}',
    },
    placeholders: [
      { name: 'hero', label: '主角', defaultValue: '阿澜', type: 'text' },
      { name: 'tone', label: '语气', defaultValue: '冷峻', type: 'select', options: ['冷峻', '轻快'] },
    ],
    isBuiltIn: true,
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  }
}

describe('TemplateManagerPanel', () => {
  beforeEach(() => {
    resetTemplateStoreMock()
    substitutePlaceholdersMock.mockClear()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('loads templates on mount and renders the loading state', async () => {
    templateStoreState.templatesLoading = true

    render(<TemplateManagerPanel />)

    await waitFor(() => {
      expect(templateStoreState.loadTemplates).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText('加载中...')).toBeInTheDocument()
  })

  it('renders empty state and can preview a custom template with no outline headings', async () => {
    const user = userEvent.setup()

    const customTemplate = createTemplate({
      id: 'template-custom',
      title: '自定义模版',
      category: 'custom',
      isBuiltIn: false,
      content: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '无标题' }] }] },
      placeholders: [],
    })

    const genreTemplate = createTemplate({
      id: 'template-genre',
      title: '类型模板',
      category: 'genre',
      description: '用于筛选测试',
    })

    const { rerender } = render(<TemplateManagerPanel />)
    expect(screen.getByText('暂无模板')).toBeInTheDocument()

    templateStoreState.templates = [genreTemplate, customTemplate]
    rerender(<TemplateManagerPanel />)

    await user.click(screen.getByRole('button', { name: '自定义' }))
    await user.click(screen.getByRole('button', { name: /自定义模版/ }))

    expect(screen.getByText('-')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '删除' })).toBeInTheDocument()
  })

  it('applies a built-in template, dispatches the apply event, and can save it as custom', async () => {
    const user = userEvent.setup()

    const onApplyTemplate = vi.fn()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const template = createTemplate()
    templateStoreState.templates = [template]

    render(<TemplateManagerPanel onApplyTemplate={onApplyTemplate} />)

    await user.click(screen.getByRole('button', { name: /结构模板/ }))

    const heroInput = screen.getByDisplayValue('阿澜')
    await user.clear(heroInput)
    await user.type(heroInput, '林霁')
    await user.selectOptions(screen.getByDisplayValue('冷峻'), '轻快')

    await user.click(screen.getByRole('button', { name: '应用到当前章节' }))

    expect(substitutePlaceholdersMock).toHaveBeenCalledWith(template.content, {
      hero: '林霁',
      tone: '轻快',
    })
    expect(dispatchSpy).toHaveBeenCalledTimes(1)
    const event = dispatchSpy.mock.calls[0]?.[0] as CustomEvent
    expect(event.type).toBe('template:apply')
    expect(event.detail).toEqual({
      templateId: 'template-1',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: '主线大纲' }],
          },
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '冲突升级' }],
          },
        ],
        note: '主角：林霁，语气：轻快',
      },
    })
    expect(onApplyTemplate).toHaveBeenCalledWith(template)
    expect(screen.getByText('模板已应用')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '保存为自定义模板' }))

    expect(templateStoreState.saveAsTemplate).toHaveBeenCalledTimes(1)
    const savedTemplate = vi.mocked(templateStoreState.saveAsTemplate).mock.calls[0]?.[0]
    expect(savedTemplate).toMatchObject({
      isBuiltIn: false,
      category: 'custom',
      title: '结构模板',
    })
    expect(savedTemplate?.createdAt).toEqual(expect.any(String))
    expect(savedTemplate?.updatedAt).toEqual(expect.any(String))
    expect(savedTemplate?.id).toMatch(/^custom-template-1-/)
  })

  it('duplicates custom templates and only deletes them after confirmation', async () => {
    const user = userEvent.setup()
    const customTemplate = createTemplate({
      id: 'template-custom',
      title: '自定义模版',
      category: 'custom',
      isBuiltIn: false,
    })
    templateStoreState.templates = [customTemplate]

    vi.stubGlobal(
      'confirm',
      vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
    )

    render(<TemplateManagerPanel />)

    await user.click(screen.getByRole('button', { name: /自定义模版/ }))
    await user.click(screen.getByRole('button', { name: '复制' }))

    expect(templateStoreState.duplicateTemplate).toHaveBeenCalledWith(
      'template-custom',
      '自定义模版 (copy)',
    )

    await user.click(screen.getByRole('button', { name: '删除' }))
    expect(templateStoreState.removeTemplate).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: '删除' }))
    await waitFor(() => {
      expect(templateStoreState.removeTemplate).toHaveBeenCalledWith('template-custom')
    })
    expect(screen.getByRole('button', { name: /自定义模版/ })).toBeInTheDocument()
  })
})
