# Roadmap: Niko-Studio Desktop — M6: Performance & Technical Debt

## Overview

M6 focuses on performance profiling and optimization. After M1–M5 built out the full application (MVP → Core Logic → Wiring → Intelligence Dashboard → Writing Experience), the bundle has grown to ~1.4MB uncompressed (~460KB gzip). The main chunk (index.js) is 457KB, and 6 major panels can be lazy-loaded to reduce initial load time. This milestone establishes performance baselines, implements code splitting, and optimizes the critical rendering path.

## Phases

- [ ] **Phase 1: Profiling & Bundle Audit** — Measure baselines, audit bundle composition, identify optimization targets
- [ ] **Phase 2: Optimization Implementation** — Lazy loading, code splitting, render optimization, bundle size reduction

---

## Phase Details

### Phase 1: Profiling & Bundle Audit

**Goal**: Establish concrete performance baselines (Lighthouse, bundle analysis) and create a prioritized optimization plan with measurable targets.

**Depends on**: M5 complete (899 tests, clean codebase)

**Current Bundle Profile** (production build):

| Chunk | Size | Gzip | Notes |
|-------|------|------|-------|
| index.js | 457KB | 135KB | Main app — too large |
| vendor-editor.js | 299KB | 98KB | TipTap/ProseMirror |
| vendor-editor-pm.js | 216KB | 67KB | ProseMirror core |
| vendor-markdown.js | 118KB | 36KB | react-markdown |
| vendor-lucide.js | 20KB | 7KB | Icon library |
| vendor-virtual.js | 16KB | 5KB | @tanstack/react-virtual |

**Lazy-load candidates** (loaded on demand):

| Component | Size | Gzip | Trigger |
|-----------|------|------|---------|
| EvaluationPanel | 61KB | 16KB | Tab click |
| SettingsModal | 57KB | 12KB | Settings open |
| WritingHelperPanel | 44KB | 10KB | Tab click |
| KnowledgeModal | 43KB | 10KB | Modal open |
| AiTextOptimizer | 28KB | 11KB | Feature trigger |
| McpStatusPanel | 21KB | 5KB | Tab click |

**Success Criteria** (what must be TRUE):
  1. Lighthouse Performance score ≥ 80 (baseline current score first)
  2. First Contentful Paint (FCP) measured and documented
  3. Largest Contentful Paint (LCP) measured and documented
  4. Total Blocking Time (TBT) measured and documented
  5. Bundle analysis report generated with size breakdown per module
  6. Priority optimization list created with expected impact estimates

**Task Waves:**

Wave 1 — Baseline Measurement:
- [ ] TASK-1.1: Run Lighthouse audit on current production build — capture Performance, FCP, LCP, TBT, CLS scores
- [ ] TASK-1.2: Generate bundle analysis report — use rollup-plugin-visualizer or vite-bundle-visualizer for module-level breakdown
- [ ] TASK-1.3: Profile React render cycles — identify components with excessive re-renders using React DevTools Profiler

Wave 2 — Analysis & Targeting:
- [ ] TASK-1.4: Audit dynamic import opportunities — map all lazy-load candidates with current import patterns
- [ ] TASK-1.5: Identify store subscription optimization targets — find components subscribed to entire store slices vs specific selectors
- [ ] TASK-1.6: Create optimization plan with priority matrix — impact vs effort for each optimization, measurable targets

---

### Phase 2: Optimization Implementation

**Goal**: Implement the highest-impact optimizations from Phase 1 analysis. Target ≥30% reduction in initial bundle size and measurable improvement in FCP/LCP.

**Depends on**: Phase 1 (data-driven optimization targets)

**Success Criteria** (what must be TRUE):
  1. index.js chunk reduced by ≥30% (from 457KB to ≤320KB)
  2. All 6 lazy-load candidate components use React.lazy + Suspense
  3. Lighthouse Performance score improved by ≥15 points from baseline
  4. FCP improved by ≥20% from baseline
  5. No regressions: 899/899 tests still pass
  6. No FOUC (Flash of Unstyled Content) from lazy loading — appropriate loading fallbacks in place

**Task Waves:**

Wave 1 — Code Splitting:
- [ ] TASK-2.1: Lazy-load heavy panels — EvaluationPanel, SettingsModal, WritingHelperPanel, KnowledgeModal, McpStatusPanel with React.lazy + Suspense
- [ ] TASK-2.2: Lazy-load AiTextOptimizer — this is loaded on demand already, ensure it's properly code-split
- [ ] TASK-2.3: Verify chunk output after lazy loading — confirm new chunk sizes and that shared dependencies are not duplicated

Wave 2 — Render Optimization:
- [ ] TASK-2.4: Optimize Zustand subscriptions — convert broad selectors to precise selectors in frequently-rendering components
- [ ] TASK-2.5: Add React.memo to pure components — identify and memo-ize components that re-render without prop changes
- [ ] TASK-2.6: Optimize TipTap editor re-renders — ensure editor updates don't trigger parent re-renders

Wave 3 — Validation:
- [ ] TASK-2.7: Run Lighthouse audit on optimized build — compare against Phase 1 baseline
- [ ] TASK-2.8: Regression test suite — verify all 899 tests pass, no visual regressions
- [ ] TASK-2.9: Bundle size diff report — before/after comparison with module-level breakdown

---

## Inherited Deferred Items (from M5)

These items were deferred from M5 and remain out of scope for M6:
- Custom TipTap extensions beyond characterCount (tables, math, collaborative cursors)
- Export functionality (PDF, DOCX, Markdown file export)
- Writing session persistence (save/restore draft state)
- Dark mode / theme system
- Localization beyond existing zh-CN/en-US support

---

## Out of Scope

- Backend changes (all work is frontend-only)
- New API endpoints or gateway modifications
- Changes to the Tauri Rust layer
- New features or UI additions
- Breaking changes to store shape or component interfaces

---

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Profiling & Bundle Audit | ⬚ Not started | — |
| 2. Optimization Implementation | ⬚ Not started | — |
