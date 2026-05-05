import { useAppStore } from '../stores/appStore'

export function resolveCurrentContentId(): string {
  const { currentChapterId, currentConversationId } = useAppStore.getState()
  return currentChapterId ?? currentConversationId ?? '__global__'
}

export function resolveCurrentProjectId(): string | null {
  return useAppStore.getState().currentProjectId
}
