# M6 Phase 1 Analysis: Profiling & Bundle Audit

## Bundle Size Baseline (Production Build)

| Chunk | Size | Gzip | Notes |
|-------|------|------|-------|
| index.js | 457KB | 135KB | Main app bundle — too large |
| vendor-editor.js | 299KB | 98KB | TipTap/ProseMirror |
| vendor-editor-pm.js | 216KB | 67KB | ProseMirror core |
| vendor-markdown.js | 118KB | 36KB | react-markdown |
| vendor-lucide.js | 20KB | 7KB | Icon library |
| vendor-virtual.js | 16KB | 5KB | @tanstack/react-virtual |

**Total**: ~1,126KB uncompressed, ~348KB gzip

## Key Finding: Lazy Loading Already Implemented

All 12 right-panel components in `AppRightPanels.tsx` already use `React.lazy()` + `Suspense`:
- SettingsModal, KnowledgeModal, EvaluationPanel, AutomationPanel
- McpStatusPanel, WritingHelperPanel, AiTextOptimizer
- ForeshadowingTrackerPanel, PatternDashboardPanel, SessionAnalyticsPanel
- EvaluationDrillDownPanel, CharacterRelationshipsPanel

This means the roadmap's TASK-2.1 (lazy-load heavy panels) is **already done**. The lazy-load candidate table in the roadmap was based on pre-lazy measurements.

## Main Chunk Analysis (index.js — 457KB)

### Non-lazy heavy components in main chunk:

| Component | LOC | In Main Chunk | Can Lazy? |
|-----------|-----|---------------|-----------|
| StoryBiblePanel.tsx | 1788 | Yes — imported directly by DocumentEditor | Yes, conditionally rendered |
| ChatArea.tsx | 1287 | Yes — imported by ChatSidebar | Conditional (chat sidebar) |
| NikoEditor.tsx | 477 | Yes — imported by DocumentEditor | Low (editor is primary view) |
| DocumentEditor.tsx | ~150 | Yes — imported by AppMainContent | No (wraps editor) |
| Sidebar.tsx | ~600 | Yes — imported by App | No (always visible) |
| MessageBubble.tsx | ~460 | Yes — imported by ChatArea | Low (core chat) |

### Import chain for main chunk bloat:

```
App.tsx
  → Sidebar (always loaded, ~600 LOC)
  → AppMainContent → DocumentEditor → StoryBiblePanel (1788 LOC) + NikoEditor (477 LOC)
  → ChatSidebar → ChatArea (1287 LOC) → MessageBubble (460 LOC, uses react-markdown)
```

### react-markdown in main chunk:

`MessageBubble.tsx` imports `react-markdown` directly (line 2). This is used for rendering AI assistant messages. Since `vendor-markdown` is already a separate chunk (118KB), the actual issue is that MessageBubble triggers this chunk load on every chat view — which is expected. No optimization needed here.

## Store Subscription Analysis

### Over-subscription issues (components using `useAppStore()` without selector):

1. **`Sidebar.tsx:42`** — `const { createConversation, selectConversation } = useAppStore()`
   - Subscribes to entire store, re-renders on ANY state change
   - Fix: use targeted selectors

2. **`EvaluationPanel.tsx:540`** — `const { addMessage } = useAppStore()`
   - Subscribes to entire store (lazy component, lower priority)
   - Fix: use targeted selector

3. **`SettingsModal.tsx:80`** — `const { checkBackend } = useAppStore()`
   - Subscribes to entire store (lazy component, lower priority)
   - Fix: use targeted selector

### Good patterns already in place:

- `selectors.ts` provides `useShallow`-based selectors for array values
- `DocumentEditor.tsx` uses fine-grained selectors: `useAppStore((state) => state.currentConversationId)`
- `ChatArea.tsx` uses `useAppStore((state) => state.toggleSkill)` (single value selector)
- `StoryBiblePanel.tsx` uses fine-grained selectors for `currentWorkspace` and `setCurrentWorkspace`
- `App.tsx` uses `useSettingsStore((state) => state.settings.fontSize)` (proper narrow selector)

## Code Splitting Opportunities

### High Impact:

1. **StoryBiblePanel** (1788 LOC) — Currently in main chunk via `DocumentEditor.tsx` direct import.
   - Can be lazy-loaded: it's rendered conditionally in DocumentEditor (appears as a tab/panel)
   - Expected savings: ~50-80KB from main chunk

2. **ChatArea + ChatSidebar** (~1750 LOC combined) — Always in main chunk.
   - `ChatSidebar` wraps `ChatArea`, controlled by `chatSidebarCollapsed` state
   - Can lazy-load ChatArea inside ChatSidebar (already conditionally rendered)
   - Expected savings: ~40-60KB from main chunk

### Medium Impact:

3. **Sidebar over-subscription fix** — `useAppStore()` without selector
   - Not a bundle size issue, but prevents unnecessary re-renders
   - Particularly impactful: Sidebar re-renders on every store change

### Low Impact / Not Recommended:

4. **NikoEditor** (477 LOC) — Editor is the primary view, lazy-loading would cause visible delay
5. **MessageBubble** (460 LOC) — Core to chat experience, already minimal
6. **react-markdown** — Already code-split into vendor-markdown chunk

## Vite Config Analysis

Current `manualChunks` splits 5 vendor libraries but has no app-level splitting rules.
Adding a rule for `src/components/StoryBiblePanel` could further reduce main chunk, but React.lazy is the preferred approach.

## Lucide Icons

22 files import from `lucide-react`. Each file imports specific icons (e.g., `import { BookOpen, ChevronDown } from 'lucide-react'`).
Lucide already tree-shakes well — the vendor-lucide chunk is only 20KB (7KB gzip). No optimization needed.

## Summary of Optimization Targets

| Priority | Target | Type | Expected Impact | Effort |
|----------|--------|------|-----------------|--------|
| P1 | Lazy-load StoryBiblePanel | Code splitting | -50-80KB main chunk | Low |
| P2 | Lazy-load ChatArea in ChatSidebar | Code splitting | -40-60KB main chunk | Low |
| P3 | Fix Sidebar store over-subscription | Render perf | Fewer re-renders | Low |
| P4 | Fix EvaluationPanel store over-subscription | Render perf | Fewer re-renders | Trivial |
| P5 | Fix SettingsModal store over-subscription | Render perf | Fewer re-renders | Trivial |
| P6 | React.memo on pure components | Render perf | Marginal | Medium |
