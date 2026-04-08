import { useMemo } from 'react'

import type { ProjectWorkspaceContext } from '@/types/workspace'

import { useAppStore } from '../stores/appStore'

export interface WriterWorkspaceSummary {
  meaningfulWorkspace: ProjectWorkspaceContext | null
  hasMeaningfulScope: boolean
  projectLabel: string | null
  chapterLabel: string | null
  storyBibleLabel: string | null
  focusLabel: string | null
  workspaceLabel: string | null
  workflowLabel: string | null
  scopeChips: string[]
}

function hasWorkspaceShape(value: unknown): value is ProjectWorkspaceContext {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return typeof record.identity === 'object'
    && typeof record.manuscript === 'object'
    && typeof record.storyBible === 'object'
    && typeof record.knowledge === 'object'
    && typeof record.workflow === 'object'
}

function readValue(value: string | number | null | undefined): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value)
  }
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function basenameOrNull(value: string | null | undefined): string | null {
  const normalized = readValue(value)
  if (!normalized) return null
  const parts = normalized.split(/[\\/]/).filter(Boolean)
  return parts.length > 0 ? readValue(parts[parts.length - 1]) : null
}

function isDefaultProjectIdentity(workspace: ProjectWorkspaceContext): boolean {
  return workspace.identity.projectId === 'default-project'
    && workspace.identity.workspaceId === 'default-project'
    && workspace.identity.workspaceRoot == null
}

export function hasMeaningfulWriterScope(workspace?: ProjectWorkspaceContext | null): workspace is ProjectWorkspaceContext {
  if (!hasWorkspaceShape(workspace)) return false
  if (!isDefaultProjectIdentity(workspace)) return true

  return Boolean(
    workspace.manuscript.chapterId
      || workspace.manuscript.chapterTitle
      || workspace.manuscript.chapterNumber != null
      || workspace.manuscript.title
      || workspace.storyBible.storyBibleId
      || workspace.storyBible.draftId
      || workspace.knowledge.focusEntityId
      || workspace.knowledge.graphEntityIds.length > 0
      || workspace.knowledge.memoryEntryIds.length > 0,
  )
}

export function summarizeWriterWorkspace(workspace?: ProjectWorkspaceContext | null): WriterWorkspaceSummary {
  const safeWorkspace = hasWorkspaceShape(workspace) ? workspace : null
  const hasCustomIdentity = safeWorkspace ? !isDefaultProjectIdentity(safeWorkspace) : false

  const projectLabel = readValue(safeWorkspace?.identity.projectName)
    ?? (hasCustomIdentity ? readValue(safeWorkspace?.identity.projectId) : null)
    ?? basenameOrNull(safeWorkspace?.identity.workspaceRoot)

  const chapterLabel = readValue(safeWorkspace?.manuscript.chapterTitle)
    ?? (safeWorkspace?.manuscript.chapterNumber != null ? `Chapter ${safeWorkspace.manuscript.chapterNumber}` : null)
    ?? readValue(safeWorkspace?.manuscript.chapterId)
    ?? readValue(safeWorkspace?.manuscript.title)

  const storyBibleLabel = readValue(safeWorkspace?.storyBible.storyBibleId)
    ?? readValue(safeWorkspace?.storyBible.draftId)
    ?? readValue(safeWorkspace?.storyBible.version)

  const focusLabel = readValue(safeWorkspace?.knowledge.focusEntityId)
    ?? readValue(safeWorkspace?.knowledge.graphEntityIds[0])
    ?? readValue(safeWorkspace?.knowledge.memoryEntryIds[0])

  const workspaceLabel = basenameOrNull(safeWorkspace?.identity.workspaceRoot)
    ?? (hasCustomIdentity ? readValue(safeWorkspace?.identity.workspaceId) : null)

  const workflowLabel = readValue(safeWorkspace?.workflow.planId)
    ?? readValue(safeWorkspace?.workflow.sessionId)
    ?? readValue(safeWorkspace?.workflow.level)

  const scopeChips = [projectLabel, chapterLabel, storyBibleLabel, focusLabel, workspaceLabel].filter(
    (value): value is string => Boolean(value),
  )

  return {
    meaningfulWorkspace: hasMeaningfulWriterScope(safeWorkspace) ? safeWorkspace : null,
    hasMeaningfulScope: hasMeaningfulWriterScope(safeWorkspace),
    projectLabel,
    chapterLabel,
    storyBibleLabel,
    focusLabel,
    workspaceLabel,
    workflowLabel,
    scopeChips,
  }
}

export function useWriterWorkspaceSummary(): WriterWorkspaceSummary {
  const workspace = useAppStore((state) => state.currentWorkspace)

  return useMemo(() => summarizeWriterWorkspace(workspace), [workspace])
}
