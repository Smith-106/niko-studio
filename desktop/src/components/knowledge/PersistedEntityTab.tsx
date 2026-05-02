import { useCallback, useEffect, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Folder, RotateCcw, Save } from 'lucide-react'

import { queryGraph } from '../../api/client'
import { useI18n } from '../../i18n'
import { useAppStore } from '../../stores/appStore'
import type { KnowledgeItem, OperationStatus } from './KnowledgeTypes'
import {
  buildGraphMergeMutation,
  filterWorkspaceKnowledgeItems,
  readGraphMutationError,
  toGraphItems,
  WORKSPACE_KNOWLEDGE_CHANGED_EVENT,
} from './knowledgeUtils'

interface PersistedEntityTabProps {
  entityType: 'Character' | 'Location' | 'Event'
  itemKind?: string
  itemLabel: string
  itemIcon: LucideIcon
  items: KnowledgeItem[]
  onItemsChange: (items: KnowledgeItem[]) => void
  loading: boolean
  onLoadingChange: (loading: boolean) => void
  onItemClick: (item: KnowledgeItem) => void
  selectedItemId: string
  selectedItem: KnowledgeItem | null
  searchQuery: string
  onStatusChange: (status: OperationStatus | null) => void
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function buildEditorCopy(kind: string, label: string, language: 'zh' | 'en') {
  if (language === 'zh') {
    return {
      nameLabel: `${label}名称`,
      descriptionLabel: `${label}描述`,
      namePlaceholder: `输入${label}名称`,
      descriptionPlaceholder:
        kind === 'plot'
          ? '记录这个剧情节点的关键冲突、推进和后果。'
          : `记录这个${label}的定位、细节和写作提示。`,
      saveLabel: `保存${label}`,
      addLabel: `添加${label}`,
      resetLabel: '清空编辑器',
      emptyLabel: `当前工作区还没有${label}条目。`,
      loadError: `加载${label}失败，请稍后重试。`,
      saveSuccess: `${label}已保存到当前工作区。`,
      saveError: `保存${label}失败，请稍后重试。`,
    }
  }

  return {
    nameLabel: `${label} name`,
    descriptionLabel: `${label} details`,
    namePlaceholder: `Enter ${label.toLowerCase()} name`,
    descriptionPlaceholder:
      kind === 'plot'
        ? 'Capture the turning point, stakes, and aftermath for this plot beat.'
        : `Capture the key details, purpose, and writing notes for this ${label.toLowerCase()}.`,
    saveLabel: `Save ${label}`,
    addLabel: `Add ${label}`,
    resetLabel: 'Clear editor',
    emptyLabel: `No ${label.toLowerCase()} entries exist for this workspace yet.`,
    loadError: `Failed to load ${label.toLowerCase()}. Please try again.`,
    saveSuccess: `${label} saved to the current workspace.`,
    saveError: `Failed to save ${label.toLowerCase()}. Please try again.`,
  }
}

export function PersistedEntityTab({
  entityType,
  itemKind,
  itemLabel,
  itemIcon: ItemIcon,
  items,
  onItemsChange,
  loading,
  onLoadingChange,
  onItemClick,
  selectedItemId,
  selectedItem,
  searchQuery,
  onStatusChange,
}: PersistedEntityTabProps) {
  const { language, t } = useI18n()
  const backendStatus = useAppStore((state) => state.backendStatus)
  const currentWorkspace = useAppStore((state) => state.currentWorkspace)
  const [draftName, setDraftName] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [matchName, setMatchName] = useState<string | null>(null)
  const [matchWorkspaceId, setMatchWorkspaceId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const copy = buildEditorCopy(itemKind ?? entityType.toLowerCase(), itemLabel, language)

  const loadItems = useCallback(async () => {
    onLoadingChange(true)
    onStatusChange(null)
    try {
      const response = await queryGraph(`MATCH (n:${entityType}) RETURN n LIMIT 100`, {
        workspace: currentWorkspace,
      })
      const graphError = readGraphMutationError(response.data)
      if (!response.success || graphError) {
        throw new Error(response.error || graphError || copy.loadError)
      }
      onItemsChange(
        filterWorkspaceKnowledgeItems(toGraphItems(response.data, 'n'), currentWorkspace, {
          itemKind,
        }),
      )
    } catch (error) {
      console.error(`Failed to load ${entityType}:`, error)
      onStatusChange({
        type: 'error',
        message: copy.loadError,
      })
    } finally {
      onLoadingChange(false)
    }
  }, [copy.loadError, currentWorkspace, entityType, itemKind, onItemsChange, onLoadingChange, onStatusChange])

  useEffect(() => {
    if (!backendStatus) {
      void loadItems()
    }
  }, [backendStatus, loadItems])

  useEffect(() => {
    if (backendStatus) {
      void loadItems()
    }
  }, [backendStatus, loadItems])

  useEffect(() => {
    if (!selectedItem) return
    if (readString(selectedItem.type) !== entityType) return
    setDraftName(readString(selectedItem.name))
    setDraftDescription(readString(selectedItem.description) || readString(selectedItem.content))
    setMatchName(readString(selectedItem.name))
    setMatchWorkspaceId(readString(selectedItem.workspaceId) || null)
  }, [entityType, selectedItem])

  const clearEditor = useCallback(() => {
    setDraftName('')
    setDraftDescription('')
    setMatchName(null)
    setMatchWorkspaceId(null)
    onStatusChange(null)
  }, [onStatusChange])

  const handleSave = useCallback(async () => {
    const name = draftName.trim()
    if (!name) {
      onStatusChange({
        type: 'error',
        message: copy.namePlaceholder,
      })
      return
    }

    const matchProps: Record<string, unknown> = {
      name: matchName ?? name,
    }
    if (matchWorkspaceId) {
      matchProps.workspaceId = matchWorkspaceId
    } else if (!matchName) {
      matchProps.workspaceId = currentWorkspace.identity.workspaceId
    }

    const setProps: Record<string, unknown> = {
      name,
      description: draftDescription.trim(),
      content: draftDescription.trim(),
      workspaceId: currentWorkspace.identity.workspaceId,
      projectId: currentWorkspace.identity.projectId,
      workspaceRoot: currentWorkspace.identity.workspaceRoot,
      itemKind: itemKind ?? entityType.toLowerCase(),
    }

    setSaving(true)
    try {
      const response = await queryGraph(buildGraphMergeMutation(entityType, matchProps, setProps), {
        workspace: currentWorkspace,
      })
      const graphError = readGraphMutationError(response.data)
      if (!response.success || graphError) {
        throw new Error(response.error || graphError || copy.saveError)
      }

      const savedItem =
        filterWorkspaceKnowledgeItems(toGraphItems(response.data, 'n'), currentWorkspace, {
          itemKind,
        })[0] ?? null

      await loadItems()
      if (savedItem) {
        onItemClick(savedItem)
        setMatchName(readString(savedItem.name))
        setMatchWorkspaceId(readString(savedItem.workspaceId) || null)
      } else {
        setMatchName(name)
        setMatchWorkspaceId(currentWorkspace.identity.workspaceId)
      }

      onStatusChange({
        type: 'success',
        message: copy.saveSuccess,
      })
      window.dispatchEvent(new CustomEvent(WORKSPACE_KNOWLEDGE_CHANGED_EVENT))
    } catch (error) {
      console.error(`Failed to save ${entityType}:`, error)
      onStatusChange({
        type: 'error',
        message: copy.saveError,
      })
    } finally {
      setSaving(false)
    }
  }, [
    copy.namePlaceholder,
    copy.saveError,
    copy.saveSuccess,
    currentWorkspace,
    draftDescription,
    draftName,
    entityType,
    itemKind,
    loadItems,
    matchName,
    matchWorkspaceId,
    onItemClick,
    onStatusChange,
  ])

  const filteredItems = filterWorkspaceKnowledgeItems(items, currentWorkspace, { itemKind }).filter((item) =>
    JSON.stringify(item).toLowerCase().includes(searchQuery.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white/80 p-4 shadow-sm dark:border-dark-border dark:bg-dark-surface">
        <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-dark-text-muted">
          <ItemIcon size={16} />
          {itemLabel}
        </div>
        <div className="grid gap-3">
          <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-dark-text-secondary">
            <span>{copy.nameLabel}</span>
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              placeholder={copy.namePlaceholder}
              aria-label={copy.nameLabel}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-dark-text-secondary">
            <span>{copy.descriptionLabel}</span>
            <textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              placeholder={copy.descriptionPlaceholder}
              aria-label={copy.descriptionLabel}
              className="min-h-24 w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800 outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-dark-border dark:bg-dark-bg dark:text-dark-text"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {matchName ? copy.saveLabel : copy.addLabel}
            </button>
            <button
              type="button"
              onClick={clearEditor}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-dark-border dark:text-dark-text-secondary dark:hover:bg-dark-bg"
            >
              <RotateCcw size={16} />
              {copy.resetLabel}
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-full text-gray-400 dark:text-dark-text-secondary">
          {t.knowledgeLoading}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 px-6 py-10 text-center text-gray-400 dark:border-dark-border dark:text-dark-text-secondary">
          <Folder size={40} className="mb-3" />
          <p>{copy.emptyLabel}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredItems.map((item, index) => (
            <button
              key={String(item.id ?? item.name ?? index)}
              type="button"
              onClick={() => onItemClick(item)}
              className={`p-4 border rounded-lg text-left transition-all ${
                String(item.id ?? item.name ?? '') === selectedItemId
                  ? 'border-blue-500 shadow-md bg-blue-50/60 dark:border-blue-400 dark:bg-blue-900/10'
                  : 'border-gray-200 dark:border-dark-border hover:border-blue-500 hover:shadow-md'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <ItemIcon size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-800 dark:text-dark-text truncate">
                    {readString(item.name) || readString(item.title) || String(item.id ?? '')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-dark-text-secondary mt-1 line-clamp-2">
                    {readString(item.description) || readString(item.content) || t.knowledgeNoDescription}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
