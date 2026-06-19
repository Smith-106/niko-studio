import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { GuidedOptions } from './GuidedOptions'
import type { GuidedOptionData } from './GuidedOptions'

const guidedOptions: GuidedOptionData[] = [
  {
    index: 0,
    text: '方案一保留叙述节奏，同时补强角色动机。',
    scores: {
      coherence: 85,
      creativity: 65,
      styleMatch: 35,
    },
    overallScore: 90,
  },
  {
    index: 1,
    text: '方案二强调冲突升级，让对话更锋利直接。',
    scores: {
      coherence: 78,
      creativity: 82,
      styleMatch: 61,
    },
    overallScore: 70,
  },
  {
    index: 2,
    text: '方案三尝试实验性视角切换，但风格稳定度较低。',
    scores: {
      coherence: 42,
      creativity: 58,
      styleMatch: 33,
    },
    overallScore: 50,
  },
]

describe('GuidedOptions', () => {
  it('renders option content with color-coded score bars and badges', () => {
    const { container } = render(
      <GuidedOptions options={guidedOptions} onSelect={vi.fn()} />
    )

    expect(screen.getByText(guidedOptions[0].text)).toBeInTheDocument()
    expect(screen.getByText(guidedOptions[1].text)).toBeInTheDocument()
    expect(screen.getByText(guidedOptions[2].text)).toBeInTheDocument()
    expect(screen.getAllByText('连贯')).toHaveLength(3)
    expect(screen.getAllByText('创意')).toHaveLength(3)
    expect(screen.getAllByText('风格')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(3)

    expect(screen.getByText('85').className).toContain('text-emerald-400')
    expect(screen.getByText('65').className).toContain('text-amber-400')
    expect(screen.getByText('35').className).toContain('text-red-400')
    expect(screen.getByText('90').className).toContain('text-emerald-400')
    expect(screen.getByText('70').className).toContain('text-amber-400')
    expect(screen.getByText('50').className).toContain('text-red-400')

    const greenBar = container.querySelector('.bg-emerald-500') as HTMLDivElement | null
    const amberBar = container.querySelector('.bg-amber-500') as HTMLDivElement | null
    const redBar = container.querySelector('.bg-red-500') as HTMLDivElement | null

    expect(greenBar?.style.width).toBe('85%')
    expect(amberBar?.style.width).toBe('65%')
    expect(redBar?.style.width).toBe('35%')
  })

  it('updates selection from both card clicks and action buttons without double-calling', () => {
    const onSelect = vi.fn()

    render(<GuidedOptions options={guidedOptions.slice(0, 2)} onSelect={onSelect} />)

    fireEvent.click(screen.getByText(guidedOptions[0].text))

    const [firstButton, secondButton] = screen.getAllByRole('button')

    expect(onSelect).toHaveBeenNthCalledWith(1, 0)
    expect(firstButton.className).toContain('bg-blue-600/80')
    expect(secondButton.className).toContain('bg-zinc-700')

    fireEvent.click(secondButton)

    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect).toHaveBeenNthCalledWith(2, 1)
    expect(firstButton.className).toContain('bg-zinc-700')
    expect(secondButton.className).toContain('bg-blue-600/80')
  })

  it('prevents selection while disabled', () => {
    const onSelect = vi.fn()

    render(<GuidedOptions options={guidedOptions.slice(0, 1)} onSelect={onSelect} disabled />)

    const optionText = screen.getByText(guidedOptions[0].text)
    const card = optionText.parentElement as HTMLElement
    const actionButton = screen.getByRole('button')

    expect(card.className).toContain('opacity-40')
    expect(actionButton).toBeDisabled()

    fireEvent.click(optionText)
    fireEvent.click(actionButton)

    expect(onSelect).not.toHaveBeenCalled()
    expect(actionButton.className).toContain('bg-zinc-700')
  })
})
