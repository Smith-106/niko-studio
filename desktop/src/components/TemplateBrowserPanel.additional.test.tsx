import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

const {
  resetTemplateStoreMock,
  templateStoreState,
  useAppStoreMock,
} = vi.hoisted(() => {
  const templateStoreState = {
    templates: [] as Template[],
    templatesLoading: false,
    templatesError: null as string | null,
    loadTemplates: vi.fn(async (_category?: string) => {}),
    saveAsTemplate: vi.fn(async (template: Template) => {
      templateStoreState.templates = [...templateStoreState.templates, template]
    }),
    removeTemplate: vi.fn(async (templateId: string) => {
      templateStoreState.templates = templateStoreState.templates.filter(
        (item) => item.id !== templateId,
      )
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
      templateStoreState.templates = templateStoreState.templates.filter(
        (item) => item.id !== templateId,
      )
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

  return { resetTemplateStoreMock, templateStoreState, useAppStoreMock }
})

vi.mock('../stores/appStore', () => ({
  useAppStore: useAppStoreMock,
}))

vi.mock('../services/templateService', () => ({
  substitutePlaceholders: (...args: Parameters<typeof substitutePlaceholdersMock>) =>
    substitutePlaceholdersMock(...args),
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

describe('TemplateBrowserPanel additional coverage', () => {
  beforeEach(() => {
    resetTemplateStoreMock()
    substitutePlaceholdersMock.mockClear()
    vi.unstubAllGlobals()
  })

  it('renders loading and error states for an empty template list', async () => {
    templateStoreState.templatesLoading = true
    templateStoreState.templatesError = 'load failed'

    render(<TemplateBrowserPanel onClose={vi.fn()} />)

    await waitFor(() => expect(templateStoreState.loadTemplates).toHaveBeenCalled())
    expect(screen.getByText('load failed')).toBeInTheDocument()
  })

  it('switches filters back to all, shows empty state, and applies select placeholders', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent')

    templateStoreState.templates = [
      createTemplate({
        id: 'template-genre',
        title: 'Genre template',
        category: 'genre',
        content: { text: 'Genre: {{tone}}' },
        placeholders: [
          {
            name: 'tone',
            label: 'Tone',
            defaultValue: 'Epic',
            type: 'select',
            options: ['Epic', 'Noir'],
          },
        ],
      }),
    ]

    const { container } = render(<TemplateBrowserPanel onClose={onClose} />)

    await user.click(getButtons(container)[6]!)
    expect(screen.queryByText('Genre template')).not.toBeInTheDocument()
    expect(templateStoreState.loadTemplates).toHaveBeenLastCalledWith('custom')

    await user.click(getButtons(container)[2]!)
    expect(templateStoreState.loadTemplates).toHaveBeenLastCalledWith()
    expect(screen.getByText('Genre template')).toBeInTheDocument()

    await user.click(screen.getByText('Genre template'))
    await user.selectOptions(screen.getByRole('combobox'), 'Noir')
    await user.click(getButtonByClass(container, 'w-full py-2 px-4 bg-primary-cta'))

    expect(substitutePlaceholdersMock).toHaveBeenCalledWith(
      { text: 'Genre: {{tone}}' },
      expect.objectContaining({ tone: 'Noir' }),
    )
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'template:apply',
        detail: {
          templateId: 'template-genre',
          content: { text: 'Genre: Noir' },
        },
      }),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders default values for text and number placeholders before editing', async () => {
    const user = userEvent.setup()

    templateStoreState.templates = [
      createTemplate({
        id: 'template-mixed',
        title: 'Mixed template',
        placeholders: [
          {
            name: 'hero',
            label: 'Hero',
            defaultValue: 'Ayla',
            type: 'text',
          },
          {
            name: 'chapters',
            label: 'Chapters',
            defaultValue: '12',
            type: 'number',
          },
        ],
      }),
    ]

    render(<TemplateBrowserPanel onClose={vi.fn()} />)

    await user.click(screen.getByText('Mixed template'))

    expect(screen.getByDisplayValue('Ayla')).toHaveAttribute('type', 'text')
    expect(screen.getByDisplayValue('12')).toHaveAttribute('type', 'number')
  })

  it('skips duplicate and delete when the user cancels, and closes the save dialog without saving', async () => {
    const user = userEvent.setup()

    templateStoreState.templates = [
      createTemplate({
        id: 'template-custom',
        title: 'Custom template',
        category: 'custom',
        isBuiltIn: false,
      }),
    ]

    vi.stubGlobal('prompt', vi.fn(() => ''))
    vi.stubGlobal('confirm', vi.fn(() => false))

    const { container } = render(<TemplateBrowserPanel onClose={vi.fn()} />)

    await user.click(screen.getByText('Custom template'))
    await user.click(getButtonByClass(container, 'text-dark-text-muted border border-dark-border rounded hover:text-white'))
    await user.click(getButtonByClass(container, 'text-danger-500 border border-danger-500/30'))

    expect(templateStoreState.duplicateTemplate).not.toHaveBeenCalled()
    expect(templateStoreState.removeTemplate).not.toHaveBeenCalled()

    const backButton = getButtons(container).find((button) => button.textContent?.includes('←'))
    expect(backButton).toBeTruthy()
    await user.click(backButton!)
    await user.click(getButtons(container)[0]!)

    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    await user.click(getButtonByClass(container, 'border border-dark-border text-dark-text-muted rounded hover:text-white'))

    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
    expect(templateStoreState.saveAsTemplate).not.toHaveBeenCalled()
  })

  it('does not save a template when the title stays blank after trimming', async () => {
    const user = userEvent.setup()
    const { container } = render(<TemplateBrowserPanel onClose={vi.fn()} />)

    await user.click(getButtons(container)[0]!)

    const [titleInput] = screen.getAllByRole('textbox')
    await user.type(titleInput, '   ')

    const saveButton = getButtonByClass(container, 'bg-primary-cta text-white rounded hover:opacity-90 disabled:opacity-50')
    expect(saveButton).toBeDisabled()

    Object.defineProperty(saveButton, 'disabled', { value: false, configurable: true })
    fireEvent.click(saveButton)

    expect(templateStoreState.saveAsTemplate).not.toHaveBeenCalled()
  })
})
