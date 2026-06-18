import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { PersonaSelector } from './PersonaSelector'

describe('PersonaSelector', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('toggles selections, prevents removing the last persona, and respects disabled mode', () => {
    const onSelectionChange = vi.fn()

    const { rerender } = render(
      <PersonaSelector
        selectedPersonaIds={['suspense-enthusiast']}
        onSelectionChange={onSelectionChange}
      />,
    )

    expect(screen.getByText('已选 1 个')).toBeInTheDocument()

    // 新增预设也应出现在界面上
    expect(screen.getByRole('button', { name: /节奏猎手/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /反 AI 味评论家/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /青春文学读者/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /网文老读者/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /文学评论家/ }))

    expect(onSelectionChange).toHaveBeenCalledWith([
      'suspense-enthusiast',
      'literary-critic',
    ])

    onSelectionChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /悬疑爱好者/ }))

    expect(onSelectionChange).not.toHaveBeenCalled()

    rerender(
      <PersonaSelector
        selectedPersonaIds={['suspense-enthusiast']}
        onSelectionChange={onSelectionChange}
        disabled
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /文学评论家/ }))

    expect(onSelectionChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '创建自定义画像' })).toBeDisabled()
  })

  it('creates a custom persona, applies modal controls, and exposes it for selection', () => {
    const onSelectionChange = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(12345)

    render(
      <PersonaSelector
        selectedPersonaIds={['general-reader']}
        onSelectionChange={onSelectionChange}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '创建自定义画像' }))

    const dialog = screen.getByRole('dialog', { name: '创建自定义读者画像' })
    const saveButton = within(dialog).getByRole('button', { name: '保存' })

    expect(saveButton).toBeDisabled()

    fireEvent.change(within(dialog).getByPlaceholderText('输入画像名称'), {
      target: { value: '偏执校对者' },
    })

    const sliders = within(dialog).getAllByRole('slider')
    fireEvent.change(sliders[0], { target: { value: '0.8' } })
    fireEvent.change(sliders[4], { target: { value: '0.65' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '对话' }))
    fireEvent.click(within(dialog).getByRole('button', { name: '世界观' }))

    expect(saveButton).not.toBeDisabled()

    fireEvent.click(saveButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /偏执校对者/ })).toBeInTheDocument()
    expect(screen.getByText('对话')).toBeInTheDocument()
    expect(screen.getByText('世界观')).toBeInTheDocument()

    onSelectionChange.mockClear()

    fireEvent.click(screen.getByRole('button', { name: /偏执校对者/ }))

    expect(onSelectionChange).toHaveBeenCalledWith([
      'general-reader',
      'custom-12345',
    ])
  })

  it('supports extended fields in custom persona modal', () => {
    const onSelectionChange = vi.fn()
    vi.spyOn(Date, 'now').mockReturnValue(99999)

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
      target: { value: 'AI 敏感读者' },
    })

    // 调整 AI 味敏感度滑块
    const sliders = within(dialog).getAllByRole('slider')
    // sliders[5] 是 AI 味敏感度（在 4 个权重 + 容忍度之后）
    fireEvent.change(sliders[5], { target: { value: '0.9' } })

    // 选择下拉选项
    const selects = within(dialog).getAllByRole('combobox')
    fireEvent.change(selects[0], { target: { value: 'adult' } })      // 年龄段
    fireEvent.change(selects[1], { target: { value: 'western-literary' } }) // 文化背景
    fireEvent.change(selects[2], { target: { value: 'analytical' } }) // 阅读偏好
    fireEvent.change(selects[3], { target: { value: 'literary-fiction' } }) // 题材偏好

    fireEvent.click(saveButton)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /AI 敏感读者/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /AI 敏感读者/ }))

    expect(onSelectionChange).toHaveBeenCalledWith([
      'general-reader',
      'custom-99999',
    ])
  })
})
