import { useCallback, useState } from 'react'

export interface ContextUsage {
  usedChars: number
  usedK: number
  totalK: number
  percent: number
}

const DEFAULT_CONTEXT_USAGE: ContextUsage = {
  usedChars: 0,
  usedK: 0,
  totalK: 128,
  percent: 0,
}

export function useAppContextUsage() {
  const [contextUsage, setContextUsage] = useState<ContextUsage>(DEFAULT_CONTEXT_USAGE)

  const handleContextUsageChange = useCallback((usage: ContextUsage) => {
    setContextUsage((prev) => {
      if (
        prev.usedChars === usage.usedChars &&
        prev.usedK === usage.usedK &&
        prev.totalK === usage.totalK &&
        prev.percent === usage.percent
      ) {
        return prev
      }
      return usage
    })
  }, [])

  return {
    contextUsage,
    handleContextUsageChange,
  }
}
