import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PersonaSelector } from './PersonaSelector'

function triggerReactClick(element: HTMLElement) {
  const propsKey = Object.keys(element).find((key) => key.startsWith('__reactProps$'))
  const reactProps = propsKey
    ? ((element as unknown as Record<string, { onClick?: (event: unknown) => void }>)[propsKey] ?? {})
    : {}

  reactProps.onClick?.({} as unknown)
}

describe('PersonaSelector additional coverage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('supports deselection when multiple personas are selected', () => {
    const onSelectionChange = vi.fn()

    render(
      <PersonaSelector
        selectedPersonaIds={['suspense-enthusiast', 'literary-critic']}
        onSelectionChange={onSelectionChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /悬疑爱好者/ }))

    expect(onSelectionChange).toHaveBeenCalledWith(['literary-critic'])
  })

  it('keeps the modal open for blank names and supports focus-area toggling off', () => {
    const onSelectionChange = vi.fn()

    render(
      <PersonaSelector
        selectedPersonaIds={['general-reader']}
        onSelectionChange={onSelectionChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '创建自定义画像' }))

    const dialog = screen.getByRole('dialog', { name: '创建自定义读者画像' })
    const saveButton = within(dialog).getByRole('button', { name: '保存' })

    fireEvent.change(within(dialog).getByPlaceholderText('输入画像名称'), {
      target: { value: '   ' },
    })

    saveButton.removeAttribute('disabled')
    ;(saveButton as HTMLButtonElement).disabled = false
    triggerReactClick(saveButton)

    expect(screen.getByRole('dialog', { name: '创建自定义读者画像' })).toBeInTheDocument()

    const focusAreaButton = within(dialog).getByRole('button', { name: '对话' })
    fireEvent.click(focusAreaButton)
    fireEvent.click(focusAreaButton)

    expect(focusAreaButton.className).toContain('bg-dark-border')
  })

  it('blocks removing the last selected custom persona after it is saved', () => {
    const onSelectionChange = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(24680)

    const { rerender } = render(
      <PersonaSelector
        selectedPersonaIds={['general-reader']}
        onSelectionChange={onSelectionChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '创建自定义画像' }))

    const dialog = screen.getByRole('dialog', { name: '创建自定义读者画像' })
    fireEvent.change(within(dialog).getByPlaceholderText('输入画像名称'), {
      target: { value: '唯一自定义画像' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    rerender(
      <PersonaSelector
        selectedPersonaIds={['custom-24680']}
        onSelectionChange={onSelectionChange}
      />,
    )

    onSelectionChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /唯一自定义画像/ }))

    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('returns early from the selection handler when disabled mode is bypassed at the DOM layer', () => {
    const onSelectionChange = vi.fn()

    render(
      <PersonaSelector
        selectedPersonaIds={['general-reader']}
        onSelectionChange={onSelectionChange}
        disabled
      />,
    )

    const disabledButton = screen.getByRole('button', { name: /文学评论家/ })
    disabledButton.removeAttribute('disabled')
    ;(disabledButton as HTMLButtonElement).disabled = false

    triggerReactClick(disabledButton)

    expect(onSelectionChange).not.toHaveBeenCalled()
  })

  it('uses the fallback description when no focus area is selected', () => {
    const onSelectionChange = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(67890)

    render(
      <PersonaSelector
        selectedPersonaIds={['general-reader']}
        onSelectionChange={onSelectionChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '创建自定义画像' }))

    const dialog = screen.getByRole('dialog', { name: '创建自定义读者画像' })
    fireEvent.change(within(dialog).getByPlaceholderText('输入画像名称'), {
      target: { value: '冷静审校者' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: '保存' }))

    expect(screen.getByRole('button', { name: /冷静审校者/ })).toBeInTheDocument()
    expect(screen.getByText('自定义读者画像：综合评价')).toBeInTheDocument()
  })
})
