import { useEffect } from 'react'
import {
  MessageSquare,
  MessageSquarePlus,
  BookOpen,
  Settings,
  Sparkles,
  BarChart3,
  Server,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useAppStore } from '../stores/appStore'
import { useConversationListItems, useCurrentConversationId } from '../stores/selectors'
import { useI18n } from '../i18n'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  onOpenKnowledge: () => void
  onOpenSettings: () => void
  onOpenEvaluation: () => void
  onOpenMcpStatus: () => void
}

export function Sidebar({ collapsed, onToggle, onOpenKnowledge, onOpenSettings, onOpenEvaluation, onOpenMcpStatus }: SidebarProps) {
  // Use selective selectors for better performance
  const conversationItems = useConversationListItems()
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

  useEffect(() => {
    void refreshAvailableSkills()
  }, [refreshAvailableSkills])

  return (
    <aside
      className={`bg-slate-900 text-slate-100 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-72'
      }`}
    >
      {/* Header */}
      <div className={`h-14 flex items-center border-b border-slate-800 ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
        {!collapsed && (
          <span className="font-semibold text-white">{t.nikoStudio}</span>
        )}
        <button
          onClick={onToggle}
          className="cursor-pointer rounded-md p-2 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      {/* New Chat Button */}
      <div className={`p-2.5 ${collapsed ? 'px-2' : ''}`}>
        <button
          onClick={createConversation}
          className={`w-full cursor-pointer flex items-center rounded-lg bg-teal-600 text-white transition-colors hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 ${collapsed ? 'justify-center px-2 py-2.5' : 'gap-2 px-3 py-2'}`}
        >
          <MessageSquarePlus size={18} />
          {!collapsed && <span>{t.newChat}</span>}
        </button>
      </div>

      {/* Conversations List */}
      <div className={`flex-1 overflow-y-auto ui-scroll pb-2 ${collapsed ? 'px-2' : 'px-2'}`}>
        {!collapsed && (
          <div className="px-2 py-2 text-xs uppercase tracking-wide text-slate-400">{t.chatList}</div>
        )}
        {conversationItems.map(({ conversation, summary }) => (
          <button
            key={conversation.id}
            onClick={() => selectConversation(conversation.id)}
            className={`w-full rounded-lg mb-1 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${
              collapsed ? 'flex justify-center px-2 py-2.5' : 'text-left px-3 py-2'
            } ${
              currentConversationId === conversation.id
                ? 'bg-slate-700 text-white'
                : 'hover:bg-slate-800 text-slate-300'
            }`}
            aria-label={conversation.title}
          >
            {collapsed ? (
              <MessageSquare size={18} />
            ) : (
              <div className="space-y-1">
                <span className="text-sm truncate block">{conversation.title}</span>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span>{t.sidebarMessagesCount.replace('{count}', String(conversation.messages.length))}</span>
                  <span>·</span>
                  <span>
                    {summary.health.state === 'healthy'
                      ? t.sidebarHealthHealthy
                      : summary.health.state === 'degraded'
                        ? t.sidebarHealthDegraded
                        : summary.health.state === 'error'
                          ? t.sidebarHealthError
                          : t.sidebarHealthIdle}
                  </span>
                  {summary.health.warningCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{t.sidebarWarningCount.replace('{count}', String(summary.health.warningCount))}</span>
                    </>
                  )}
                </div>
                <div className="text-[11px] text-slate-500">
                  {t.sidebarLatestActivity}: {new Date(conversation.updatedAt).toLocaleTimeString()}
                </div>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Skills Section */}
      {!collapsed && (
        <div className="border-t border-slate-800 p-2.5">
          <div className="px-2 py-2 flex items-center gap-1 text-xs uppercase tracking-wide text-slate-400">
            <Sparkles size={12} />
            {t.skillPacks}
          </div>
          <div className="space-y-1 max-h-40 overflow-y-auto ui-scroll">
            {availableSkills.map((skill) => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${
                  selectedSkills.includes(skill)
                    ? 'bg-teal-600 text-white'
                    : 'hover:bg-slate-800 text-slate-400'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={`border-t border-slate-800 p-2.5 ${collapsed ? 'px-2' : ''}`}>
        <button
          onClick={onOpenMcpStatus}
          aria-label={t.mcpStatus}
          className={`w-full rounded-lg text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${collapsed ? 'flex justify-center px-2 py-2.5' : 'flex items-center gap-2 px-3 py-2'}`}
        >
          <Server size={18} />
          {!collapsed && <span className="text-sm">{t.mcpStatus}</span>}
        </button>
        <button
          onClick={onOpenEvaluation}
          aria-label={t.evaluationPanel}
          className={`w-full rounded-lg text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${collapsed ? 'flex justify-center px-2 py-2.5' : 'flex items-center gap-2 px-3 py-2'}`}
        >
          <BarChart3 size={18} />
          {!collapsed && <span className="text-sm">{t.evaluationPanel}</span>}
        </button>
        <button
          onClick={onOpenKnowledge}
          className={`w-full rounded-lg text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${collapsed ? 'flex justify-center px-2 py-2.5' : 'flex items-center gap-2 px-3 py-2'}`}
        >
          <BookOpen size={18} />
          {!collapsed && <span className="text-sm">{t.knowledgeBase}</span>}
        </button>
        <button
          onClick={onOpenSettings}
          className={`w-full rounded-lg text-slate-300 transition-colors hover:bg-slate-800 cursor-pointer focus:outline-none focus:ring-2 focus:ring-teal-500 ${collapsed ? 'flex justify-center px-2 py-2.5' : 'flex items-center gap-2 px-3 py-2'}`}
        >
          <Settings size={18} />
          {!collapsed && <span className="text-sm">{t.settings}</span>}
        </button>
      </div>
    </aside>
  )
}
