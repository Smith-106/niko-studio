# Implementation Plan: Release, Docs, and Workflow Alignment

**Session**: `WFS-release-docs-workflow-alignment-20260407`  
**Status**: Planning Complete  
**Prepared**: `2026-04-07T16:30:00+08:00`

## 1. Requirements Summary

### Goal

Close the remaining post-migration alignment work identified by the `2026-04-07` progress report so external release automation, high-visibility docs, workflow bookkeeping, and evidence reporting all agree with the already-completed core closure.

### In Scope

- Align the external release workflow to the current `desktop + src-ts` authority surface
- Refresh README / release docs / high-visibility status docs so they no longer present conflicting completion signals
- Reconcile stale workflow session metadata and TODO files with completed CSV-wave execution artifacts
- Refresh release summary evidence inputs and freshness/linkage signals to current repository reality
- Run a final alignment verification sweep and record one authoritative handoff

### Out of Scope

- Reopening the completed core migration implementation work
- New product features unrelated to release and workflow alignment
- Large historical documentation rewrites beyond the minimum needed to resolve current authority conflicts
- Broad legacy-compatibility productization beyond explicit boundary notes

## 2. Architecture Decisions

1. **The completed core closure remains the engineering source of truth**
   - `cwp-core-migration-final-closure-20260407` already records `7/7 completed` and `GO`.
   - This session aligns downstream surfaces to that fact instead of replanning completed work.

2. **Wave 1 must preserve non-overlapping ownership**
   - External CI, public docs, and workflow bookkeeping touch different directories.
   - Keeping them parallel-safe maximizes later `csv-wave-pipeline` value.

3. **Evidence refresh should consume current authority, not dead history**
   - If `.writing/sessions` snapshot linkage is still required, it must be backed by current valid artifacts.
   - If it is obsolete, the signal source must be replaced intentionally and documented.

4. **Documentation should clarify authority, not amplify ambiguity**
   - README and release docs must clearly distinguish current runtime/release authority from historical roadmap material.

5. **Final verification is a separate wave**
   - Only after CI/docs/workflow/evidence are aligned should the repository publish a new authoritative closeout signal.

## 3. Task Breakdown

| Task | Objective | Wave | Depends On |
|------|-----------|------|------------|
| `IMPL-001` | Align external release gate to current authority surfaces | 1 | - |
| `IMPL-002` | Refresh public release and status documentation authority | 1 | - |
| `IMPL-003` | Reconcile active workflow bookkeeping with completed closure artifacts | 1 | - |
| `IMPL-004` | Refresh release evidence linkage and freshness inputs | 2 | `IMPL-001`, `IMPL-002`, `IMPL-003` |
| `IMPL-005` | Run final alignment verification and publish handoff | 3 | `IMPL-004` |

## 4. Implementation Strategy

### Wave 1: Parallel Alignment

- `IMPL-001` removes stale external CI assumptions tied to missing Python-era paths.
- `IMPL-002` resolves high-visibility documentation ambiguity across README, release notes, and legacy task/status docs.
- `IMPL-003` updates workflow session status surfaces so completed work no longer reads as pending.

### Wave 2: Evidence and Summary Refresh

- `IMPL-004` updates the release summary evidence model and/or evidence artifacts so freshness/linkage warnings are grounded in current sources and current smoke paths.

### Wave 3: Final Handoff

- `IMPL-005` re-runs the aligned verification sweep, records the resulting handoff, and leaves one authoritative queue/reporting path for follow-up operators.

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| External workflow alignment weakens release checks instead of translating them | High | Preserve blocking vs soft semantics and keep checks mapped to real current authority surfaces |
| Documentation cleanup leaves multiple conflicting “truth” sources | High | Add clear authority notes and bound historical docs instead of partial silent edits |
| Workflow bookkeeping edits accidentally rewrite completed history | Medium | Use completed CSV artifacts as the source of truth and keep changes minimal and local |
| Evidence refresh fabricates obsolete linkage data | High | Prefer updating the current evidence model or generating fresh valid artifacts over recreating dead paths |
| Final handoff still reflects stale warnings after cleanup | Medium | Gate final verification on Wave 2 outputs and regenerate summary artifacts at the end |

## 6. Deliverables

- Workflow plan session:
  - `.workflow/active/WFS-release-docs-workflow-alignment-20260407/IMPL_PLAN.md`
  - `.workflow/active/WFS-release-docs-workflow-alignment-20260407/plan.json`
  - `.workflow/active/WFS-release-docs-workflow-alignment-20260407/TODO_LIST.md`
  - `.workflow/active/WFS-release-docs-workflow-alignment-20260407/.task/IMPL-001.json` to `IMPL-005.json`
- CSV wave session:
  - `.workflow/.csv-wave/cwp-release-docs-workflow-alignment-20260407/tasks.csv`

## 7. Recommended Execution

- Use `csv-wave-pipeline`
- Recommended concurrency: `3`
- Execution order: `Wave 1 -> Wave 2 -> Wave 3`
