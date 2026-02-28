# Research Report: PRD-042 US-002 - Runtime route guard prevents semantic drift under refactors

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Drift scenarios in runtime route mapping and fallback resolution
2. Assertion patterns for deterministic parity across routed command outputs

---

## Findings

### Topic 1: Drift scenarios in runtime route mapping and fallback resolution

**Summary:**
Runtime route drift can appear in two places: command identity drift (name/registration mismatch) and dispatch drift (unexpected endpoint/payload mapping). Existing tests primarily covered response rendering but did not fully lock these route contracts.

**Code Evidence:**
- Runtime command declarations: `src/cli/commands/runtime.py:42`, `src/cli/commands/runtime.py:70`, `src/cli/commands/runtime.py:100`, `src/cli/commands/runtime.py:153`
- Dispatch calls:
  - status -> `/health`: `src/cli/commands/runtime.py:51`
  - stats -> `/metrics`: `src/cli/commands/runtime.py:79`
  - search -> `/memory/search` with POST payload: `src/cli/commands/runtime.py:120`

### Topic 2: Assertion patterns for deterministic parity across routed command outputs

**Summary:**
The strongest guard pattern is dual-surface parity testing: verify route-call contract and verify user-visible outputs from both plain and JSON surfaces under identical payload.

**Implementation Pattern:**
- Patch `_gateway_request` directly to assert called endpoint/method/payload.
- Execute both plain output and `--json-output` for same input and assert aligned result meaning.
- Keep explicit command-name invariants for route identity (`status`, `stats`, `search`, `serve`).

---

## Implementation Recommendations

1. Add route contract tests to `tests/unit/test_cli_runtime_commands.py`:
   - Command names stable.
   - Endpoint mapping stable for status/stats/search.
   - Search plain/json surfaces aligned under identical payload.
2. Keep top-level registration guards in `tests/unit/test_cli_module_entry.py` for command-map determinism.
3. Avoid behavior drift by asserting exact route payload for search (`query/scope/limit`).

---

## Risks / Pitfalls

- If tests only validate output text, internal route target can drift unnoticed.
- If tests only validate route call, output semantics can drift unnoticed.
- Overly strict cross-command ordering assertions can become brittle; keep route-contract assertions focused and explicit.

---

## Checklist

- [x] Research topics investigated
- [x] Drift scenarios mapped
- [x] Deterministic assertion strategy defined
- [x] Implementation guidance documented
