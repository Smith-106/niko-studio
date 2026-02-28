# Research Report: PRD-042 US-001 - Runtime command routes remain deterministic and backward-safe

**Date:** 2026-02-28
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Current runtime command routing and dispatch path in cli command modules
2. Existing deterministic contract tests covering cli runtime behavior

---

## Findings

### Topic 1: Current runtime command routing and dispatch path in CLI command modules

**Summary:**
CLI route registration is centralized in `src/cli/main.py` with explicit `cli.add_command(...)` calls. Runtime-oriented commands (`status`, `stats`, `search`, `serve`) and guided drafting (`guided-draft`) are imported and registered through a single deterministic path.

**Code Evidence:**
- CLI command imports and registration sequence: `src/cli/main.py:35`, `src/cli/main.py:43`
- Runtime command endpoint declarations: `src/cli/commands/runtime.py:42`, `src/cli/commands/runtime.py:70`, `src/cli/commands/runtime.py:100`, `src/cli/commands/runtime.py:153`
- Guided draft command declaration: `src/cli/commands/guided_draft.py:25`

**Determinism Implication:**
- Route determinism currently depends on preserving explicit registration order and command-name stability.
- Any future refactor that conditionally registers commands or changes import side effects can introduce drift.

### Topic 2: Existing deterministic contract tests covering CLI runtime behavior

**Summary:**
Runtime command behavior is partially guarded at command-level via `tests/unit/test_cli_runtime_commands.py`, but registration-surface determinism in top-level CLI command map had only guided-draft coverage.

**Code Evidence:**
- Runtime command tests for payload/serve behavior: `tests/unit/test_cli_runtime_commands.py:26`
- Existing module-entry registration guard for guided-draft only: `tests/unit/test_cli_module_entry.py:68`

**Gap Identified:**
- Missing explicit tests for top-level registration presence/order of `status/stats/search/serve` alongside guided-draft.

---

## Implementation Recommendation

1. Add deterministic registration guards in `tests/unit/test_cli_module_entry.py`:
   - Assert runtime command presence (`status`, `stats`, `search`, `serve`).
   - Assert stable registration order for key command prefix.
2. Keep runtime contract tests in `tests/unit/test_cli_runtime_commands.py` focused on behavior/output semantics, not registration mechanics.
3. Preserve centralized registration in `src/cli/main.py` as single source of truth.

---

## Risks / Pitfalls

- Relying only on behavior tests can miss accidental route disappearance due to registration drift.
- Overly broad ordering assertions can become brittle if unrelated new commands are intentionally inserted; scope assertions to required prefix.

---

## Checklist

- [x] Research topics investigated
- [x] Routing path inspected
- [x] Existing tests mapped
- [x] Deterministic guard recommendation defined
