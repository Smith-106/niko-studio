# Phase 2 Context: Optimization Implementation

**Milestone**: M6 — Performance & Technical Debt
**Phase**: 2 — Optimization Implementation
**Source**: Phase 1 profiling results + codebase exploration

---

## Locked Decisions

### LD-1: Lazy-load StoryBiblePanel in DocumentEditor.tsx
- **What**: Replace direct import `import { StoryBiblePanel } from './StoryBiblePanel'` with `React.lazy()` + `Suspense`
- **Why**: StoryBiblePanel is 1788 LOC, P1 priority from Phase 1 audit. Estimated -60 to -100KB from main bundle.
- **Location**: `src/components/DocumentEditor.tsx:5` (import), `:106` (render)
- **Constraint**: Must use same Suspense fallback pattern as AppRightPanels.tsx

### LD-2: Lazy-load ChatArea in ChatSidebar.tsx
- **What**: Replace direct import `import { ChatArea } from './ChatArea'` with `React.lazy()` + `Suspense`
- **Why**: ChatArea is 1287 LOC, P2 priority. Estimated -30 to -40KB from main bundle.
- **Location**: `src/components/ChatSidebar.tsx:2` (import), `:30` (render)
- **Constraint**: ChatSidebar is a collapsible sidebar — ideal for lazy loading since ChatArea renders conditionally

### LD-3: Fix useAppStore() over-subscription in 4 locations
- **What**: Replace bare `useAppStore()` destructuring with targeted selectors from `stores/selectors.ts`
- **Locations**:
  1. `src/components/Sidebar.tsx:42` — `{ createConversation, selectConversation }` → `useCreateConversation()` + new `useSelectConversation()`
  2. `src/components/EvaluationPanel.tsx:540` — `{ addMessage }` → `useAddMessage()`
  3. `src/components/SettingsModal.tsx:80` — `{ checkBackend }` → new `useCheckBackend()`
  4. `src/hooks/useAppViewModel.ts:14` — `{ backendStatus, checkBackend }` → new `useBackendStatus()` + `useCheckBackend()`
- **Why**: Bare `useAppStore()` subscribes to entire store — any state change triggers re-render. Phase 1 identified 3 over-subscribed components.
- **Constraint**: Some selectors already exist (useCreateConversation, useAddMessage). Need to create missing ones (selectConversation, checkBackend, backendStatus).

### LD-4: Performance targets from Phase 1 baseline
- index.js: ≤320KB (from 457KB, ≥30% reduction)
- Lighthouse Performance: ≥80 (from 72, +8 points minimum)
- FCP: <1800ms (from 3023ms)
- LCP: <2500ms (from 3974ms)
- TBT: <200ms (from 408ms)

---

## Free Decisions

### FD-1: React.memo strategy
- Sidebar.tsx already wrapped in React.memo
- ChatArea.tsx — evaluate whether React.memo would help given it already uses targeted selectors
- EvaluationPanel.tsx — already lazy-loaded, memo less impactful
- **Decision**: Only apply React.memo where profiling shows clear re-render benefit

### FD-2: Suspense fallback UI
- AppRightPanels.tsx uses a simple loading spinner
- StoryBiblePanel/ChatArea can use same pattern or a skeleton placeholder
- **Decision**: Match existing AppRightPanels fallback pattern for consistency

### FD-3: Selector granularity
- Group related selectors (backendStatus + checkBackend) or keep separate
- **Decision**: Keep separate — each selector tracks one slice, minimizes subscriptions

---

## Deferred Decisions

### DD-1: TipTap editor re-render optimization
- Roadmap mentions TASK-2.6 (TipTap editor re-render fix)
- ProseMirror causes 117ms reflow during init (from Phase 1)
- Defer unless time permits — high risk, low ROI vs lazy-loading

### DD-2: Service worker / caching strategy
- Not in Phase 2 scope
- Could further improve FCP/LCP in future milestone

---

## Implementation Scope Summary

| Task | Scope | LOC Impact | Risk |
|------|-------|-----------|------|
| Lazy-load StoryBiblePanel | 1 file (DocumentEditor.tsx) | ~5 lines changed | Low |
| Lazy-load ChatArea | 1 file (ChatSidebar.tsx) | ~5 lines changed | Low |
| Zustand selectors | 5 files (selectors.ts + 4 consumers) | ~20 lines changed | Low |
| Missing selectors | 1 file (selectors.ts) | ~15 lines added | Low |

**Total scope**: ~50 lines changed across 6 files. Well-bounded, low-risk optimization work.
