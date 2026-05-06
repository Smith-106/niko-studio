# Roadmap: Niko-Studio M12

## Overview

M12 focuses on polish, robustness, and production readiness. With core features complete through M10-M11, this milestone hardens the application: empty states guide users, error boundaries prevent crashes, performance is optimized for large projects, and the settings/style flows are end-to-end functional.

## Phases

- [ ] **Phase 1: UX Polish & Empty States** — Add meaningful empty states, loading indicators, and guidance text for all M10-M11 features
- [ ] **Phase 2: Error Handling & Robustness** — Add error boundaries around intelligence panels, graceful degradation when backend is unavailable, retry logic for API calls
- [ ] **Phase 3: Performance & Large Project Support** — Virtualize long lists in consistency reports, debounce style extraction, optimize re-renders in AnalysisPanel/EvaluationPanel

## Phase Details

### Phase 1: UX Polish & Empty States
**Goal**: Every intelligence feature has a clear empty state that tells the user what to do next.
**Depends on**: M11 (completed)

**Success Criteria**:
1. EvaluationPanel shows "Load a document to use multi-pass revision" when no content is loaded, with a subtle call-to-action
2. AnalysisPanel consistency tab explains "Add chapters to your project to enable cross-chapter analysis" when no chapters exist
3. Settings style profile section shows a meaningful state when no project is active (not just a disabled button)
4. All empty states use consistent styling (dark card background, muted text, icon)

### Phase 2: Error Handling & Robustness
**Goal**: Intelligence features degrade gracefully — never crash, always show something useful.

**Success Criteria**:
1. Error boundary wraps the AnalysisPanel — if it crashes, show a retry button instead of blank space
2. API call failures in style/cross-chapter endpoints show user-friendly error messages with retry
3. When backend is unreachable, intelligence panels show "offline" state instead of loading spinner forever
4. Console errors from failed API calls are caught and surfaced in UI instead of just logged

### Phase 3: Performance & Large Project Support
**Goal**: Features remain responsive with 50+ chapters.

**Success Criteria**:
1. Cross-chapter consistency report renders within 2 seconds for 50 chapters
2. Style extraction is debounced when typing in the editor
3. Consistency report results are virtualized (not all rendered at once)
4. No unnecessary re-renders when switching between AnalysisPanel tabs

## Scope Decisions

- **In scope**:
  - Empty state UI for all M10-M11 features
  - Error boundaries and graceful degradation
  - Performance optimization for large chapter counts
  - Retry UX for failed API calls
  - Consistent loading/error/empty states

- **Deferred**:
  - Plugin/extension architecture
  - Cloud sync / multi-device
  - Code signing production CA cert

- **Out of scope**:
  - Mobile companion
  - Multi-user collaboration
  - New intelligence features

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. UX Polish & Empty States | Not started | - |
| 2. Error Handling & Robustness | Not started | - |
| 3. Performance & Large Project Support | Not started | - |
