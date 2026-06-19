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

vi.mock('lucide-react', () => ({
  AlertCircle: ({ size }: { size: number }) => <svg data-size={size} />,
  Loader2: ({ size, className }: { size: number; className: string }) => (
    <svg data-size={size} data-class={className} />
  ),
}))

import { VoiceFingerprintPanel } from './VoiceFingerprintPanel'

describe('VoiceFingerprintPanel additional branch coverage', () => {
  beforeEach(() => {
    analyzeVoiceConsistencyMock.mockReset()
  })

  // Branch: scoreToPercent clamps score < 0 to 0
  it('clamps voiceDistinctness below 0 to 0%', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: {
        voiceDistinctness: -0.3,
        warnings: [],
        suggestions: [],
        fingerprints: [],
      } as VoiceFingerprintResult,
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：0%')).toBeInTheDocument()
    })
  })

  // Branch: scoreToPercent clamps score > 1 to 100
  it('clamps voiceDistinctness above 1 to 100%', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: {
        voiceDistinctness: 1.5,
        warnings: [],
        suggestions: [],
        fingerprints: [],
      } as VoiceFingerprintResult,
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：100%')).toBeInTheDocument()
    })
  })

  // Branch: handleAnalyze early return when text.trim() is empty
  it('does not call API and disables button when text is only whitespace', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: { voiceDistinctness: 0.5, warnings: [], suggestions: [], fingerprints: [] },
    })

    render(<VoiceFingerprintPanel text="   " visible />)

    // The component should render but the button should be disabled
    const button = screen.getByRole('button', { name: '重新分析' })
    expect(button).toBeDisabled()

    // The useEffect should still fire but handleAnalyze returns early
    // because !text.trim() is true — so no API call
    expect(analyzeVoiceConsistencyMock).not.toHaveBeenCalled()
  })

  // Branch: component returns null when visible is false
  it('returns null when visible is false', () => {
    const { container } = render(<VoiceFingerprintPanel text="text" visible={false} />)

    expect(container.innerHTML).toBe('')
  })

  // Branch: result with no warnings and no suggestions (already partially covered, add explicit)
  it('renders result with 0 distinctness when result has exact 0 voiceDistinctness', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: {
        voiceDistinctness: 0,
        warnings: [],
        suggestions: [],
        fingerprints: [
          {
            character: '无名',
            dialogueCount: 1,
            catchphrases: null as unknown as string[],
            formalityLevel: 0.5,
            emotionalExpressionTendency: 0.5,
            rhetoricalHabits: undefined as unknown as string[],
            sampleDialogues: null as unknown as string[],
          },
        ],
      },
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：0%')).toBeInTheDocument()
    })

    // fingerprint card renders
    expect(screen.getByText('无名')).toBeInTheDocument()
    // catchphrases, rhetoricalHabits, sampleDialogues are null/undefined → sections not rendered
    expect(screen.queryByText('口头禅')).not.toBeInTheDocument()
    expect(screen.queryByText('修辞习惯')).not.toBeInTheDocument()
    expect(screen.queryByText('示例对话')).not.toBeInTheDocument()
  })

  // Branch: click "重新分析" button to trigger re-analysis
  it('triggers re-analysis when button is clicked after initial load', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValue({
      success: true,
      data: {
        voiceDistinctness: 0.7,
        warnings: [],
        suggestions: [],
        fingerprints: [],
      },
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：70%')).toBeInTheDocument()
    })

    // Click re-analyze
    fireEvent.click(screen.getByRole('button', { name: '重新分析' }))

    await waitFor(() => {
      expect(analyzeVoiceConsistencyMock).toHaveBeenCalledTimes(2)
    })
  })
})
