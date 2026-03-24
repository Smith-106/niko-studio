import { useEffect, useMemo } from 'react'
import { MessageSquarePlus, BookOpen, Settings, ChevronLeft, ChevronRight, Sparkles, BarChart3, Server, Wand2, Library } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useConversationList, useCurrentConversationId } from '../stores/selectors'
import { useI18n } from '../i18n'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenKnowledge: () => void
  onOpenPrompts: () => void
  onOpenSettings: () => void
  onOpenEvaluation: () => void
  onOpenMcpStatus: () => void
  onOpenWritingHelper: () => void
}

export function Sidebar({
  collapsed,
  onToggle,
  onOpenKnowledge,
  onOpenPrompts,
  onOpenSettings,
  onOpenEvaluation,
  onOpenMcpStatus,
  onOpenWritingHelper,
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
  const { t } = useI18n()

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

      {/* New Chat Button */}
      <div className="p-3 shrink-0">
        <button
          onClick={createConversation}
          className={`w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 hover:bg-primary-500 active:scale-[0.98] text-white rounded-lg shadow-sm transition-all duration-200 ${collapsed ? 'px-0' : 'px-4'}`}
          aria-label={t.newChat}
          title={t.newChat}
        >
          <MessageSquarePlus size={18} />
          {!collapsed && <span className="font-medium text-sm">{t.newChat}</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-0.5 custom-scrollbar">
        {!collapsed && (
          <div className="text-xs font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-3 mt-1">{t.chatList}</div>
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
          <div className="text-xs font-semibold uppercase tracking-wider text-dark-text-muted px-2 py-2 flex items-center gap-1.5 mb-1">
            <Sparkles size={12} className="text-primary-500" />
            {t.skillPacks}
          </div>
          <div className="space-y-3 max-h-[30vh] overflow-y-auto custom-scrollbar pr-1">
            {groupedSkills.map((group) => (
              <div key={group.key} className="space-y-1">
                <div className="px-2 text-[10px] uppercase tracking-wider text-dark-text-muted">{group.label}</div>
                <div className="space-y-0.5">
                  {group.skills.length === 0 ? (
                    <div className="px-3 py-1.5 text-[11px] text-dark-text-muted italic">{t.skillGroupEmpty}</div>
                  ) : (
                    group.skills.map((skill) => (
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
                        <div className={`font-medium truncate ${selectedSkills.includes(skill) ? 'text-primary-400' : 'text-dark-text'}`}>{skill}</div>
                        <div className={`text-[10px] truncate ${selectedSkills.includes(skill) ? 'text-primary-400/70' : 'text-dark-text-muted'}`}>
                          {t.skillDescriptionGeneric}
                        </div>
                      </button>
                    ))
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

      {/* Footer Tools */}
      <div className="border-t border-dark-border p-3 space-y-0.5 shrink-0 bg-dark-bg/50">
        <button
          onClick={onOpenWritingHelper}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.sidebarWritingHelper}
          title={t.sidebarWritingHelper}
        >
          <Wand2 size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.sidebarWritingHelper}</span>}
        </button>
        <button
          onClick={onOpenMcpStatus}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.sidebarMcpStatus}
          title={t.sidebarMcpStatus}
        >
          <Server size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.sidebarMcpStatus}</span>}
        </button>
        <button
          onClick={onOpenEvaluation}
          className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-dark-surface rounded-lg text-dark-text-secondary hover:text-dark-text transition-colors ${collapsed ? 'justify-center' : ''}`}
          aria-label={t.sidebarEvaluationPanel}
          title={t.sidebarEvaluationPanel}
        >
          <BarChart3 size={18} />
          {!collapsed && <span className="text-sm font-medium">{t.sidebarEvaluationPanel}</span>}
        </button>
      </div>
    </aside>
  )
}
