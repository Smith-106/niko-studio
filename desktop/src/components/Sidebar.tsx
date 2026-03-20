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
  // Use selective selectors for better performance
  const conversations = useConversationList()
  const currentConversationId = useCurrentConversationId()

  // Get actions directly from store (these don't cause re-renders)
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
      className={`bg-gray-900 text-gray-100 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-gray-700">
        {!collapsed && (
          <span className="font-semibold text-white">{t.nikoStudio}</span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-700 rounded-md"
          aria-label={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
          title={collapsed ? t.sidebarToggleExpand : t.sidebarToggleCollapse}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-2">
        <button
          onClick={createConversation}
          className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          aria-label={t.newChat}
          title={t.newChat}
        >
          <MessageSquarePlus size={18} />
          {!collapsed && <span>{t.newChat}</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto px-2">
        {!collapsed && (
          <div className="text-xs text-gray-400 px-2 py-2">{t.chatList}</div>
        )}
        {conversations.map((conv) => (
          <button
            key={conv.id}
            onClick={() => selectConversation(conv.id)}
            className={`w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors ${
              currentConversationId === conv.id
                ? 'bg-gray-700 text-white'
                : 'hover:bg-gray-800 text-gray-300'
            }`}
          >
            {collapsed ? (
              <MessageSquarePlus size={18} />
            ) : (
              <span className="text-sm truncate block">{conv.title}</span>
            )}
          </button>
        ))}
      </div>

      {/* Skills Section */}
      {!collapsed && (
        <div className="border-t border-gray-700 p-2">
          <div className="text-xs text-gray-400 px-2 py-2 flex items-center gap-1">
            <Sparkles size={12} />
            {t.skillPacks}
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {groupedSkills.map((group) => (
              <div key={group.key}>
                <div className="px-2 text-[11px] uppercase tracking-wide text-gray-500">{group.label}</div>
                <div className="space-y-1 mt-1">
                  {group.skills.length === 0 ? (
                    <div className="px-3 py-1 text-[11px] text-gray-500">{t.skillGroupEmpty}</div>
                  ) : (
                    group.skills.map((skill) => (
                      <button
                        key={skill}
                        onClick={() => toggleSkill(skill)}
                        className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                          selectedSkills.includes(skill)
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-gray-800 text-gray-300'
                        }`}
                        type="button"
                      >
                        <div className="font-medium truncate">{skill}</div>
                        <div className={`text-[11px] truncate ${selectedSkills.includes(skill) ? 'text-blue-100' : 'text-gray-500'}`}>
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
      <div className="border-t border-gray-700 p-2 space-y-1">
        <button
          onClick={onOpenPrompts}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
          aria-label={t.templateLibraryEntry}
          title={t.templateLibraryEntry}
          type="button"
        >
          <Library size={18} />
          {!collapsed && <span className="text-sm">{t.templateLibraryEntry}</span>}
        </button>
        <button
          onClick={onOpenKnowledge}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
          aria-label={t.knowledgeBase}
          title={t.knowledgeBase}
          type="button"
        >
          <BookOpen size={18} />
          {!collapsed && <span className="text-sm">{t.knowledgeBase}</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
          aria-label={t.settings}
          title={t.settings}
          type="button"
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm">{t.settings}</span>}
        </button>
      </div>

      {/* Footer */}
      <div className="border-t border-gray-700 p-2">
        <button
          onClick={onOpenWritingHelper}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
          aria-label={t.sidebarWritingHelper}
          title={t.sidebarWritingHelper}
        >
          <Wand2 size={18} />
          {!collapsed && <span className="text-sm">{t.sidebarWritingHelper}</span>}
        </button>
        <button
          onClick={onOpenMcpStatus}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
          aria-label={t.sidebarMcpStatus}
          title={t.sidebarMcpStatus}
        >
          <Server size={18} />
          {!collapsed && <span className="text-sm">{t.sidebarMcpStatus}</span>}
        </button>
        <button
          onClick={onOpenEvaluation}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
          aria-label={t.sidebarEvaluationPanel}
          title={t.sidebarEvaluationPanel}
        >
          <BarChart3 size={18} />
          {!collapsed && <span className="text-sm">{t.sidebarEvaluationPanel}</span>}
        </button>
      </div>
    </aside>
  )
}
