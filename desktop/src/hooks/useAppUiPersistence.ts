import { useCallback, useEffect, useState } from 'react'
import type { WritingHelperMode } from '../api/client'

export type RightPanelType = 'none' | 'knowledge' | 'evaluation' | 'automation' | 'mcpStatus' | 'writingHelper' | 'textOptimizer' | 'foreshadowingTracker' | 'patternDashboard' | 'sessionAnalytics' | 'evaluationDrillDown' | 'characterRelationships' | 'analysis' | 'templateBrowser' | 'workflowEditor'

export interface WritingHelperEvaluationHandoff {
  source: 'evaluation'
  suggestionTitle: string
  suggestionReason: string
  guidance: string
  carriedContent: 'original-reply' | 'revision-preview'
  preset: {
    mode: WritingHelperMode
    maxSentences: number
    maxItems: number
  }
}

export interface WritingHelperDraftState {
  content: string
  mode: WritingHelperMode
  maxSentences: number
  maxItems: number
  guidance: string
  handoff?: WritingHelperEvaluationHandoff | null
}

const WRITING_HELPER_DRAFT_STORAGE_KEY = 'niko.writing-helper-draft-v1'
const SIDEBAR_COLLAPSED_STORAGE_KEY = 'niko.sidebar-collapsed-v1'
const ACTIVE_RIGHT_PANEL_STORAGE_KEY = 'niko.active-right-panel-v1'
const CHAT_SIDEBAR_COLLAPSED_STORAGE_KEY = 'niko.chat-sidebar-collapsed-v1'

const DEFAULT_WRITING_HELPER_DRAFT: WritingHelperDraftState = {
  content: '',
  mode: 'polish',
  maxSentences: 3,
  maxItems: 6,
  guidance: '',
  handoff: null,
}

export function createWritingHelperDraft(
  overrides: Partial<WritingHelperDraftState> = {},
): WritingHelperDraftState {
  return {
    ...DEFAULT_WRITING_HELPER_DRAFT,
    ...overrides,
    handoff: overrides.handoff ?? DEFAULT_WRITING_HELPER_DRAFT.handoff,
  }
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

const toWritingHelperCarriedContent = (
  value: unknown,
): WritingHelperEvaluationHandoff['carriedContent'] | null => {
  if (value === 'original-reply' || value === 'revision-preview') {
    return value
  }
  return null
}

const loadWritingHelperEvaluationHandoff = (value: unknown): WritingHelperEvaluationHandoff | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const parsed = value as Partial<WritingHelperEvaluationHandoff>
  const carriedContent = toWritingHelperCarriedContent(parsed.carriedContent)
  if (parsed.source !== 'evaluation' || !carriedContent) {
    return null
  }

  const preset = parsed.preset && typeof parsed.preset === 'object'
    ? parsed.preset
    : null

  return {
    source: 'evaluation',
    suggestionTitle: typeof parsed.suggestionTitle === 'string' ? parsed.suggestionTitle : '',
    suggestionReason: typeof parsed.suggestionReason === 'string' ? parsed.suggestionReason : '',
    guidance: typeof parsed.guidance === 'string' ? parsed.guidance : '',
    carriedContent,
    preset: {
      mode: toWritingHelperMode(preset?.mode, DEFAULT_WRITING_HELPER_DRAFT.mode),
      maxSentences: toPositiveInteger(preset?.maxSentences, DEFAULT_WRITING_HELPER_DRAFT.maxSentences),
      maxItems: toPositiveInteger(preset?.maxItems, DEFAULT_WRITING_HELPER_DRAFT.maxItems),
    },
  }
}

const loadWritingHelperDraft = (): WritingHelperDraftState => {
  try {
    const raw = localStorage.getItem(WRITING_HELPER_DRAFT_STORAGE_KEY)
    if (!raw) return DEFAULT_WRITING_HELPER_DRAFT

    const parsed = JSON.parse(raw) as Partial<WritingHelperDraftState>
    return createWritingHelperDraft({
      content: typeof parsed.content === 'string' ? parsed.content : DEFAULT_WRITING_HELPER_DRAFT.content,
      mode: toWritingHelperMode(parsed.mode, DEFAULT_WRITING_HELPER_DRAFT.mode),
      maxSentences: toPositiveInteger(parsed.maxSentences, DEFAULT_WRITING_HELPER_DRAFT.maxSentences),
      maxItems: toPositiveInteger(parsed.maxItems, DEFAULT_WRITING_HELPER_DRAFT.maxItems),
      guidance: typeof parsed.guidance === 'string' ? parsed.guidance : DEFAULT_WRITING_HELPER_DRAFT.guidance,
      handoff: loadWritingHelperEvaluationHandoff(parsed.handoff),
    })
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

const loadChatSidebarCollapsed = (): boolean => {
  try {
    const raw = localStorage.getItem(CHAT_SIDEBAR_COLLAPSED_STORAGE_KEY)
    if (raw === 'true') return true
    if (raw === 'false') return false
    return true
  } catch {
    return true
  }
}

const isRightPanelType = (value: unknown): value is RightPanelType => {
  return value === 'none' || value === 'knowledge' || value === 'evaluation' || value === 'automation' || value === 'mcpStatus' || value === 'writingHelper' || value === 'textOptimizer' || value === 'foreshadowingTracker' || value === 'patternDashboard' || value === 'sessionAnalytics' || value === 'evaluationDrillDown' || value === 'characterRelationships' || value === 'analysis' || value === 'templateBrowser'
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
  const [chatSidebarCollapsed, setChatSidebarCollapsed] = useState(() => loadChatSidebarCollapsed())
  const [activeRightPanel, setActiveRightPanel] = useState<RightPanelType>(() => loadActiveRightPanel())
  const [writingHelperDraft, setWritingHelperDraft] = useState<WritingHelperDraftState>(() => loadWritingHelperDraft())

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth < 1100) setChatSidebarCollapsed(true)
      if (window.innerWidth < 750) setSidebarCollapsed(true)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

  useEffect(() => {
    try {
      localStorage.setItem(CHAT_SIDEBAR_COLLAPSED_STORAGE_KEY, chatSidebarCollapsed ? 'true' : 'false')
    } catch {
      // ignore localStorage write failures
    }
  }, [chatSidebarCollapsed])

  const clearWritingHelperDraft = useCallback(() => {
    clearWritingHelperDraftStorage()
    setWritingHelperDraft(createWritingHelperDraft())
  }, [])

  return {
    sidebarCollapsed,
    setSidebarCollapsed,
    chatSidebarCollapsed,
    setChatSidebarCollapsed,
    activeRightPanel,
    setActiveRightPanel,
    writingHelperDraft,
    setWritingHelperDraft,
    clearWritingHelperDraft,
  }
}
