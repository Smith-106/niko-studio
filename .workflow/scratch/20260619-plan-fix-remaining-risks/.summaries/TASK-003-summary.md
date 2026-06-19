# TASK-003 Summary: Add monitoring checklist document

## Files changed
- `docs/operations/MONITORING.md` (created)
- `docs/INDEX.md` (updated)

## What was done
1. Created `docs/operations/MONITORING.md` with monitoring metrics, alert thresholds, check commands, log checks, troubleshooting table, and release-readiness references.
2. Updated `docs/operations/DESKTOP_RUNBOOK.md` and `docs/operations/ROLLBACK.md` are already referenced rather than duplicated.
3. Added `operations/MONITORING.md` entry to `docs/INDEX.md`.

## Verification results
- `docs/operations/MONITORING.md` exists and contains `/health`, `docker compose ps`, and `npm --prefix desktop run local:status`.
- `grep -n 'MONITORING.md' docs/INDEX.md` → non-empty.
- `npm --prefix desktop run lint` still passes (docs not linted, but no source impact).
