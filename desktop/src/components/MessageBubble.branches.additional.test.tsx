import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/client', () => ({
  promoteProjectWikiCanonApi: vi.fn(),
}))

import { MessageBubble } from './MessageBubble'
import { promoteProjectWikiCanonApi } from '../api/client'
import { translations } from '../i18n'
import { useSettingsStore } from '../stores/settingsStore'
import type { Message } from '../stores/appStore'
import { createDefaultProjectWorkspaceContext } from '../types/workspace'

const zh = translations.zh
const en = translations.en
const baseTimestamp = new Date('2026-06-17T08:00:00.000Z')

function buildWorkspace() {
  const workspace = createDefaultProjectWorkspaceContext({
    workspaceRoot: '/tmp/atlas-project',
    fallbackProjectId: 'atlas-project',
  })
  workspace.identity.workspaceId = 'atlas-workspace'
  workspace.identity.projectId = 'atlas-project'
  workspace.identity.projectName = 'Atlas'
  workspace.manuscript.chapterId = 'chapter-1'
  workspace.workflow.sessionId = 'workflow-1'
  workspace.chat.conversationId = 'conversation-1'
  return workspace
}

function buildMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: 'assistant-1',
    role: 'assistant',
    content: 'Assistant reply',
    timestamp: baseTimestamp,
    ...overrides,
  }
}

describe('MessageBubble additional branch coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  // --- governanceSignature branches: writerMetadata defined but consistency_governance / narrative_authority undefined ---
  it('renders governance summary when writerMetadata exists but governance fields are undefined', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'go',
              publish_recommendation: 'pass',
            },
          },
        })}
      />
    )
    expect(screen.getByText('一致性治理')).toBeInTheDocument()
  })

  // --- authority?.consistencyRunId branch: governance undefined but authority has consistencyRunId ---
  // This forces the !authority?.consistencyRunId to evaluate (governance is falsy so && proceeds)
  it('renders governance when only narrative_authority with consistencyRunId is present', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            narrative_authority: {
              consistencyRunId: 'run-auth-branch',
            },
          },
        })}
      />
    )
    // governance is undefined, so !governance is true
    // authority.consistencyRunId is truthy, so !authority?.consistencyRunId is false
    // Combined: !governance && !authority?.consistencyRunId = true && false = false => does NOT return null
    expect(screen.getByText('一致性治理')).toBeInTheDocument()
    expect(screen.getByText('运行 ID run-auth-branch')).toBeInTheDocument()
  })

  // --- decisionLabel English branches: go, soft_go, no_go ---
  it('renders English "Go" decision label', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'go',
              publish_recommendation: 'pass',
              score: 90,
            },
          },
        })}
      />
    )
    expect(screen.getByText('Consistency governance: Go / Pass')).toBeInTheDocument()
    expect(screen.getByText('Evaluation score 90')).toBeInTheDocument()
  })

  it('renders English "Soft Go" decision label', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'soft_go',
              publish_recommendation: 'revise',
            },
          },
        })}
      />
    )
    expect(screen.getByText('Consistency governance: Soft Go / Revise')).toBeInTheDocument()
  })

  it('renders English "No-Go" decision label', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'no_go',
              publish_recommendation: 'block',
              feedback: 'Inconsistency detected',
            },
          },
        })}
      />
    )
    expect(screen.getByText('Consistency governance: No-Go / Block')).toBeInTheDocument()
    expect(screen.getByText('Inconsistency detected')).toBeInTheDocument()
  })

  // --- publishRecommendation English branches: pass, revise, block ---
  it('renders English "Pass" recommendation label', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'go',
              publish_recommendation: 'pass',
            },
          },
        })}
      />
    )
    expect(screen.getByText('Consistency governance: Go / Pass')).toBeInTheDocument()
  })

  it('renders English "Revise" recommendation label', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'soft_go',
              publish_recommendation: 'revise',
            },
          },
        })}
      />
    )
    expect(screen.getByText('Consistency governance: Soft Go / Revise')).toBeInTheDocument()
  })

  it('renders English "Block" recommendation label', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'no_go',
              publish_recommendation: 'block',
            },
          },
        })}
      />
    )
    expect(screen.getByText('Consistency governance: No-Go / Block')).toBeInTheDocument()
  })

  // --- scoreLine Chinese branch: typeof score === 'number' with zh language ---
  it('renders Chinese score line when score is a number', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'go',
              publish_recommendation: 'pass',
              score: 92,
            },
          },
        })}
      />
    )
    expect(screen.getByText('评估分数 92')).toBeInTheDocument()
  })

  // --- decisionLabel Chinese branch: decision='no_go' and decision='soft_go' ---
  it('renders Chinese Soft Go and Revise governance labels', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'soft_go',
              publish_recommendation: 'revise',
              score: 70,
            },
          },
        })}
      />
    )
    expect(screen.getByText('一致性治理：Soft Go / 需修改')).toBeInTheDocument()
    expect(screen.getByText('评估分数 70')).toBeInTheDocument()
  })

  it('renders Chinese No-Go and Block governance labels', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'no_go',
              publish_recommendation: 'block',
            },
          },
        })}
      />
    )
    expect(screen.getByText('一致性治理：No-Go / 阻塞')).toBeInTheDocument()
  })
  it('renders Chinese fallback labels for unknown governance decision values', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'unexpected' as never,
              publish_recommendation: 'unexpected' as never,
            },
          },
        })}
      />
    )
    expect(screen.getByText('一致性治理：未标记 / 未生成')).toBeInTheDocument()
  })

  // --- publishRecommendation Chinese fallback (line 65-66) ---
  it('renders Chinese fallback label for unknown publish recommendation', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'soft_go',
              publish_recommendation: 'unknown_value' as never,
            },
          },
        })}
      />
    )
    expect(screen.getByText('一致性治理：Soft Go / 未生成')).toBeInTheDocument()
  })

  // --- arePropsEqual: prevMsg.skills || [] and nextMsg.skills || [] when skills is undefined ---
  it('exercises React.memo skills || [] branch when skills is undefined', () => {
    const { rerender } = render(
      <MessageBubble
        message={buildMessage({
          skills: undefined,
          writerMetadata: {
            consistency_governance: {
              decision: 'go',
              publish_recommendation: 'pass',
            },
          },
        })}
      />
    )
    // Rerender with same shape (skills undefined again) to exercise || [] in arePropsEqual
    rerender(
      <MessageBubble
        message={buildMessage({
          skills: undefined,
          writerMetadata: {
            consistency_governance: {
              decision: 'go',
              publish_recommendation: 'pass',
            },
          },
        })}
      />
    )
    expect(screen.getByText('一致性治理：Go / 通过')).toBeInTheDocument()
  })

  // --- canonContextSignature: writerMetadata?.canon_context ?? null ---
  it('exercises canonContextSignature ?? null branch when canon_context is undefined', () => {
    const { rerender } = render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            canon_context: undefined,
            knowledge_retrieved: {
              entities_count: 2,
              relations_count: 0,
              memories_count: 0,
            },
          },
        })}
      />
    )
    // Rerender with same message (but new object) to trigger arePropsEqual which calls canonContextSignature
    rerender(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            canon_context: undefined,
            knowledge_retrieved: {
              entities_count: 2,
              relations_count: 0,
              memories_count: 0,
            },
          },
        })}
      />
    )
    expect(screen.getByText(zh.messageBubbleSourceSummaryTitle)).toBeInTheDocument()
  })

  // --- getReferenceSummary: English join separator ', ' instead of '、' ---
  it('uses English comma separator in source summary when language is en', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            knowledge_retrieved: {
              entities_count: 1,
              relations_count: 1,
              memories_count: 0,
            },
          },
        })}
      />
    )
    // Should use ', ' as separator in English
    expect(
      screen.getByText(
        en.messageBubbleSourceSummaryUsed.replace('{summary}', 'characters and key elements, story links')
      )
    ).toBeInTheDocument()
  })

  // --- slugifySegment: value ?? '' when value is null ---
  it('uses slug fallback when value is null for slugifySegment', async () => {
    const user = userEvent.setup()
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'ws',
        page: {
          id: 'page-1',
          slug: 'chat/reply-reply-reply',
          title: 'Workspace Chat Reply',
          status: 'curated',
          path: '/tmp/chat.md',
          markdown: '# Workspace Chat Reply',
          promoted_from: 'chat',
        },
      },
    })

    const workspace = buildWorkspace()
    workspace.identity.projectName = ''
    workspace.identity.projectId = ''
    // Set workspaceId and conversationId to null to exercise value ?? '' branch
    workspace.identity.workspaceId = null as any
    workspace.chat.conversationId = null as any
    const content = '### *** --- ```'

    render(
      <MessageBubble
        message={buildMessage({
          id: '###',
          content,
          workspaceContext: workspace,
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: zh.messageBubblePromoteCanon }))
    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    // slugifySegment(null) => String(null ?? '') => '' => 'reply'
    expect(payload).toMatchObject({
      title: 'Workspace Chat Reply',
      slug: 'chat/reply-reply-reply',
    })
  })

  // --- handleMouseUp: empty selection returns early ---
  it('does not call onAssistantSelection when mouse selection is empty', () => {
    const onAssistantSelection = vi.fn()
    const selectionSpy = vi.spyOn(window, 'getSelection')
    selectionSpy.mockReturnValue({ toString: () => '' } as Selection)

    const { container } = render(
      <MessageBubble
        message={buildMessage({ role: 'assistant' })}
        onAssistantSelection={onAssistantSelection}
      />
    )

    const markdownBody = container.querySelector('.markdown-body')
    expect(markdownBody).not.toBeNull()
    fireEvent.mouseUp(markdownBody!)
    expect(onAssistantSelection).not.toHaveBeenCalled()
    selectionSpy.mockRestore()
  })

  // --- handlePromoteReplyToCanon: isPromotingCanon guard (line 239) ---
  // When isPromotingCanon is true, the button is disabled and the handler returns early.
  // React prevents click events on disabled buttons, so we verify the disabled state
  // which effectively guards the isPromotingCanon check in the handler.
  it('disables promote button while promoting to prevent double invocation', async () => {
    let resolveFirst!: (value: unknown) => void
    const firstCall = new Promise((resolve) => { resolveFirst = resolve })

    vi.mocked(promoteProjectWikiCanonApi).mockImplementation(() => firstCall as any)

    render(
      <MessageBubble
        message={buildMessage({
          content: 'Promotable content',
          workspaceContext: buildWorkspace(),
        })}
      />
    )

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: zh.messageBubblePromoteCanon }))

    // Button should now show promoting state and be disabled
    await waitFor(() => {
      const promotingButton = screen.getByRole('button', { name: zh.messageBubblePromotingCanon })
      expect(promotingButton).toBeDisabled()
    })

    // Clicking the disabled button does not trigger onClick (React behavior),
    // effectively exercising the isPromotingCanon guard path.
    // The API is called exactly once.
    expect(vi.mocked(promoteProjectWikiCanonApi)).toHaveBeenCalledTimes(1)

    resolveFirst({ success: false, error: 'cancelled' })
    await waitFor(() => {
      expect(screen.getByText(zh.messageBubblePromoteCanonFailure)).toBeInTheDocument()
    })
  })

  // --- handlePromoteReplyToCanon: response.success=true but data.available=false (line 269-270) ---
  it('shows failure when canon promotion succeeds but data is not available', async () => {
    const user = userEvent.setup()
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: false,
        reason: 'duplicate-slug',
        workspace_id: 'atlas-workspace',
        page: null,
      },
    })

    render(
      <MessageBubble
        message={buildMessage({
          content: 'Duplicate content',
          workspaceContext: buildWorkspace(),
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: zh.messageBubblePromoteCanon }))
    await waitFor(() => {
      expect(screen.getByText(zh.messageBubblePromoteCanonFailure)).toBeInTheDocument()
    })
  })

  // --- handlePromoteReplyToCanon: response.success=true, available=true, but page missing ---
  it('shows failure when canon promotion succeeds but page is missing', async () => {
    const user = userEvent.setup()
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: undefined as any,
      },
    })

    render(
      <MessageBubble
        message={buildMessage({
          content: 'Content without page',
          workspaceContext: buildWorkspace(),
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: zh.messageBubblePromoteCanon }))
    await waitFor(() => {
      expect(screen.getByText(zh.messageBubblePromoteCanonFailure)).toBeInTheDocument()
    })
  })

  // --- referenceSummary display: unavailableReason ?? fallback (line 345) ---
  // The ?? fallback path for messageBubbleSourceSummaryFallback is reached when
  // summary is null and unavailableReason is also null but the section still renders
  // (triggered by shouldRenderCanonContext). This exercises the ?? chain.
  it('exercises source summary display with null summary falling to unavailable reason', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            canon_context: {
              available: false,
              reason: 'timeout',
              total_pages: 0,
              match_count: 0,
              injected: false,
              matches: [],
            },
          },
        })}
      />
    )
    // summary is null (no labels), so it falls to unavailableReason
    expect(screen.getByText(en.messageBubbleSourceSummaryTitle)).toBeInTheDocument()
    expect(screen.getByText(/The app could not expand into project references this time: timeout/)).toBeInTheDocument()
  })

  // --- promote button visibility guards ---
  it('does not show promote-to-canon button for user messages even with workspace context', () => {
    render(
      <MessageBubble
        message={buildMessage({
          role: 'user',
          content: 'User content',
          workspaceContext: buildWorkspace(),
        })}
      />
    )
    expect(screen.queryByRole('button', { name: zh.messageBubblePromoteCanon })).not.toBeInTheDocument()
  })

  it('does not show promote-to-canon button when message content is only whitespace', () => {
    render(
      <MessageBubble
        message={buildMessage({
          content: '   ',
          workspaceContext: buildWorkspace(),
        })}
      />
    )
    expect(screen.queryByRole('button', { name: zh.messageBubblePromoteCanon })).not.toBeInTheDocument()
  })
})
