import { useCallback, useEffect, useState } from 'react'
import type { WritingHelperMode } from '../api/client'

export type RightPanelType = 'none' | 'knowledge' | 'evaluation' | 'mcpStatus' | 'writingHelper'

export interface WritingHelperDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
}

const WRITING_HELPER_DRAFT_STORAGE_KEY = 'niko.writing-helper-draft-v1'
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'niko.sidebar-collapsed-v1'
const ACTIVE_RIGHT_PANEL_STORAGE_KEY = 'niko.active-right-panel-v1'

const DEFAULT_WRITING_HELPER_DRAFT: WritingHelperDraftState = {
  content: '',
  mode: 'polish',
  maxSentences: 3,
  maxItems: 6,
}

const toPositiveInteger = (value: unknown, fallback: number): number => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  const normalized = Math.floor(parsed)
  return normalized > 0 ? normalized : fallback
}

const toWritingHelperMode = (value: unknown, fallback: WritingHelperMode): WritingHelperMode => {
  if (value === 'polish' || value === 'summarize' || value === 'outline' || value === 'rewrite' || value === 'expand') {
    return value
  }
  return fallback
}

const loadWritingHelperDraft = (): WritingHelperDraftState => {
  try {
    const raw = localStorage.getItem(WRITING_HELPER_DRAFT_STORAGE_KEY)
    if (!raw) return DEFAULT_WRITING_HELPER_DRAFT

    const parsed = JSON.parse(raw) as Partial<WritingHelperDraftState>
    return {
      content: typeof parsed.content === 'string' ? parsed.content : DEFAULT_WRITING_HELPER_DRAFT.content,
      mode: toWritingHelperMode(parsed.mode, DEFAULT_WRITING_HELPER_DRAFT.mode),
      maxSentences: toPositiveInteger(parsed.maxSentences, DEFAULT_WRITING_HELPER_DRAFT.maxSentences),
      maxItems: toPositiveInteger(parsed.maxItems, DEFAULT_WRITING_HELPER_DRAFT.maxItems),
    }
  } catch {
    return DEFAULT_WRITING_HELPER_DRAFT
  }
}

const clearWritingHelperDraftStorage = (): void => {
  try {
    localStorage.removeItem(WRITING_HELPER_DRAFT_STORAGE_KEY)
  } catch {
    // ignore localStorage clear failures
  }
}

const loadSidebarCollapsed = (): boolean => {
  try {
    const raw = localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return false
  } catch {
    return false
  }
}

const isRightPanelType = (value: unknown): value is RightPanelType => {
  return value === 'none' || value === 'knowledge' || value === 'evaluation' || value === 'mcpStatus' || value === 'writingHelper'
}

const loadActiveRightPanel = (): RightPanelType => {
  try {
    const raw = localStorage.getItem(ACTIVE_RIGHT_PANEL_STORAGE_KEY)
    if (!raw) return 'none'
    return isRightPanelType(raw) ? raw : 'none'
  } catch {
    return 'none'
  }
}

export function useAppUiPersistence() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => loadSidebarCollapsed())
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType>(() => loadActiveRightPanel())
  const [writingHelperDraft, setWritingHelperDraft] = useState<WritingHelperDraftState>(() => loadWritingHelperDraft())

  useEffect(() => {
    try {
      localStorage.setItem(WRITING_HELPER_DRAFT_STORAGE_KEY, JSON.stringify(writingHelperDraft))
    } catch {
      // ignore localStorage write failures
    }
  }, [writingHelperDraft])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, sidebarCollapsed ? 'true' : 'false')
    } catch {
      // ignore localStorage write failures
    }
  }, [sidebarCollapsed])

  useEffect(() => {
    try {
      localStorage.setItem(ACTIVE_RIGHT_PANEL_STORAGE_KEY, activeRightPanel)
    } catch {
      // ignore localStorage write failures
    }
  }, [activeRightPanel])

  const clearWritingHelperDraft = useCallback(() => {
    clearWritingHelperDraftStorage()
    setWritingHelperDraft(DEFAULT_WRITING_HELPER_DRAFT)
  }, [])

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    activeRightPanel,
    setActiveRightPanel,
    writingHelperDraft,
    setWritingHelperDraft,
    clearWritingHelperDraft,
  }
}
