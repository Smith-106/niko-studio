import type { ComponentProps } from 'react'
import { ChatArea } from './ChatArea'

interface ChatSidebarProps {
  chatAreaProps: ComponentProps<typeof ChatArea>
}

export function ChatSidebar({ chatAreaProps }: ChatSidebarProps) {
  return (
    <aside className="w-[400px] flex flex-col border-l border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shrink-0 z-30 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative">
      <ChatArea {...chatAreaProps} />
    </aside>
  )
}
