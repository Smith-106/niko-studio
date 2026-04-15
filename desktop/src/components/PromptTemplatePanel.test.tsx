import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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
})

