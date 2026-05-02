import type { ProjectWorkspaceContext } from '@/types/workspace'

import type { KnowledgeItem } from './KnowledgeTypes'

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function readString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeGraphItem(item: Record<string, unknown>): KnowledgeItem {
  const properties = asRecord(item.properties) ?? {}
  const name = readString(item.name) ?? readString(properties.name) ?? readString(item.id) ?? ''
  const description =
    readString(item.description)
    ?? readString(item.content)
    ?? readString(properties.description)
    ?? readString(properties.summary)
    ?? readString(properties.content)
    ?? readString(properties.details)
    ?? ''

  return {
    ...properties,
    ...item,
    id: readString(item.id) ?? name,
    name,
    title: readString(item.title) ?? readString(properties.title) ?? readString(item.type) ?? '',
    description,
    content: readString(item.content) ?? readString(properties.content) ?? description,
    workspaceId: readString(item.workspaceId) ?? readString(properties.workspaceId),
    projectId: readString(item.projectId) ?? readString(properties.projectId),
    itemKind: readString(item.itemKind) ?? readString(properties.itemKind),
    created_at: readString(item.created_at) ?? readString(properties.created_at),
    updated_at: readString(item.updated_at) ?? readString(properties.updated_at),
  }
}

export const toGraphItems = (rows: unknown[] | undefined, key: string): KnowledgeItem[] => {
  if (!Array.isArray(rows)) return []
  return rows.map((row) => {
    if (row && typeof row === 'object' && key in (row as Record<string, unknown>)) {
      const value = (row as Record<string, unknown>)[key]
      if (value && typeof value === 'object') {
        return normalizeGraphItem(value as Record<string, unknown>)
      }
    }
    if (row && typeof row === 'object') {
      return normalizeGraphItem(row as Record<string, unknown>)
    }
    return { value: String(row) }
  })
}

export function filterWorkspaceKnowledgeItems(
  items: KnowledgeItem[],
  workspace: ProjectWorkspaceContext,
  options: {
    allowLegacy?: boolean
    itemKind?: string
  } = {},
): KnowledgeItem[] {
  const allowLegacy = options.allowLegacy ?? true
  const workspaceId = workspace.identity.workspaceId
  const projectId = workspace.identity.projectId
  const deduped = new Map<string, KnowledgeItem>()

  for (const item of items) {
    const itemWorkspaceId = readString(item.workspaceId)
    const itemProjectId = readString(item.projectId)
    const itemKind = readString(item.itemKind) ?? readString(item.kind)

    if (options.itemKind && itemKind && itemKind !== options.itemKind) {
      continue
    }

    const belongsToWorkspace = itemWorkspaceId === workspaceId
    const belongsToProject = !itemWorkspaceId && itemProjectId === projectId
    const isLegacy = !itemWorkspaceId && !itemProjectId

    if (!belongsToWorkspace && !belongsToProject && !(allowLegacy && isLegacy)) {
      continue
    }

    const key = `${readString(item.name) ?? readString(item.id) ?? 'item'}::${readString(item.type) ?? 'unknown'}`
    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, item)
      continue
    }

    const existingScoped = Boolean(readString(existing.workspaceId) || readString(existing.projectId))
    const incomingScoped = Boolean(itemWorkspaceId || itemProjectId)
    if (!existingScoped && incomingScoped) {
      deduped.set(key, item)
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const leftStamp = Date.parse(String(left.updated_at ?? left.created_at ?? 0))
    const rightStamp = Date.parse(String(right.updated_at ?? right.created_at ?? 0))
    if (Number.isFinite(leftStamp) && Number.isFinite(rightStamp) && leftStamp !== rightStamp) {
      return rightStamp - leftStamp
    }
    return String(left.name ?? '').localeCompare(String(right.name ?? ''))
  })
}

export function buildGraphMergeMutation(
  entityType: string,
  matchProps: Record<string, unknown>,
  setProps: Record<string, unknown>,
): string {
  return `MERGE (n:${entityType} ${JSON.stringify(matchProps)}) SET ${JSON.stringify(setProps)} RETURN n`
}

export function buildStoryBibleGraphName(workspace: ProjectWorkspaceContext): string {
  return `story-bible::${workspace.identity.workspaceId}`
}

export function readGraphMutationError(rows: unknown[] | undefined): string | null {
  if (!Array.isArray(rows) || rows.length === 0) return null
  const first = asRecord(rows[0])
  return readString(first?.error)
}

export function buildWorkspaceNotice(language: 'zh' | 'en'): string[] {
  if (language === 'zh') {
    return [
      '当前 Story Bible 与知识条目会写入当前工作区的权威模型，并在重新加载后继续可见。',
      '导入 / 导出仍保留用于兼容旧的本地草稿，不再是唯一数据来源。',
    ]
  }

  return [
    'Story Bible and knowledge entries now persist into the active workspace authority and survive reloads.',
    'Import and export remain available for legacy local-draft compatibility, not as the primary source of truth.',
  ]
}

export function buildGraphDeleteMutation(
  entityType: string,
  name: string,
  workspaceId: string,
): string {
  return `MATCH (n:${entityType} {name: ${JSON.stringify(name)}, workspaceId: ${JSON.stringify(workspaceId)}}) DETACH DELETE n`
}

export const WORKSPACE_KNOWLEDGE_CHANGED_EVENT = 'niko:workspace-knowledge-changed'
