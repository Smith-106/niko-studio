import { useCallback, useState } from 'react'

type InlineAction = 'continue' | 'revise' | 'generate' | null

interface SelectionMeta {
  messageId: string
}

interface UseInlineActionsInput {
  isLoading: boolean
}

export function useInlineActions({ isLoading }: UseInlineActionsInput) {
  const [selectedText, setSelectedText] = useState('')
  const [selectionMeta, setSelectionMeta] = useState<SelectionMeta | null>(null)
  const [inlineAction, setInlineAction] = useState<InlineAction>(null)

  const resetInlineState = useCallback(() => {
    setInlineAction(null)
    setSelectionMeta(null)
    setSelectedText('')
  }, [])

  const handleAssistantSelection = useCallback((payload: { messageId: string; selectedText: string }) => {
    setSelectionMeta({ messageId: payload.messageId })
    setSelectedText(payload.selectedText)
    setInlineAction(null)
  }, [])

  const runDisabled = !inlineAction || isLoading

  return {
    selectedText,
    selectionMeta,
    inlineAction,
    setInlineAction,
    resetInlineState,
    handleAssistantSelection,
    runDisabled,
  }
}
