import { describe, expect, it } from 'vitest'

import { summarizeWriterWorkspace, useWriterWorkspaceSummary } from './useWriterWorkspaceSummary'
import { createDefaultProjectWorkspaceContext } from '../types/workspace'

describe('useWriterWorkspaceSummary', () => {
  it('summarizes a workspace with numeric chapter number', () => {
    const workspace = createDefaultProjectWorkspaceContext({
      workspaceRoot: '/tmp/project',
      fallbackProjectId: 'project-1',
    })
    workspace.identity.projectId = 'project-1'
    workspace.identity.workspaceId = 'workspace-1'
    workspace.identity.projectName = 'My Project'
    workspace.manuscript.chapterNumber = 3

    const result = summarizeWriterWorkspace(workspace)

    expect(result.chapterLabel).toBe('Chapter 3')
    expect(result.projectLabel).toBe('My Project')
    expect(result.hasMeaningfulScope).toBe(true)
  })

  it('treats an empty workspace as non-meaningful', () => {
    const result = summarizeWriterWorkspace(null)

    expect(result.meaningfulWorkspace).toBeNull()
    expect(result.hasMeaningfulScope).toBe(false)
    expect(result.scopeChips).toEqual([])
  })

  it('converts numeric workspace identifiers to strings', () => {
    const workspace = createDefaultProjectWorkspaceContext()
    workspace.storyBible.draftId = 42

    const result = summarizeWriterWorkspace(workspace)

    expect(result.storyBibleLabel).toBe('42')
  })
})
