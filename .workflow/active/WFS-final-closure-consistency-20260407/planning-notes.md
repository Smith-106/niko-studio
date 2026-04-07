# Planning Notes

**Session**: `WFS-final-closure-consistency-20260407`  
**Created**: `2026-04-07T16:26:59+08:00`

## User Intent

- **Goal**: turn the still-open post-closure inconsistencies into an execution-ready CSV queue that can finish the remaining project closure work.
- **Scope**: external release semantics, release summary authority, stale CI linkage, residual Python-era public docs, workflow metadata chronology, and final aligned handoff.
- **Context**: planning-only pass; do not reopen completed migration implementation work.

## Context Findings

- `WFS-core-migration-final-closure-20260407` and `cwp-core-migration-final-closure-20260407` already record the core migration closure as complete and `GO`.
- `WFS-release-docs-workflow-alignment-20260407` and `cwp-release-docs-workflow-alignment-20260407` already closed the first alignment sweep and should remain completed history, not reopened work.
- Remaining closure debt is now narrower:
  - external gate semantics are still softer than the published external release policy in key places;
  - `scripts/release_check_summary.py` and `release-check-summary.md` still advertise stale CI authority and non-blocking classifications for checks that read as mandatory in the policy;
  - `README.md`, `docs/operations/ROLLBACK.md`, and `docs/API_REFERENCE.md` still carry Python-era `src/*` guidance that no longer matches the current checkout;
  - workflow metadata still has chronology and formatting quality issues, especially in `WFS-release-docs-workflow-alignment-20260407/workflow-session.json`.
- Conflict risk is high because the exact authority files that still need residual closure are already dirty in the current worktree.

## Conflict Decisions

- Treat the current dirty worktree as the baseline state for later execution, not as disposable or stale content.
- Do not overwrite existing uncommitted hunks in targeted files. Later execution must inspect `git diff` first and stop if unrelated ownership is detected.
- Keep this work in a separate session from the already-completed `2026-04-07` closure sessions.
- Land policy and CI semantics before regenerating evidence or publishing final handoff artifacts.
- During later `csv-wave-pipeline` execution, `scope` is the only writable boundary. `focus_paths`, `hints`, and cross-task references are read-only context only.

## Planning Decisions

- Add a dedicated preflight task as Wave 1 so the later CSV execution queue begins with explicit overlap rules.
- Keep the direct code and docs work in Wave 2 with non-overlapping scopes:
  - external gate workflow;
  - release summary generator plus stale CI authority link;
  - public docs cleanup.
- Delay workflow metadata normalization until after the policy and docs surfaces are aligned.
- Put final release evidence regeneration and handoff in the last wave so it reflects the corrected authority surfaces rather than stale intermediate state.
