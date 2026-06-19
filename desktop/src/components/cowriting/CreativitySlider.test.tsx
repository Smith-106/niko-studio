import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { CreativitySlider } from './CreativitySlider'

describe('CreativitySlider', () => {
  it('renders percentage, presets, and gradient-driven styles', () => {
    const { container } = render(
      <CreativitySlider value={0.25} mode="auto" onChange={vi.fn()} />
    )

    expect(screen.getByText('创造力光谱')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保守' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '平衡' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '创意' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '实验' })).toBeInTheDocument()

    const filledTrack = Array.from(container.querySelectorAll('div')).find(
      element => (element as HTMLDivElement).style.width === '25%',
    ) as HTMLDivElement | undefined
    const thumbStyle = container.querySelector('style')

    expect(filledTrack?.style.width).toBe('25%')
    expect(thumbStyle?.textContent).toContain('rgb(114,108,247)')
  })

  it('matches slider changes to presets or custom values', () => {
    const onChange = vi.fn()

    render(<CreativitySlider value={0.2} mode="auto" onChange={onChange} />)

    const slider = screen.getByRole('slider')

    fireEvent.change(slider, { target: { value: '0.7' } })
    fireEvent.change(slider, { target: { value: '0.35' } })

    expect(onChange).toHaveBeenNthCalledWith(
      1,
      0.7,
      expect.objectContaining({
        id: 'creative',
        label: '创意',
        value: 0.7,
      }),
    )
    expect(onChange).toHaveBeenNthCalledWith(
      2,
      0.35,
      expect.objectContaining({
        id: 'custom',
        label: '自定义',
        value: 0.35,
      }),
    )
  })

  it('highlights the guided balanced preset and forwards preset button clicks', () => {
    const onChange = vi.fn()

    render(<CreativitySlider value={0.6} mode="guided" onChange={onChange} />)

    const balancedButton = screen.getByRole('button', { name: '平衡' })
    const experimentalButton = screen.getByRole('button', { name: '实验' })

    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(balancedButton.className).toContain('bg-blue-600/80')
    expect(experimentalButton.className).toContain('bg-zinc-800')

    fireEvent.click(experimentalButton)

    expect(onChange).toHaveBeenCalledWith(
      0.9,
      expect.objectContaining({
        id: 'experimental',
        label: '实验',
        value: 0.9,
      }),
    )
  })

  it('leaves all preset buttons inactive when the value does not match any preset tolerance', () => {
    render(<CreativitySlider value={0.35} mode="auto" onChange={vi.fn()} />)

    expect(screen.getByText('35%')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '保守' }).className).toContain('bg-zinc-800')
    expect(screen.getByRole('button', { name: '平衡' }).className).toContain('bg-zinc-800')
    expect(screen.getByRole('button', { name: '创意' }).className).toContain('bg-zinc-800')
    expect(screen.getByRole('button', { name: '实验' }).className).toContain('bg-zinc-800')
  })

  it('disables the slider and preset actions when requested', () => {
    const onChange = vi.fn()
    const { container } = render(
      <CreativitySlider value={0.5} mode="auto" onChange={onChange} disabled />
    )

    const wrapper = container.firstElementChild as HTMLElement
    const slider = screen.getByRole('slider')
    const creativeButton = screen.getByRole('button', { name: '创意' })

    expect(wrapper.className).toContain('opacity-40')
    expect(slider).toBeDisabled()
    expect(creativeButton).toBeDisabled()

    fireEvent.click(creativeButton)

    expect(onChange).not.toHaveBeenCalled()
  })
})
