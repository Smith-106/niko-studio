import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
const baseTimestamp = new Date('2026-06-04T08:00:00.000Z')

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

describe('MessageBubble additional coverage', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.getState().resetSettings()
    useSettingsStore.getState().updateSettings({ language: 'zh' })
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  it('renders English governance fallback labels for unknown decision values', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            consistency_governance: {
              decision: 'unexpected' as never,
              publish_recommendation: 'unexpected' as never,
              feedback: '  Needs review  ',
            },
            narrative_authority: {
              consistencyRunId: 'run-en-1',
            },
          },
        })}
      />
    )

    expect(screen.getByText('Consistency governance')).toBeInTheDocument()
    expect(screen.getByText('Consistency governance: Not marked / Not generated')).toBeInTheDocument()
    expect(screen.getByText('Run ID run-en-1')).toBeInTheDocument()
    expect(screen.getByText('Needs review')).toBeInTheDocument()
  })

  it('renders English canon-unavailable summary and skill chips', () => {
    useSettingsStore.getState().updateSettings({ language: 'en' })

    render(
      <MessageBubble
        message={buildMessage({
          skills: ['outline', 'canon'],
          writerMetadata: {
            canon_context: {
              available: false,
              reason: null,
              total_pages: 0,
              match_count: 0,
              injected: false,
              matches: [],
            },
          },
        })}
      />
    )

    expect(screen.getByText(en.messageBubbleSourceSummaryTitle)).toBeInTheDocument()
    expect(
      screen.getByText('The app could not expand into project references this time: unknown')
    ).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === '📦 outline')).toBeInTheDocument()
    expect(screen.getByText((_, element) => element?.textContent === '📦 canon')).toBeInTheDocument()
  })

  it('does not render a source summary when canon context is available but not injected', () => {
    render(
      <MessageBubble
        message={buildMessage({
          writerMetadata: {
            canon_context: {
              available: true,
              reason: null,
              total_pages: 1,
              match_count: 0,
              injected: false,
              matches: [],
            },
          },
        })}
      />
    )

    expect(screen.queryByText(zh.messageBubbleSourceSummaryTitle)).not.toBeInTheDocument()
  })

  it('truncates long user messages and expands on demand', async () => {
    const user = userEvent.setup()
    const longContent = Array.from({ length: 10 }, (_, index) => `line ${index + 1}`).join('\n')

    render(
      <MessageBubble
        message={buildMessage({
          role: 'user',
          content: longContent,
        })}
      />
    )

    expect(screen.getByText(zh.scrollToBottom)).toBeInTheDocument()
    expect(screen.queryByText(/line 9/i)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: zh.scrollToBottom }))

    expect(screen.getByText(/line 9/i)).toBeInTheDocument()
    expect(screen.getByText(/line 10/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: zh.scrollToBottom })).not.toBeInTheDocument()
  })

  it('shows failure feedback when promoting a reply to canon fails and uses the workspace title fallback', async () => {
    const user = userEvent.setup()
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: false,
      error: 'boom',
    })

    render(
      <MessageBubble
        message={buildMessage({
          content: '#',
          workspaceContext: buildWorkspace(),
        })}
      />
    )

    await user.click(screen.getByRole('button', { name: zh.messageBubblePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })

    const [payload] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    expect(payload).toMatchObject({
      title: 'Atlas Chat Reply',
      slug: 'chat/atlas-workspace-conversation-1-assistant-1',
      idSeed: 'atlas-workspace:conversation-1:assistant-1',
      sourceRef: 'chat.conversation-1.assistant-1',
      rawEvidence: {
        relativePath: 'imports/chat/atlas-workspace/conversation-1/assistant-1.md',
        content: '#',
      },
    })
    expect(screen.getByText(zh.messageBubblePromoteCanonFailure)).toBeInTheDocument()
  })

  it('renders fenced code blocks through the markdown code renderer', () => {
    const { container } = render(
      <MessageBubble
        message={buildMessage({
          content: '```ts\nconst harbor = 1\n```',
        })}
      />
    )

    const codeBlock = container.querySelector('pre code')
    expect(codeBlock).not.toBeNull()
    expect(codeBlock).toHaveTextContent('const harbor = 1')
    expect(codeBlock).toHaveClass('language-ts')
  })

  it('exercises React.memo comparison paths across callbacks and nested message data', () => {
    const workspace = buildWorkspace()
    const canonContext = {
      available: true,
      reason: null,
      total_pages: 1,
      match_count: 1,
      injected: true,
      matches: [
        {
          page_id: 'canon-1',
          slug: 'canon/hero',
          title: 'Hero Canon',
          score: 90,
          excerpt: 'Canon excerpt',
          authority: {
            workspaceId: 'atlas-workspace',
            scopeAuthority: 'workspace' as const,
            canonAuthority: 'canon-page' as const,
            projectionAuthority: 'derived' as const,
            promotion: 'manual' as const,
            promotedFrom: 'story-bible' as const,
            status: 'curated' as const,
          },
        },
      ],
    }

    const baseMessage = buildMessage({
      skills: ['canon'],
      comparison: {
        enabled: true,
        primary: { model: 'model-a', content: 'Alpha line' },
        control: { model: 'model-b', content: 'Beta line' },
      },
      writerMetadata: {
        knowledge_retrieved: {
          entities_count: 1,
          relations_count: 2,
          memories_count: 3,
        },
        canon_context: canonContext,
        consistency_governance: {
          decision: 'go',
          publish_recommendation: 'pass',
        },
        narrative_authority: {
          consistencyRunId: 'run-1',
        },
      },
      workspaceContext: workspace,
    })

    const onAssistantSelection = vi.fn()
    const onAssistantSelectionAlt = vi.fn()
    const onComparisonAccept = vi.fn()
    const onComparisonAcceptAlt = vi.fn()

    const { rerender } = render(
      <MessageBubble
        message={baseMessage}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )

    const renderBase = () =>
      rerender(
        <MessageBubble
          message={{
            ...baseMessage,
            skills: [...(baseMessage.skills ?? [])],
            comparison: baseMessage.comparison
              ? {
                  ...baseMessage.comparison,
                  primary: { ...baseMessage.comparison.primary },
                  control: { ...baseMessage.comparison.control },
                }
              : baseMessage.comparison,
            writerMetadata: baseMessage.writerMetadata
              ? {
                  ...baseMessage.writerMetadata,
                  knowledge_retrieved: baseMessage.writerMetadata.knowledge_retrieved
                    ? { ...baseMessage.writerMetadata.knowledge_retrieved }
                    : undefined,
                  canon_context: baseMessage.writerMetadata.canon_context
                    ? {
                        ...baseMessage.writerMetadata.canon_context,
                        matches: [...baseMessage.writerMetadata.canon_context.matches],
                      }
                    : undefined,
                  consistency_governance: baseMessage.writerMetadata.consistency_governance
                    ? { ...baseMessage.writerMetadata.consistency_governance }
                    : undefined,
                  narrative_authority: baseMessage.writerMetadata.narrative_authority
                    ? { ...baseMessage.writerMetadata.narrative_authority }
                    : undefined,
                }
              : undefined,
          }}
          onAssistantSelection={onAssistantSelection}
          onComparisonAccept={onComparisonAccept}
        />
      )

    renderBase()
    rerender(
      <MessageBubble
        message={baseMessage}
        onAssistantSelection={onAssistantSelectionAlt}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={baseMessage}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAcceptAlt}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{ ...baseMessage, id: 'assistant-2' }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{ ...baseMessage, content: 'Changed assistant reply' }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{ ...baseMessage, skills: [] }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{ ...baseMessage, skills: ['other-skill'] }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{ ...baseMessage, comparison: undefined }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          comparison: {
            ...baseMessage.comparison!,
            enabled: false,
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          comparison: {
            ...baseMessage.comparison!,
            primary: { ...baseMessage.comparison!.primary, model: 'model-c' },
            control: { ...baseMessage.comparison!.control },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          comparison: {
            ...baseMessage.comparison!,
            primary: { ...baseMessage.comparison!.primary, content: 'Alpha replacement' },
            control: { ...baseMessage.comparison!.control },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          comparison: {
            ...baseMessage.comparison!,
            primary: { ...baseMessage.comparison!.primary },
            control: { ...baseMessage.comparison!.control, model: 'model-d' },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          comparison: {
            ...baseMessage.comparison!,
            primary: { ...baseMessage.comparison!.primary },
            control: { ...baseMessage.comparison!.control, content: 'Beta replacement' },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          writerMetadata: {
            ...baseMessage.writerMetadata!,
            knowledge_retrieved: undefined,
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          writerMetadata: {
            ...baseMessage.writerMetadata!,
            knowledge_retrieved: {
              entities_count: 9,
              relations_count: 2,
              memories_count: 3,
            },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          writerMetadata: {
            ...baseMessage.writerMetadata!,
            knowledge_retrieved: {
              entities_count: 1,
              relations_count: 9,
              memories_count: 3,
            },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          writerMetadata: {
            ...baseMessage.writerMetadata!,
            knowledge_retrieved: {
              entities_count: 1,
              relations_count: 2,
              memories_count: 9,
            },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          writerMetadata: {
            ...baseMessage.writerMetadata!,
            canon_context: {
              ...canonContext,
              reason: 'changed',
            },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )
    renderBase()
    rerender(
      <MessageBubble
        message={{
          ...baseMessage,
          writerMetadata: {
            ...baseMessage.writerMetadata!,
            consistency_governance: {
              decision: 'soft_go',
              publish_recommendation: 'revise',
            },
          },
        }}
        onAssistantSelection={onAssistantSelection}
        onComparisonAccept={onComparisonAccept}
      />
    )

    expect(screen.getAllByText('Alpha line').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Beta line').length).toBeGreaterThan(0)
  })
})
