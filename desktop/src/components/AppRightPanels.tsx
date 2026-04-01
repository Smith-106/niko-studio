import { SettingsModal } from './SettingsModal'
import { KnowledgeModal } from './KnowledgeModal'
import { EvaluationPanel } from './EvaluationPanel'
import { McpStatusPanel } from './McpStatusPanel'
import { WritingHelperPanel } from './WritingHelperPanel'
import { AiTextOptimizer } from './AiTextOptimizer'
import type { RightPanelType, WritingHelperDraftState } from '../hooks/useAppUiPersistence'

interface AppRightPanelsProps {
  activeRightPanel: RightPanelType
  settingsOpen: boolean
  latestAssistantContent: string
  writingHelperDraft: WritingHelperDraftState
  closeRightPanel: () => void
  closeSettings: () => void
  openSettingsFromWritingHelper: () => void
  setWritingHelperDraft: (draft: WritingHelperDraftState) => void
  clearWritingHelperDraft: () => void
}

export function AppRightPanels({
  activeRightPanel,
  settingsOpen,
  latestAssistantContent,
  writingHelperDraft,
  closeRightPanel,
  closeSettings,
  openSettingsFromWritingHelper,
  setWritingHelperDraft,
  clearWritingHelperDraft,
}: AppRightPanelsProps) {
  return (
    <>
      {activeRightPanel === 'knowledge' && (
        <KnowledgeModal isOpen onClose={closeRightPanel} />
      )}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={closeSettings}
      />

      {activeRightPanel === 'evaluation' && (
        <EvaluationPanel
          content={latestAssistantContent}
          onClose={closeRightPanel}
        />
      )}

      {activeRightPanel === 'mcpStatus' && <McpStatusPanel onClose={closeRightPanel} />}

      {activeRightPanel === 'writingHelper' && (
        <WritingHelperPanel
          onClose={closeRightPanel}
          onOpenSettings={openSettingsFromWritingHelper}
          draftState={writingHelperDraft}
          onDraftStateChange={setWritingHelperDraft}
          onClearDraft={clearWritingHelperDraft}
        />
      )}

      {activeRightPanel === 'textOptimizer' && (
        <AiTextOptimizer
          onClose={closeRightPanel}
          onOpenSettings={openSettingsFromWritingHelper}
        />
      )}
    </>
  )
}
