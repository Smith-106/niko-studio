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

// -- Branch 1,2,3: fingerprint optional arrays empty/null --
// VoiceFingerprint type declares arrays as required (string[]),
// but the component uses optional chaining (?.length) to guard,
// implying runtime data may omit these fields.

const fingerprintAllEmpty: VoiceFingerprintResult = {
  voiceDistinctness: 0.55,
  warnings: [],
  suggestions: [],
  fingerprints: [
    {
      character: '叶辰',
      dialogueCount: 5,
      // sentenceLengthPreference omitted — not rendered in VoiceCard
      catchphrases: [],
      formalityLevel: 0.6,
      emotionalExpressionTendency: 0.3,
      rhetoricalHabits: [],
      sampleDialogues: [],
    },
  ],
}

// -- Branch 4: API returns !success with no error → fallback message --
// -- Branch 5: analyzeVoiceConsistency throws a non-Error --

// -- Branch 7: warnings exist with multiple severity levels --

const resultWithWarnings: VoiceFingerprintResult = {
  voiceDistinctness: 0.65,
  warnings: [
    {
      character: '沈墨',
      line: '你先别说话。',
      issue: '语气偏离',
      severity: 'high',
    },
    {
      character: '林晓薇',
      line: '怎么会这样？',
      issue: '情感不一致',
      severity: 'medium',
    },
    {
      character: '叶辰',
      line: '嗯。',
      issue: '台词过短',
      severity: 'low',
    },
  ],
  suggestions: [],
  fingerprints: [],
}

// -- Branch 8: suggestions exist --

const resultWithSuggestions: VoiceFingerprintResult = {
  voiceDistinctness: 0.72,
  warnings: [],
  suggestions: ['增强角色口头禅', '拉开语气差异', '减少相似句式', '额外建议不入列表'],
  fingerprints: [],
}

// -- Branch 6: result visible when not loading is already covered by existing
//    tests but we add an explicit assertion for the conditional branch --

describe('VoiceFingerprintPanel — branch coverage', () => {
  beforeEach(() => {
    analyzeVoiceConsistencyMock.mockReset()
  })

  // Branch 1: catchphrases empty → renders nothing for catchphrases section
  // Branch 2: rhetoricalHabits empty → renders nothing for rhetorical habits section
  // Branch 3: sampleDialogues empty → renders nothing for sample dialogues section
  it('renders VoiceCard without catchphrases, rhetoricalHabits, or sampleDialogues sections when arrays are empty', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: fingerprintAllEmpty,
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：55%')).toBeInTheDocument()
    })

    // Character card is rendered
    expect(screen.getByText('叶辰')).toBeInTheDocument()
    expect(screen.getByText('对话 5 句')).toBeInTheDocument()
    expect(screen.getByText('progress:60')).toBeInTheDocument()
    expect(screen.getByText('progress:30')).toBeInTheDocument()

    // None of the optional sections appear
    expect(screen.queryByText('口头禅')).not.toBeInTheDocument()
    expect(screen.queryByText('修辞习惯')).not.toBeInTheDocument()
    expect(screen.queryByText('示例对话')).not.toBeInTheDocument()

    // No IntelligenceBadge rendered for this fingerprint
    expect(screen.queryByText(/success:/)).not.toBeInTheDocument()
  })

  // Branch 4: API returns !success with undefined error → uses fallback 'Analysis failed'
  it('shows fallback error message when API returns failure without an error string', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: false,
      // error field is undefined
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('Analysis failed')).toBeInTheDocument()
    })
  })

  // Branch 5: analyzeVoiceConsistency throws a non-Error value
  it('shows "Unknown error" when analyzeVoiceConsistency throws a non-Error', async () => {
    analyzeVoiceConsistencyMock.mockRejectedValueOnce('string error, not an Error')

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('Unknown error')).toBeInTheDocument()
    })
  })

  // Branch 5 variant: throws an Error instance
  it('shows error.message when analyzeVoiceConsistency throws an Error', async () => {
    analyzeVoiceConsistencyMock.mockRejectedValueOnce(new Error('runtime crash'))

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('runtime crash')).toBeInTheDocument()
    })
  })

  // Branch 6: result panel visible when loading is false
  it('hides result section while loading and shows it once loading completes', async () => {
    let resolveAnalysis!: (value: unknown) => void
    const pending = new Promise((res) => {
      resolveAnalysis = res
    })

    analyzeVoiceConsistencyMock.mockReturnValueOnce(pending)

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    // While loading, result section is not visible even if result state
    // had a previous value (fresh mount, so result is null here)
    expect(screen.queryByText(/声音区分度/)).not.toBeInTheDocument()
    expect(screen.getByText('正在分析对话声音...')).toBeInTheDocument()

    resolveAnalysis({
      success: true,
      data: fingerprintAllEmpty,
    })

    // After loading completes, result section becomes visible
    await waitFor(() => {
      expect(screen.getByText('声音区分度：55%')).toBeInTheDocument()
    })
    expect(screen.queryByText('正在分析对话声音...')).not.toBeInTheDocument()
  })

  // Branch 7: warnings exist with multiple severities (low, medium, high)
  it('renders warnings section with low, medium, and high severity colors', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: resultWithWarnings,
    })

    const { container } = render(
      <VoiceFingerprintPanel text="对话文本" visible />,
    )

    await waitFor(() => {
      expect(screen.getByText('声音区分度：65%')).toBeInTheDocument()
    })

    // Warnings heading appears
    expect(screen.getByText('不一致告警')).toBeInTheDocument()

    // All three severity levels are rendered
    expect(screen.getByText('沈墨 · HIGH')).toBeInTheDocument()
    expect(screen.getByText('林晓薇 · MEDIUM')).toBeInTheDocument()
    expect(screen.getByText('叶辰 · LOW')).toBeInTheDocument()

    // Verify severity colors are applied via inline styles
    const highEl = screen.getByText('沈墨 · HIGH')
    const medEl = screen.getByText('林晓薇 · MEDIUM')
    const lowEl = screen.getByText('叶辰 · LOW')

    expect(highEl.style.color).toBe('rgb(220, 38, 38)')   // #dc2626
    expect(medEl.style.color).toBe('rgb(217, 119, 6)')    // #d97706
    expect(lowEl.style.color).toBe('rgb(148, 163, 184)')  // #94a3b8

    // Issue descriptions are shown
    expect(screen.getByText('语气偏离')).toBeInTheDocument()
    expect(screen.getByText('情感不一致')).toBeInTheDocument()
    expect(screen.getByText('台词过短')).toBeInTheDocument()
  })

  // Branch 7 complement: no warnings → warnings section hidden
  it('hides warnings section when there are no warnings', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: {
        voiceDistinctness: 0.9,
        warnings: [],
        suggestions: [],
        fingerprints: [],
      },
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：90%')).toBeInTheDocument()
    })

    expect(screen.queryByText('不一致告警')).not.toBeInTheDocument()
  })

  // Branch 8: suggestions exist → suggestions line rendered
  it('renders suggestions when they exist, capped at 3 joined by semicolons', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: resultWithSuggestions,
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：72%')).toBeInTheDocument()
    })

    // Only first 3 suggestions, joined by Chinese semicolons
    expect(
      screen.getByText('建议：增强角色口头禅；拉开语气差异；减少相似句式'),
    ).toBeInTheDocument()

    // The 4th suggestion is not rendered
    expect(screen.queryByText(/额外建议/)).not.toBeInTheDocument()
  })

  // Branch 8 complement: no suggestions → suggestions section hidden
  it('hides suggestions when they are empty', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: {
        voiceDistinctness: 0.5,
        warnings: [],
        suggestions: [],
        fingerprints: [
          {
            character: 'A',
            dialogueCount: 1,
            catchphrases: [],
            formalityLevel: 0.5,
            emotionalExpressionTendency: 0.5,
            rhetoricalHabits: [],
            sampleDialogues: [],
          },
        ],
      },
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：50%')).toBeInTheDocument()
    })

    expect(screen.queryByText(/建议/)).not.toBeInTheDocument()
  })

  // Combined: VoiceCard with sampleDialogues present (covers the render
  // path for the <details> element which was only in the "all empty"
  // branch above)
  it('renders sampleDialogues as a details element when present', async () => {
    analyzeVoiceConsistencyMock.mockResolvedValueOnce({
      success: true,
      data: {
        voiceDistinctness: 0.8,
        warnings: [],
        suggestions: [],
        fingerprints: [
          {
            character: '沈墨',
            dialogueCount: 10,
            catchphrases: ['先别急', '听我说'],
            formalityLevel: 0.75,
            emotionalExpressionTendency: 0.4,
            rhetoricalHabits: ['反问句', '设问'],
            sampleDialogues: ['"先别急，证据会说话。"', '"听我说完再下结论。"'],
          },
        ],
      },
    })

    render(<VoiceFingerprintPanel text="对话文本" visible />)

    await waitFor(() => {
      expect(screen.getByText('声音区分度：80%')).toBeInTheDocument()
    })

    // Catchphrases and rhetoricalHabits badges
    expect(screen.getByText('success:先别急')).toBeInTheDocument()
    expect(screen.getByText('success:听我说')).toBeInTheDocument()
    expect(screen.getByText('success:反问句')).toBeInTheDocument()
    expect(screen.getByText('success:设问')).toBeInTheDocument()

    // Sample dialogues in <details> — multiline text with \n\n join
    expect(screen.getByText('示例对话')).toBeInTheDocument()
    const dialogueEl = screen.getByText((content) =>
      content.includes('先别急，证据会说话') && content.includes('听我说完再下结论'),
    )
    expect(dialogueEl).toBeInTheDocument()
  })
})
