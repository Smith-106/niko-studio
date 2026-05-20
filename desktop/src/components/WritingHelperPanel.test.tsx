import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
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
const zh = translations.zh

describe('WritingHelperPanel clear draft', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge'],
      availableSkills: ['character-forge', 'dialogue-system'],
      personalizedCraftSummary: '近期重点：character · improving',
      personalizedCraftTrajectory: '近期画像整体平稳，适合继续追踪并逐步强化薄弱维度。',
      personalizedCraftRecommendations: ['优先针对角色动机与冲突可见性做小范围修订。'],
    }))
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('resets draft fields and calls onClearDraft', async () => {
    const onClearDraft = vi.fn()

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'outline',
          maxSentences: 9,
          maxItems: 11,
          guidance: '保留这段交接说明。',
        }}
        onClearDraft={onClearDraft}
      />
    )

    const user = userEvent.setup()

    const contentInput = screen.getByLabelText(zh.writingHelperInputText) as HTMLTextAreaElement
    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const maxSentencesInput = screen.getByLabelText(zh.writingHelperMaxSentences) as HTMLInputElement
    const maxItemsInput = screen.getByLabelText(zh.writingHelperMaxItems) as HTMLInputElement

    expect(contentInput.value).toBe('已有草稿内容')
    expect(modeSelect.value).toBe('outline')
    expect(maxSentencesInput.value).toBe('9')
    expect(maxItemsInput.value).toBe('11')

    await user.click(screen.getByRole('button', { name: zh.writingHelperClearDraft }))

    expect(onClearDraft).toHaveBeenCalledOnce()
    expect(contentInput.value).toBe('')
    expect(modeSelect.value).toBe('polish')
    expect(maxSentencesInput.value).toBe('3')
    expect(maxItemsInput.value).toBe('6')
    expect(screen.queryByText('保留这段交接说明。')).not.toBeInTheDocument()
  })
})

describe('WritingHelperPanel mode options and payload', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    vi.clearAllMocks()
    useAppStore.setState((state) => ({
      ...state,
      selectedSkills: ['character-forge'],
      availableSkills: ['character-forge', 'dialogue-system'],
    }))
    mockGetEditorHandle.mockReturnValue(null)
  })

  it('renders rewrite and expand mode options', () => {
    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const optionValues = Array.from(modeSelect.options).map((option) => option.value)

    expect(optionValues).toContain('rewrite')
    expect(optionValues).toContain('expand')
  })

  it('uses legacy polish alias when toggle is enabled in polish mode', async () => {
    mockPolishContent.mockResolvedValue({
      originalText: '原始内容。',
      polishedText: '兼容润色结果。',
      diffMarkup: '',
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    const user = userEvent.setup()
    const contentInput = screen.getByLabelText(zh.writingHelperInputText) as HTMLTextAreaElement
    const legacyToggle = screen.getByLabelText(zh.writingHelperLegacyPolish) as HTMLInputElement

    await user.type(contentInput, '原始内容。')
    await user.click(legacyToggle)
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(mockPolishContent).toHaveBeenCalledWith(
      expect.objectContaining({
        originalText: '原始内容。',
        polishType: 'standard',
      })
    )
    expect(mockProcessWritingHelper).not.toHaveBeenCalled()
    expect(screen.getByText('兼容润色结果。')).toBeInTheDocument()
  })

  it('shows handoff guidance from draft state and appends it to the request instruction', async () => {
    const user = userEvent.setup()

    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '继续改写后的结果。',
      },
    })

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'rewrite',
          maxSentences: 3,
          maxItems: 6,
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力\n\n本次改写请优先这样处理：\n1. 更早亮出人物之间的对立目标或阻力。',
          handoff: {
            source: 'evaluation',
            suggestionTitle: '增加冲突',
            suggestionReason: '提升张力',
            guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力\n\n本次改写请优先这样处理：\n1. 更早亮出人物之间的对立目标或阻力。',
            carriedContent: 'revision-preview',
            preset: {
              mode: 'rewrite',
              maxSentences: 4,
              maxItems: 6,
            },
          },
        }}
      />,
    )

    expect(screen.getByText('评估接力预设')).toBeInTheDocument()
    expect(screen.getByText('接力来源')).toBeInTheDocument()
    expect(screen.getByText('建议：增加冲突')).toBeInTheDocument()
    expect(screen.getByText('携带：修改预览')).toBeInTheDocument()
    expect(screen.getByText('原因：提升张力')).toBeInTheDocument()
    expect(screen.getByText('推荐：改写')).toBeInTheDocument()
    expect(screen.getByText('推荐：4 句')).toBeInTheDocument()
    expect(screen.getByText('推荐：6 条')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: '改写（推荐）' })).toBeInTheDocument()
    expect(screen.getByText('当前正在使用推荐模式：改写')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开预设详情' })).toBeInTheDocument()
    expect(screen.queryByText('模式：改写')).not.toBeInTheDocument()
    expect(screen.queryByText('交接说明')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))

    expect(screen.getByRole('button', { name: '收起预设详情' })).toBeInTheDocument()
    expect(screen.getByText('模式：改写')).toBeInTheDocument()
    expect(screen.getByText('句数：3')).toBeInTheDocument()
    expect(screen.getByText('条目：6')).toBeInTheDocument()
    expect(screen.getByText('交接说明')).toBeInTheDocument()
    expect(screen.getByText(/优先处理这条评估建议：增加冲突/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '展开说明' })).toBeInTheDocument()
    expect(screen.queryByText(/1\. 更早亮出人物之间的对立目标或阻力。/)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开说明' }))

    expect(screen.getByRole('button', { name: '收起说明' })).toBeInTheDocument()
    expect(screen.getByText(/1\. 更早亮出人物之间的对立目标或阻力。/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: '已有草稿内容',
      mode: 'rewrite',
      instruction: expect.stringContaining('优先处理这条评估建议：增加冲突'),
    }))
  })

  it('restores the captured handoff preset after the user changes parameters', async () => {
    const user = userEvent.setup()

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'rewrite',
          maxSentences: 3,
          maxItems: 6,
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
          handoff: {
            source: 'evaluation',
            suggestionTitle: '增加冲突',
            suggestionReason: '提升张力',
            guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
            carriedContent: 'original-reply',
            preset: {
              mode: 'rewrite',
              maxSentences: 3,
              maxItems: 6,
            },
          },
        }}
      />,
    )

    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const maxSentencesInput = screen.getByLabelText(zh.writingHelperMaxSentences) as HTMLInputElement
    const maxItemsInput = screen.getByLabelText(zh.writingHelperMaxItems) as HTMLInputElement

    await user.selectOptions(modeSelect, 'expand')
    fireEvent.change(maxSentencesInput, { target: { value: '8' } })
    fireEvent.change(maxItemsInput, { target: { value: '10' } })

    expect(screen.getByText('已偏离推荐参数')).toBeInTheDocument()
    expect(screen.getByText('你已经改动了推荐模式或参数；如需回到评估给出的起始设置，可使用“恢复推荐参数”。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))

    expect(screen.getByText('模式已改动')).toBeInTheDocument()
    expect(screen.getByText('句数已改动')).toBeInTheDocument()
    expect(screen.getByText('条目已改动')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '清除说明' }))

    expect(screen.getByText('交接说明已清除，你仍可恢复推荐参数。')).toBeInTheDocument()
    expect(screen.getByText('说明已改动')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '恢复推荐参数' })).toBeInTheDocument()
    expect(screen.getByText('建议：增加冲突')).toBeInTheDocument()
    expect(screen.getByText('携带：原始回复')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '恢复推荐参数' }))

    expect(modeSelect.value).toBe('rewrite')
    expect(maxSentencesInput.value).toBe('3')
    expect(maxItemsInput.value).toBe('6')

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))

    expect(screen.getByText(/优先处理这条评估建议：增加冲突/)).toBeInTheDocument()
  })

  it('restores only the selected preset field and keeps other manual changes', async () => {
    const user = userEvent.setup()

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'rewrite',
          maxSentences: 3,
          maxItems: 6,
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
        }}
      />,
    )

    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const maxSentencesInput = screen.getByLabelText(zh.writingHelperMaxSentences) as HTMLInputElement
    const maxItemsInput = screen.getByLabelText(zh.writingHelperMaxItems) as HTMLInputElement

    await user.selectOptions(modeSelect, 'expand')
    fireEvent.change(maxSentencesInput, { target: { value: '8' } })
    fireEvent.change(maxItemsInput, { target: { value: '10' } })

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))

    await user.click(screen.getByRole('button', { name: '清除说明' }))

    await user.click(screen.getByRole('button', { name: '恢复模式推荐' }))

    expect(modeSelect.value).toBe('rewrite')
    expect(maxSentencesInput.value).toBe('8')
    expect(maxItemsInput.value).toBe('10')
    expect(screen.queryByText('模式已改动')).not.toBeInTheDocument()
    expect(screen.getByText('句数已改动')).toBeInTheDocument()
    expect(screen.getByText('条目已改动')).toBeInTheDocument()
    expect(screen.getByText('说明已改动')).toBeInTheDocument()
    expect(screen.getByText('交接说明已清除，你仍可恢复推荐参数。')).toBeInTheDocument()
  })

  it('shows control-level recommendation hints and restores from the control area', async () => {
    const user = userEvent.setup()

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'rewrite',
          maxSentences: 3,
          maxItems: 6,
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
        }}
      />,
    )

    const modeSelect = screen.getByLabelText(zh.writingHelperMode) as HTMLSelectElement
    const maxSentencesInput = screen.getByLabelText(zh.writingHelperMaxSentences) as HTMLInputElement
    const maxItemsInput = screen.getByLabelText(zh.writingHelperMaxItems) as HTMLInputElement

    expect(screen.getByText('推荐：改写')).toBeInTheDocument()
    expect(screen.getByText('推荐：3 句')).toBeInTheDocument()
    expect(screen.getByText('推荐：6 条')).toBeInTheDocument()

    await user.selectOptions(modeSelect, 'expand')
    fireEvent.change(maxSentencesInput, { target: { value: '8' } })
    fireEvent.change(maxItemsInput, { target: { value: '10' } })

    expect(screen.getByRole('button', { name: '在模式控件中恢复推荐' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '在句数控件中恢复推荐' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '在条目控件中恢复推荐' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '在句数控件中恢复推荐' }))

    expect(modeSelect.value).toBe('expand')
    expect(maxSentencesInput.value).toBe('3')
    expect(maxItemsInput.value).toBe('10')
    expect(screen.getByText('当前：扩写 · 推荐：改写')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '在句数控件中恢复推荐' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '在模式控件中恢复推荐' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '在条目控件中恢复推荐' })).toBeInTheDocument()
  })

  it('restores guidance from the guidance section after clearing it', async () => {
    const user = userEvent.setup()

    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'rewrite',
          maxSentences: 3,
          maxItems: 6,
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力\n\n本次改写请优先这样处理：\n1. 更早亮出人物之间的对立目标或阻力。',
        }}
      />,
    )

    await user.click(screen.getByRole('button', { name: '展开预设详情' }))

    await user.click(screen.getByRole('button', { name: '清除说明' }))

    expect(screen.getByText('交接说明已清除，你仍可恢复推荐参数。')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '在说明区恢复推荐说明' })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '在说明区恢复推荐说明' }))

    expect(screen.getByRole('button', { name: '展开说明' })).toBeInTheDocument()
    expect(screen.queryByText(/1\. 更早亮出人物之间的对立目标或阻力。/)).not.toBeInTheDocument()
    expect(screen.getByText(/优先处理这条评估建议：增加冲突/)).toBeInTheDocument()
  })

  it('applies selected skill packs through the primary writing request and shows used skills in the result', async () => {
    const user = userEvent.setup()

    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '技能包改写结果。',
        skills_used: ['character-forge', 'dialogue-system'],
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByRole('button', { name: 'character-forge' })).toHaveAttribute('aria-pressed', 'true')

    await user.click(screen.getByRole('button', { name: 'dialogue-system' }))
    await user.type(screen.getByLabelText(zh.writingHelperInputText), '请改写这一段。')
    await user.selectOptions(screen.getByLabelText(zh.writingHelperMode), 'rewrite')
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(mockProcessWritingHelper).toHaveBeenCalledWith(expect.objectContaining({
      content: '请改写这一段。',
      mode: 'rewrite',
      skill_ids: ['character-forge', 'dialogue-system'],
    }))
    expect(screen.getByText('已应用技能包')).toBeInTheDocument()
    expect(screen.getAllByText('character-forge').length).toBeGreaterThan(0)
    expect(screen.getAllByText('dialogue-system').length).toBeGreaterThan(0)
  })

  it('uses revision-safe replace/alternative/undo actions when the current input matches an editor selection snapshot', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => '原始内容。'),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => ({ from: 3, to: 8, text: '原始内容。' })),
      replaceSelectionSnapshot: vi.fn(() => true),
      insertBelowSelectionSnapshot: vi.fn(() => true),
      undoLastRevisionApply: vi.fn(() => true),
    }

    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'rewrite',
        processed_text: '改写结果。',
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    expect(screen.getByLabelText(zh.writingHelperInputText)).toHaveValue('原始内容。')

    await user.selectOptions(screen.getByLabelText(zh.writingHelperMode), 'rewrite')
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))

    expect(await screen.findByText('修改预览')).toBeInTheDocument()
    expect(screen.getByText('原文')).toBeInTheDocument()
    expect(screen.getByText('建议版本')).toBeInTheDocument()
    expect(screen.getAllByText('改写结果。').length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: '替换选区' }))
    expect(editorHandle.replaceSelectionSnapshot).toHaveBeenCalledWith(
      { from: 3, to: 8, text: '原始内容。' },
      '改写结果。',
    )
    expect(screen.getByText('已替换当前选区。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '作为备选插入' }))
    expect(editorHandle.insertBelowSelectionSnapshot).toHaveBeenCalledWith(
      { from: 3, to: 8, text: '原始内容。' },
      '改写结果。',
    )
    expect(screen.getByText('已作为备选插入到原文后。')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: '撤销上次应用' }))
    expect(editorHandle.undoLastRevisionApply).toHaveBeenCalledTimes(1)
    expect(screen.getByText('已撤销上次应用。')).toBeInTheDocument()
  })


  it('falls back to plain insert when no matching editor selection snapshot exists', async () => {
    const user = userEvent.setup()
    const editorHandle = {
      insertText: vi.fn(),
      getSelectedText: vi.fn(() => ''),
      getJSON: vi.fn(() => ({ type: 'doc', content: [] })),
      captureSelectionSnapshot: vi.fn(() => null),
      replaceSelectionSnapshot: vi.fn(() => false),
      insertBelowSelectionSnapshot: vi.fn(() => false),
      undoLastRevisionApply: vi.fn(() => false),
    }

    mockGetEditorHandle.mockReturnValue(editorHandle)
    mockProcessWritingHelper.mockResolvedValue({
      success: true,
      data: {
        mode: 'polish',
        processed_text: '插入结果。',
      },
    })

    render(<WritingHelperPanel onClose={() => {}} onOpenSettings={() => {}} />)

    await user.type(screen.getByLabelText(zh.writingHelperInputText), '手动输入内容')
    await user.click(screen.getByRole('button', { name: zh.writingHelperRun }))
    await screen.findByText('插入结果。')

    expect(screen.getByRole('button', { name: zh.writingHelperInsertToEditor })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '替换选区' })).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.writingHelperInsertToEditor }))
    expect(editorHandle.insertText).toHaveBeenCalledWith('插入结果。')
  })

  it('renders revision session metadata from the evaluation handoff', () => {
    render(
      <WritingHelperPanel
        onClose={() => {}}
        onOpenSettings={() => {}}
        draftState={{
          content: '已有草稿内容',
          mode: 'rewrite',
          maxSentences: 3,
          maxItems: 6,
          guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
          handoff: {
            source: 'evaluation',
            suggestionTitle: '增加冲突',
            suggestionReason: '提升张力',
            guidance: '优先处理这条评估建议：增加冲突\n原因：提升张力',
            carriedContent: 'revision-preview',
            preset: {
              mode: 'rewrite',
              maxSentences: 4,
              maxItems: 6,
            },
            revisionSession: {
              id: 'revision-session-1',
              chapterId: 'chapter-7',
              state: 'COMPARED',
              iteration: 2,
              comparisonSummary: 'Score improved',
            },
          },
        }}
      />,
    )

    expect(screen.getByText(/修订会话：revision-session-1/)).toBeInTheDocument()
    expect(screen.getByText(/COMPARED/)).toBeInTheDocument()
    expect(screen.getByText(/会话提示：Score improved/)).toBeInTheDocument()
    expect(screen.getByText('个性化技巧画像')).toBeInTheDocument()
    expect(screen.getByText('近期重点：character · improving')).toBeInTheDocument()
    expect(screen.getByText('优先针对角色动机与冲突可见性做小范围修订。')).toBeInTheDocument()
  })
})
