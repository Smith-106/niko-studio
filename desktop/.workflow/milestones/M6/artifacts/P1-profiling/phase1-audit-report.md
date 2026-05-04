# Phase 1 Audit Report: Profiling & Bundle Analysis

## Bundle Baseline

| Chunk | Size | Gzip | % of Total |
|-------|------|------|------------|
| index.js | 457KB | 135KB | 40.6% |
| vendor-editor.js | 299KB | 98KB | 26.6% |
| vendor-editor-pm.js | 216KB | 67KB | 19.2% |
| vendor-markdown.js | 118KB | 36KB | 10.5% |
| vendor-lucide.js | 20KB | 7KB | 1.8% |
| vendor-virtual.js | 16KB | 5KB | 1.4% |
| **Total** | **1,126KB** | **348KB** | **100%** |

**Main chunk (index.js) is 40.6% of total — primary optimization target.**

## Lighthouse Scores

Captured via CLI Lighthouse on production build (localhost:4173).

| Metric | Value | Lighthouse Score | Rating |
|--------|-------|------------------|--------|
| Performance | — | **72** | Medium |
| First Contentful Paint (FCP) | 3,023ms | 0.49 | Slow |
| Largest Contentful Paint (LCP) | 3,974ms | 0.50 | Slow |
| Total Blocking Time (TBT) | 408ms | 0.67 | Medium |
| Cumulative Layout Shift (CLS) | 0 | 1.0 | Good |
| Speed Index | 3,023ms | 0.94 | Good |
| Time to Interactive (TTI) | 3,987ms | 0.88 | Good |

**Key bottleneck: FCP/LCP (scores ~0.5). JS parse/eval on main chunk blocks first paint.**

**Chrome DevTools trace confirms**: LCP render delay is 258ms (98.7% of LCP time), TTFB is only 3ms.

## Render Hotspots

### Over-Subscription (useAppStore() without selector)

| Component | File | Severity | Impact |
|-----------|------|----------|--------|
| **Sidebar** | `Sidebar.tsx:42` | HIGH | Re-renders on ANY store mutation (6 slices × all state) |
| EvaluationPanel | `EvaluationPanel.tsx:540` | MEDIUM | Lazy-loaded, over-subscribed when mounted |
| SettingsModal | `SettingsModal.tsx:80` | LOW | Lazy-loaded modal, minimal impact |

**Sidebar is critical** — it's always mounted and re-renders on every conversation change, message add, skill toggle, loading state change, and UI state update.

### Forced Reflows (126ms total during load)

| Source | Time | Cause |
|--------|------|-------|
| ProseMirror updateStateInner | 117ms | Editor state initialization |
| index.js anonymous | 17ms | App bootstrap |
| ProseMirror eq | 15ms | Editor comparison |
| react-virtual | 0.1ms | Virtual list calculation |

### DOM Stats

- Total elements: 574
- Sidebar: 85 elements | Main content: 245 elements
- DOM depth: 14 (acceptable)
- Full layout update: 94ms (580 nodes)
- JS heap at idle: 7MB

## Optimization Priority Matrix

| Priority | Target | Type | Expected Impact | Effort | Confidence |
|----------|--------|------|-----------------|--------|------------|
| **P1** | Lazy-load StoryBiblePanel | Code splitting | -50-80KB main chunk | Low | High |
| **P2** | Lazy-load ChatArea in ChatSidebar | Code splitting | -40-60KB main chunk | Low | High |
| **P3** | Fix Sidebar useAppStore() over-subscription | Render perf | Eliminate majority of unnecessary re-renders | Low | High |
| **P4** | Fix EvaluationPanel + SettingsModal over-subscription | Render perf | Fewer re-renders when panels open | Trivial | High |

**Combined P1+P2 impact**: -90 to -140KB from main chunk (457KB → 317-367KB), achieving roadmap target of ≥30% reduction.

**P3 impact**: Sidebar currently re-renders on every store change. With 6 slices and frequent conversation/message updates, this is the single largest source of unnecessary renders.

## Phase 2 Targets

| Target | Current | Goal | Success Metric |
|--------|---------|------|----------------|
| index.js size | 457KB | ≤320KB | -30% main chunk (roadmap SC) |
| Lighthouse Performance | 72 | ≥80 | Score improvement (roadmap SC) |
| FCP | 3,023ms | <1,800ms | Score ≥0.8 |
| LCP | 3,974ms | <2,500ms | Score ≥0.7 |
| TBT | 408ms | <200ms | Score ≥0.9 |
| CLS | 0 | 0 | Maintain perfect score |
| Sidebar re-renders | On every store change | Only on relevant changes | Measured via selector granularity |
| Lazy-loaded panels | 12 (right panels) | 14 (+ StoryBiblePanel, ChatArea) | All heavy conditional components lazy |

### Implementation Approach

1. **P1: StoryBiblePanel** — `React.lazy()` import in DocumentEditor.tsx, wrapped in `<Suspense>`. StoryBiblePanel is conditionally rendered (tab-switched), so lazy load is safe.

2. **P2: ChatArea** — `React.lazy()` import in ChatSidebar.tsx. Chat sidebar defaults to collapsed, so ChatArea loads on-demand when user expands chat.

3. **P3: Sidebar selectors** — Replace `useAppStore()` with targeted selectors:
   ```ts
   const createConversation = useAppStore((s) => s.createConversation)
   const selectConversation = useAppStore((s) => s.selectConversation)
   ```

4. **P4: EvaluationPanel/SettingsModal** — Same pattern as P3, single-field selectors.
