import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { WritingHelperPanel } from './WritingHelperPanel'
import { translations } from '../i18n'
import { processWritingHelper, polishContent } from '../api/client'
import { getEditorHandle } from '../utils/editorHandle'
import { useAppStore } from '../stores/appStore'
import { useSettingsStore } from '../stores/settingsStore'

vi.mock('../api/client', () => ({
  processWritingHelper: vi.fn(),
  polishContent: vi.fn(),
}))

vi.mock('../utils/editorHandle', () => ({
  getEditorHandle: vi.fn(),
}))

const mockProcessWritingHelper = vi.mocked(processWritingHelper)
const mockPolishContent = vi.mocked(polishContent)
const mockGetEditorHandle = vi.mocked(getEditorHandle)
const en = translations.en
const zh = translations.zh

function enableEnglishOpenAISettings() {
  useSettingsStore.getState().resetSettings()
  const currentProviders = useSettingsStore.getState().settings.llmProviders
  useSettingsStore.getState().updateSettings({
    language: 'en',
    detectionEvasionGuardEnabled: false,
    primaryProvider: 'openai',
    llmProviders: currentProviders.map((provider) =>
      provider.id === 'openai'
        ? {
            ...provider,
            enabled: true,
            apiKey: 'sk-test',
            baseUrl: 'https://api.openai.example/v1',
            defaultModel: 'gpt-4o-mini',
          }
        : provider,
    ),
  })
}

describe('WritingHelperPanel additional coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    enableEnglishOpenAISettings()
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: [],
      availableSkills: ['plot-weaver', 'voice-tuner'],
      personalizedCraftSummary: '',
      personalizedCraftTrajectory: '',
      personalizedCraftRecommendations: [],
    }))
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('supports English style controls, advanced style groups, tag inputs, and outline rendering', async () => {
    const user = userEvent.setup()

    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'outline',
        outline: ['Beat one', 'Beat two'],
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await user.type(screen.getByLabelText(en.writingHelperInputText), 'Draft text for outlining')

    await user.click(screen.getAllByRole('button', { name: /Style Settings/i })[0])
    await user.selectOptions(screen.getByLabelText(en.styleTone), 'formal')
    await user.selectOptions(screen.getByLabelText(en.stylePerspective), 'third')
    await user.selectOptions(screen.getByLabelText(en.styleSentence), 'varied')
    await user.selectOptions(screen.getByLabelText(en.styleRhythmLabel), 'brisk')

    const baseSliders = screen.getAllByRole('slider')
    fireEvent.change(baseSliders[0], { target: { value: '5' } })
    fireEvent.change(baseSliders[1], { target: { value: '4' } })
    fireEvent.change(baseSliders[2], { target: { value: '5' } })
    fireEvent.change(baseSliders[3], { target: { value: '2' } })

    await user.click(screen.getByRole('button', { name: en.styleAdvancedTitle }))

    await user.click(screen.getByRole('button', { name: en.styleStructure }))
    await user.selectOptions(screen.getByLabelText(en.styleParagraphLength), 'long')
    await user.selectOptions(screen.getByLabelText(en.styleTransition), 'dramatic')
    await user.selectOptions(screen.getByLabelText(en.styleHierarchy), 'nested')

    await user.click(screen.getByRole('button', { name: `${en.styleEmotionExpression} / ${en.styleEmotion}` }))
    await user.selectOptions(screen.getByLabelText(en.styleEmotionExpression), 'passionate')
    fireEvent.change(screen.getAllByRole('slider')[4], { target: { value: '5' } })

    await user.click(screen.getByRole('button', { name: en.styleThinkingLogic }))
    await user.selectOptions(screen.getByLabelText(en.styleThinkingLogic), 'deductive')
    fireEvent.change(screen.getAllByRole('slider')[5], { target: { value: '4' } })
    await user.selectOptions(screen.getByLabelText(en.styleThinkingRhythm), 'contemplative')

    await user.click(screen.getByRole('button', { name: en.stylePerspective }))
    await user.selectOptions(screen.getByLabelText(en.styleNarrativeTime), 'flashback')
    await user.selectOptions(screen.getByLabelText(en.styleNarrativeAttitude), 'critical')

    await user.click(screen.getByRole('button', { name: en.styleRhythmLabel }))
    await user.selectOptions(screen.getByLabelText(en.styleRhythmSyllable), 'dense')
    await user.selectOptions(screen.getByLabelText(en.styleRhythmPause), 'minimal')
    await user.selectOptions(screen.getByLabelText(en.styleRhythmTempo), 'varied')

    await user.click(screen.getByRole('button', { name: en.styleUniqueness || 'Uniqueness / Cultural' }))

    const tagInputs = screen.getAllByPlaceholderText(en.styleTagPlaceholder)
    await user.type(tagInputs[0], 'echo{enter}')
    await user.type(tagInputs[1], 'moon{enter}')
    await user.type(tagInputs[2], 'myth{enter}')
    await user.type(tagInputs[3], 'history{enter}')

    await user.click(within(screen.getByText('echo').parentElement as HTMLElement).getByRole('button'))
    await user.click(within(screen.getByText('moon').parentElement as HTMLElement).getByRole('button'))
    await user.click(within(screen.getByText('myth').parentElement as HTMLElement).getByRole('button'))
    await user.click(within(screen.getByText('history').parentElement as HTMLElement).getByRole('button'))

    await user.type(tagInputs[0], 'echo{enter}')
    await user.type(tagInputs[1], 'moon{enter}')
    await user.type(tagInputs[2], 'myth{enter}')
    await user.type(tagInputs[3], 'history{enter}')

    await user.click(screen.getByRole('button', { name: en.writingHelperRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
        content: 'Draft text for outlining',
        mode: 'polish',
        detection_evasion_guard_enabled: false,
        api_key: 'sk-test',
        base_url: 'https://api.openai.example/v1',
        provider: 'openai',
        instruction: expect.stringContaining('Writing style requirements:'),
      }))
    })

    const savedStyle = JSON.parse(localStorage.getItem('niko.writing-helper-style-v1') ?? '{}')
    expect(savedStyle).toMatchObject({
      tone: 'formal',
      perspective: 'third',
      sentenceStyle: 'varied',
      rhythm: 'brisk',
      structure: expect.objectContaining({
        paragraphLength: 'long',
        transitionStyle: 'dramatic',
        hierarchyPattern: 'nested',
      }),
      thinking: expect.objectContaining({
        logicPattern: 'deductive',
        rhythm: 'contemplative',
      }),
      uniqueness: expect.objectContaining({
        signaturePhrases: ['echo'],
        imagerySystem: ['moon'],
      }),
      cultural: expect.objectContaining({
        allusions: ['myth'],
        knowledgeDomains: ['history'],
      }),
    })

    expect(await screen.findByText('Beat one')).toBeInTheDocument()
    expect(screen.getByText('Beat two')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: en.writingHelperInsertToEditor })).not.toBeInTheDocument()
    expect(screen.getByText('Explicitly apply skill packs to this writing run.')).toBeInTheDocument()
  })

  it('surfaces legacy polish errors and provider-backed request failures', async () => {
    const user = userEvent.setup()

    mockPolishContent.mockResolvedValue({
      error: 'legacy failed',
      originalText: 'Draft',
      polishedText: '',
      diffMarkup: '',
    })

    useSettingsStore.getState().updateSettings({
      writingHelperUseLegacyPolish: true,
    })

    const { rerender } = render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await user.type(screen.getByLabelText(en.writingHelperInputText), 'Legacy draft')
    await user.click(screen.getByRole('button', { name: en.writingHelperRun }))

    expect(mockPolishContent).toHaveBeenCalledWith(expect.objectContaining({
      originalText: 'Legacy draft',
      polishType: 'standard',
    }))
    expect(await screen.findByText('legacy failed')).toBeInTheDocument()

    mockProcessWritingHelper.mockRejectedValue(new Error('boom'))
    useSettingsStore.getState().updateSettings({
      writingHelperUseLegacyPolish: false,
    })

    rerender(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    const input = screen.getByLabelText(en.writingHelperInputText)
    fireEvent.change(input, { target: { value: 'Provider-backed request' } })
    await user.click(screen.getByRole('button', { name: en.writingHelperRun }))

    expect(await screen.findByText('Error: boom')).toBeInTheDocument()
  })

  it('renders English handoff details, restores guidance, and coerces zero limits to one', async () => {
    const user = userEvent.setup()

    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['plot-weaver'],
      availableSkills: ['plot-weaver', 'voice-tuner'],
      personalizedCraftSummary: 'Focus on atmosphere.',
      personalizedCraftTrajectory: 'Momentum is holding steady.',
      personalizedCraftRecommendations: ['Lean into suspense.'],
    }))

    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        processed_text: 'English revised text.',
        skills_used: ['plot-weaver', 'voice-tuner'],
      },
    })

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: 'English draft body',
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 5,
          guidance: [
            'Prioritize this evaluation guidance:',
            'Tighten the reveal before the midpoint.',
            'Preserve the uncertainty in the dialogue beats.',
          ].join('\n'),
          handoff: {
            source: 'evaluation',
            suggestionTitle: 'Tighten the reveal',
            suggestionReason: 'Increase suspense',
            guidance: [
              'Prioritize this evaluation guidance:',
              'Tighten the reveal before the midpoint.',
              'Preserve the uncertainty in the dialogue beats.',
            ].join('\n'),
            carriedContent: 'original-reply',
            preset: {
              mode: 'rewrite',
              maxSentences: 4,
              maxItems: 5,
            },
            revisionSession: {
              id: 'revision-session-en',
              comparisonSummary: 'Use a slower reveal.',
            },
          },
        }}
      />,
    )

    expect(screen.getByText('Evaluation handoff preset')).toBeInTheDocument()
    expect(screen.getByText('Personalized craft profile')).toBeInTheDocument()
    expect(screen.getByText('Focus on atmosphere.')).toBeInTheDocument()
    expect(screen.getByText('1 skill packs applied')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Expand preset details' }))
    expect(screen.getByRole('button', { name: 'Expand guidance' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand guidance' }))
    expect(screen.getByRole('button', { name: 'Collapse guidance' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear guidance' }))
    const restoreGuidanceButtons = screen.getAllByRole('button', { name: /Restore recommended guidance/ })
    expect(restoreGuidanceButtons.length).toBeGreaterThan(0)
    await user.click(restoreGuidanceButtons[0])
    expect(screen.getByText('Matches recommendation')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(en.writingHelperMaxSentences), {
      target: { value: '0' },
    })
    fireEvent.change(screen.getByLabelText(en.writingHelperMaxItems), {
      target: { value: '0' },
    })
    await user.click(screen.getByRole('button', { name: 'voice-tuner' }))
    await user.click(screen.getByRole('button', { name: en.writingHelperRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
        content: 'English draft body',
        mode: 'rewrite',
        max_sentences: 1,
        max_items: 1,
        skill_ids: ['plot-weaver', 'voice-tuner'],
        instruction: expect.stringContaining('Prioritize the following handoff guidance:'),
      }))
    })

    expect(await screen.findByText('Applied skill packs')).toBeInTheDocument()
    expect(screen.getAllByText('plot-weaver').length).toBeGreaterThan(0)
    expect(screen.getAllByText('voice-tuner').length).toBeGreaterThan(0)
    expect(screen.getByText('English revised text.')).toBeInTheDocument()
  })

  it('falls back when skill arrays or toggle handlers are malformed', async () => {
    const user = userEvent.setup()

    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: 'broken-selected-skills' as unknown as string[],
      availableSkills: null as unknown as string[],
      toggleSkill: undefined as unknown as typeof state.toggleSkill,
    }))

    const firstRender = render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)
    expect(screen.queryByRole('button', { name: 'solo-skill' })).not.toBeInTheDocument()
    expect(screen.getByText('Explicitly apply skill packs to this writing run.')).toBeInTheDocument()
    firstRender.unmount()

    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: 'broken-selected-skills' as unknown as string[],
      availableSkills: ['solo-skill'],
      toggleSkill: undefined as unknown as typeof state.toggleSkill,
    }))

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)
    const fallbackSkillButton = screen.getByRole('button', { name: 'solo-skill' })
    expect(fallbackSkillButton).toHaveAttribute('aria-pressed', 'false')

    await user.click(fallbackSkillButton)

    expect(fallbackSkillButton).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Explicitly apply skill packs to this writing run.')).toBeInTheDocument()
  })

  it('renders english preset fallback branches, clipped guidance previews, and callback updates', async () => {
    const user = userEvent.setup()
    const onDraftStateChange = vi.fn()
    const originalTempoModerate = en.styleRhythmTempoModerate
    const originalUniqueness = en.styleUniqueness
    const longGuidance = `Prioritize this evaluation guidance: ${'A'.repeat(180)}`

    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['plot-weaver'],
      availableSkills: ['plot-weaver', 'voice-tuner'],
      personalizedCraftSummary: '',
      personalizedCraftTrajectory: 'Momentum only.',
      personalizedCraftRecommendations: [],
    }))

    en.styleRhythmTempoModerate = ''
    en.styleUniqueness = ''

    try {
      render(
        <WritingHelperPanel
          onClose={() => {}}
          onOpenSettings={() => {}}
          onDraftStateChange={onDraftStateChange}
          draftState={{
            content: 'English callback draft',
            mode: 'rewrite',
            maxSentences: 4,
            maxItems: 5,
            guidance: longGuidance,
            handoff: {
              source: 'evaluation',
              suggestionTitle: 'Sharpen reveal',
              suggestionReason: 'Keep tension',
              guidance: longGuidance,
              carriedContent: 'revision-preview',
              preset: {
                mode: 'rewrite',
                maxSentences: 4,
                maxItems: 5,
              },
              revisionSession: {
                id: 'revision-session-en',
                state: 'COMPARED',
              },
            },
          }}
        />,
      )

      await waitFor(() => {
        expect(onDraftStateChange).toHaveBeenCalledWith({
          content: 'English callback draft',
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 5,
          guidance: longGuidance,
          handoff: expect.objectContaining({
            carriedContent: 'revision-preview',
          }),
        })
      })

      await user.selectOptions(screen.getByLabelText(en.writingHelperMode), 'expand')
      await user.click(screen.getByRole('button', { name: 'Expand preset details' }))

      expect(screen.getByText('Mode changed')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Restore recommended mode' })).toBeInTheDocument()
      expect(screen.getByText('Carries: revision preview')).toBeInTheDocument()
      expect(screen.getByText(/Revision session: revision-session-en/)).toBeInTheDocument()
      expect(screen.getByText(/COMPARED/)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Expand guidance' })).toBeInTheDocument()
      expect(screen.queryByText(longGuidance)).not.toBeInTheDocument()
      expect(screen.getByText('Personalized craft profile')).toBeInTheDocument()
      expect(screen.getByText('Momentum only.')).toBeInTheDocument()

      await user.click(screen.getAllByRole('button', { name: /Style Settings/i })[0])
      await user.click(screen.getByRole('button', { name: en.styleAdvancedTitle }))
      await user.click(screen.getByRole('button', { name: en.styleRhythmLabel }))
      expect(screen.getAllByRole('option', { name: en.styleRhythmModerate }).length).toBeGreaterThan(0)
      expect(screen.getByRole('button', { name: '独特性 / 文化' })).toBeInTheDocument()
    } finally {
      en.styleRhythmTempoModerate = originalTempoModerate
      en.styleUniqueness = originalUniqueness
    }
  })

  it('shows personalized craft profile when only recommendations remain', () => {
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['plot-weaver'],
      availableSkills: ['plot-weaver'],
      personalizedCraftSummary: '',
      personalizedCraftTrajectory: '',
      personalizedCraftRecommendations: ['Lean into suspense.'],
    }))

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: 'English draft body',
          mode: 'rewrite',
          maxSentences: 4,
          maxItems: 5,
          guidance: 'Prioritize this evaluation guidance:\nKeep suspense alive.',
          handoff: {
            source: 'evaluation',
            suggestionTitle: 'Keep suspense',
            suggestionReason: 'Hold reader attention',
            guidance: 'Prioritize this evaluation guidance:\nKeep suspense alive.',
            carriedContent: 'original-reply',
            preset: {
              mode: 'rewrite',
              maxSentences: 4,
              maxItems: 5,
            },
          },
        }}
      />,
    )

    expect(screen.getByText('Personalized craft profile')).toBeInTheDocument()
    expect(screen.getByText('Lean into suspense.')).toBeInTheDocument()
  })

  it('surfaces unsuccessful responses in zh mode with no selected skills', async () => {
    const user = userEvent.setup()

    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: [],
      availableSkills: [],
      personalizedCraftSummary: '',
      personalizedCraftTrajectory: '',
      personalizedCraftRecommendations: [],
    }))
    mockProcessWritingHelper.mockResolvedValue({
      success: false,
      error: 'service failed',
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await user.type(screen.getByLabelText(zh.writingHelperInputText), '中文草稿')
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(await screen.findByText('service failed')).toBeInTheDocument()
  })

  it('covers replace and insert alternative handlers via RevisionPreviewCard', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => '原始内容。'),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => ({ from: 3, to: 8, text: '原始内容。' })),
      replaceSelectionSnapshot: vi.fn(() => true),
      insertBelowSelectionSnapshot: vi.fn(() => true),
      undoLastRevisionApply: vi.fn(() => false),
      triggerAIContinue: vi.fn(),
    }

    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: 'rewritten text',
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByLabelText(en.writingHelperInputText)).toHaveValue('原始内容。')

    await user.selectOptions(screen.getByLabelText(en.writingHelperMode), 'rewrite')
    await user.click(screen.getByRole('button', { name: en.writingHelperRun }))

    await waitFor(() => {
      expect(mockProcessWritingHelper).toHaveBeenCalled()
    })

    // Verify buttons are visible when processedText exists
    expect(screen.getByRole('button', { name: 'Replace selection' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Insert as alternative' })).toBeInTheDocument()

    // Click both buttons to trigger the handlers
    await user.click(screen.getByRole('button', { name: 'Replace selection' }))
    await user.click(screen.getByRole('button', { name: 'Insert as alternative' }))
  })
})
