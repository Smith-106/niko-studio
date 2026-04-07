# Tasks: Core Migration Final Closure

## Wave 1: Authority and Core Tail

- [x] **IMPL-001**: Finalize Node-first sidecar build and packaged default -> [task](./.task/IMPL-001.json)
- [x] **IMPL-003**: Close remaining Phase 4 multi-store semantics and adapter gaps -> [task](./.task/IMPL-003.json)

## Wave 2: Closure Hardening

- [x] **IMPL-002**: Repair or retire broken Python fallback entrypoints -> [task](./.task/IMPL-002.json)
- [x] **IMPL-004**: Stabilize the official Phase 4 regression and coverage gate -> [task](./.task/IMPL-004.json)
- [x] **IMPL-006**: Prune or explicitly bound legacy compatibility shims -> [task](./.task/IMPL-006.json)

## Wave 3: Gate Migration

- [x] **IMPL-005**: Migrate release and delivery gates to TypeScript authority -> [task](./.task/IMPL-005.json)

## Wave 4: Final Acceptance

- [x] **IMPL-007**: Final migration closure verification and handoff -> [task](./.task/IMPL-007.json)

## Execution Notes

- CSV wave session: `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/`
- Primary execution artifact: `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/tasks.csv`
- Recommended concurrency: `2`
- Authority rule: do not migrate release gates until `IMPL-001`, `IMPL-002`, and `IMPL-004` are complete.

## Status Legend

- `- [ ]` = pending
- `- [x]` = completed

## Planning Summary

- Phase 2: complete
- Phase 3: complete
- Phase 4: complete
- Phase 5: final closure complete (`GO`)

## Synchronization Note

- 2026-04-07: synchronized with `.workflow/.csv-wave/cwp-core-migration-final-closure-20260407/tasks.csv` (`7/7 completed`, `Final Release Decision: GO`).
