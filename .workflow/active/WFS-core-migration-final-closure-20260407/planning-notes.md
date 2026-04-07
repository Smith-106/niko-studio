# Planning Notes

**Session**: `WFS-core-migration-final-closure-20260407`  
**Created**: `2026-04-07T00:30:00+08:00`

## User Intent

- **Goal**: complete the remaining migration closure work for the Python -> TypeScript transition and prepare a `tasks.csv` file for later `/csv-wave-pipeline` execution
- **Scope**: finish the core migration authority cutover, close the remaining Phase 4 tail, repair stale Python release paths, and leave a single authoritative handoff
- **Context**: planning-only pass; no production code edited in this session

## Context Findings

- Phase 2 is already accepted as complete through the active handoff in `.workflow/active/WFS-phase-2-services-layer-entry-20260404/`.
- Phase 3 is already accepted as complete through the active handoff in `.workflow/active/WFS-phase-3-domain-logic-entry-20260404/`.
- Phase 4 is near-done, but the active TODO still calls out `broader multi-store semantics remain unverified` in `src-ts/memory/unified-memory.ts`.
- Phase 5 is not complete: desktop runtime is already Node-first, but build-time default still routes to Python via `desktop/scripts/choose_sidecar.cjs`.
- Python operational and release scripts still assume a root `src/` runtime that does not exist in the current checkout, which currently breaks `scripts/delivery_gate.py` and `scripts/release_check_summary.py`.
- An earlier CSV wave session already closed many parity gaps and explicitly left packaged/runtime polish plus remaining compatibility cleanup as follow-up work: `.workflow/.csv-wave/cwp-complete-migration-critical-gaps-20260406/context.md`.

## Critical Files

- `desktop/scripts/choose_sidecar.cjs`
- `desktop/package.json`
- `desktop/SIDECAR_CONTRACT.md`
- `desktop/src-tauri/src/main.rs`
- `scripts/build_gateway_sidecar.py`
- `scripts/start_gateway.py`
- `scripts/delivery_gate.py`
- `scripts/release_check_summary.py`
- `README.md`
- `src-ts/package.json`
- `src-ts/vitest.phase4.config.ts`
- `src-ts/memory/unified-memory.ts`
- `src-ts/integrations/adapters.ts`
- `src-ts/workflow/types.ts`
- `src-ts/web/app.ts`

## Conflict Assessment

- **Conflict risk**: `high`
- **Reason 1**: the remaining work spans desktop build scripts, Python utility scripts, TypeScript runtime code, release gates, and migration documentation.
- **Reason 2**: build/runtime authority and release-gate authority are currently split; changing one without sequencing the others would create partial closure and fresh breakage.
- **Reason 3**: the remaining Phase 4 tail and `test:phase4` stability both touch the official validation path for the migration, so sequencing matters.

## Planning Decisions

- Make Node/TypeScript the authoritative runtime and build path for the final closure.
- Do not leave a dead Python compatibility path in place. Any retained Python fallback must be explicit and working; otherwise it should stop being treated as authoritative.
- Close the remaining Phase 4 tail before migrating release and delivery gates.
- Keep optional external adapter expansion out of scope; focus on core migration closure only.
- Prepare one workflow session and one CSV wave session so later execution can start without re-planning.

## Output Targets

- Workflow plan session: `.workflow/active/WFS-core-migration-final-closure-20260407/`
- CSV wave session: `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/`
- Primary execution artifact: `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/tasks.csv`
