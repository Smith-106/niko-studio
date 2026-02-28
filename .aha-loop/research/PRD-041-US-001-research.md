# Research Report: PRD-041 US-001 - Freshness and trace cross-surface deterministic alignment

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

1. Freshness/trace signal contracts in release_check_summary main checks[] reduction path
2. Deterministic repeated-run assertions for report machine payload and release-readiness artifact

---

## Findings

### Topic 1: Signal and reduction contracts

`release_check_summary.main()` emits freshness and trace signals as non-blocking P1 checks in canonical `checks[]`:

- `evidence_freshness_signal`
- `quality_level_trace_signal`
- `degrade_trace_signal`

Decision semantics remain blocking-only (`go_no_go_reasons` from blocking non-PASS rows), so freshness/trace observability hardening must not alter GO/NO_GO policy behavior.

### Topic 2: Deterministic repeated-run verification

Strongest guard pattern:

- Stub freshness/trace signals to deterministic PASS detail payloads.
- Execute `main()` twice in the same deterministic harness.
- Assert report/artifact parity by `check_id` for `priority`, `blocking`, `status`, `detail`.
- Assert repeated-run detail stability and trace-shape consistency (`session_id`, `run_id`, path suffixes, `trace_id` prefix).
- Assert generated_at rolls forward across runs while staying payload/artifact-aligned per run.

---

## Implementation Recommendations

1. Keep test-only implementation; avoid production reduction-path changes.
2. Encode trace assertions as shape/prefix/suffix checks to remain temp-path safe.
3. Keep explicit GO + empty reasons assertions to guard semantic invariance.

### Pitfalls to Avoid

- Avoid brittle absolute path expectations for trace fields.
- Avoid assertions that validate only one surface.

---

## Checklist

- [x] Freshness/trace contract mapped
- [x] Repeated-run deterministic strategy validated
- [x] Cross-surface parity guard implemented
