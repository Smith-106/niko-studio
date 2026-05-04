# M4 Writer Intelligence Dashboard — Decision Context

**Source**: ANL-m4-design-context-2026-05-04 (re-analysis with design context)
**Prior**: ANL-m4-next-milestone-20260503
**Score**: 9.0/10 GO (↑ from 8.5)
**Design Ref**: UID-001 Variant A — Observatory

---

## Locked Decisions

1. **M4 = Writer Intelligence Dashboard** — Frontend-only, no new backend endpoints. Surface existing backend intelligence through UI panels.
2. **Single phase, milestone-scoped, 3-wave structure** — Wave 1: shared components, Wave 2: 5 panels parallel, Wave 3: polish/tests.
3. **Panel-first, graph-later** — Implement data panels first. Graph visualization deferred to future milestone.
4. **Excluded modules** — Fictional Dream, Timeline Consistency, Scene Coherence, Worldview Coherence (no backend endpoints).
5. **Variant A — Observatory** — Data-dense, cool/high-contrast, dense, soft rounding, subtle animation, professional. All component styles, layouts, spacing, typography, and animation tokens from UID-001 are Locked.
6. **CSS-only implementation** — No external visualization library. All layouts via CSS Grid, Flexbox, and standard HTML.
7. **Right-panel placement** — 400px width, following existing AppRightPanels.tsx lazy-loading pattern.
8. **Accordion behavior** — Single-expand for Evaluation Drill-Down, multi-expand for Foreshadowing Tracker.
9. **Standalone panels** — Character Relationships and Evaluation Drill-Down are new standalone right panels (not tabs within existing panels). Reuse existing API hooks.
10. **5 target panels**: Foreshadowing Tracker (timeline_table), Pattern Dashboard (categorized_grid), Session Analytics (metric_row_grid), Evaluation Drill-Down (expandable_table), Character Relationships (structured_list).

---

## Free Decisions

1. **i18n key structure** — Need to decide key naming convention for panel labels, section headers, metric labels. Should follow existing i18n patterns in codebase.
2. **State management** — Local component state vs Zustand for UI concerns (expand/collapse state, filter selections). Most panels consume API data directly.

---

## Deferred

1. **Graph visualization** — Network graphs for character relationships, timeline graphs for sessions. Post-M4.
2. **Panel persistence** — Remember panel open/close state and filter selections across sessions. Post-M4.
3. **Real-time updates** — Live data refresh when backend analysis completes. Post-M4.
4. **Export/reporting** — Export panel data as PDF/CSV. Post-M4.
5. **Panel search/filter** — Global search across all panels. Post-M4.
6. **Mobile responsive** — Panel adaptation for smaller viewports. Post-M4.

---

## Design Reference Artifacts

- `scratch/20260503-ui-design-m4-writer-intelligence/MASTER.md` — Layout wireframes, interaction patterns
- `scratch/20260503-ui-design-m4-writer-intelligence/design-tokens.json` — Component styles, spacing, typography
- `scratch/20260503-ui-design-m4-writer-intelligence/animation-tokens.json` — Transitions, keyframes
- `scratch/20260503-ui-design-m4-writer-intelligence/selection.json` — Variant selection metadata
