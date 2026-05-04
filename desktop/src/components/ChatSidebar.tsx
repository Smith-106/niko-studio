import React, { Suspense, type ComponentProps } from 'react'
const ChatArea = React.lazy(() => import('./ChatArea').then(m => ({ default: m.ChatArea })))
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
      className={`flex flex-col border-l border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface shrink-0 z-30 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 ${
        isResizing ? '' : 'transition-all duration-300'
      } ${chatSidebarCollapsed ? 'overflow-hidden' : ''}`}
      style={{ width: chatSidebarCollapsed ? 0 : width }}
    >
      {!chatSidebarCollapsed && (
        <PanelResizeHandle side="left" onMouseDown={startResize} onDoubleClick={resetWidth} />
      )}
      <Suspense fallback={<div className="flex-1" />}>
        <ChatArea {...chatAreaProps} />
      </Suspense>
    </aside>
  )
}
