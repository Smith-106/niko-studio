# Implementation Plan: Final Closure Consistency

**Session**: `WFS-final-closure-consistency-20260407`  
**Status**: Planning Complete  
**Prepared**: `2026-04-07T16:26:59+08:00`

## 1. Requirements Summary

### Goal

Close the remaining residual closure gaps after the completed `2026-04-07` migration and release-docs alignment sessions so the repository exposes one mechanically consistent story across release policy, external CI, public docs, workflow metadata, and generated release evidence.

### In Scope

- Record a conflict-safe execution baseline for the dirty authority surfaces
- Align the external release gate behavior with the intended external policy
- Remove stale Integration Tests authority from the release summary path and align the generator semantics
- Clean the remaining Python-era public docs that still read as current primary authority
- Normalize workflow metadata chronology and final handoff wording for the post-closure sessions
- Regenerate the aligned release evidence and leave one final operator handoff

### Out of Scope

- Reopening the completed core migration implementation work
- Rewriting broad historical roadmap material outside the current authority surfaces
- Large-scale documentation modernization beyond the files that still misstate current release or runtime authority
- Any destructive cleanup of unrelated worktree changes

## 2. Architecture Decisions

1. **Completed closure sessions remain authoritative history**
   - `cwp-core-migration-final-closure-20260407` and `cwp-release-docs-workflow-alignment-20260407` stay completed.
   - This plan only queues the residual consistency work that still sits on top of those sessions.

2. **Conflict-safe preflight is mandatory**
   - The targeted authority files are already dirty.
   - The execution queue must begin with an explicit overlap baseline before any direct edits are attempted.

3. **Policy and CI semantics come before regenerated evidence**
   - The external workflow and summary generator must agree on the same blocking model before a new summary or release artifact is produced.

4. **Docs should bound legacy paths instead of pretending they are current**
   - Residual Python examples are acceptable only as explicit compatibility or historical notes.
   - They must no longer read as the current primary authority in this checkout.

5. **Metadata hygiene happens after the content surfaces are aligned**
   - Workflow chronology fixes and final handoff text should reflect the final aligned state, not an intermediate one.

## 3. Task Breakdown

| Task | Objective | Wave | Depends On |
|------|-----------|------|------------|
| `IMPL-001` | Capture conflict-safe execution baseline | 1 | - |
| `IMPL-002` | Enforce external release workflow semantics | 2 | `IMPL-001` |
| `IMPL-003` | Align release summary authority and stale CI linkage | 2 | `IMPL-001` |
| `IMPL-004` | Remove residual Python-era public authority from docs | 2 | `IMPL-001` |
| `IMPL-005` | Normalize post-closure workflow metadata and chronology | 3 | `IMPL-002`, `IMPL-003`, `IMPL-004` |
| `IMPL-006` | Regenerate aligned release evidence and publish final handoff | 4 | `IMPL-005` |

## 4. Implementation Strategy

### Wave 1: Conflict-Safe Preflight

- `IMPL-001` records the active overlap baseline and writes the execution guardrails into the new session artifacts.
- No authority file outside the new session is edited in this wave.

### Wave 2: Parallel Content Alignment

- `IMPL-002` focuses only on `.github/workflows/external-release-gate.yml`.
- `IMPL-003` focuses on the stale CI authority and the release summary generator without regenerating artifacts yet.
- `IMPL-004` limits the public docs cleanup to README, docs index, rollback, and API reference surfaces.

### Wave 3: Metadata Normalization

- `IMPL-005` cleans the remaining workflow chronology and handoff wording issues after the content surfaces are aligned.

### Wave 4: Final Verification and Handoff

- `IMPL-006` regenerates the release summary and machine-readable artifact from the corrected authority surfaces and leaves one final handoff for the remaining closure work.

## 5. Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Later csv-wave execution overwrites the current dirty patch | High | Require Wave 1 baseline capture and stop-on-overlap rules before any direct edits |
| External policy and generated summary remain inconsistent after partial edits | High | Separate policy and generator alignment from final evidence regeneration |
| Docs cleanup silently re-promotes legacy Python paths | Medium | Bound legacy commands explicitly as compatibility or historical notes |
| Metadata cleanup rewrites already-completed history incorrectly | Medium | Limit chronology fixes to impossible ordering and handoff wording only |
| Final GO evidence is regenerated from stale or mixed semantics | High | Gate the final verification sweep on the completion of Waves 2 and 3 |

## 6. Deliverables

- Workflow plan session:
  - `.workflow/active/WFS-final-closure-consistency-20260407/IMPL_PLAN.md`
  - `.workflow/active/WFS-final-closure-consistency-20260407/plan.json`
  - `.workflow/active/WFS-final-closure-consistency-20260407/TODO_LIST.md`
  - `.workflow/active/WFS-final-closure-consistency-20260407/.task/IMPL-001.json` to `IMPL-006.json`
  - `.workflow/active/WFS-final-closure-consistency-20260407/.process/context-package.json`
  - `.workflow/active/WFS-final-closure-consistency-20260407/.process/conflict-resolution.json`
- CSV wave session:
  - `.workflow/.csv-wave/cwp-final-closure-consistency-20260407/tasks.csv`

## 7. Execution Notes

- Recommended concurrency: `3`
- Start with `IMPL-001` only; do not skip the preflight because the worktree is already dirty.
- The final evidence regeneration should happen only once per aligned end state.
- During later csv-wave execution, `scope` is the only writable surface for a task. `focus_paths` and reference files are read-only context only.
