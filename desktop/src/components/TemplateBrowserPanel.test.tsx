import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { TemplateBrowserPanel } from './TemplateBrowserPanel'
import type { Template } from '../types/template'

const substitutePlaceholdersMock = vi.fn(
  (content: Record<string, unknown>, values: Record<string, string>) => {
    const json = JSON.stringify(content)
    return JSON.parse(
      json.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => values[key] ?? _match),
    ) as Record<string, unknown>
  },
)

const { resetTemplateStoreMock, useAppStoreMock, templateStoreState } = vi.hoisted(() => {
  const templateStoreState = {
    templates: [] as Template[],
    templatesLoading: false,
    templatesError: null as string | null,
    loadTemplates: vi.fn(async (_category?: string) => {}),
    saveAsTemplate: vi.fn(async (template: Template) => {
      templateStoreState.templates = [...templateStoreState.templates, template]
    }),
    removeTemplate: vi.fn(async (templateId: string) => {
      templateStoreState.templates = templateStoreState.templates.filter((item) => item.id !== templateId)
    }),
    duplicateTemplate: vi.fn(async (templateId: string, title: string) => {
      const source = templateStoreState.templates.find((item) => item.id === templateId)
      const duplicated = {
        ...(source ?? templateStoreState.templates[0]),
        id: `duplicate-${templateId}`,
        title,
        isBuiltIn: false,
        category: 'custom' as const,
      }
      templateStoreState.templates = [...templateStoreState.templates, duplicated]
      return duplicated
    }),
  }

  const resetTemplateStoreMock = () => {
    templateStoreState.templates = []
    templateStoreState.templatesLoading = false
    templateStoreState.templatesError = null
    templateStoreState.loadTemplates = vi.fn(async (_category?: string) => {})
    templateStoreState.saveAsTemplate = vi.fn(async (template: Template) => {
      templateStoreState.templates = [...templateStoreState.templates, template]
    })
    templateStoreState.removeTemplate = vi.fn(async (templateId: string) => {
      templateStoreState.templates = templateStoreState.templates.filter((item) => item.id !== templateId)
    })
    templateStoreState.duplicateTemplate = vi.fn(async (templateId: string, title: string) => {
      const source = templateStoreState.templates.find((item) => item.id === templateId)
      const duplicated = {
        ...(source ?? templateStoreState.templates[0]),
        id: `duplicate-${templateId}`,
        title,
        isBuiltIn: false,
        category: 'custom' as const,
      }
      templateStoreState.templates = [...templateStoreState.templates, duplicated]
      return duplicated
    })
  }

  const useAppStoreMock = Object.assign(
    <T,>(selector?: (state: typeof templateStoreState) => T) => (
      selector ? selector(templateStoreState) : (templateStoreState as T)
    ),
    {
      getState: () => templateStoreState,
      setState: (
        partial:
          | Partial<typeof templateStoreState>
          | ((state: typeof templateStoreState) => Partial<typeof templateStoreState>),
      ) => {
        Object.assign(
          templateStoreState,
          typeof partial === 'function' ? partial(templateStoreState) : partial,
        )
      },
    },
  )

  return {
    resetTemplateStoreMock,
    useAppStoreMock,
    templateStoreState,
  }
})

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../services/templateService', () => ({
  substitutePlaceholders: (...args: Parameters<typeof substitutePlaceholdersMock>) => substitutePlaceholdersMock(...args),
}))

vi.mock('./intelligence', () => ({
  IntelligenceBadge: ({ children }: { children: unknown }) => <span>{children}</span>,
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

function createTemplate(overrides: Partial<Template> = {}): Template {
  return {
    id: 'template-1',
    title: 'Structure template',
    description: 'Applies structure guidance',
    category: 'structure',
    content: { text: 'Hero: {{hero}}' },
    placeholders: [
      {
        name: 'hero',
        label: 'Hero',
        defaultValue: 'Ayla',
        type: 'text',
      },
    ],
    isBuiltIn: true,
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
    ...overrides,
  }
}

function getButtons(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button'))
}

function getButtonByClass(container: HTMLElement, classSnippet: string): HTMLButtonElement {
  const button = getButtons(container).find((element) => element.className.includes(classSnippet))
  expect(button).toBeTruthy()
  return button!
}

describe('TemplateBrowserPanel', () => {
  beforeEach(() => {
    resetTemplateStoreMock()
    substitutePlaceholdersMock.mockClear()
    vi.unstubAllGlobals()
  })

  it('loads templates, filters by category, and applies a selected template', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const genreTemplate = createTemplate({
      id: 'template-2',
      title: 'Genre template',
      description: 'Applies genre guidance',
      category: 'genre',
      content: { text: 'Genre: {{hero}}' },
    })
    templateStoreState.templates = [createTemplate(), genreTemplate]

    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')
    const { container } = render(<TemplateBrowserPanel onClose={onClose} />)

    await waitFor(() => expect(templateStoreState.loadTemplates).toHaveBeenCalled())

    await user.click(getButtons(container)[4]!)
    expect(templateStoreState.loadTemplates).toHaveBeenCalledWith('genre')

    await user.click(screen.getByText('Genre template'))

    const heroInput = screen.getByDisplayValue('Ayla')
    await user.clear(heroInput)
    await user.type(heroInput, 'Nova')

    await user.click(getButtonByClass(container, 'w-full py-2 px-4 bg-primary-cta'))

    expect(substitutePlaceholdersMock).toHaveBeenCalledWith(
      genreTemplate.content,
      expect.objectContaining({ hero: 'Nova' }),
    )
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'template:apply',
        detail: {
          templateId: 'template-2',
          content: { text: 'Genre: Nova' },
        },
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('duplicates and deletes a custom template from preview', async () => {
    const user = userEvent.setup()
    templateStoreState.templates = [
      createTemplate({
        id: 'template-custom',
        title: 'Custom template',
        category: 'custom',
        isBuiltIn: false,
      }),
    ]

    vi.stubGlobal('prompt', vi.fn(() => 'Custom template copy'))
    vi.stubGlobal('confirm', vi.fn(() => true))

    const { container } = render(<TemplateBrowserPanel onClose={vi.fn()} />)

    await user.click(screen.getByText('Custom template'))
    await user.click(getButtonByClass(container, 'text-dark-text-muted border border-dark-border rounded hover:text-white'))

    await waitFor(() => {
      expect(templateStoreState.duplicateTemplate).toHaveBeenCalledWith(
        'template-custom',
        'Custom template copy',
      )
    })

    expect(templateStoreState.templates.some((item) => item.title === 'Custom template copy')).toBe(true)

    await user.click(getButtonByClass(container, 'text-danger-500 border border-danger-500/30'))
    await waitFor(() => expect(templateStoreState.removeTemplate).toHaveBeenCalledWith('template-custom'))

    expect(screen.queryByText('Custom template')).not.toBeInTheDocument()
    expect(screen.getByText('Custom template copy')).toBeInTheDocument()
  })

  it('opens the save dialog and persists a new template shell', async () => {
    const user = userEvent.setup()
    const { container } = render(<TemplateBrowserPanel onClose={vi.fn()} />)

    await user.click(getButtons(container)[0]!)

    const [titleInput, descriptionInput] = screen.getAllByRole('textbox')
    await user.type(titleInput, 'Scene shell')
    await user.type(descriptionInput, 'Reusable scene scaffold')

    await user.click(getButtons(container).at(-2)!)

    await waitFor(() => expect(templateStoreState.saveAsTemplate).toHaveBeenCalledTimes(1))

    const savedTemplate = vi.mocked(templateStoreState.saveAsTemplate).mock.calls[0]?.[0]
    expect(savedTemplate?.title).toBe('Scene shell')
    expect(savedTemplate?.description).toBe('Reusable scene scaffold')
    expect(savedTemplate?.category).toBe('custom')
  })
})
