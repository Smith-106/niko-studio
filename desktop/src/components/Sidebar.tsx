import { MessageSquarePlus, BookOpen, Settings, ChevronLeft, ChevronRight, Sparkles, BarChart3 } from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useConversationList, useCurrentConversationId } from '../stores/selectors'
import { useI18n } from '../i18n'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenKnowledge: () => void
  onOpenSettings: () => void
  onOpenEvaluation: () => void
}

export function Sidebar({ collapsed, onToggle, onOpenKnowledge, onOpenSettings, onOpenEvaluation }: SidebarProps) {
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
  } = useAppStore()
  const { t } = useI18n()

  return (
    <aside
      className={`bg-gray-900 text-gray-100 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-3 border-b border-gray-700">
        {!collapsed && (
          <span className="font-semibold text-white">🖊️ {t.nikoStudio}</span>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-gray-700 rounded-md"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="p-2">
        <button
          onClick={createConversation}
          className="w-full flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {availableSkills.map((skill) => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                  selectedSkills.includes(skill)
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-800 text-gray-400'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-700 p-2">
        <button
          onClick={onOpenEvaluation}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
        >
          <BarChart3 size={18} />
          {!collapsed && <span className="text-sm">评估面板</span>}
        </button>
        <button
          onClick={onOpenKnowledge}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
        >
          <BookOpen size={18} />
          {!collapsed && <span className="text-sm">{t.knowledgeBase}</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-800 rounded-lg text-gray-300"
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm">{t.settings}</span>}
        </button>
      </div>
    </aside>
  )
}
