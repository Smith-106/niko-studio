import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../api/client', () => ({
  promoteProjectWikiCanonApi: vi.fn(),
}))

import { MessageBubble } from './MessageBubble'
import { promoteProjectWikiCanonApi } from '../api/client'
import { translations } from '../i18n'

const zh = translations.zh

describe('MessageBubble selection', () => {
  it('triggers selection callback for assistant message', () => {
    const onAssistantSelection = vi.fn()
    const selectionSpy = vi.spyOn(window, 'getSelection')
    selectionSpy.mockReturnValue({ toString: () => 'selected text' } as Selection)

    const { container } = render(
      <MessageBubble
        message={{
          id: 'm1',
          role: 'assistant',
          content: 'assistant content',
          timestamp: new Date(),
        }}
        onAssistantSelection={onAssistantSelection}
      />
    )

    const markdownBody = container.querySelector('.markdown-body')
    expect(markdownBody).not.toBeNull()
    fireEvent.mouseUp(markdownBody!)

    expect(onAssistantSelection).toHaveBeenCalledWith({
      messageId: 'm1',
      selectedText: 'selected text',
    })

    selectionSpy.mockRestore()
  })

  it('renders structured dual-column comparison content for assistant message', () => {
    const onComparisonAccept = vi.fn()

    render(
      <MessageBubble
        message={{
          id: 'm3',
          role: 'assistant',
          content: 'comparison fallback',
          timestamp: new Date(),
          comparison: {
            enabled: true,
            primary: { model: 'primary', content: '共享行\n主模型独有' },
            control: { model: 'gpt-4-turbo', content: '共享行\n对照模型独有' },
          },
        }}
        onComparisonAccept={onComparisonAccept}
      />
    )

    expect(screen.getByText(`${zh.messageBubblePrimaryModelLabel}primary`)).toBeInTheDocument()
    expect(screen.getByText(`${zh.messageBubbleControlModelLabel}gpt-4-turbo`)).toBeInTheDocument()
    expect(screen.getByText('主模型独有')).toBeInTheDocument()
    expect(screen.getByText('对照模型独有')).toBeInTheDocument()
    expect(screen.getAllByText(zh.messageBubbleDiffHighlightsLabel)).toHaveLength(2)
    expect(screen.getByRole('button', { name: zh.messageBubbleAcceptPrimary })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: zh.messageBubbleAcceptControl })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: zh.messageBubbleAcceptPrimary }))
    expect(onComparisonAccept).toHaveBeenCalledWith('共享行\n主模型独有')

    fireEvent.click(screen.getByRole('button', { name: zh.messageBubbleAcceptControl }))
    expect(onComparisonAccept).toHaveBeenCalledWith('共享行\n对照模型独有')
  })

  it('renders retrieval status when writer metadata is present', () => {
    render(
      <MessageBubble
        message={{
          id: 'm4',
          role: 'assistant',
          content: '带检索状态的回复',
          timestamp: new Date(),
          writerMetadata: {
            knowledge_retrieved: {
              entities_count: 3,
              relations_count: 2,
              memories_count: 5,
            },
          },
        }}
      />
    )

    expect(screen.getByText(zh.messageBubbleSourceSummaryTitle)).toBeInTheDocument()
    expect(
      screen.getByText(
        zh.messageBubbleSourceSummaryUsed.replace('{summary}', '角色与要素、关联线索、历史记忆')
      )
    ).toBeInTheDocument()
  })

  it('renders canon traceability when canon context is injected', () => {
    render(
      <MessageBubble
        message={{
          id: 'm5',
          role: 'assistant',
          content: '带 canon 来源的回复',
          timestamp: new Date(),
          writerMetadata: {
            canon_context: {
              available: true,
              reason: null,
              total_pages: 4,
              match_count: 1,
              injected: true,
              matches: [
                {
                  page_id: 'wpg_atlas_1',
                  slug: 'characters/atlas-hero-profile',
                  title: 'Atlas Hero Profile',
                  score: 82,
                  excerpt: 'Atlas guards the city archive and protects the atlas sigil.',
                  authority: {
                    workspaceId: 'atlas-project',
                    scopeAuthority: 'workspace',
                    canonAuthority: 'canon-page',
                    projectionAuthority: 'derived',
                    promotion: 'manual',
                    promotedFrom: 'story-bible',
                    status: 'curated',
                  },
                },
              ],
            },
          },
        }}
      />
    )

    expect(screen.getByText(zh.messageBubbleSourceSummaryTitle)).toBeInTheDocument()
    expect(
      screen.getByText(
        zh.messageBubbleSourceSummaryUsed.replace('{summary}', '项目设定')
      )
    ).toBeInTheDocument()
    expect(screen.getByText(zh.messageBubbleSourcePrimary)).toBeInTheDocument()
    expect(screen.getByText('Atlas Hero Profile')).toBeInTheDocument()
    expect(
      screen.getByText('Atlas guards the city archive and protects the atlas sigil.')
    ).toBeInTheDocument()
  })

  it('promotes an assistant reply into canon when workspace context is present', async () => {
    vi.mocked(promoteProjectWikiCanonApi).mockResolvedValue({
      success: true,
      data: {
        available: true,
        reason: null,
        workspace_id: 'atlas-workspace',
        page: {
          id: 'canon-chat-1',
          slug: 'chat/atlas-workspace-conversation-1-m6',
          title: 'Harbor Ledger',
          status: 'curated',
          path: '/tmp/chat.md',
          markdown: '# Harbor Ledger',
          promoted_from: 'chat',
        },
        raw_evidence_path: '/tmp/raw.md',
        log_entry: { type: 'promotion' },
      },
    })

    render(
      <MessageBubble
        message={{
          id: 'm6',
          role: 'assistant',
          content: '# Harbor Ledger\n\nThe dock ledger ties the smugglers to Atlas Harbor.',
          timestamp: new Date(),
          workspaceContext: {
            schemaVersion: '2026-04-08',
            identity: {
              workspaceId: 'atlas-workspace',
              projectId: 'atlas-project',
              projectName: 'Atlas',
              workspaceRoot: '/tmp/atlas',
            },
            manuscript: {
              manuscriptId: null,
              title: null,
              chapterId: 'chapter-6',
              chapterTitle: null,
              chapterNumber: 6,
            },
            storyBible: {
              storyBibleId: null,
              draftId: 'draft-6',
              version: null,
              storage: 'workspace',
            },
            knowledge: {
              focusEntityId: null,
              graphEntityIds: [],
              memoryEntryIds: [],
            },
            workflow: {
              sessionId: 'workflow-session-6',
              planId: null,
              level: 'L3',
            },
            chat: {
              conversationId: 'conversation-1',
              comparisonEnabled: false,
            },
            compatibility: {
              additiveContract: true,
              migratedLegacyFields: [],
              notes: [],
            },
          },
        }}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: zh.messageBubblePromoteCanon }))

    await waitFor(() => {
      expect(promoteProjectWikiCanonApi).toHaveBeenCalledTimes(1)
    })
    const [payload, workspace] = vi.mocked(promoteProjectWikiCanonApi).mock.calls[0] ?? []
    expect(payload).toMatchObject({
      title: 'Harbor Ledger',
      body: '# Harbor Ledger\n\nThe dock ledger ties the smugglers to Atlas Harbor.',
      slug: 'chat/atlas-workspace-conversation-1-m6',
      idSeed: 'atlas-workspace:conversation-1:m6',
      promotedFrom: 'chat',
      sourceId: 'm6',
      sourceRef: 'chat.conversation-1.m6',
      rawEvidence: {
        relativePath: 'imports/chat/atlas-workspace/conversation-1/m6.md',
        content: '# Harbor Ledger\n\nThe dock ledger ties the smugglers to Atlas Harbor.',
      },
      metadata: {
        conversation_id: 'conversation-1',
        workflow_session_id: 'workflow-session-6',
        chapter_id: 'chapter-6',
        source: 'assistant-message',
      },
    })
    expect(workspace).toMatchObject({
      identity: {
        workspaceId: 'atlas-workspace',
      },
    })
    expect(screen.getByText(zh.messageBubblePromoteCanonSuccess)).toBeInTheDocument()
  })
})
