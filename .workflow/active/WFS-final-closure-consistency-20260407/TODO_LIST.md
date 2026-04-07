# Tasks: Final Closure Consistency

## Wave 1: Conflict-Safe Preflight

- [x] **IMPL-001**: Capture conflict-safe execution baseline -> [task](./.task/IMPL-001.json)

## Wave 2: Parallel Content Alignment

- [x] **IMPL-002**: Enforce external release workflow semantics -> [task](./.task/IMPL-002.json)
- [x] **IMPL-003**: Align release summary authority and stale CI linkage -> [task](./.task/IMPL-003.json)
- [x] **IMPL-004**: Remove residual Python-era public authority from docs -> [task](./.task/IMPL-004.json)

## Wave 3: Metadata Normalization

- [x] **IMPL-005**: Normalize post-closure workflow metadata and chronology -> [task](./.task/IMPL-005.json)

## Wave 4: Final Verification and Handoff

- [x] **IMPL-006**: Regenerate aligned release evidence and publish final handoff -> [task](./.task/IMPL-006.json)

## Execution Notes

- Parent sessions:
  - `WFS-core-migration-final-closure-20260407`
  - `WFS-release-docs-workflow-alignment-20260407`
- CSV wave session: `.workflow/.csv-wave/cwp-final-closure-consistency-20260407/`
- Recommended concurrency: `3`
- Preflight rule: do not start Wave 2 until `IMPL-001` has recorded the current dirty-file baseline and overlap guardrails.
- Execution rule: later csv-wave agents may read `focus_paths`, but only files inside each task `scope` may be modified.

## Status Legend

- `- [ ]` = pending
- `- [x]` = completed

## Planning Summary

- Core migration closure remains complete and `GO`
- First release/docs alignment sweep remains complete
- Residual closure work is now bounded to policy consistency, CI authority linkage, residual public docs, metadata quality, and final regenerated evidence
- Final residual closure consistency sweep: complete and `GO`
