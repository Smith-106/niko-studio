import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { VoiceFingerprintResult } from '../../api/writing-craft'

const analyzeVoiceConsistencyMock = vi.hoisted(() => vi.fn())

vi.mock('../../api/writing-craft', () => ({
  analyzeVoiceConsistency: analyzeVoiceConsistencyMock,
}))

vi.mock('./SectionHeader', () => ({
  SectionHeader: ({ title }: { title: string }) => <h3>{title}</h3>,
}))

vi.mock('./ProgressBar', () => ({
  ProgressBar: ({ value }: { value: number }) => <div>{`progress:${value}`}</div>,
}))

vi.mock('./IntelligenceBadge', () => ({
  IntelligenceBadge: ({
    children,
    variant,
  }: {
    children: unknown
    variant: string
  }) => <span>{`${variant}:${children}`}</span>,
}))

import { VoiceFingerprintPanel } from './VoiceFingerprintPanel'

const voiceResult: VoiceFingerprintResult = {
  voiceDistinctness: 0.78,
  warnings: [
    {
      character: '沈墨',
      line: '你先别说话。',
      issue: '语气偏离',
      severity: 'high',
    },
  ],
  suggestions: ['增强角色口头禅', '拉开语气差异'],
  fingerprints: [
    {
      character: '沈墨',
      dialogueCount: 12,
      catchphrases: ['先别急'],
      formalityLevel: 0.81,
      emotionalExpressionTendency: 0.42,
      rhetoricalHabits: ['反问句'],
      sampleDialogues: ['“先别急，证据会说话。”'],
    },
    {
      character: '林晓薇',
      dialogueCount: 7,
      catchphrases: [],
      formalityLevel: 0.27,
      emotionalExpressionTendency: 0.88,
      rhetoricalHabits: [],
      sampleDialogues: [],
    },
  ],
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('VoiceFingerprintPanel', () => {
  beforeEach(() => {
    analyzeVoiceConsistencyMock.mockReset()
  })

  it('returns null when hidden and avoids analysis for blank text', () => {
    const { container, rerender } = render(
      <VoiceFingerprintPanel text="角色对话" visible={false} />,
    )

    expect(container).toBeEmptyDOMElement()
    expect(analyzeVoiceConsistencyMock).not.toHaveBeenCalled()

    rerender(<VoiceFingerprintPanel text="   " visible />)
    expect(screen.getByRole('button', { name: '重新分析' })).toBeDisabled()
    expect(analyzeVoiceConsistencyMock).not.toHaveBeenCalled()
  })

  it('shows loading, renders the analysis result, and supports re-analysis', async () => {
    const deferred = createDeferred<{
      success: boolean
      data?: VoiceFingerprintResult
      error?: string
    }>()

    analyzeVoiceConsistencyMock
      .mockReturnValueOnce(deferred.promise)
      .mockResolvedValueOnce({ success: true, data: voiceResult })

    render(<VoiceFingerprintPanel text="角色对话片段" visible />)

    expect(analyzeVoiceConsistencyMock).toHaveBeenCalledWith('角色对话片段')
    expect(screen.getByRole('button', { name: '分析中...' })).toBeDisabled()
    expect(screen.getByText('正在分析对话声音...')).toBeInTheDocument()

    deferred.resolve({ success: true, data: voiceResult })

    await waitFor(() => {
      expect(screen.getByText('声音区分度：78%')).toBeInTheDocument()
    })

    expect(screen.getByText('progress:78')).toBeInTheDocument()
    expect(screen.getByText('沈墨 · HIGH')).toBeInTheDocument()
    expect(screen.getByText('语气偏离')).toBeInTheDocument()
    expect(screen.getByText('对话 12 句')).toBeInTheDocument()
    expect(screen.getAllByText('success:先别急')).toHaveLength(1)
    expect(screen.getAllByText('success:反问句')).toHaveLength(1)
    expect(screen.getByText('建议：增强角色口头禅；拉开语气差异')).toBeInTheDocument()
    expect(screen.getByText('progress:81')).toBeInTheDocument()
    expect(screen.getByText('progress:42')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重新分析' }))

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledTimes(2)
    })
  })

  it('renders backend and thrown errors from the analysis flow', async () => {
    analyzeVoiceConsistencyMock
      .mockResolvedValueOnce({ success: false, error: 'gateway unavailable' })
      .mockRejectedValueOnce(new Error('network down'))

    const { rerender } = render(<VoiceFingerprintPanel text="角色对话" visible />)

    await waitFor(() => {
      expect(screen.getByText('gateway unavailable')).toBeInTheDocument()
    })

    rerender(<VoiceFingerprintPanel text="更新后的角色对话" visible />)

    await waitFor(() => {
      expect(screen.getByText('network down')).toBeInTheDocument()
    })
  })
})
