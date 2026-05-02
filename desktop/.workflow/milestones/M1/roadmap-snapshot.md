# Roadmap: Niko-Studio Desktop — M1: UX & Stability Sprint

## Overview

M1 delivers two sequential phases that together lift the application from a capable prototype to a polished, reliable writing tool. Phase 1 focuses entirely on the React/TypeScript frontend layer — refining the chat composer experience (REQ-A) and achieving visual consistency across all panels (REQ-B) — so user-facing improvements can ship and be validated without touching backend infrastructure. Phase 2 then hardens the Node.js gateway workflow engine and knowledge graph (REQ-C + REQ-D), leveraging the stable agent pipeline established in Phase 1 feedback to improve memory retrieval precision and L1–L5 checkpoint reliability. Both phases maintain strict backward compatibility: no existing features are broken, and all tests must remain green at every wave boundary.

## Phases

- [ ] **Phase 1: Frontend UX Polish** - Cherry Studio-style composer toolbar, mode switching, and cross-panel layout consistency (REQ-A + REQ-B)
- [ ] **Phase 2: Backend Stability & Knowledge** - Agent workflow reliability hardening and Story Bible CRUD + retrieval enhancements (REQ-C + REQ-D)

---

## Phase Details

### Phase 1: Frontend UX Polish

**Goal**: Deliver a Cherry Studio-style composer with toolbar quick-actions and mode switching, and achieve consistent layout rhythm and interaction polish across all major panels.

**Depends on**: Nothing (first phase)

**Requirements**: REQ-A, REQ-B

**Success Criteria** (what must be TRUE):
  1. The chat input area displays a persistent toolbar with at least 4 quick-action buttons (e.g., attach context, toggle mode, clear, template insert) without requiring a slash command.
  2. Users can switch between Write / Revise / Context-Fetch agent modes from the composer toolbar with a single click, and the active mode is visually indicated at all times.
  3. All major panels (ChatArea, Sidebar, StoryBiblePanel, SettingsModal, WritingHelperPanel) share consistent spacing, heading sizes, and interactive element dimensions with no misaligned grids or rogue margin overrides.
  4. Hover states, focus rings, and disabled states are uniform across all button and input components — no panel exhibits uniquely styled interactive elements that break visual cohesion.
  5. Composer draft text persists across mode switches and panel focus changes (no accidental clear on re-render).

**Task Waves:**

Wave 1 — Foundation:
- [ ] TASK-1.1: Audit existing `ChatAreaComposer.tsx` and `ChatAreaModeControls.tsx` — document current props API, internal state, and event handlers; identify which responsibilities belong in the toolbar vs. the input row (`src/components/ChatAreaComposer.tsx`, `src/components/ChatAreaModeControls.tsx`)
- [ ] TASK-1.2: Define shared design tokens for the composer toolbar — button size (32px), icon size (16px), gap rhythm, active/hover color variables — add to `src/index.css` or Tailwind config (`tailwind.config.ts`)
- [ ] TASK-1.3: Audit all panel components for spacing/typography inconsistencies — produce a diff-list of Tailwind class mismatches across `AppMainContent.tsx`, `Sidebar.tsx`, `StoryBiblePanel.tsx`, `WritingHelperPanel.tsx`, `SettingsModal.tsx`, `ChatSidebar.tsx`
- [ ] TASK-1.4: Review `useDraftCache.ts` to confirm draft persistence scope; verify draft survives mode switch and panel blur events (`src/hooks/useDraftCache.ts`)

Wave 2 — Core:
- [ ] TASK-1.5: Implement `ChatAreaToolbar` sub-component inside `ChatAreaComposer.tsx` — render quick-action buttons (attach context, insert template, clear draft, copy last reply) with accessible `aria-label` attributes and keyboard navigation (`src/components/ChatAreaComposer.tsx`)
- [ ] TASK-1.6: Refactor `ChatAreaModeControls.tsx` to expose a compact single-row mode switcher (Write / Revise / Context-Fetch) that fits inline with the toolbar; connect to existing Zustand chat mode state (`src/components/ChatAreaModeControls.tsx`)
- [ ] TASK-1.7: Wire toolbar "attach context" action to open existing `KnowledgeModal` or inject a @-mention token into the composer input — no new modal, reuse existing flow (`src/components/ChatArea.tsx`, `src/components/KnowledgeModal.tsx`)
- [ ] TASK-1.8: Apply standardized spacing pass to `StoryBiblePanel.tsx` and `knowledge/` tab components (`CharacterTab.tsx`, `LocationTab.tsx`, `PlotTab.tsx`, `SkillTab.tsx`) — normalize section headers, card padding, and form field gaps (`src/components/StoryBiblePanel.tsx`, `src/components/knowledge/`)
- [ ] TASK-1.9: Apply layout consistency pass to `Sidebar.tsx`, `ChatSidebar.tsx`, `AppHeader.tsx`, and `AppContextFooter.tsx` — unify icon button sizing, divider widths, and active-item highlight colors (`src/components/Sidebar.tsx`, `src/components/ChatSidebar.tsx`, `src/components/AppHeader.tsx`, `src/components/AppContextFooter.tsx`)
- [ ] TASK-1.10: Standardize interactive states (hover, focus-visible ring, disabled opacity) in `AiToolbar.tsx`, `MessageBubble.tsx`, and `QuickPanel.tsx` — derive from shared Tailwind utilities, remove one-off inline styles (`src/components/AiToolbar.tsx`, `src/components/MessageBubble.tsx`, `src/components/QuickPanel.tsx`)

Wave 3 — Polish & Tests:
- [ ] TASK-1.11: Update `ChatAreaComposer.test.tsx` and `ChatAreaModeControls.test.tsx` — add test cases for toolbar button rendering, mode switch state transitions, and draft persistence across mode changes (`src/components/ChatAreaComposer.test.tsx`, `src/components/ChatAreaModeControls.test.tsx`)
- [ ] TASK-1.12: Add snapshot or visual regression tests for the standardized panel layouts — cover `StoryBiblePanel.test.tsx`, `Sidebar.test.tsx`, and `AppMainContent.test.tsx` at representative viewport width (`src/components/StoryBiblePanel.test.tsx`, `src/components/Sidebar.test.tsx`, `src/components/AppMainContent.test.tsx`)
- [ ] TASK-1.13: Manual smoke-test checklist — verify toolbar quick actions, mode switching persistence, and consistent panel appearance in both zh-CN and en-US locales; confirm no regression in existing slash-command and bubble-toolbar flows

---

### Phase 2: Backend Stability & Knowledge

**Goal**: Harden L1–L5 agent workflow reliability with checkpoint save/restore and error recovery, and improve Story Bible CRUD completeness and memory retrieval precision in the gateway knowledge graph.

**Depends on**: Phase 1

**Requirements**: REQ-C, REQ-D

**Success Criteria** (what must be TRUE):
  1. An interrupted L3–L5 workflow (simulated by killing the sidecar mid-run) resumes from the last saved checkpoint without data loss when the user clicks "Restore" — the engine does not restart from the beginning.
  2. When an agent step returns a non-recoverable error, the chat interface displays a human-readable error message with a retry option, rather than silently hanging or showing a raw stack trace.
  3. Character, Location, and Plot entries each support full CRUD (create, rename, update all fields, delete with confirmation) — no field is read-only or silently dropped on save.
  4. Memory retrieval for an open novel document surfaces at least the top-3 relevant character/location entries when the user queries an entity by name, with no false-positive matches from unrelated stories.
  5. All L1–L5 workflow levels complete their respective test scenarios (rapid reply, lite revision, standard plan, brainstorm, coordinator) without hanging or emitting unhandled promise rejections under normal network conditions.

**Task Waves:**

Wave 1 — Foundation:
- [ ] TASK-2.1: Audit `workflow/engine/` for checkpoint write/read paths — map where `persistence.js` saves state, identify missing `await` or fire-and-forget patterns that can lose checkpoint data (`src-tauri/bin/sidecar/workflow/engine/persistence.js`, `src-tauri/bin/sidecar/workflow/engine/lifecycle.js`)
- [ ] TASK-2.2: Audit `useChatStreaming.ts` and `useChatRecovery.ts` — document the current error propagation path from gateway SSE stream to UI toast; identify which error classes are swallowed silently (`src/hooks/useChatStreaming.ts`, `src/hooks/useChatRecovery.ts`)
- [ ] TASK-2.3: Audit `knowledge/` tab components and `MemoryForm.tsx` — enumerate which fields are present in the form vs. stored in the graph engine; flag any field that is accepted by the form but not persisted to `graph-engine.js` (`src/components/knowledge/MemoryForm.tsx`, `src/components/knowledge/KnowledgeTypes.ts`, `src-tauri/bin/sidecar/graph/graph-engine.js`)
- [ ] TASK-2.4: Audit `graph-manager.js` memory retrieval query — examine scoring/ranking logic; identify whether entity name matching uses exact string, fuzzy, or embedding similarity, and whether story-scope isolation is enforced (`src-tauri/bin/sidecar/graph/graph-manager.js`)

Wave 2 — Core:
- [ ] TASK-2.5: Fix checkpoint persistence in `workflow/engine/persistence.js` — ensure checkpoint is written atomically before each level transition; add a `restored_from_checkpoint` flag to the runtime state so the engine skips completed steps on resume (`src-tauri/bin/sidecar/workflow/engine/persistence.js`, `src-tauri/bin/sidecar/workflow/engine/runtime-state.js`)
- [ ] TASK-2.6: Implement structured error classification in `workflow/engine/` — distinguish recoverable (rate-limit, timeout) vs. non-recoverable (schema violation, auth failure) errors; emit typed error events on the SSE stream (`src-tauri/bin/sidecar/workflow/engine/responses.js`, `src-tauri/bin/sidecar/workflow/engine/flow-control.js`)
- [ ] TASK-2.7: Update `useChatRecovery.ts` to handle the new typed error events — map recoverable errors to auto-retry (max 2 attempts) and non-recoverable errors to a user-visible error card with "Retry" and "Dismiss" actions (`src/hooks/useChatRecovery.ts`, `src/hooks/useChatStreaming.ts`)
- [ ] TASK-2.8: Complete CRUD for `CharacterTab.tsx` — add rename-in-place, delete-with-confirmation, and field validation for all character fields (name, role, traits, backstory); wire delete to `graph-engine.js` node removal (`src/components/knowledge/CharacterTab.tsx`, `src-tauri/bin/sidecar/graph/graph-engine.js`)
- [ ] TASK-2.9: Complete CRUD for `LocationTab.tsx` and `PlotTab.tsx` — apply same rename/delete/validate pattern as TASK-2.8; ensure `PlotTab` supports reordering plot beats (`src/components/knowledge/LocationTab.tsx`, `src/components/knowledge/PlotTab.tsx`)
- [ ] TASK-2.10: Improve memory retrieval precision in `graph-manager.js` — add story-scope filter (only return nodes belonging to the current `project_id`); implement simple TF-IDF or token-overlap scoring to rank results instead of returning all nodes (`src-tauri/bin/sidecar/graph/graph-manager.js`)

Wave 3 — Polish & Tests:
- [ ] TASK-2.11: Add unit tests for checkpoint resume path in `workflow/engine/` — test that a workflow initialized with a pre-existing checkpoint state skips already-completed steps and resumes at the correct level (`src-tauri/bin/sidecar/workflow/engine/persistence.js` test suite, if present under `src-ts/tests/`)
- [ ] TASK-2.12: Update `useChatRecovery.test.tsx` and `useChatStreaming.test.tsx` — add cases for typed error events (recoverable auto-retry, non-recoverable error card render) (`src/hooks/useChatRecovery.test.tsx`, `src/hooks/useChatStreaming.test.tsx`)
- [ ] TASK-2.13: Update `MemoryForm.test.tsx`, `CharacterTab.test.tsx`, `LocationTab.test.tsx`, `PlotTab.test.tsx` — cover create, update all fields, rename, and delete-with-confirmation flows (`src/components/knowledge/`)
- [ ] TASK-2.14: End-to-end smoke test — run L1 through L3 workflow levels manually, interrupt L3 mid-run, verify checkpoint restore; verify character/location CRUD round-trip in both zh-CN and en-US; confirm all existing tests are green

---

## Scope Decisions

- **In scope**:
  - Cherry Studio-style composer toolbar with quick-action buttons and inline mode switcher (REQ-A)
  - Cross-panel layout consistency pass covering spacing, typography, and interactive states (REQ-B)
  - Checkpoint save/restore for L1–L5 workflow levels (REQ-C)
  - Structured error classification and user-visible error recovery UI (REQ-C)
  - Full CRUD for Character, Location, and Plot in Story Bible (REQ-D)
  - Story-scoped memory retrieval with relevance ranking in graph-manager (REQ-D)

- **Deferred**:
  - Full embedding-based semantic search for knowledge retrieval (requires vector DB — deferred to M2)
  - L4/L5 multi-agent coordinator stress testing under concurrent sessions (deferred to M2)
  - Composer rich-text attachments (image/file drag-drop into chat — deferred to M2)
  - Skill Tab CRUD improvements (lower user-impact than Character/Location/Plot — deferred to M2)

- **Out of scope**:
  - Cloud sync or any network storage feature (violates local-first constraint)
  - New AI model integrations or provider changes
  - TipTap editor core modifications unrelated to the composer toolbar
  - Breaking changes to existing Zustand store shape or Tauri command surface

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Frontend UX Polish | Not started | - |
| 2. Backend Stability & Knowledge | Not started | - |
