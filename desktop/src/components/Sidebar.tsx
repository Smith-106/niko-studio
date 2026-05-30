import React, { useRef } from 'react'
import { FilePlus, BookOpen, Settings, ChevronLeft, ChevronRight, Sparkles, BarChart3, Library, Eye, LayoutGrid, PieChart, Scaling, Users, Brain, Activity, Check } from 'lucide-react'
import { useVirtualizer } from '@tanstack/react-virtual'

import { useConversationList, useCurrentConversationId, useCreateConversation, useSelectConversation } from '../stores/selectors'
import { useI18n } from '../i18n'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'
import { useResizablePanel } from '../hooks/useResizablePanel'
import { PanelResizeHandle } from './PanelResizeHandle'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onContinueWriting: () => void
  onOpenKnowledge: () => void
  onOpenPrompts: () => void
  onOpenSettings: () => void
  onOpenEvaluation: () => void
  onOpenForeshadowingTracker: () => void
  onOpenPatternDashboard: () => void
  onOpenSessionAnalytics: () => void
  onOpenAnalysis: () => void
  onOpenEvaluationDrillDown: () => void
  onOpenCharacterRelationships: () => void
  onOpenNarrativeVisualization: () => void
  activeRightPanel?: string
}

type FlowStep = 1 | 2 | 3 | 4

const STEP_TO_PANELS: Record<FlowStep, string[]> = {
  1: ['analysis', 'evaluation'],
  2: ['evaluationDrillDown', 'patternDashboard'],
  3: ['foreshadowingTracker', 'characterRelationships'],
  4: ['narrativeVisualization', 'sessionAnalytics'],
}

function getActiveStep(activePanel: string | undefined): FlowStep | null {
  if (!activePanel || activePanel === 'none') return null
  for (const [step, panels] of Object.entries(STEP_TO_PANELS)) {
    if (panels.includes(activePanel)) return Number(step) as FlowStep
  }
  return null
}

function FlowStepBadge({ step, isActive, isCompleted }: { step: number; isActive: boolean; isCompleted: boolean }) {
  if (isCompleted) {
    return (
      <span className="w-5 h-5 rounded-md bg-primary-600 text-white flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(72,8,209,0.3)]">
        <Check size={12} strokeWidth={3} />
      </span>
    )
  }
  if (isActive) {
    return (
      <span className="w-5 h-5 rounded-md bg-primary-600/30 text-primary-300 flex items-center justify-center text-[10px] font-bold shrink-0 ring-1 ring-primary-500/50 shadow-[0_0_8px_rgba(99,102,241,0.15)]">
        {step}
      </span>
    )
  }
  return (
    <span className="w-5 h-5 rounded-md bg-dark-surface2 text-dark-text-muted flex items-center justify-center text-[10px] font-bold shrink-0">
      {step}
    </span>
  )
}

function FlowConnector({ completed }: { completed: boolean }) {
  return (
    <div className="flex items-center justify-center py-0.5">
      <div className={`w-px h-3 rounded-full transition-colors duration-300 ${completed ? 'bg-primary-500/60' : 'bg-dark-border'}`} />
    </div>
  )
}

const sidebarBtnClass = (collapsed: boolean) =>
  `w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`

export const Sidebar = React.memo(function Sidebar({
  collapsed,
  onToggle,
  onContinueWriting,
  onOpenKnowledge,
  onOpenPrompts,
  onOpenSettings,
  onOpenEvaluation,
  onOpenForeshadowingTracker,
  onOpenPatternDashboard,
  onOpenSessionAnalytics,
  onOpenAnalysis,
  onOpenEvaluationDrillDown,
  onOpenCharacterRelationships,
  onOpenNarrativeVisualization,
  activeRightPanel,
}: SidebarProps) {
  const conversations = useConversationList()
  const currentConversationId = useCurrentConversationId()
  const createConversation = useCreateConversation()
  const selectConversation = useSelectConversation()
  const { t, translate } = useI18n()
  const workspaceSummary = useWriterWorkspaceSummary()
  const writerWorkspaceTitle = translate('writerWorkspaceTitle')
  const writerWorkspaceHint = translate('writerWorkspaceHint')
  const writerContinueLabel = t.sidebarContinueWriting
  const writerStoryBibleLabel = translate('writerStoryBibleLabel')
  const writerChapterLabel = translate('writerChapterLabel')
  const writerStoryBibleMetaLabel = translate('writerStoryBibleMetaLabel')
  const writerWorkspaceLabel = translate('writerWorkspaceLabel')

  const activeStep = getActiveStep(activeRightPanel)

  const handleContinueWriting = () => {
    onContinueWriting()
    const mainContent = document.getElementById('app-main-content')
    if (mainContent instanceof HTMLElement) {
      mainContent.focus()
    }
  }

  const { width, isResizing, startResize, resetWidth } = useResizablePanel({
    defaultWidth: 288,
    minWidth: 200,
    maxWidth: 480,
    storageKey: 'niko.left-sidebar-width-v1',
    direction: 'rtl',
  })

  const VIRTUAL_THRESHOLD = 50
  const convListRef = useRef<HTMLDivElement>(null)
  const shouldVirtualize = conversations.length > VIRTUAL_THRESHOLD
  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => convListRef.current,
    estimateSize: () => 40,
    overscan: 5,
    enabled: shouldVirtualize,
  })

  return (
    <aside
      className={`bg-dark-bg text-dark-text flex flex-col border-r border-dark-border z-10 relative shadow-sm overflow-hidden ${
        isResizing ? '' : 'transition-[width] duration-300'
      }`}
      style={{ width: collapsed ? 72 : width }}
    >
      {/* Header */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-dark-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-primary-600 flex items-center justify-center shadow-sm">
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="font-semibold text-dark-text tracking-wide">{t.nikoStudio}</span>
          </div>
        )}
        <button
          onClick={onToggle}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-dark-text-secondary transition-colors hover:bg-dark-surface hover:text-dark-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'mx-auto' : ''}`}
          aria-label={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
          title={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* New Document Button */}
      <div className="p-3 shrink-0">
        <button
          onClick={createConversation}
          className={`w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 active:scale-[0.98] text-white rounded-lg shadow-sm transition-all duration-200 ${collapsed ? 'px-0' : 'px-4'}`}
          aria-label={t.sidebarNewDocument}
          title={t.sidebarNewDocument}
        >
          <FilePlus size={18} />
          {!collapsed && <span className="font-medium text-sm">{t.sidebarNewDocument}</span>}
        </button>
      </div>

      {!collapsed && workspaceSummary.hasMeaningfulScope && (
        <div className="px-3 pb-3 shrink-0">
          <div className="rounded-2xl border border-dark-border bg-dark-surface/70 p-3 shadow-sm">
            <div className="shell-text-label font-semibold uppercase tracking-[0.18em] text-primary-400">
              {writerWorkspaceTitle}
            </div>
            <div className="mt-2 text-sm font-semibold text-dark-text">
              {workspaceSummary.projectLabel ?? workspaceSummary.chapterLabel ?? workspaceSummary.workspaceLabel}
            </div>
            <p className="shell-text-compact mt-1 text-dark-text-secondary">
              {writerWorkspaceHint}
            </p>
            <div className="shell-text-compact mt-3 space-y-1.5 text-dark-text-secondary">
              {workspaceSummary.chapterLabel && (
                <div>
                  <span className="text-dark-text-muted">{writerChapterLabel}: </span>
                  <span className="text-dark-text">{workspaceSummary.chapterLabel}</span>
                </div>
              )}
              {workspaceSummary.storyBibleLabel && (
                <div>
                  <span className="text-dark-text-muted">{writerStoryBibleMetaLabel}: </span>
                  <span className="text-dark-text">{workspaceSummary.storyBibleLabel}</span>
                </div>
              )}
              {workspaceSummary.workspaceLabel && (
                <div>
                  <span className="text-dark-text-muted">{writerWorkspaceLabel}: </span>
                  <span className="text-dark-text">{workspaceSummary.workspaceLabel}</span>
                </div>
              )}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={handleContinueWriting}
                type="button"
                className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-500"
              >
                {writerContinueLabel}
              </button>
              <button
                onClick={onOpenKnowledge}
                type="button"
                className="rounded-xl border border-dark-border2 bg-dark-bg px-3 py-2 text-xs font-medium text-dark-text transition-colors hover:bg-dark-surface2"
              >
                {writerStoryBibleLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document List */}
      <div
        className="flex-1 overflow-y-auto px-3 space-y-0.5 custom-scrollbar"
        ref={convListRef}
      >
        {!collapsed && (
          <div className="shell-text-ui font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-3 mt-1">{t.sidebarDocuments}</div>
        )}
        {shouldVirtualize ? (
          <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const conv = conversations[virtualItem.index]
              return (
                <button
                  key={conv.id}
                  data-index={virtualItem.index}
                  onClick={() => selectConversation(conv.id)}
                  className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                    currentConversationId === conv.id
                      ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                      : 'hover:bg-dark-surface text-dark-text-secondary hover:text-dark-text'
                  } ${collapsed ? 'justify-center' : 'text-left'}`}
                  title={collapsed ? conv.title : undefined}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  {collapsed ? (
                    <span
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
                        currentConversationId === conv.id
                          ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/40'
                          : 'bg-dark-surface2 text-dark-text-muted group-hover:text-dark-text-secondary'
                      }`}
                      aria-hidden="true"
                    >
                      {(conv.title || '?').trim().charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <span className="text-sm truncate block">{conv.title}</span>
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
                currentConversationId === conv.id
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                  : 'hover:bg-dark-surface text-dark-text-secondary hover:text-dark-text'
              } ${collapsed ? 'justify-center' : 'text-left'}`}
              title={collapsed ? conv.title : undefined}
            >
              {collapsed ? (
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-md text-[11px] font-semibold transition-colors ${
                    currentConversationId === conv.id
                      ? 'bg-primary-600/20 text-primary-300 ring-1 ring-primary-500/40'
                      : 'bg-dark-surface2 text-dark-text-muted group-hover:text-dark-text-secondary'
                  }`}
                  aria-hidden="true"
                >
                  {(conv.title || '?').trim().charAt(0).toUpperCase()}
                </span>
              ) : (
                <span className="text-sm truncate block">{conv.title}</span>
              )}
            </button>
          ))
        )}
      </div>

      {/* Primary Navigation */}
      <div className="border-t border-dark-border p-3 space-y-0.5 shrink-0">
        <button
          onClick={onOpenPrompts}
          className={sidebarBtnClass(collapsed)}
          aria-label={t.templateLibraryEntry}
          title={t.templateLibraryEntry}
          type="button"
        >
          <Library size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.templateLibraryEntry}</span>}
        </button>
        <button
          onClick={onOpenKnowledge}
          className={sidebarBtnClass(collapsed)}
          aria-label={t.knowledgeBase}
          title={t.knowledgeBase}
          type="button"
        >
          <BookOpen size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.knowledgeBase}</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={sidebarBtnClass(collapsed)}
          aria-label={t.settings}
          title={t.settings}
          type="button"
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.settings}</span>}
        </button>
      </div>

      {/* Writer Intelligence — 流程引导式设计 */}
      {!collapsed && (
        <div className="px-3 pt-2 pb-1">
          <div className="shell-text-ui font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-2">{t.sidebarWriterIntelligence}</div>
        </div>
      )}
      <div className="border-t border-dark-border shrink-0 overflow-y-auto custom-scrollbar">
        {/* Step 1: 写作与评估 */}
        {!collapsed && (
          <div className="px-4 pt-3 pb-0.5">
            <div className="flex items-center gap-1.5">
              <FlowStepBadge step={1} isActive={activeStep === 1} isCompleted={activeStep !== null && activeStep > 1} />
              <span className={`shell-text-ui text-[11px] font-semibold transition-colors duration-300 ${activeStep === 1 ? 'text-primary-300' : activeStep !== null && activeStep > 1 ? 'text-primary-500/70' : 'text-primary-400/80'}`}>{t.sidebarFlowWrite}</span>
            </div>
          </div>
        )}
        <div className="px-3 space-y-0.5">
          <button onClick={onOpenAnalysis} className={`${sidebarBtnClass(collapsed)} ${activeStep === 1 && activeRightPanel === 'analysis' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarAnalysis} type="button">
            <Brain size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarAnalysis}</span>}
          </button>
          <button onClick={onOpenEvaluation} className={`${sidebarBtnClass(collapsed)} ${activeStep === 1 && activeRightPanel === 'evaluation' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarEvaluationPanel} type="button">
            <BarChart3 size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarEvaluationPanel}</span>}
          </button>
        </div>

        {!collapsed && <FlowConnector completed={activeStep !== null && activeStep > 1} />}

        {/* Step 2: 评估与修订 */}
        {!collapsed && (
          <div className="px-4 pt-1 pb-0.5">
            <div className="flex items-center gap-1.5">
              <FlowStepBadge step={2} isActive={activeStep === 2} isCompleted={activeStep !== null && activeStep > 2} />
              <span className={`shell-text-ui text-[11px] font-semibold transition-colors duration-300 ${activeStep === 2 ? 'text-primary-300' : activeStep !== null && activeStep > 2 ? 'text-primary-500/70' : 'text-primary-400/80'}`}>{t.sidebarFlowEvaluate}</span>
            </div>
          </div>
        )}
        <div className="px-3 space-y-0.5">
          <button onClick={onOpenEvaluationDrillDown} className={`${sidebarBtnClass(collapsed)} ${activeStep === 2 && activeRightPanel === 'evaluationDrillDown' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarEvaluationDrillDown} type="button">
            <Scaling size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarEvaluationDrillDown}</span>}
          </button>
          <button onClick={onOpenPatternDashboard} className={`${sidebarBtnClass(collapsed)} ${activeStep === 2 && activeRightPanel === 'patternDashboard' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarPatternDashboard} type="button">
            <LayoutGrid size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarPatternDashboard}</span>}
          </button>
        </div>

        {!collapsed && <FlowConnector completed={activeStep !== null && activeStep > 2} />}

        {/* Step 3: 修订与追踪 */}
        {!collapsed && (
          <div className="px-4 pt-1 pb-0.5">
            <div className="flex items-center gap-1.5">
              <FlowStepBadge step={3} isActive={activeStep === 3} isCompleted={activeStep !== null && activeStep > 3} />
              <span className={`shell-text-ui text-[11px] font-semibold transition-colors duration-300 ${activeStep === 3 ? 'text-primary-300' : activeStep !== null && activeStep > 3 ? 'text-primary-500/70' : 'text-primary-400/80'}`}>{t.sidebarFlowRevise}</span>
            </div>
          </div>
        )}
        <div className="px-3 space-y-0.5">
          <button onClick={onOpenForeshadowingTracker} className={`${sidebarBtnClass(collapsed)} ${activeStep === 3 && activeRightPanel === 'foreshadowingTracker' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarForeshadowingTracker} type="button">
            <Eye size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarForeshadowingTracker}</span>}
          </button>
          <button onClick={onOpenCharacterRelationships} className={`${sidebarBtnClass(collapsed)} ${activeStep === 3 && activeRightPanel === 'characterRelationships' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarCharacterRelationships} type="button">
            <Users size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarCharacterRelationships}</span>}
          </button>
        </div>

        {!collapsed && <FlowConnector completed={activeStep !== null && activeStep > 3} />}

        {/* Step 4: 叙事追踪 */}
        {!collapsed && (
          <div className="px-4 pt-1 pb-0.5">
            <div className="flex items-center gap-1.5">
              <FlowStepBadge step={4} isActive={activeStep === 4} isCompleted={false} />
              <span className={`shell-text-ui text-[11px] font-semibold transition-colors duration-300 ${activeStep === 4 ? 'text-primary-300' : 'text-primary-400/80'}`}>{t.sidebarFlowTrack}</span>
            </div>
          </div>
        )}
        <div className="px-3 pb-3 space-y-0.5">
          <button onClick={onOpenNarrativeVisualization} className={`${sidebarBtnClass(collapsed)} ${activeStep === 4 && activeRightPanel === 'narrativeVisualization' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarNarrativeVisualization} type="button">
            <Activity size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarNarrativeVisualization}</span>}
          </button>
          <button onClick={onOpenSessionAnalytics} className={`${sidebarBtnClass(collapsed)} ${activeStep === 4 && activeRightPanel === 'sessionAnalytics' ? 'bg-primary-600/10 text-primary-300 ring-1 ring-primary-500/30' : ''}`} title={t.sidebarSessionAnalytics} type="button">
            <PieChart size={18} />
            {!collapsed && <span className="text-sm font-medium">{t.sidebarSessionAnalytics}</span>}
          </button>
        </div>
      </div>

      {!collapsed && (
        <PanelResizeHandle side="right" onMouseDown={startResize} onDoubleClick={resetWidth} />
      )}
    </aside>
  )
})
