import { useRef, useEffect, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualListProps<T> {
  items: T[]
  estimateSize: (index: number) => number
  overscan?: number
  children: (item: T, index: number) => ReactNode
  className?: string
  style?: React.CSSProperties
  stickToBottom?: boolean
  containerRef?: React.RefObject<HTMLDivElement>
  onScroll?: () => void
}

export function VirtualList<T>({
  items,
  estimateSize,
  overscan = 5,
  children,
  className,
  style,
  stickToBottom = false,
  containerRef: externalContainerRef,
  onScroll,
}: VirtualListProps<T>) {
  const internalRef = useRef<HTMLDivElement>(null)
  const containerRef = externalContainerRef ?? internalRef
  const isJsdomEnvironment =
    typeof window !== 'undefined'
    && typeof window.navigator?.userAgent === 'string'
    && window.navigator.userAgent.toLowerCase().includes('jsdom')
  const [fallback, setFallback] = useState(isJsdomEnvironment)

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan,
    enabled: !isJsdomEnvironment && !fallback,
  })

  const virtualItems = virtualizer.getVirtualItems()

  // In JSDOM/test environments, the scroll container has 0 dimensions
  // and the virtualizer produces 0 items. Fall back to direct rendering.
  useEffect(() => {
    if (items.length > 0 && virtualItems.length === 0 && !fallback) {
      setFallback(true)
    }
  }, [items.length, virtualItems.length, fallback])

  useEffect(() => {
    if (stickToBottom && items.length > 0) {
      virtualizer.scrollToIndex(items.length - 1, { align: 'end', behavior: 'smooth' })
    }
  }, [stickToBottom, items.length, virtualizer])

  if (fallback) {
    return (
      <div
        ref={containerRef}
        className={className}
        style={{ overflow: 'auto', ...style }}
        onScroll={onScroll}
      >
        {items.map((item, index) => (
          <div key={index}>
            {children(item, index)}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ overflow: 'auto', ...style }}
      onScroll={onScroll}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`,
            }}
            data-index={virtualItem.index}
            ref={virtualizer.measureElement}
          >
            {children(items[virtualItem.index], virtualItem.index)}
          </div>
        ))}
      </div>
    </div>
  )
}
