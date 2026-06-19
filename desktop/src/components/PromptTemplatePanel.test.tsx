import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PromptTemplate } from '../stores/settingsStore'
import { PromptTemplatePanel } from './PromptTemplatePanel'
import { translations } from '../i18n'

const zh = translations.zh

const baseTemplates: PromptTemplate[] = [
  {
    id: 'tpl-1',
    title: '故事脑暴',
    category: 'brainstorm',
    content: '主题：{topic}；数量：{count}',
    variables: [
      { id: 'topic', label: '主题', required: true, defaultValue: '' },
      { id: 'count', label: '数量', required: true, defaultValue: '5' },
    ],
    isFavorite: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'tpl-2',
    title: '章节大纲',
    category: 'outline',
    content: '作品：{title}',
    variables: [
      { id: 'title', label: '作品名', required: true, defaultValue: '' },
    ],
    isFavorite: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
]

describe('PromptTemplatePanel', () => {
  it('filters templates by category', async () => {
    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: zh.templateCategoryOutline }))

    expect(screen.queryByText('故事脑暴')).not.toBeInTheDocument()
    expect(screen.getAllByText('章节大纲').length).toBeGreaterThan(0)
  })

  it('toggles favorite by callback', async () => {
    const onToggleFavorite = vi.fn()

    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={onToggleFavorite}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    await userEvent.click(screen.getByLabelText(zh.templateFavorite))
    expect(onToggleFavorite).toHaveBeenCalledWith('tpl-1')
  })

  it('exposes pressed state for category and favorite filters', async () => {
    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    const outlineFilter = screen.getByRole('button', { name: zh.templateCategoryOutline })
    expect(outlineFilter).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(outlineFilter)
    expect(outlineFilter).toHaveAttribute('aria-pressed', 'true')

    const favoriteToggle = screen.getByRole('button', { name: zh.templateFavoriteOnlyOff })
    expect(favoriteToggle).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(favoriteToggle)
    expect(screen.getByRole('button', { name: zh.templateFavoriteOnlyOn })).toHaveAttribute('aria-pressed', 'true')
  })

  it('filters out non-favorite templates when favorite-only mode is enabled', async () => {
    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: zh.templateFavoriteOnlyOff }))

    expect(screen.queryByText('故事脑暴')).not.toBeInTheDocument()
    expect(screen.getAllByText('章节大纲').length).toBeGreaterThan(0)
  })

  it('uses separate row select and favorite buttons for template cards', async () => {
    const onToggleFavorite = vi.fn()

    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={onToggleFavorite}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    const rows = within(screen.getByRole('list')).getAllByRole('listitem')
    const outlineRow = rows[1]
    const [rowButton, favoriteButton] = within(outlineRow).getAllByRole('button')

    expect(rowButton).toHaveAccessibleName(/章节大纲/)
    expect(rowButton).not.toHaveAttribute('aria-current')
    expect(favoriteButton).toHaveAccessibleName(zh.templateUnfavorite)

    await userEvent.click(rowButton)
    expect(rowButton).toHaveAttribute('aria-current', 'true')

    await userEvent.click(favoriteButton)
    expect(onToggleFavorite).toHaveBeenCalledWith('tpl-2')
    expect(rowButton).toHaveAttribute('aria-current', 'true')
  })

  it('validates required variables before apply', async () => {
    const onApplyTemplate = vi.fn()

    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={onApplyTemplate}
        onClose={() => {}}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))

    expect(screen.getByText(zh.templateRequiredHint)).toBeInTheDocument()
    expect(onApplyTemplate).not.toHaveBeenCalled()
  })

  it('focuses the first invalid input and exposes field-level error semantics', async () => {
    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    const topicInput = screen.getByLabelText('主题 *')
    const countInput = screen.getByLabelText('数量 *')

    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))

    await waitFor(() => {
      expect(topicInput).toHaveFocus()
    })
    expect(topicInput).toHaveAttribute('aria-invalid', 'true')
    expect(topicInput).toHaveAttribute('aria-describedby', 'template-var-error-topic')
    expect(countInput).not.toHaveAttribute('aria-invalid')
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'template-var-error-topic')
  })

  it('clears invalid field semantics after the user edits that field', async () => {
    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    const topicInput = screen.getByLabelText('主题 *')

    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))
    await screen.findByRole('alert')

    await userEvent.type(topicInput, '悬疑')

    expect(topicInput).not.toHaveAttribute('aria-invalid')
    expect(topicInput).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('applies template payload with append mode', async () => {
    const onApplyTemplate = vi.fn()

    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{
          'tpl-1': {
            count: '7',
          },
        }}
        onToggleFavorite={() => {}}
        onApplyTemplate={onApplyTemplate}
        onClose={() => {}}
      />
    )

    await userEvent.type(screen.getByLabelText(`${baseTemplates[0].variables[0].label} *`), '悬疑')
    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAppend }))
    await userEvent.click(screen.getByRole('button', { name: zh.templateApplyAction }))

    expect(onApplyTemplate).toHaveBeenCalledWith({
      text: '主题：悬疑；数量：7',
      mode: 'append',
      templateId: 'tpl-1',
      variableValues: {
        topic: '悬疑',
        count: '7',
      },
    })
  })

  it('focuses search on open and loops shift-tab from close back to apply', async () => {
    const user = userEvent.setup()

    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    const searchInput = screen.getByRole('textbox', { name: zh.templateSearchPlaceholder })
    await waitFor(() => {
      expect(searchInput).toHaveFocus()
    })

    const closeButton = screen.getByRole('button', { name: zh.templateClosePanel })
    closeButton.focus()
    await user.tab({ shift: true })

    expect(screen.getByRole('button', { name: zh.templateApplyAction })).toHaveFocus()
  })

  it('closes with backdrop reason when the scrim is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={onClose}
      />
    )

    const scrim = container.querySelector('[aria-hidden="true"]') as HTMLElement
    fireEvent.mouseDown(scrim)
    fireEvent.click(scrim)

    expect(onClose).toHaveBeenCalledWith('backdrop')
  })

  it('renders no-match and empty-detail states when search returns zero templates', async () => {
    const user = userEvent.setup()

    render(
      <PromptTemplatePanel
        templates={baseTemplates}
        variablePresets={{}}
        onToggleFavorite={() => {}}
        onApplyTemplate={() => {}}
        onClose={() => {}}
      />
    )

    await user.type(screen.getByRole('textbox', { name: zh.templateSearchPlaceholder }), 'not-found-template')

    expect(screen.getByText(zh.templateNoMatch)).toBeInTheDocument()
    expect(screen.getByText(zh.templateEmptyList)).toBeInTheDocument()
  })
})

