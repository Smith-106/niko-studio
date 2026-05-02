# Feature Map — Niko-Studio Desktop

## Overview

Niko-Studio Desktop is an AI-assisted creative writing application. It pairs a rich-text document editor with a persistent AI chat sidebar, layered over a knowledge graph for story world management. The right panel system hosts specialized tools (evaluation, writing helper, automation, MCP diagnostics) that slide in without displacing the editor.

---

## 1. Document Editing

### FT-001: Rich Text Editor (NikoEditor)
- **Status**: active
- **Components**: `src/components/NikoEditor.tsx`, `src/components/DocumentEditor.tsx`
- **Description**: TipTap-based WYSIWYG editor supporting headings, lists, bold/italic/strikethrough, and placeholder text. Persists content per-conversation via draft cache.
- **User value**: Familiar word-processor experience with auto-save and live word/character/reading-time stats shown in the document toolbar.

### FT-002: Slash Command Menu
- **Status**: active
- **Components**: `src/components/editor/SlashCommandMenu.tsx`
- **Description**: Floating command palette triggered by `/` inside the editor. Offers AI commands (generate, continue, full-article) and formatting shortcuts (H1–H3, bullet list).
- **User value**: Single-keystroke access to AI generation and rich formatting without leaving the keyboard.

### FT-003: Bubble Toolbar (Selection Rewrite)
- **Status**: active
- **Components**: `src/components/editor/BubbleToolbar.tsx`
- **Description**: Context toolbar that floats above selected text; exposes bold/italic/strikethrough formatting plus an AI rewrite sub-menu with configurable rewrite options.
- **User value**: Inline text improvement without opening a separate panel.

### FT-004: Document Export
- **Status**: active
- **Components**: `src/components/DocumentEditor.tsx` (calls `src/utils/export.ts`)
- **Description**: Exports the current document to Markdown or HTML from the document toolbar.
- **User value**: Portable output from the writing session.

### FT-005: Content Search
- **Status**: active
- **Components**: `src/components/ContentSearch.tsx`
- **Description**: In-page find using the CSS Custom Highlight API; supports case-sensitive toggle, match count, and next/previous navigation with zero DOM modification.
- **User value**: Fast find-in-chat without breaking message rendering.

### FT-006: Draft Cache
- **Status**: active
- **Components**: `src/hooks/useDraftCache.ts`
- **Description**: Automatically persists unsaved editor content per conversation ID to local storage on a debounce timer.
- **User value**: Content survives accidental closes or app crashes.

---

## 2. AI Chat & Agent

### FT-010: Chat Mode Conversation
- **Status**: active
- **Components**: `src/components/ChatArea.tsx`, `src/components/ChatAreaComposer.tsx`, `src/components/MessageBubble.tsx`
- **Description**: Standard LLM chat with streaming responses. Messages are stored per conversation and rendered in a virtualised list for performance.
- **User value**: Free-form Q&A and brainstorming with full conversation history.

### FT-011: Agent Write / Revise / Context Modes
- **Status**: active
- **Components**: `src/components/ChatArea.tsx`, `src/components/ChatAreaModeControls.tsx`, `src/hooks/useChatRequestBuilder.ts`
- **Description**: Switches the chat request routing to specialised agent endpoints (`agentWrite`, `agentRevise`, `agentGetContext`). Mode controls expose Write, Revise, and Context sub-actions when Agent mode is active.
- **User value**: Directs the AI to write new prose, revise existing text, or retrieve context from the knowledge graph rather than chat freely.

### FT-012: Workflow Level Selection (L1–L5)
- **Status**: active
- **Components**: `src/components/ChatAreaModeControls.tsx`, `src/components/ChatAreaComposer.tsx`
- **Description**: Dropdown in the composer toolbar lets the user select workflow depth: Quick (L1), Lite (L2), Standard (L3), Brainstorm (L4), Coordinator (L5). The selected level is sent in the agent request.
- **User value**: Balances response speed vs. thoroughness for different task sizes.

### FT-013: Skill Pack Selection
- **Status**: active
- **Components**: `src/components/ChatAreaModeControls.tsx`, `src/hooks/useChatRequestBuilder.ts`
- **Description**: Multi-select of available AI skill packs (displayed in the mode controls drawer). Selected skill IDs are attached to every agent request.
- **User value**: Activates domain-specific AI capabilities (e.g., writing style, critic) per request.

### FT-014: Model Comparison Mode
- **Status**: active
- **Components**: `src/components/ChatAreaModeControls.tsx`, `src/components/ChatAreaComposer.tsx`
- **Description**: Toggle that enables side-by-side model comparison; a secondary model picker appears. Both models are queried and results presented for comparison.
- **User value**: Evaluate quality differences between models without leaving the app.

### FT-015: Streaming with Cancel
- **Status**: active
- **Components**: `src/components/ChatArea.tsx`, `src/components/ChatAreaComposer.tsx`, `src/components/ChatAreaStreamStatus.tsx`, `src/hooks/useChatStreaming.ts`
- **Description**: Real-time token streaming with a cancel (stop) button. Stream phase is tracked (`idle | streaming | done | error | interrupted | recovered`) and shown in a status bar.
- **User value**: Immediate feedback during generation with the ability to abort mid-stream.

### FT-016: Chat Recovery
- **Status**: active
- **Components**: `src/components/ChatArea.tsx`, `src/hooks/useChatRecovery.ts`
- **Description**: Detects interrupted or failed streams and offers a retry/recovery path with diagnostic feedback via `buildFailurePresentation`.
- **User value**: Graceful handling of network drops or backend errors without losing context.

### FT-017: Inline Chat Actions (Continue / Revise / Generate)
- **Status**: active
- **Components**: `src/components/ChatAreaInlineActions.tsx`, `src/hooks/useInlineActions.ts`
- **Description**: When the user selects text in the editor while the chat pane is open, an action strip appears offering Continue, Revise, or Generate for that selection.
- **User value**: Context-targeted AI operations directly tied to a text selection.

### FT-018: Quick Rollback
- **Status**: active
- **Components**: `src/components/ChatArea.tsx` (calls `quickRollbackWorkflow`)
- **Description**: One-click rollback of the last agent write via the `quickRollbackWorkflow` API endpoint.
- **User value**: Instant undo of AI-generated content without navigating checkpoint history.

### FT-019: Memory Upload
- **Status**: active
- **Components**: `src/components/ChatArea.tsx`, `src/hooks/useMemoryUpload.ts`
- **Description**: File attachment in the composer triggers upload of content to the backend memory store; the uploaded payload is referenced in subsequent requests.
- **User value**: Inject external documents or notes into the AI's working context.

### FT-020: Prompt Template Library
- **Status**: active
- **Components**: `src/components/PromptTemplatePanel.tsx`, `src/components/ChatAreaModeControls.tsx`
- **Description**: Searchable library of prompt templates grouped by category (brainstorm, outline, character, rewrite, analysis, custom). Templates support variable substitution and can be favorited. Applying a template replaces or appends to the composer input.
- **User value**: Reusable, structured prompts speed up common writing workflows.

### FT-021: Thinking Effect (AI Reasoning Display)
- **Status**: active
- **Components**: `src/components/ThinkingEffect.tsx`
- **Description**: Animated "thinking" indicator rendered inside message bubbles when the model emits chain-of-thought tokens before the final answer.
- **User value**: Visible signal that the model is working, with optional view of reasoning trace.

### FT-022: Context Usage Meter
- **Status**: active
- **Components**: `src/components/AppHeader.tsx`, `src/components/AppContextFooter.tsx`, `src/hooks/useAppContextUsage.ts`
- **Description**: Header bar displays a colour-coded usage bar showing characters/tokens consumed vs. the context window limit; footer shows estimated context text.
- **User value**: Prevents accidental context overflow by making usage visible.

### FT-023: Writer Workspace Summary (Context Footer)
- **Status**: active
- **Components**: `src/components/AppMainContent.tsx`, `src/hooks/useWriterWorkspaceSummary.ts`
- **Description**: Displays current writing context (title, chapter, story bible scope) as a banner below the header when a meaningful workspace is active.
- **User value**: Always-visible reminder of which project scope the AI is working within.

---

## 3. Knowledge & Story Bible

### FT-030: Knowledge Modal (Character / Location / Plot / Skills)
- **Status**: active
- **Components**: `src/components/KnowledgeModal.tsx`, `src/components/knowledge/CharacterTab.tsx`, `src/components/knowledge/LocationTab.tsx`, `src/components/knowledge/PlotTab.tsx`, `src/components/knowledge/SkillTab.tsx`, `src/components/knowledge/PersistedEntityTab.tsx`, `src/components/knowledge/MemoryForm.tsx`
- **Description**: Full-screen modal with four tabs for managing narrative entities. Characters, Locations, and Plot entries are CRUD-managed against the backend graph store. Skills tab manages AI skill packs. Each entity can be promoted to the project wiki canon.
- **User value**: Structured storage of story world facts that the AI can query during writing.

### FT-031: Story Bible Panel
- **Status**: active
- **Components**: `src/components/StoryBiblePanel.tsx`
- **Description**: Embedded panel inside the document editor showing the project wiki canon pages (characters, locations, plot, tags). Supports inline edit, import/export of the story bible, and workspace-notice generation for AI context injection.
- **User value**: Always-available reference for story world consistency without switching views.

### FT-032: Wiki Canon Promotion
- **Status**: active
- **Components**: `src/components/KnowledgeModal.tsx`, `src/components/StoryBiblePanel.tsx` (both call `promoteProjectWikiCanonApi`)
- **Description**: Promotes a knowledge graph entity into a persistent wiki canon page with a structured Markdown body (title, summary, detail entries).
- **User value**: Elevates ephemeral memory entries into durable, version-controlled story references.

### FT-033: Graph Query & Merge
- **Status**: active
- **Components**: `src/components/StoryBiblePanel.tsx` (calls `queryGraph`, `buildGraphMergeMutation`)
- **Description**: Reads and writes structured data to the backend knowledge graph; merge mutations resolve conflicts between in-memory workspace knowledge and persisted canon.
- **User value**: Keeps the AI's knowledge of the story world consistent across sessions.

---

## 4. AI Writing Tools

### FT-040: Writing Helper Panel
- **Status**: active
- **Components**: `src/components/WritingHelperPanel.tsx`, `src/hooks/useAppUiPersistence.ts`
- **Description**: Side panel offering Polish, Rewrite, Expand, Summarize, and Outline modes. Operates on editor selection or full document content. Includes writing style configuration (tone, perspective, sentence style, rhythm, tags) that persists locally.
- **User value**: Structured AI editing with full control over style parameters and before/after diff preview.

### FT-041: AI Text Optimizer
- **Status**: active
- **Components**: `src/components/AiTextOptimizer.tsx`
- **Description**: Focused optimizer with named presets: Humanize, AI Guide, Character Narrative, Literary Polish, Academic Paper, and Custom. Operates on selected text or a manual paste, streams the result, and shows a side-by-side diff.
- **User value**: One-click style transformation targeting specific output profiles.

### FT-042: Evaluation Panel (Quality Check)
- **Status**: active
- **Components**: `src/components/EvaluationPanel.tsx`, `src/hooks/useEvaluationWorkflow.ts`, `src/hooks/useEvaluationRecommendations.ts`, `src/hooks/useEvaluationCheckpoints.ts`, `src/hooks/useEvaluationQualityCheck.ts`, `src/hooks/useEvaluationData.ts`
- **Description**: Full writing quality analysis with consistency check, recommendation suggestions, and checkpoint tracking. Operates on the latest AI reply, editor selection, or writing helper draft as source. Includes a revision loop with diff preview, apply/undo, and alternative generation.
- **User value**: Systematic quality gate that surfaces inconsistencies and improvement opportunities before committing to a revision.

### FT-043: AI Toolbar (Document Header Shortcuts)
- **Status**: active
- **Components**: `src/components/AiToolbar.tsx`, `src/components/AppHeader.tsx`
- **Description**: Row of quick-action buttons in the document header: Write, Rewrite, Describe, Brainstorm, Writing Helper, Text Optimizer.
- **User value**: Single-click AI actions on the current document without opening the chat.

### FT-044: Revision Preview Card
- **Status**: active
- **Components**: `src/components/RevisionPreviewCard.tsx`
- **Description**: Shared diff card used by WritingHelperPanel and EvaluationPanel showing original vs. candidate text with line-level diff highlighting, apply/alternative/undo controls, and optional rollback confirmation guard.
- **User value**: Side-by-side review before accepting AI edits, with safe undo.

### FT-045: Smooth Stream Display
- **Status**: active
- **Components**: `src/hooks/useSmoothStream.ts`
- **Description**: Buffers streaming tokens and releases them at a controlled rate to reduce visual jitter during streaming responses.
- **User value**: Readable, stable text display even at high token speeds.

---

## 5. Workflow & Automation

### FT-050: Automation Panel (Workflow Scheduler)
- **Status**: active
- **Components**: `src/components/AutomationPanel.tsx`
- **Description**: Manage backend scheduled workflow tasks: list, pause, resume, run now, and import lite-plan YAML. Displays task status, retry configuration, and schedule details. Supports lifecycle operations (start/pause/resume/stop/status) against the workflow engine.
- **User value**: Schedule and monitor long-running AI writing pipelines without manual intervention.

### FT-051: Quick Panel (Command Palette)
- **Status**: active
- **Components**: `src/components/QuickPanel.tsx`
- **Description**: Keyboard-activated command palette with fuzzy search over registered actions. Renders up to 8 visible items via a virtual list; supports label, description, icon, and keywords per item.
- **User value**: Keyboard-first navigation to any app function without hunting through menus.

### FT-052: Checkpoint Management
- **Status**: active
- **Components**: `src/components/AppHeader.tsx`, `src/hooks/useAppCheckpointMenu.ts`
- **Description**: Header dropdown lists saved checkpoints (description + timestamp). Selecting one triggers a restore call; a banner (`AppRestoreStatusBanner`) shows success or failure.
- **User value**: Named snapshots of document state that can be restored at any time.

---

## 6. Settings & Config

### FT-060: Settings Modal
- **Status**: active
- **Components**: `src/components/SettingsModal.tsx`, `src/hooks/useSettingsBackendConfig.ts`, `src/hooks/useSettingsProviderModels.ts`, `src/hooks/useSettingsDiagnostics.ts`
- **Description**: Multi-section settings modal covering backend config (agent, memory, workflow, graph, writing, gateway, backup, token, obsidian, integration), quality goals, send shortcut, context retrieval mode, workflow backend mode, and language. Supports import/export of config, field-level masking of secrets, and a three-stage save (persisted → runtime → validation).
- **User value**: Full control over all backend connections and AI behaviour parameters from one place.

### FT-061: MCP Status & Gateway Panel
- **Status**: active
- **Components**: `src/components/McpStatusPanel.tsx`
- **Description**: Real-time health dashboard for backend microservices (memory, graph, search, workflow, critic, agent, skills). Shows connected/degraded/disconnected state per service, gateway metrics, available tools, and allows enabling/disabling individual services or updating their config. Provides one-click re-probe.
- **User value**: Instant visibility into which backend services are healthy and actionable control without editing config files.

### FT-062: Theme Support (Dark / Light)
- **Status**: active
- **Components**: `src/hooks/useTheme.ts`
- **Description**: Persisted theme preference toggled through settings; applies Tailwind dark-mode classes at the root.
- **User value**: Comfortable writing environment in any lighting condition.

### FT-063: Language / i18n (ZH / EN)
- **Status**: active
- **Components**: `src/i18n/` (referenced throughout), `src/hooks/useSettingsProviderModels.ts`
- **Description**: All UI strings are driven by a translation layer; language is toggled in settings and synced via `syncI18nLanguage`.
- **User value**: Full Chinese and English UI without any restart.

---

## 7. UI Shell

### FT-070: Sidebar (Conversation List + Navigation)
- **Status**: active
- **Components**: `src/components/Sidebar.tsx`, `src/hooks/useResizablePanel.ts`, `src/components/PanelResizeHandle.tsx`
- **Description**: Collapsible left sidebar listing all conversations with a "new conversation" button. Also hosts navigation shortcuts to Knowledge, Prompts, Settings, and Evaluation. Resizable via drag handle with persisted width.
- **User value**: Conversation management and feature navigation without cluttering the editor.

### FT-071: Chat Sidebar (Resizable AI Pane)
- **Status**: active
- **Components**: `src/components/ChatSidebar.tsx`, `src/hooks/useResizablePanel.ts`
- **Description**: Right-side collapsible panel hosting the full ChatArea. Width is resizable (240–560 px) and persisted to local storage.
- **User value**: Adjustable AI chat pane that coexists with the document editor.

### FT-072: Right Panel Orchestration (Lazy Panels)
- **Status**: active
- **Components**: `src/components/AppRightPanels.tsx`, `src/hooks/useAppPanelOrchestration.ts`, `src/hooks/useAppUiPersistence.ts`
- **Description**: Lazy-loads EvaluationPanel, SettingsModal, KnowledgeModal, AutomationPanel, McpStatusPanel, WritingHelperPanel, and AiTextOptimizer. Panel open state is persisted across sessions; panels are code-split to reduce initial bundle size.
- **User value**: Fast startup with on-demand loading of heavy panels; remembered open state on restart.

### FT-073: Toast Notification System
- **Status**: active
- **Components**: `src/components/ToastContainer.tsx`, `src/hooks/useToast.ts`
- **Description**: Global toast queue rendered in a fixed-position container; supports success/error/info levels with auto-dismiss.
- **User value**: Non-blocking feedback for background operations like saves and uploads.

### FT-074: Error Boundary
- **Status**: active
- **Components**: `src/components/ErrorBoundary.tsx`
- **Description**: React error boundary wrapping the component tree; catches render errors and shows a recovery UI.
- **User value**: Prevents a single component crash from taking down the whole app.

### FT-075: App Startup & Backend Bootstrap
- **Status**: active
- **Components**: `src/hooks/useAppStartup.ts`, `src/hooks/useAppBackendBootstrap.ts`, `src/hooks/useAppRuntimeHealth.ts`
- **Description**: On mount, bootstraps the backend connection, checks health, and exposes a `backendStatus` signal used throughout the shell to gate features and display connection state.
- **User value**: Graceful degradation and clear status when the backend is unreachable.

### FT-076: Virtual List (Message Rendering)
- **Status**: active
- **Components**: `src/components/VirtualList.tsx`, `src/components/ChatArea.tsx` (uses `@tanstack/react-virtual`)
- **Description**: Windowed rendering of the chat message list to keep memory and paint cost constant regardless of conversation length.
- **User value**: Smooth scrolling in long conversations without memory pressure.

---

## Key Patterns

- **Right-panel lazy loading**: All heavy panels are `React.lazy` wrapped in `AppRightPanels.tsx`; prevents bundle bloat on startup.
- **Hook-per-concern**: Each complex feature has a dedicated hook (`useEvaluationWorkflow`, `useChatStreaming`, `useChatRecovery`, `useEditorAI`) keeping component files lean.
- **Revision loop**: `src/utils/revisionLoop.ts` is a shared utility consumed by both `WritingHelperPanel` and `EvaluationPanel` for apply/undo/alternative operations.
- **Editor handle singleton**: `src/utils/editorHandle.ts` provides a global singleton reference to the TipTap editor, allowing non-React code (hooks, utilities) to read selection or apply mutations.
- **i18n everywhere**: All user-visible strings go through `useI18n()`; no hardcoded English/Chinese except dev fallbacks.

## Recommendations

- FT-014 (Model Comparison): Verify the comparison result display component — no dedicated `ModelComparisonView` component was found; the rendering may be embedded in `MessageBubble.tsx` or `ChatArea.tsx` and worth extracting.
- FT-051 (Quick Panel): The panel exists as a generic action host but its registration site (where `QuickPanelItem[]` is assembled) was not located — likely in `useAppShellViewModel.ts` or `AppViewModel.tsx`; confirm before extending.
- FT-044 (Revision Preview Card): Used by two panels with slightly different props; if a third consumer appears, consider promoting shared revision state to a context rather than prop-drilling.
- FT-050 (Automation Panel): Imports `workflowSchedulerImportLitePlan` suggesting YAML plan import is supported — this is a power-user feature with no visible onboarding; consider documentation or tooltip.
