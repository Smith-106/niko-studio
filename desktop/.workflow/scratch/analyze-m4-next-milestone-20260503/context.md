# M4 Context — Decisions & Constraints

**Generated**: 2026-05-03
**Source**: analyze-m4-next-milestone-20260503

---

## Locked Decisions

1. **M4 = Writer Intelligence Dashboard** — Surface existing backend intelligence through rich UI panels. No new backend modules.
   - *Why*: M1→M2→M3→M4 follows build→equip→connect→reveal. Intelligence exists but is invisible to writers.
   - *How*: All tasks must consume existing endpoints. No new MCP endpoints.

2. **Single phase, milestone-scoped** — One plan, 3 waves, matching M3's proven pattern.
   - *Why*: M3 succeeded with milestone-scoped execution. No hard dependency requires phase splitting.
   - *How*: Plan structure is Wave 1 (data panels) → Wave 2 (integration) → Wave 3 (polish/tests).

3. **Panel-first, graph-later** — Start with list/table views for narrative data. Complex visualizations (relationship graphs, heatmaps) deferred unless time permits.
   - *Why*: Minimizes risk. Table views are straightforward React; graph rendering requires library selection and design work.
   - *How*: Foreshadowing tracker = timeline list. Pattern dashboard = categorized list. Session analytics = summary cards.

4. **Fictional Dream, Timeline Consistency, Scene Coherence, Worldview Coherence excluded** — These modules lack MCP endpoints.
   - *Why*: M4 is frontend-only. Adding endpoints crosses the boundary into backend work, expanding scope.
   - *How*: Document as M5 candidates. They need endpoint creation first.

## Free Decisions

1. **Panel placement** — New panels as right-panel types in `AppRightPanels` (extending `RightPanelType` union) or as tabs within existing panels (e.g., CharacterTab extension). Plan should decide per-panel.

2. **Visualization library** — If relationship graph is attempted, library selection (e.g., reactflow, d3, vis.js) is a plan-time decision. Default: no external lib, use CSS-based layout.

3. **i18n key structure** — New translation keys should follow existing pattern. Exact key naming is implementation detail.

4. **State management** — Panel data can use local component state or Zustand stores. Decision deferred to plan based on data complexity.

## Deferred

1. **DEF-M3-002 (Character-foreshadow cross-linking)** — Requires backend graph relation schema change. Defer to M5 or later.

2. **DEF-M3-005 (Chinese-novelist-specific features)** — Needs market research to validate. Defer to dedicated research phase.

3. **Fictional Dream engine UI** — No MCP endpoint exists. Requires backend endpoint creation first. Defer to M5.

4. **Timeline Consistency / Scene Coherence / Worldview Coherence UI** — Same as Fictional Dream. No endpoints.

5. **Complex graph visualization (relationship networks, heatmaps)** — Defer to post-M4 if data panels prove valuable.

6. **Evaluation historical trend tracking** — Store and display score trends over time. Requires persistence design. Defer.

## M3 Deferred Items Resolution

| ID | Action | Rationale |
|----|--------|-----------|
| DEF-M3-001 | **Include in M4** | Pattern → evaluator integration is a wiring task matching M4 scope |
| DEF-M3-002 | Defer to M5 | Backend graph schema change needed |
| DEF-M3-003 | **Include in M4** | Add pattern type as HybridSearch dimension — backend extension within scope |
| DEF-M3-004 | **Include in M4** | Session analytics dashboard is a core M4 panel |
| DEF-M3-005 | Defer | Needs market research |
| DEF-M3-006 | **Include in M4** | Evaluator weight customization in settings panel |

## Scope Boundary

**In scope**:
- Foreshadowing tracker panel (timeline list of plant/hint/harvest events)
- Character relationship view (extend CharacterTab with relationship data)
- Pattern detection dashboard (detected patterns by type, chapter, frequency)
- Writing session analytics (session clustering visualization)
- Evaluation drill-down (per-evaluator detail view in EvaluationPanel)
- Evaluator weight customization (settings section)
- Pattern → evaluator integration wiring
- Pattern-based search dimension in HybridSearch
- i18n keys for new panels
- Test coverage for new components

**Out of scope**:
- New backend modules
- New MCP endpoints
- Workflow L1-L5 UX changes
- Fictional Dream, Timeline Consistency, Scene Coherence, Worldview Coherence UI
- Complex graph/heatmap visualizations
- Market research
- Cloud sync or external API integration
