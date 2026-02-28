# Evidence Directory

This directory stores execution evidence referenced by `docs/PDD.md` v1.6.

## Structure

- `e2e/` - End-to-end run evidence
- `weekly/` - Weekly planning/review/trend evidence
- `quality/` - Quality revision case evidence
- `release/` - Release path and gate evidence

## Naming Convention

- e2e: `YYYY-MM-DD-*.md`
- weekly: `YYYY-Www-*.md`
- quality: `YYYY-MM-DD-*.md`
- release: `YYYY-MM-DD-*.md`

## Canonical Artifact Contract (v1)

All evidence artifacts should include the same metadata envelope as top-level fields:

- `artifact_type` - one of `e2e_session`, `quality_revision`, `release_gate_run`
- `schema_version` - `evidence.v1`
- `date` - `YYYY-MM-DD`
- `owner` - operator/maintainer id
- `input` - key input summary used for this run
- `output` - key output summary produced by this run
- `result` - one of `PASS`, `FAIL`, `WARN`, `BLOCKED`
- `evidence_links` - at least one traceable link/path
- `trace` - deterministic correlation identifiers required by artifact type

Required `trace` identifiers by artifact type:

| artifact_type | required trace fields |
|---|---|
| `e2e_session` | `session_id`, `run_id` |
| `quality_revision` | `session_id`, `revision_id` |
| `release_gate_run` | `session_id`, `run_id`, `check_id` |

Artifact-specific body blocks then extend this envelope:

- `e2e_session`: commands, key logs, failure retries, generated artifacts
- `quality_revision`: original sample, issue summary, revision action, re-evaluation
- `release_gate_run`: startup checks, critical path checks, gate/rollback checks

For machine-readable companions, keep key ordering stable and detail values deterministic (`key=value` pairs in fixed order).