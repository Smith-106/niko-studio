import React from 'react'
import { FilePlus, BookOpen, Settings, ChevronLeft, ChevronRight, Sparkles, BarChart3, Library, Eye, LayoutGrid, PieChart, Scaling, Users, Brain } from 'lucide-react'

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
}

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
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 custom-scrollbar">
        {!collapsed && (
          <div className="shell-text-ui font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-3 mt-1">{t.sidebarDocuments}</div>
        )}
        {conversations.map((conv) => (
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
        ))}
      </div>

      {/* Primary Navigation */}
      <div className="border-t border-dark-border p-3 space-y-0.5 shrink-0">
        <button
          onClick={onOpenPrompts}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.templateLibraryEntry}
          title={t.templateLibraryEntry}
          type="button"
        >
          <Library size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.templateLibraryEntry}</span>}
        </button>
        <button
          onClick={onOpenKnowledge}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.knowledgeBase}
          title={t.knowledgeBase}
          type="button"
        >
          <BookOpen size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.knowledgeBase}</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.settings}
          title={t.settings}
          type="button"
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.settings}</span>}
        </button>
      </div>

      {!collapsed && (
        <div className="px-3 pt-2 pb-1">
          <div className="shell-text-ui font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-2">Writer Intelligence</div>
        </div>
      )}
      <div className="border-t border-dark-border p-3 space-y-0.5 shrink-0">
        <button onClick={onOpenForeshadowingTracker} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`} title="Foreshadowing" type="button">
          <Eye size={18} />
          {!collapsed && <span className="text-sm font-medium">Foreshadowing</span>}
        </button>
        <button onClick={onOpenPatternDashboard} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`} title="Patterns" type="button">
          <LayoutGrid size={18} />
          {!collapsed && <span className="text-sm font-medium">Patterns</span>}
        </button>
        <button onClick={onOpenSessionAnalytics} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`} title="Analytics" type="button">
          <PieChart size={18} />
          {!collapsed && <span className="text-sm font-medium">Analytics</span>}
        </button>
        <button onClick={onOpenAnalysis} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`} title="智能分析" type="button">
          <Brain size={18} />
          {!collapsed && <span className="text-sm font-medium">智能分析</span>}
        </button>
        <button onClick={onOpenEvaluationDrillDown} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`} title="Evaluation" type="button">
          <Scaling size={18} />
          {!collapsed && <span className="text-sm font-medium">Evaluation</span>}
        </button>
        <button onClick={onOpenCharacterRelationships} className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${collapsed ? 'justify-center' : ''}`} title="Characters" type="button">
          <Users size={18} />
          {!collapsed && <span className="text-sm font-medium">Characters</span>}
        </button>
      </div>

      {/* Footer Tools - Console Status Tags */}
      <div className="border-t border-dark-border p-3 flex flex-wrap gap-2 shrink-0 bg-dark-bg">
        <button
          onClick={onOpenEvaluation}
          className="flex items-center gap-2 px-2 py-1 bg-dark-surface border border-dark-border2 rounded hover:bg-dark-surface2 transition-colors text-dark-text-secondary hover:text-dark-text"
          title={t.sidebarEvaluationPanel}
        >
          <BarChart3 size={14} />
          {!collapsed && <span className="text-[10px] font-medium tracking-wide uppercase">{t.sidebarEvaluationPanel}</span>}
        </button>
      </div>

      {!collapsed && (
        <PanelResizeHandle side="right" onMouseDown={startResize} onDoubleClick={resetWidth} />
      )}
    </aside>
  )
})
