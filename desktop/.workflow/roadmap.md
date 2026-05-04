# Roadmap: Niko-Studio Desktop — M5: Writing Experience & Quality

## Overview

M5 shifts focus to the core writing experience and codebase health. After M1–M4 built out the intelligence pipeline, API surface, and dashboard panels, this milestone addresses accumulated technical debt (3 pre-existing test failures, 3 TODO markers), enhances the TipTap editor with writing-specific tools, and polishes the panel interaction layer that M4 introduced.

## Phases

- [ ] **Phase 1: Test Health & Technical Debt** — Fix all pre-existing test failures, resolve TODO markers, add integration tests for key user flows
- [ ] **Phase 2: Editor & UX Enhancement** — TipTap writing tools (word count, focus mode, AI inline actions), panel interaction polish, keyboard navigation

---

## Phase Details

### Phase 1: Test Health & Technical Debt

**Goal**: Achieve a clean test suite (0 failures) and eliminate all TODO/FIXME markers in production code. Add integration tests for the critical chat-to-analysis pipeline that spans multiple modules.

**Depends on**: M4 complete (all panels and shared components in place)

**Success Criteria** (what must be TRUE):
  1. `useChatStreaming.test.tsx` — all 10 tests pass (currently 2 failing)
  2. `Sidebar.test.tsx` — all 15 tests pass (currently 1 failing)
  3. All TODO markers resolved: `analysis.test.ts` lines 48-49 and 98-99 (incomplete assertions), `useChatStreaming.ts` line 174 (commented-out retry logic)
  4. Integration test covering chat send → stream response → message render pipeline passes
  5. Full test suite: 0 failures, 0 skipped

**Task Waves:**

Wave 1 — Test Failure Root Causes:
- [ ] TASK-1.1: Diagnose and fix 2 `useChatStreaming.test.tsx` failures — analyze test expectations vs actual hook behavior, fix either test setup or hook implementation
- [ ] TASK-1.2: Diagnose and fix 1 `Sidebar.test.tsx` failure — analyze component render expectations, fix test or component
- [ ] TASK-1.3: Resolve `analysis.test.ts` TODO markers — fix or remove the 2 commented-out assertions (lines 48-49, 98-99), ensure test coverage is not degraded

Wave 2 — Code Quality:
- [ ] TASK-1.4: Resolve `useChatStreaming.ts` TODO at line 174 — either implement the commented-out retry logic or remove the dead code block with justification
- [ ] TASK-1.5: Run full anti-pattern scan on `src/` — grep for TODO, FIXME, HACK, XXX markers; document or resolve any new findings

Wave 3 — Integration Tests:
- [ ] TASK-1.6: Add integration test for chat send → stream → render pipeline — verify `useChatStreaming` hook + `ChatArea` + `MessageBubble` end-to-end with mock gateway
- [ ] TASK-1.7: Add integration test for knowledge entity search flow — verify `PersistedEntityTab` → API → store → render with mock backend

---

### Phase 2: Editor & UX Enhancement

**Goal**: Enhance the TipTap editor with writing-centric tools that leverage the intelligence panels from M4. Polish panel interactions with keyboard navigation and responsive behavior.

**Depends on**: Phase 1 (clean test baseline before adding features)

**Success Criteria** (what must be TRUE):
  1. Editor displays live word count and estimated reading time in the status bar area
  2. Focus mode (toggleable) hides sidebar and non-essential panels, expanding the editor to full width
  3. AI inline actions work in the editor — select text → AI toolbar appears with rewrite/expand/summarize options
  4. Intelligence panels (M4) are keyboard-navigable — Tab/Shift+Tab between panels, Escape to close
  5. All existing tests + new tests pass (0 failures)

**Task Waves:**

Wave 1 — Editor Tools:
- [ ] TASK-2.1: Add word count and reading time display to editor — use TipTap's `characterCount` extension, display in `AppContextFooter` or editor status bar
- [ ] TASK-2.2: Implement focus/distraction-free mode — toggle to hide sidebar and secondary panels, expand editor; restore on toggle off or Escape key
- [ ] TASK-2.3: Enhance AI toolbar in editor — wire `BubbleToolbar` with rewrite/expand/summarize actions that call the chat API with selected text context

Wave 2 — Panel Polish:
- [ ] TASK-2.4: Add keyboard navigation to intelligence panels — Tab/Shift+Tab cycle through open panels, Escape closes focused panel, Enter activates panel action
- [ ] TASK-2.5: Responsive panel layout — ensure M4 intelligence panels stack gracefully at narrow widths, no horizontal overflow
- [ ] TASK-2.6: Connect editor word count to SessionAnalytics panel — surface live writing metrics in the M4 SessionAnalytics dashboard

Wave 3 — Validation:
- [ ] TASK-2.7: Full regression suite — all tests pass (existing + new), no type errors, no lint warnings
- [ ] TASK-2.8: Manual UI verification — focus mode toggle, AI toolbar, panel keyboard nav, responsive layout all work in dev build

---

## Scope Decisions

- **In scope**:
  - Fixing all pre-existing test failures (useChatStreaming, Sidebar)
  - Resolving all TODO/FIXME markers in production code
  - Integration tests for chat and knowledge flows
  - TipTap word count and reading time
  - Focus/distraction-free mode
  - AI inline toolbar enhancement (rewrite/expand/summarize)
  - Keyboard navigation for M4 intelligence panels
  - Responsive panel layout
  - Connecting editor metrics to SessionAnalytics

- **Deferred**:
  - Custom TipTap extensions beyond characterCount (tables, math, collaborative cursors)
  - Export functionality (PDF, DOCX, Markdown file export)
  - Writing session persistence (save/restore draft state)
  - Dark mode / theme system
  - Performance profiling and optimization (lazy loading, code splitting)
  - Localization beyond existing zh-CN/en-US support

- **Out of scope**:
  - Backend changes (all work is frontend-only this milestone)
  - New API endpoints or gateway modifications
  - Changes to the Tauri Rust layer
  - Breaking changes to store shape or component interfaces

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Test Health & Technical Debt | ⬚ Not started | — |
| 2. Editor & UX Enhancement | ⬚ Not started | — |
