# M4 Re-Analysis — Design Context Integration

**Session**: ANL-m4-design-context-2026-05-04
**Date**: 2026-05-04
**Mode**: Full (re-analysis)
**Scope**: Adhoc — M4 Writer Intelligence Dashboard with locked design direction
**Prior Session**: analyze-m4-next-milestone-20260503 (GO, 8.5/10)

---

## Table of Contents

- [User Intent](#user-intent)
- [Current Understanding](#current-understanding)
- [Discussion Timeline](#discussion-timeline)
- [Technical Solutions](#technical-solutions)
- [Intent Coverage Matrix](#intent-coverage-matrix)

---

## User Intent

Re-analyze M4 now that the UI design direction is locked (Variant A — Observatory). Validate/update prior analysis scores with design context. Produce updated decisions incorporating the design system as Locked constraints.

**Key questions to resolve:**
1. Does the locked design direction change any prior scores?
2. Which Free decisions are now resolved by the design spec?
3. Are there new gray areas introduced by the design that need discussion?
4. Updated risk assessment with concrete layout specifications?

---

## Current Understanding

M4 is a frontend-only milestone to surface existing backend intelligence through UI panels. The prior analysis (ANL-003) scored 8.5/10 GO. The UI design (UID-001) selected Variant A — Observatory: data-dense dashboard with cool/high-contrast/dense/soft/subtle/professional attributes. Five panels have specific layout specifications (timeline_table, categorized_grid, metric_row_grid, expandable_table, structured_list). This re-analysis integrates the design context to update decisions and scores.

---

## Discussion Timeline

### Round 0: Prior Context Summary

**Sources**: ANL-003 context.md, analysis.md; UID-001 MASTER.md, design-tokens.json, animation-tokens.json, selection.json

**Prior Locked Decisions (carried forward)**:
1. M4 = Writer Intelligence Dashboard (frontend-only, no new backend)
2. Single phase, milestone-scoped, 3-wave structure
3. Panel-first, graph-later
4. Fictional Dream / Timeline Consistency / Scene Coherence / Worldview Coherence excluded

**New Locked Decision (from UID-001)**:
5. Variant A — Observatory selected: data-dense, cool/high-contrast, dense layout, soft rounding, subtle animation, professional personality

**Design Specifications Now Locked**:
- Component styles: card, data_row, badge (semantic success/warning/danger), section_header, metric_value/label, progress_bar
- Layout per panel: Foreshadowing=timeline_table, Pattern=categorized_grid(minmax(180px,1fr)), Sessions=metric_row_grid(3col+list), Evaluation=expandable_table(accordion), Characters=structured_list
- Animation tokens: panel enter 200ms, accordion 120ms, badge pulse 600ms, row highlight 1200ms, card hover 150ms, stagger 15ms/item max 300ms
- Spacing: section_gap=16px, card_gap=10px, row_gap=0px, inner_padding=14px
- Typography: panel_title 0.9375rem/700, section_title uppercase/700, body compact, caption label

**Free Decisions Resolved by Design**:
- Visualization library → CSS-based (no external lib needed, per design spec)
- Panel placement → right-panel 400px width (per design brief constraint)

**Free Decisions Still Open**:
- i18n key structure
- State management approach (local vs Zustand)

---

### Round 1: Codebase Exploration & Design Compatibility

**Sources**: exploration-codebase.json, explorations.json, direct codebase examination

**Exploration Findings**:

| Area | Finding | Compatibility | Risk |
|------|---------|---------------|------|
| Panel infrastructure | AppRightPanels.tsx uses lazy+Suspense pattern; RightPanelType is a string union | Full | Low |
| Design tokens | All CSS vars in design-tokens.json exist in globals.css + themes.ts (9 themes) | Full | Low |
| Character API | CharacterTab already calls getCharacterRelationships | Full | Low |
| Evaluation hooks | EvaluationPanel uses useEvaluationData + useDialogFocusTrap | Full | Low |
| Theme system | 9 themes each define complete token sets; badge colors are theme-independent rgba | Full | Low |

**Score Impact Assessment**:
- Feasibility: 9→9 (unchanged — already high, design confirms simplicity)
- Impact: 9→9 (unchanged — design adds no new value dimension)
- Risk: 3→2 (improved — design tokens fully compatible, no lib dependency, fewer unknowns)
- Scope Clarity: 8→9 (improved — design spec resolves 3 of 4 Free decisions, concrete layouts)
- Dependency: 9→9 (unchanged — no new dependencies)

**New Locked Decisions (from exploration)**:
6. Accordion behavior: single-expand (Evaluation) vs multi-expand (Foreshadowing) — per MASTER.md

**New Gray Areas**:
1. **Panel vs Tab integration (Character Relationships)**: Standalone panel or enhanced tab within KnowledgePanel? Recommendation: standalone panel reusing existing API hooks.
2. **Evaluation Drill-Down scope**: New panel or enhancement to existing EvaluationPanel? Recommendation: new focused panel for score analysis.

---

## Technical Solutions

**Panel Integration Pattern** (confirmed from codebase):
```
1. Extend RightPanelType union in useAppUiPersistence.ts
2. Add React.lazy import in AppRightPanels.tsx
3. Add conditional render block matching new panel types
4. Each panel component follows existing pattern: hooks → render → useDialogFocusTrap
```

**Design Token Usage** (confirmed compatible):
- All CSS variables referenced in design-tokens.json resolve to globals.css base values + themes.ts per-theme values
- Badge semantic colors use fixed rgba — no theme variable needed
- Spacing/typography tokens map to existing --shell-font-* custom properties

**Accordion Implementation**:
- Single-expand: Track one expandedIndex in state
- Multi-expand: Track Set<number> of expanded indices
- Animation: 120ms cubic-bezier(0.16, 1, 0.3, 1) via CSS transition on max-height/opacity

---

## Intent Coverage Matrix

| # | Intent Item | Status | Notes |
|---|------------|--------|-------|
| 1 | Validate prior scores with design context | ✅ Complete | Risk 3→2, Scope Clarity 8→9, others unchanged |
| 2 | Identify resolved Free decisions | ✅ Complete | 3 of 4 resolved (viz lib, placement, accordion); 2 remain (i18n, state mgmt) |
| 3 | Identify new gray areas from design | ✅ Complete | 2 gray areas: panel-vs-tab for Characters, evaluation drill-down scope |
| 4 | Updated risk assessment | ✅ Complete | Overall risk down to 2/10 — design tokens 100% compatible, no new infra needed |
