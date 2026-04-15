import React, { useEffect, useMemo } from 'react'
import { FilePlus, BookOpen, Settings, ChevronLeft, ChevronRight, Sparkles, BarChart3, Server, Library } from 'lucide-react'

import { useAppStore } from '../stores/appStore'
import { useConversationList, useCurrentConversationId } from '../stores/selectors'
import { useI18n } from '../i18n'
import { useWriterWorkspaceSummary } from '../hooks/useWriterWorkspaceSummary'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenKnowledge: () => void
  onOpenPrompts: () => void
  onOpenSettings: () => void
  onOpenEvaluation: () => void
  onOpenMcpStatus: () => void
}

export const Sidebar = React.memo(function Sidebar({
  collapsed,
  onToggle,
  onOpenKnowledge,
  onOpenPrompts,
  onOpenSettings,
  onOpenEvaluation,
  onOpenMcpStatus,
}: SidebarProps) {
  const conversations = useConversationList()
  const currentConversationId = useCurrentConversationId()
  const {
    createConversation,
    selectConversation,
    availableSkills,
    selectedSkills,
    toggleSkill,
    refreshAvailableSkills,
  } = useAppStore()
  const { t, language } = useI18n()
  const workspaceSummary = useWriterWorkspaceSummary()
  const isZh = language === 'zh'
  const writerWorkspaceTitle = isZh ? '当前写作项目' : 'Current writing project'
  const writerWorkspaceHint = isZh
    ? '聊天、评估和知识整理会优先围绕这组上下文。'
    : 'Chat, review, and knowledge flows stay anchored to this scope.'
  const writerReviewLabel = isZh ? '审阅当前草稿' : 'Review draft'
  const writerStoryBibleLabel = isZh ? '打开故事设定' : 'Open story bible'
  const writerChapterLabel = isZh ? '章节' : 'Chapter'
  const writerStoryBibleMetaLabel = isZh ? '设定稿' : 'Story bible'
  const writerWorkspaceLabel = isZh ? '工作区' : 'Workspace'

  // ── 技能 ID → 中文显示名 / 描述映射 ──────────────────────────
  const SKILL_DISPLAY_MAP: Record<string, { name: string; desc: string }> = useMemo(() => ({
    'character-forge':       { name: '角色熔炉',   desc: t.skillDescCharacterForge },
    'suspense-craft':        { name: '悬念工坊',   desc: t.skillDescSuspenseCraft },
    'dialogue-system':       { name: '对话系统',   desc: t.skillDescDialogueSystem },
    'tension-arc':           { name: '张力曲线',   desc: t.skillDescTensionArc },
    'emotion-arc':           { name: '情感弧光',   desc: t.skillDescEmotionArc },
    'opening-craft':         { name: '开篇技巧',   desc: t.skillDescOpeningCraft },
    'ending-craft':          { name: '结尾技巧',   desc: t.skillDescEndingCraft },
    'conflict-escalation':   { name: '冲突升级',   desc: t.skillDescConflictEscalation },
  }), [t])

  const getSkillDisplay = (skillId: string) => {
    const entry = SKILL_DISPLAY_MAP[skillId]
    if (entry) return entry
    // 未知技能：kebab-case → 首字母大写可读名
    const fallbackName = skillId.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    return { name: fallbackName, desc: t.skillDescriptionGeneric }
  }

  const groupedSkills = useMemo(() => {
    const groups: Record<'core' | 'story' | 'quality' | 'tools', string[]> = {
      core: [],
      story: [],
      quality: [],
      tools: [],
    }

    for (const skill of availableSkills) {
      const lowered = skill.toLowerCase()
      if (lowered.includes('style') || lowered.includes('rewrite') || lowered.includes('quality') || lowered.includes('polish')) {
        groups.quality.push(skill)
      } else if (lowered.includes('plot') || lowered.includes('character') || lowered.includes('world') || lowered.includes('story')) {
        groups.story.push(skill)
      } else if (lowered.includes('context') || lowered.includes('memory') || lowered.includes('tool') || lowered.includes('retrieval')) {
        groups.tools.push(skill)
      } else {
        groups.core.push(skill)
      }
    }

    return [
      { key: 'core', label: t.skillGroupCore, skills: groups.core },
      { key: 'story', label: t.skillGroupStory, skills: groups.story },
      { key: 'quality', label: t.skillGroupQuality, skills: groups.quality },
      { key: 'tools', label: t.skillGroupTools, skills: groups.tools },
    ]
  }, [availableSkills, t])

  useEffect(() => {
    void refreshAvailableSkills()
  }, [refreshAvailableSkills])

  return (
    <aside
      className={`bg-dark-bg text-dark-text flex flex-col transition-all duration-300 border-r border-dark-border z-10 relative shadow-sm ${
        collapsed ? 'w-[72px]' : 'w-72'
      }`}
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
          className={`p-1.5 hover:bg-dark-surface2 rounded-md text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'mx-auto' : ''}`}
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
                onClick={onOpenEvaluation}
                type="button"
                className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-primary-500"
              >
                {writerReviewLabel}
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
            className={`w-full flex items-center px-3 py-2 rounded-lg transition-colors group ${
              currentConversationId === conv.id
                ? 'bg-dark-surface text-primary-400 font-medium'
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

      {/* Skills Section */}
      {!collapsed && (
        <div className="border-t border-dark-border p-3 shrink-0">
          <div className="shell-text-ui font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-2 flex items-center gap-1.5 mb-1">
            <Sparkles size={12} className="text-primary-500" />
            {t.skillPacks}
          </div>
          <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
            {groupedSkills.map((group) => (
              <div key={group.key} className="space-y-1">
                <div className="shell-text-label px-2 uppercase tracking-wider text-dark-text-muted">{group.label}</div>
                <div className="space-y-0.5">
                  {group.skills.length === 0 ? (
                    <div className="shell-text-compact px-3 py-1.5 text-dark-text-muted italic">{t.skillGroupEmpty}</div>
                  ) : (
                    group.skills.map((skill) => {
                      const display = getSkillDisplay(skill)
                      return (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex flex-col gap-0.5 ${
                          selectedSkills.includes(skill)
                            ? 'bg-primary-600/10 border border-primary-600/20 text-primary-400'
                            : 'hover:bg-dark-surface text-dark-text-secondary'
                        }`}
                        type="button"
                      >
                        <div className={`font-medium truncate ${selectedSkills.includes(skill) ? 'text-primary-400' : 'text-dark-text'}`}>{display.name}</div>
                        <div className={`text-[10px] truncate ${selectedSkills.includes(skill) ? 'text-primary-400/70' : 'text-dark-text-muted'}`}>
                          {display.desc}
                        </div>
                      </button>
                      )
                    })
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Primary Navigation */}
      <div className="border-t border-dark-border p-3 space-y-0.5 shrink-0">
        <button
          onClick={onOpenPrompts}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.templateLibraryEntry}
          title={t.templateLibraryEntry}
          type="button"
        >
          <Library size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.templateLibraryEntry}</span>}
        </button>
        <button
          onClick={onOpenKnowledge}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.knowledgeBase}
          title={t.knowledgeBase}
          type="button"
        >
          <BookOpen size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.knowledgeBase}</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.settings}
          title={t.settings}
          type="button"
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.settings}</span>}
        </button>
      </div>

      {/* Footer Tools - Console Status Tags */}
      <div className="border-t border-dark-border p-3 flex flex-wrap gap-2 shrink-0 bg-dark-bg">
        <button
          onClick={onOpenMcpStatus}
          className="flex items-center gap-2 px-2 py-1 bg-dark-surface border border-dark-border2 rounded hover:bg-dark-surface2 transition-colors text-dark-text-secondary hover:text-dark-text"
          title={t.sidebarMcpStatus}
        >
          <Server size={14} />
          {!collapsed && <span className="text-[10px] font-medium tracking-wide uppercase">节点</span>}
        </button>
        <button
          onClick={onOpenEvaluation}
          className="flex items-center gap-2 px-2 py-1 bg-dark-surface border border-dark-border2 rounded hover:bg-dark-surface2 transition-colors text-dark-text-secondary hover:text-dark-text"
          title={t.sidebarEvaluationPanel}
        >
          <BarChart3 size={14} />
          {!collapsed && <span className="text-[10px] font-medium tracking-wide uppercase">评估</span>}
        </button>
      </div>
    </aside>
  )
})
