import type { MouseEvent } from 'react'

interface PanelResizeHandleProps {
  side: 'left' | 'right'
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void
  onDoubleClick: () => void
}

export function PanelResizeHandle({ side, onMouseDown, onDoubleClick }: PanelResizeHandleProps) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      className={`absolute top-0 ${
        side === 'right' ? 'right-0 translate-x-1/2' : 'left-0 -translate-x-1/2'
      } w-3 h-full z-50 cursor-col-resize select-none group`}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
    >
      <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-transparent group-hover:bg-primary-400 dark:group-hover:bg-primary-500 group-active:bg-primary-500 transition-colors duration-150" />
    </div>
  )
}
