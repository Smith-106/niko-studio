import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsModal } from './SettingsModal'
import { useSettingsStore } from '../stores/settingsStore'
import { translations } from '../i18n'

const zh = translations.zh
const en = translations.en

const getInputByLabel = (label: string): HTMLInputElement => {
  const labelNode = screen.getByText(label)
  const container = labelNode.parentElement
  if (!container) {
    throw new Error(`cannot find container for label: ${label}`)
  }
  const input = container.querySelector('input')
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`cannot find input for label: ${label}`)
  }
  return input
}

describe('SettingsModal quality presets', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        language: 'zh',
      },
    }))
  })

  it('updates quality goal sliders when preset changes', async () => {
    render(<SettingsModal isOpen onClose={vi.fn()} />)

    expect(getInputByLabel(zh.qualityGoalNaturalness).value).toBe('85')
    expect(getInputByLabel(zh.qualityGoalReadability).value).toBe('80')
    expect(getInputByLabel(zh.qualityGoalCoherence).value).toBe('80')
    expect(getInputByLabel(zh.qualityGoalStyleConsistency).value).toBe('78')
    expect(getInputByLabel(zh.qualityGoalSentenceEntropy).value).toBe('60')
    expect(getInputByLabel(zh.qualityGoalRhythmVariability).value).toBe('60')

    const presetLabel = screen.getByText(zh.qualityGoalPreset)
    const presetSelect = presetLabel.parentElement?.querySelector('select')
    expect(presetSelect).toBeInstanceOf(HTMLSelectElement)

    await userEvent.selectOptions(presetSelect as HTMLSelectElement, 'ai_edit_guidance')

    expect(getInputByLabel(zh.qualityGoalNaturalness).value).toBe('80')
    expect(getInputByLabel(zh.qualityGoalReadability).value).toBe('88')
    expect(getInputByLabel(zh.qualityGoalCoherence).value).toBe('86')
    expect(getInputByLabel(zh.qualityGoalStyleConsistency).value).toBe('84')
    expect(getInputByLabel(zh.qualityGoalSentenceEntropy).value).toBe('52')
    expect(getInputByLabel(zh.qualityGoalRhythmVariability).value).toBe('50')
  })

  it('persists retrieval and context type settings after save', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    const user = userEvent.setup()

    await user.click(screen.getByLabelText(zh.settingsEnableKnowledgeRetrieval))
    await user.selectOptions(screen.getByDisplayValue(zh.settingsSearchModeHybrid), 'iterative')

    const profileInput = screen.getByPlaceholderText(zh.settingsRetrievalProfilePlaceholder)
    await user.clear(profileInput)
    await user.type(profileInput, 'strict')


    const minScoreInput = getInputByLabel(zh.settingsRetrievalMinScore)
    const budgetTokensInput = getInputByLabel(zh.settingsRetrievalBudgetTokens)
    const maxIterationsInput = getInputByLabel(zh.settingsRetrievalMaxIterations)
    const confidenceThresholdInput = getInputByLabel(zh.settingsRetrievalConfidenceThreshold)

    await user.clear(minScoreInput)
    await user.type(minScoreInput, '0.35')
    await user.clear(budgetTokensInput)
    await user.type(budgetTokensInput, '2048')
    await user.clear(maxIterationsInput)
    await user.type(maxIterationsInput, '6')
    await user.clear(confidenceThresholdInput)
    await user.type(confidenceThresholdInput, '0.9')

    await user.click(screen.getByLabelText(zh.settingsEnableRerank))
    await user.click(screen.getByLabelText(zh.settingsContextTypeCharacter))

    await user.click(screen.getByRole('button', { name: zh.save }))

    const { retrieval, contextTypes } = useSettingsStore.getState().settings
    expect(retrieval.enabled).toBe(false)
    expect(retrieval.searchMode).toBe('iterative')
    expect(retrieval.profile).toBe('strict')
    expect(retrieval.minScore).toBe(0.35)
    expect(retrieval.budgetTokens).toBe(2048)
    expect(retrieval.maxIterations).toBe(6)
    expect(retrieval.confidenceThreshold).toBe(0.9)
    expect(retrieval.rerank).toBe(true)
    expect(contextTypes).toEqual(['world', 'plot'])
    expect(onClose).toHaveBeenCalled()
  })

  it('persists workflow backend mode after save', async () => {
    const onClose = vi.fn()
    render(<SettingsModal isOpen onClose={onClose} />)

    const user = userEvent.setup()

    const modeLabel = screen.getByText(zh.workflowBackendMode)
    const modeSelect = modeLabel.parentElement?.querySelector('select')
    expect(modeSelect).toBeInstanceOf(HTMLSelectElement)

    await user.selectOptions(modeSelect as HTMLSelectElement, 'uiBridge')
    await user.click(screen.getByRole('button', { name: zh.save }))

    expect(useSettingsStore.getState().settings.workflowBackendMode).toBe('uiBridge')
    expect(onClose).toHaveBeenCalled()
  })

  it('renders workflow backend mode labels in english', () => {
    useSettingsStore.setState((state) => ({
      ...state,
      settings: {
        ...state.settings,
        language: 'en',
      },
    }))

    render(<SettingsModal isOpen onClose={vi.fn()} />)

    expect(screen.getByText(en.workflowBackendMode)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: en.workflowBackendModeStandard })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: en.workflowBackendModeUiBridge })).toBeInTheDocument()
  })
})
