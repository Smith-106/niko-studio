import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./CreativitySlider', () => ({
  CreativitySlider: ({
    value,
    mode,
    onChange,
    disabled = false,
  }: {
    value: number
    mode: 'auto' | 'guided'
    onChange: (value: number, preset: { id: string; label: string; value: number }) => void
    disabled?: boolean
  }) => (
    <div>
      <div>{`creativity-value:${value.toFixed(2)}`}</div>
      <div>{`creativity-mode:${mode}`}</div>
      <div>{`creativity-disabled:${disabled ? 'yes' : 'no'}`}</div>
      <button
        type="button"
        onClick={() =>
          onChange(0.85, {
            id: 'experimental',
            label: '实验',
            value: 0.85,
          })
        }
        disabled={disabled}
      >
        set creativity
      </button>
    </div>
  ),
}))

vi.mock('./ModeSwitcher', () => ({
  ModeSwitcher: ({
    currentMode,
    onModeChange,
    disabled = false,
  }: {
    currentMode: 'auto' | 'guided'
    onModeChange: (mode: 'auto' | 'guided') => void
    disabled?: boolean
  }) => (
    <div>
      <div>{`mode:${currentMode}`}</div>
      <div>{`mode-disabled:${disabled ? 'yes' : 'no'}`}</div>
      <button type="button" onClick={() => onModeChange('auto')} disabled={disabled}>
        switch-auto
      </button>
      <button type="button" onClick={() => onModeChange('guided')} disabled={disabled}>
        switch-guided
      </button>
    </div>
  ),
}))

vi.mock('./GuidedOptions', () => ({
  GuidedOptions: ({
    options,
    onSelect,
    disabled = false,
  }: {
    options: Array<{ index: number; text: string }>
    onSelect: (index: number) => void
    disabled?: boolean
  }) => (
    <div>
      <div>{`guided-disabled:${disabled ? 'yes' : 'no'}`}</div>
      {options.map((option) => (
        <button
          key={option.index}
          type="button"
          onClick={() => onSelect(option.index)}
          disabled={disabled}
        >
          {`use-${option.index}:${option.text}`}
        </button>
      ))}
      <button type="button" onClick={() => onSelect(999)} disabled={disabled}>
        use-missing
      </button>
    </div>
  ),
}))

import { CoWritingPanel } from './index'

describe('CoWritingPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-03T07:20:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('updates creativity, shows loading state, and renders the auto continuation result', async () => {
    render(<CoWritingPanel />)

    expect(screen.getByText('AI 协作')).toBeInTheDocument()
    expect(screen.getByText('mode:auto')).toBeInTheDocument()
    expect(screen.getByText('creativity-value:0.50')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成续写' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'set creativity' }))

    expect(screen.getByText('creativity-value:0.85')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '生成续写' }))

    expect(screen.getByText('生成中...')).toBeInTheDocument()
    expect(screen.getByText('mode-disabled:yes')).toBeInTheDocument()
    expect(screen.getByText('creativity-disabled:yes')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(screen.getByText('生成结果')).toBeInTheDocument()
    expect(
      screen.getByText(
        'The narrative continues with a sense of quiet anticipation. Characters move through the space with purpose, each action carrying the weight of what came before. The dialogue crackles with subtext, revealing layers of motivation beneath the surface.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('自动')).toBeInTheDocument()
    expect(screen.getByText('claude-sonnet-4-6')).toBeInTheDocument()
    expect(screen.getByText('85%')).toBeInTheDocument()
    expect(screen.getByText('42 tokens')).toBeInTheDocument()
    expect(screen.getByText('mode-disabled:no')).toBeInTheDocument()
    expect(screen.getByText('creativity-disabled:no')).toBeInTheDocument()
  })

  it('switches to guided mode, clears previous results, renders guided options, and tolerates selecting an option', async () => {
    render(<CoWritingPanel />)

    fireEvent.click(screen.getByRole('button', { name: '生成续写' }))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(800)
    })

    expect(screen.getByText('生成结果')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'switch-guided' }))

    expect(screen.getByText('mode:guided')).toBeInTheDocument()
    expect(screen.getByText('creativity-mode:guided')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成选项' })).toBeInTheDocument()
    expect(screen.queryByText('生成结果')).not.toBeInTheDocument()
    expect(screen.queryByText('42 tokens')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '生成选项' }))

    expect(screen.getByText('生成中...')).toBeInTheDocument()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1200)
    })

    expect(screen.getByText('选择续写方案')).toBeInTheDocument()
    expect(
      screen.getByRole('button', {
        name: /use-1:A sudden draft swept through the room, extinguishing the candle and plunging everything into darkness\./,
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('引导')).toBeInTheDocument()
    expect(screen.getByText('156 tokens')).toBeInTheDocument()
    expect(screen.queryByText('85%')).not.toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('button', {
        name: /use-1:A sudden draft swept through the room, extinguishing the candle and plunging everything into darkness\./,
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'use-missing' }))

    fireEvent.click(screen.getByRole('button', { name: 'switch-auto' }))

    expect(screen.getByText('mode:auto')).toBeInTheDocument()
    expect(screen.queryByText('选择续写方案')).not.toBeInTheDocument()
    expect(screen.queryByText('156 tokens')).not.toBeInTheDocument()
  })

  it('surfaces generation errors and clears them when the mode changes', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    setTimeoutSpy.mockImplementationOnce((() => {
      throw new Error('timer exploded')
    }) as typeof setTimeout)

    render(<CoWritingPanel />)

    fireEvent.click(screen.getByRole('button', { name: '生成续写' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('timer exploded')).toBeInTheDocument()
    expect(screen.queryByText('生成结果')).not.toBeInTheDocument()

    setTimeoutSpy.mockRestore()
    fireEvent.click(screen.getByRole('button', { name: 'switch-guided' }))

    expect(screen.queryByText('timer exploded')).not.toBeInTheDocument()
    expect(screen.getByText('mode:guided')).toBeInTheDocument()
  })

  it('falls back to the generic auto error copy for non-Error throws', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')
    setTimeoutSpy.mockImplementationOnce((() => {
      throw 'auto exploded'
    }) as typeof setTimeout)

    render(<CoWritingPanel />)

    fireEvent.click(screen.getByRole('button', { name: '生成续写' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('生成失败')).toBeInTheDocument()
    setTimeoutSpy.mockRestore()
  })

  it('falls back to the generic guided error copy for non-Error throws', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    render(<CoWritingPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'switch-guided' }))
    setTimeoutSpy.mockImplementationOnce((() => {
      throw 'guided exploded'
    }) as typeof setTimeout)

    fireEvent.click(screen.getByRole('button', { name: '生成选项' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('生成失败')).toBeInTheDocument()
    setTimeoutSpy.mockRestore()
  })

  it('surfaces guided error messages when guided generation throws an Error', async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout')

    render(<CoWritingPanel />)

    fireEvent.click(screen.getByRole('button', { name: 'switch-guided' }))
    setTimeoutSpy.mockImplementationOnce((() => {
      throw new Error('guided timer exploded')
    }) as typeof setTimeout)

    fireEvent.click(screen.getByRole('button', { name: '生成选项' }))

    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText('guided timer exploded')).toBeInTheDocument()
    setTimeoutSpy.mockRestore()
  })
})
