import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProjectWorkspaceContext } from '@/types/workspace'

import {
  hasMeaningfulWriterScope,
  summarizeWriterWorkspace,
  useWriterWorkspaceSummary,
  type WriterWorkspaceSummary,
} from './useWriterWorkspaceSummary'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeDefaultWorkspace(overrides: Partial<ProjectWorkspaceContext> = {}): ProjectWorkspaceContext {
  return {
    identity: {
      workspaceId: 'default-project',
      projectId: 'default-project',
      workspaceRoot: null,
      projectName: null,
      ...overrides.identity,
    },
    manuscript: {
      manuscriptId: null,
      title: null,
      chapterId: null,
      chapterTitle: null,
      chapterNumber: null,
      ...overrides.manuscript,
    },
    storyBible: {
      storyBibleId: null,
      draftId: null,
      version: null,
      storage: 'workspace',
      ...overrides.storyBible,
    },
    knowledge: {
      focusEntityId: null,
      graphEntityIds: [],
      memoryEntryIds: [],
      ...overrides.knowledge,
    },
    workflow: {
      sessionId: null,
      planId: null,
      level: null,
      ...overrides.workflow,
    },
    chat: {
      conversationId: null,
      comparisonEnabled: null,
    },
    compatibility: {
      additiveContract: true,
      migratedLegacyFields: [],
      notes: [],
    },
    schemaVersion: '2026-04-08',
  }
}

function makeCustomWorkspace(overrides: Partial<ProjectWorkspaceContext> = {}): ProjectWorkspaceContext {
  return makeDefaultWorkspace({
    identity: {
      workspaceId: 'ws-custom',
      projectId: 'proj-custom',
      workspaceRoot: '/home/user/project',
      projectName: 'My Novel',
    },
    ...overrides,
  })
}

// ---------------------------------------------------------------------------
// Mock appStore
// ---------------------------------------------------------------------------

const mockAppState = {
  currentWorkspace: makeCustomWorkspace(),
}

vi.mock('../stores/appStore', () => ({
  useAppStore: (selector: (s: typeof mockAppState) => unknown) => selector(mockAppState),
}))

// ---------------------------------------------------------------------------
// Tests: pure functions
// ---------------------------------------------------------------------------

describe('useWriterWorkspaceSummary / workspace hooks additional coverage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAppState.currentWorkspace = makeCustomWorkspace()
  })

  describe('hasMeaningfulWriterScope', () => {
    it('returns false for null input', () => {
      expect(hasMeaningfulWriterScope(null)).toBe(false)
    })

    it('returns false for undefined input', () => {
      expect(hasMeaningfulWriterScope(undefined)).toBe(false)
    })

    it('returns false for empty object', () => {
      expect(hasMeaningfulWriterScope({} as unknown as ProjectWorkspaceContext)).toBe(false)
    })

    it('returns false for default-project with no meaningful data', () => {
      const workspace = makeDefaultWorkspace()
      expect(hasMeaningfulWriterScope(workspace)).toBe(false)
    })

    it('returns true for default-project with chapterId', () => {
      const workspace = makeDefaultWorkspace({
        manuscript: { chapterId: 'ch-1', chapterTitle: null, chapterNumber: null, manuscriptId: null, title: null },
      })
      expect(hasMeaningfulWriterScope(workspace)).toBe(true)
    })

    it('returns true for default-project with storyBibleId', () => {
      const workspace = makeDefaultWorkspace({
        storyBible: { storyBibleId: 'sb-1', draftId: null, version: null, storage: 'workspace' },
      })
      expect(hasMeaningfulWriterScope(workspace)).toBe(true)
    })

    it('returns true for default-project with focusEntityId', () => {
      const workspace = makeDefaultWorkspace({
        knowledge: { focusEntityId: 'entity-1', graphEntityIds: [], memoryEntryIds: [] },
      })
      expect(hasMeaningfulWriterScope(workspace)).toBe(true)
    })

    it('returns true for default-project with graphEntityIds', () => {
      const workspace = makeDefaultWorkspace({
        knowledge: { focusEntityId: null, graphEntityIds: ['g1', 'g2'], memoryEntryIds: [] },
      })
      expect(hasMeaningfulWriterScope(workspace)).toBe(true)
    })

    it('returns true for default-project with memoryEntryIds', () => {
      const workspace = makeDefaultWorkspace({
        knowledge: { focusEntityId: null, graphEntityIds: [], memoryEntryIds: ['mem-1'] },
      })
      expect(hasMeaningfulWriterScope(workspace)).toBe(true)
    })

    it('returns true for custom project identity even with no manuscript data', () => {
      const workspace = makeCustomWorkspace()
      expect(hasMeaningfulWriterScope(workspace)).toBe(true)
    })

    it('returns false for non-object primitives', () => {
      expect(hasMeaningfulWriterScope(42 as unknown as ProjectWorkspaceContext)).toBe(false)
      expect(hasMeaningfulWriterScope('string' as unknown as ProjectWorkspaceContext)).toBe(false)
      expect(hasMeaningfulWriterScope(true as unknown as ProjectWorkspaceContext)).toBe(false)
    })

    it('returns false for partial workspace shape (missing keys)', () => {
      expect(hasMeaningfulWriterScope({ identity: {} } as unknown as ProjectWorkspaceContext)).toBe(false)
    })
  })

  describe('summarizeWriterWorkspace', () => {
    it('returns empty summary for null workspace', () => {
      const summary = summarizeWriterWorkspace(null)

      expect(summary.meaningfulWorkspace).toBeNull()
      expect(summary.hasMeaningfulScope).toBe(false)
      expect(summary.scopeChips).toEqual([])
    })

    it('returns empty summary for undefined workspace', () => {
      const summary = summarizeWriterWorkspace(undefined)

      expect(summary.meaningfulWorkspace).toBeNull()
      expect(summary.hasMeaningfulScope).toBe(false)
    })

    it('extracts projectLabel from projectName', () => {
      const workspace = makeCustomWorkspace({
        identity: { ...makeCustomWorkspace().identity, projectName: 'My Novel' },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.projectLabel).toBe('My Novel')
    })

    it('falls back to projectId when projectName is null for custom identity', () => {
      const workspace = makeCustomWorkspace({
        identity: { ...makeCustomWorkspace().identity, projectName: null },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.projectLabel).toBe('proj-custom')
    })

    it('extracts chapterLabel from chapterTitle', () => {
      const workspace = makeCustomWorkspace({
        manuscript: { manuscriptId: null, title: null, chapterId: 'ch-1', chapterTitle: 'Chapter One', chapterNumber: null },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.chapterLabel).toBe('Chapter One')
    })

    it('extracts chapterLabel from chapterNumber when title is null', () => {
      const workspace = makeCustomWorkspace({
        manuscript: { manuscriptId: null, title: null, chapterId: null, chapterTitle: null, chapterNumber: 3 },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.chapterLabel).toBe('Chapter 3')
    })

    it('extracts workspaceLabel from workspaceRoot basename', () => {
      const workspace = makeCustomWorkspace()
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.workspaceLabel).toBe('project')
    })

    it('extracts workflowLabel from planId', () => {
      const workspace = makeCustomWorkspace({
        workflow: { sessionId: null, planId: 'plan-1', level: null },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.workflowLabel).toBe('plan-1')
    })

    it('extracts workflowLabel from sessionId when planId is null', () => {
      const workspace = makeCustomWorkspace({
        workflow: { sessionId: 'session-1', planId: null, level: null },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.workflowLabel).toBe('session-1')
    })

    it('extracts workflowLabel from level when both planId and sessionId are null', () => {
      const workspace = makeCustomWorkspace({
        workflow: { sessionId: null, planId: null, level: 'L3' },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.workflowLabel).toBe('L3')
    })

    it('builds scopeChips from non-null labels', () => {
      const workspace = makeCustomWorkspace({
        manuscript: { manuscriptId: null, title: null, chapterId: 'ch-1', chapterTitle: 'Chapter One', chapterNumber: null },
        workflow: { sessionId: null, planId: 'plan-1', level: null },
      })
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.scopeChips.length).toBeGreaterThan(0)
      expect(summary.scopeChips).toContain('My Novel')
      expect(summary.scopeChips).toContain('Chapter One')
    })

    it('sets meaningfulWorkspace to null for default-project with no data', () => {
      const workspace = makeDefaultWorkspace()
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.meaningfulWorkspace).toBeNull()
      expect(summary.hasMeaningfulScope).toBe(false)
    })

    it('sets meaningfulWorkspace for custom project', () => {
      const workspace = makeCustomWorkspace()
      const summary = summarizeWriterWorkspace(workspace)

      expect(summary.meaningfulWorkspace).toBe(workspace)
      expect(summary.hasMeaningfulScope).toBe(true)
    })

    it('handles workspace with empty strings that become null via readValue', () => {
      const workspace = makeCustomWorkspace({
        identity: { ...makeCustomWorkspace().identity, projectName: '   ' },
      })
      const summary = summarizeWriterWorkspace(workspace)

      // readValue trims and returns null for empty strings
      expect(summary.projectLabel).toBe('proj-custom')
    })
  })
})
