import type { ComponentProps } from 'react'
import { ChatArea } from './ChatArea'
import { PanelResizeHandle } from './PanelResizeHandle'
import { useResizablePanel } from '../hooks/useResizablePanel'

interface ChatSidebarProps {
  chatAreaProps: ComponentProps<typeof ChatArea>
  chatSidebarCollapsed: boolean
}

export function ChatSidebar({ chatAreaProps, chatSidebarCollapsed }: ChatSidebarProps) {
  const { width, isResizing, startResize, resetWidth } = useResizablePanel({
    defaultWidth: 320,
    minWidth: 240,
    maxWidth: 560,
    storageKey: 'niko.chat-sidebar-width-v1',
    direction: 'ltr',
  })

  return (
    <aside
      className={`flex flex-col border-l border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shrink-0 z-30 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative ${
        isResizing ? '' : 'transition-[width] duration-300'
      } ${chatSidebarCollapsed ? 'overflow-hidden' : ''}`}
      style={{ width: chatSidebarCollapsed ? 0 : width }}
    >
      {!chatSidebarCollapsed && (
        <PanelResizeHandle side="left" onMouseDown={startResize} onDoubleClick={resetWidth} />
      )}
      <ChatArea {...chatAreaProps} />
    </aside>
  )
}
