import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { AnalysisTemplate } from '../../utils/analysis-templates'
import { TemplateManager } from './TemplateManager'

function triggerReactClick(element: HTMLElement) {
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'))
  const reactProps = propsKey
    ? ((element as unknown as Record<string, { onClick?: (event: unknown) => void }>)[propsKey] ?? {})
    : {}

  reactProps.onClick?.({} as unknown)
}

const builtinTemplate: AnalysisTemplate = {
  id: 'builtin-1',
  name: '全面分析',
  dimensions: ['structure', 'character'],
  weights: {
    structure: 1,
    character: 1,
    suspense: 1,
    emotion: 1,
    dialogue: 1,
    webnovel: 1,
    show_tell: 0,
  },
  builtin: true,
}

const customTemplate: AnalysisTemplate = {
  id: 'custom-1',
  name: '自定义模板',
  dimensions: ['emotion'],
  weights: {
    structure: 0,
    character: 0,
    suspense: 0,
    emotion: 2,
    dialogue: 0,
    webnovel: 0,
    show_tell: 0,
  },
}

describe('TemplateManager', () => {
  it('selects and deletes templates based on builtin state', () => {
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    render(
      <TemplateManager
        templates={[builtinTemplate, customTemplate]}
        onSelect={onSelect}
        onSave={vi.fn()}
        onDelete={onDelete}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /全面分析/ }))
    fireEvent.click(screen.getByRole('button', { name: /自定义模板/ }))

    expect(onSelect).toHaveBeenNthCalledWith(1, builtinTemplate)
    expect(onSelect).toHaveBeenNthCalledWith(2, customTemplate)

    fireEvent.click(screen.getByRole('button', { name: '' }))
    expect(onDelete).toHaveBeenCalledWith('custom-1')
  })

  it('creates a new template after dimensions and weights are configured', () => {
    const onSave = vi.fn()

    render(
      <TemplateManager
        templates={[]}
        onSelect={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /新建模板/ }))

    const saveButton = screen.getByRole('button', { name: /保存模板/ })
    expect(saveButton).toBeDisabled()

    fireEvent.change(screen.getByPlaceholderText('模板名称'), {
      target: { value: '节奏模板' },
    })
    fireEvent.click(screen.getByLabelText('结构'))

    const slider = screen.getByRole('slider')
    fireEvent.change(slider, { target: { value: '3' } })

    expect(saveButton).not.toBeDisabled()
    fireEvent.click(saveButton)

    expect(onSave).toHaveBeenCalledWith({
      name: '节奏模板',
      dimensions: ['structure'],
      weights: {
        structure: 3,
        character: 1,
        suspense: 1,
        emotion: 1,
        dialogue: 1,
        webnovel: 1,
        show_tell: 0,
      },
    })

    expect(screen.queryByPlaceholderText('模板名称')).not.toBeInTheDocument()
  })

  it('keeps save disabled when the name is present but all dimensions are deselected again', () => {
    const onSave = vi.fn()

    render(
      <TemplateManager
        templates={[]}
        onSelect={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /新建模板/ }))
    fireEvent.change(screen.getByPlaceholderText('模板名称'), {
      target: { value: '回退模板' },
    })

    const structureToggle = screen.getByLabelText('结构')
    fireEvent.click(structureToggle)
    expect(screen.getByRole('slider')).toBeInTheDocument()

    fireEvent.click(structureToggle)

    const saveButton = screen.getByRole('button', { name: /保存模板/ })
    expect(saveButton).toBeDisabled()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()

    fireEvent.click(saveButton)
    expect(onSave).not.toHaveBeenCalled()
  })

  it('guards save when the disabled button is force-triggered with no dimensions selected', () => {
    const onSave = vi.fn()

    render(
      <TemplateManager
        templates={[]}
        onSelect={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /新建模板/ }))
    fireEvent.change(screen.getByPlaceholderText('模板名称'), {
      target: { value: '仅名称模板' },
    })

    const saveButton = screen.getByRole('button', { name: /保存模板/ }) as HTMLButtonElement
    saveButton.disabled = false
    saveButton.removeAttribute('disabled')

    triggerReactClick(saveButton)

    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('模板名称')).toBeInTheDocument()
  })
})
