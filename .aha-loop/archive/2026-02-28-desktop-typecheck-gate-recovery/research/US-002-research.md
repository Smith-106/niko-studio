# Research Report: US-002 - Preserve schema compatibility across summary and release evidence outputs

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Schema invariants required by downstream consumers for release-check-summary and release-readiness artifact
2. Failure modes where evidence refresh introduces contract drift

---

## Findings

### Topic 1: Required schema invariants for downstream consumers

**Summary:**
Downstream consumers rely on stable structural keys rather than full-text report equality.

**Required contract fields (stable):**
- Report machine payload JSON block:
  - `decision`
  - `go_no_go_reasons`
  - `generated_at`
  - `checks[]` with keys: `check_id`, `priority`, `blocking`, `status`, `exit_code`, `detail`
- Release-readiness artifact JSON:
  - top-level keys: `artifact_type`, `schema_version`, `generated_at`, `decision`, `go_no_go_reasons`, `checks`, `trace`
  - `schema_version` invariant: `evidence.v1`
  - `trace` required keys: `trace_id`, `session_id`, `run_id`, `artifact_path`, `report_path`

### Topic 2: Contract drift failure modes

**Summary:**
Evidence refresh can regress consumers when key sets change unintentionally even if decision semantics still pass.

**Primary drift risks:**
- Top-level key additions/removals in report payload or artifact.
- `checks[]` object shape drift (missing required keys).
- Trace metadata key drift that breaks downstream linkage checks.
- Over-asserting volatile values (`generated_at`, `trace_id`) instead of structural compatibility.

---

## Implementation Recommendations

1. Add a deterministic two-run contract test on `release_summary.main()`.
2. Assert key-set stability for:
   - report machine payload top-level keys,
   - artifact top-level keys,
   - artifact `trace` keys,
   - `checks[]` entry keys on both surfaces.
3. Keep decision semantics assertions (`GO` + empty reasons) to ensure no coupling break during contract checks.
4. Do not enforce equality on volatile timestamp/trace-id values.

### Pitfalls to Avoid

- Avoid full report text snapshot assertions for schema compatibility.
- Avoid policy-semantics edits when adding schema guard coverage.

---

## Checklist

- [x] Downstream schema invariants identified
- [x] Drift failure modes mapped
- [x] Deterministic compatibility test strategy defined
