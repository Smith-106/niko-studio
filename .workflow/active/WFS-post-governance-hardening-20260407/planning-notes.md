# Planning Notes

## User Intent

GOAL: Create a future-facing implementation plan and CSV wave queue for continued project improvement after the repository already reached a current `GO` state on the authoritative `desktop + src-ts` path.

SCOPE: Governance hardening only. Focus on CI gate graduation, Node-first compatibility boundary tightening, current-vs-historical authority mapping, and automated alignment checks.

CONTEXT: Do not reopen or overwrite the already completed migration-closure and release-docs alignment sessions. This session should create a fresh follow-up queue for later execution.

## Context Findings

- Current release evidence reports `Decision: GO` on `2026-04-07`.
- The main remaining risks are not core runtime breakage; they are governance and maintainability issues:
  - remaining soft-gate jobs in `.github/workflows/integration-tests.yml`
  - retained Python compatibility and dual-runtime messaging in launcher/build tooling
  - high-visibility docs still requiring readers to infer current authority versus historical reference
  - no dedicated automated alignment check for drift between workflows, runtime selectors, and authority docs
- Existing sessions already cover migration closure and release/docs alignment:
  - `WFS-core-migration-final-closure-20260407`
  - `WFS-release-docs-workflow-alignment-20260407`
  - `WFS-final-closure-consistency-20260407`

## Planning Decisions

- Create a new session instead of mutating an existing completed or near-complete closure session.
- Use three waves so Wave 1 can parallelize non-overlapping ownership across CI, runtime/tooling, and docs.
- Put automation of alignment checks in Wave 2 so it can consume the clarified state from Wave 1.
- Reserve Wave 3 for verification and handoff only.

## Constraints

- Preserve the current authoritative `desktop + src-ts` release path.
- Preserve explicit Python compatibility override support; only tighten and bound it.
- Keep same-wave scopes non-overlapping for later `csv-wave-pipeline` execution.
- Treat existing dirty active sessions as history/reference, not rewrite targets.

## Conflict Notes

- Conflict risk is `medium` because the targeted authority surfaces overlap with active workflow sessions and high-visibility repository files.
- The plan is intentionally scoped to minimize cross-task write overlap:
  - CI hardening: `.github/workflows/integration-tests.yml`
  - runtime governance: `desktop/scripts/choose_sidecar.cjs`, `scripts/start_gateway.py`, `desktop/SIDECAR_IMPLEMENTATION_SUMMARY.md`
  - authority map docs: `README.md`, `docs/INDEX.md`, `docs/TASKS_V10_OPTIMIZED.md`, `docs/ui_design_guide.md`, `docs/workflow-entrypoint-inventory.md`
  - automation check: `scripts/release_check_summary.py`, `scripts/check_authority_alignment.py`

## CSV Handoff

- Planned CSV session: `.workflow/.csv-wave/cwp-post-governance-hardening-20260407/tasks.csv`
- Recommended execution mode: wave-based with moderate parallelism (`-c 3`)
