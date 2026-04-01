import type { ComponentProps } from 'react'
import { ChatArea } from './ChatArea'

interface ChatSidebarProps {
  chatAreaProps: ComponentProps<typeof ChatArea>
  chatSidebarCollapsed: boolean
}

export function ChatSidebar({ chatAreaProps, chatSidebarCollapsed }: ChatSidebarProps) {
  return (
    <aside className={`${chatSidebarCollapsed ? 'w-0 overflow-hidden' : 'w-[320px]'} flex flex-col border-l border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shrink-0 z-30 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative transition-all duration-300`}>
      <ChatArea {...chatAreaProps} />
    </aside>
  )
}
