import { describe, expect, it } from 'vitest'

import { createDefaultProjectWorkspaceContext } from '../../types/workspace'
import {
  WORKSPACE_KNOWLEDGE_CHANGED_EVENT,
  buildGraphDeleteMutation,
  buildGraphMergeMutation,
  buildStoryBibleGraphName,
  buildWorkspaceNotice,
  filterWorkspaceKnowledgeItems,
  readGraphMutationError,
  toGraphItems,
} from './knowledgeUtils'

const workspace = createDefaultProjectWorkspaceContext({
  workspaceRoot: '/tmp/atlas-project',
})

workspace.identity.projectId = 'project-1'
workspace.identity.workspaceId = 'workspace-1'

describe('knowledgeUtils additional coverage', () => {
  it('normalizes graph rows from nested records, raw objects, and primitive fallbacks', () => {
    const items = toGraphItems(
      [
        {
          n: {
            id: ' hero-1 ',
            type: 'character',
            properties: {
              name: 'Hero',
              title: 'Lead',
              description: 'Scoped hero',
              workspaceId: 'workspace-1',
            },
          },
        },
        {
          id: 'event-1',
          type: 'event',
          properties: {
            name: 'Plot Twist',
            summary: 'Project event',
            projectId: 'project-1',
            itemKind: 'story',
          },
        },
        'loose value',
      ],
      'n',
    )

    expect(items[0]).toMatchObject({
      id: 'hero-1',
      name: 'Hero',
      title: 'Lead',
      description: 'Scoped hero',
      workspaceId: 'workspace-1',
    })
    expect(items[1]).toMatchObject({
      id: 'event-1',
      name: 'Plot Twist',
      description: 'Project event',
      projectId: 'project-1',
      itemKind: 'story',
    })
    expect(items[2]).toEqual({ value: 'loose value' })
  })

  it('filters, deduplicates, and sorts knowledge items by workspace relevance', () => {
    const items = [
      { id: 'legacy-hero', name: 'Hero', type: 'character', updated_at: '2024-01-01T00:00:00.000Z' },
      {
        id: 'scoped-hero',
        name: 'Hero',
        type: 'character',
        workspaceId: 'workspace-1',
        updated_at: '2024-01-03T00:00:00.000Z',
      },
      {
        id: 'project-event',
        name: 'Project Event',
        type: 'event',
        projectId: 'project-1',
        itemKind: 'story',
        updated_at: '2024-01-02T00:00:00.000Z',
      },
      {
        id: 'wrong-kind',
        name: 'Other Event',
        type: 'event',
        workspaceId: 'workspace-1',
        itemKind: 'misc',
        updated_at: '2024-01-04T00:00:00.000Z',
      },
      {
        id: 'foreign',
        name: 'Foreign Event',
        type: 'event',
        workspaceId: 'workspace-2',
      },
    ]

    const filtered = filterWorkspaceKnowledgeItems(items, workspace, { itemKind: 'story' })

    expect(filtered).toEqual([
      expect.objectContaining({ id: 'scoped-hero' }),
      expect.objectContaining({ id: 'project-event' }),
    ])

    const noLegacy = filterWorkspaceKnowledgeItems(
      [
        { id: 'legacy-only', name: 'Legacy', type: 'note' },
        { id: 'scoped-only', name: 'Scoped', type: 'note', projectId: 'project-1' },
      ],
      workspace,
      { allowLegacy: false },
    )

    expect(noLegacy).toEqual([expect.objectContaining({ id: 'scoped-only' })])
  })

  it('builds graph helpers, notices, and mutation error fallbacks', () => {
    expect(buildGraphMergeMutation('Character', { name: 'Alice' }, { role: 'lead' })).toBe(
      "MERGE (n:Character {name: 'Alice'}) SET n += {role: 'lead'} RETURN n",
    )
    expect(buildStoryBibleGraphName(workspace)).toBe('story-bible::workspace-1')
    expect(readGraphMutationError([{ error: 'merge blocked' }])).toBe('merge blocked')
    expect(readGraphMutationError(undefined)).toBeNull()
    expect(buildWorkspaceNotice('zh')).toHaveLength(2)
    expect(buildWorkspaceNotice('en')).toEqual([
      'Story Bible and knowledge entries now persist into the active workspace authority and survive reloads.',
      'Import and export remain available for legacy local-draft compatibility, not as the primary source of truth.',
    ])
    expect(buildGraphDeleteMutation('Character', 'Alice', 'workspace-1')).toBe(
      "MATCH (n:Character {name: 'Alice', workspaceId: 'workspace-1'}) DETACH DELETE n",
    )
    expect(WORKSPACE_KNOWLEDGE_CHANGED_EVENT).toBe('niko:workspace-knowledge-changed')
  })
})
