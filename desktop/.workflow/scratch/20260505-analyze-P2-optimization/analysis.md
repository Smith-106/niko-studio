# Phase 2 Analysis: Optimization Implementation

**Milestone**: M6 — Performance & Technical Debt
**Phase**: 2 — Optimization Implementation
**Analyzed**: 2026-05-05

---

## 6-Dimension Scoring

### 1. Feasibility: 5/5

All optimizations follow established patterns already in the codebase. React.lazy + Suspense is used in AppRightPanels.tsx for 12 panels. Targeted Zustand selectors already exist in stores/selectors.ts. No new dependencies or architectural changes needed.

**Evidence**: `src/components/AppRightPanels.tsx` imports 12 panels with `React.lazy()`. `src/stores/selectors.ts` exports 11 targeted selectors.

### 2. Impact: 5/5

Phase 1 profiling quantified the impact:
- StoryBiblePanel lazy-load: -60 to -100KB from main bundle
- ChatArea lazy-load: -30 to -40KB from main bundle
- Zustand selector fixes: eliminate over-subscription in 3 identified components (Sidebar, StoryBiblePanel, ChatArea)
- Combined: estimated ≥30% bundle reduction (457KB → ≤320KB target), Lighthouse +8 points

**Evidence**: lighthouse-baseline.json (Performance 72), render-profile.json (3 over-subscribed components), phase1-audit-report.md (P1-P4 priority matrix)

### 3. Risk: 5/5 (low risk)

Each change is isolated to 1-2 files. No shared state mutations, no API changes, no data model changes. React.lazy is a well-understood pattern. If a lazy-load breaks, the fallback (Suspense) catches it gracefully. Zustand selector changes are purely optimization — same behavior, fewer re-renders.

**Mitigations**: Existing 899 tests provide regression coverage. Each change can be verified independently.

### 4. Complexity: 5/5 (low complexity)

Total scope: ~50 lines changed across 6 files. Each task is mechanical:
1. Change import to `React.lazy(() => import(...))`
2. Wrap render in `<Suspense fallback={...}>`
3. Replace `useAppStore()` destructuring with targeted selector hook

No algorithm design, no state machine changes, no cross-component coordination.

### 5. Dependencies: 4/5

Dependencies are minimal but exist:
- Need to create 3 new selectors in stores/selectors.ts before consumer files can use them
- Lazy-load changes are independent of each other
- No external dependency changes needed

**Gap**: selectConversation, checkBackend, backendStatus selectors don't exist yet — trivial to add (1-line selectors following existing patterns).

### 6. Testability: 5/5

- Bundle size: directly measurable via build output
- Lighthouse scores: re-runnable audit
- React lazy-load: chunk output verification (TASK-2.3 in roadmap)
- Zustand selectors: existing 899 tests verify no behavioral change
- Render performance: React DevTools profiler before/after

---

## Overall Score: 29/30

**Recommendation**: **GO** — High-confidence, low-risk, well-scoped optimization work with quantified baselines and clear success criteria.
