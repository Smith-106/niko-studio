# Research Report: US-001 - Start guided idea-to-draft session from CLI

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From prd.json `researchTopics`:

1. Existing CLI command patterns for guided workflows in this repository
2. Deterministic session-state transition patterns in current workflow engine

---

## Findings

### Topic 1: Existing CLI command patterns for guided workflows

**Summary:**
CLI commands are implemented as Click commands in `src/cli/commands/*.py`, exported via `src/cli/commands/__init__.py`, and explicitly registered in `src/cli/main.py`. Workflow-style execution is already represented by `run` command calling `WorkflowEngine` route/plan/execute in deterministic order.

**Sources Consulted:**
- [x] Existing codebase patterns
- [ ] Library source code (`.vendor/...`)
- [ ] Official documentation
- [ ] Web search results

**Codebase evidence:**
- Command registration pattern:
  - `src/cli/main.py:20-49` (`@click.group`, import command symbols, `cli.add_command(...)`)
  - `src/cli/commands/__init__.py:12-19` (centralized exports)
- Workflow command behavior:
  - `src/cli/commands/run.py:16-38` (CLI options)
  - `src/cli/commands/run.py:74-109` (`route` then `plan`)
  - `src/cli/commands/run.py:141-150` (looped `execute` until completion)
- Runtime command pattern for additional command group behavior:
  - `src/cli/commands/runtime.py:42-164` (multiple click commands in one module)
- Command testing pattern:
  - `tests/unit/test_cli_runtime_commands.py:26-107` (`CliRunner` + patched dependencies)

### Topic 2: Deterministic session-state transition patterns in workflow engine

**Summary:**
Workflow engine enforces deterministic transitions through canonical transition maps and step lifecycle states. State machine constants and tests provide explicit transition contracts for runner state and step state progression.

**Sources Consulted:**
- [x] Existing codebase patterns
- [ ] Library source code (`.vendor/...`)
- [ ] Official documentation
- [ ] Web search results

**Codebase evidence:**
- Runner lifecycle transition map:
  - `src/workflow/workflow_engine.py:69-80` (`RUNNER_ALLOWED_TRANSITIONS`, `RUNNER_TO_SESSION_STATUS`)
- Step lifecycle transition map:
  - `src/workflow/workflow_engine.py:82-89` (`STEP_ALLOWED_TRANSITIONS`)
- Canonical/legacy alias normalization:
  - `src/workflow/workflow_engine.py:91-126` (`STEP_LEGACY_TO_CANONICAL`, `WORKFLOW_STATE_PHASE_ALIASES`, `WORKFLOW_STATE_ALLOWED_PHASES`)
- Contract normalization entrypoint:
  - `src/workflow/levels/types.py:65-99` (`apply_contract_defaults`, `ensure_contract_payload`)
- Deterministic behavior covered by tests:
  - `tests/unit/workflow/test_workflow_engine.py:32-66` (dataclass defaults)
  - `tests/unit/workflow/test_workflow_engine.py:153-166` (step dependencies)
  - `tests/unit/workflow/test_workflow_engine.py:217-237` (runner lifecycle transition expectations)

---

## Implementation Recommendations

Based on research, implement US-001 as follows:

1. **Approach:**
   Add a dedicated guided-session CLI command following existing Click command/module registration pattern, and orchestrate deterministic stage execution by delegating to `WorkflowEngine` with explicit stage markers.

2. **Pattern to Follow:**
   - CLI registration pattern from `src/cli/main.py` + `src/cli/commands/__init__.py`
   - Async route→plan→execute sequencing from `src/cli/commands/run.py`
   - Deterministic state transition semantics from `src/workflow/workflow_engine.py`

3. **Key Files to Modify (anticipated):**
   - `src/cli/commands/` (new guided command module)
   - `src/cli/main.py` (command registration)
   - `src/cli/commands/__init__.py` (export)
   - `src/workflow/workflow_engine.py` or adapter-level orchestration surface (if adding guided stage model)
   - `tests/unit/` command + workflow tests

4. **Dependencies:**
   No new third-party dependencies required; use existing Click/Rich/WorkflowEngine stack.

### Pitfalls to Avoid

- Do not bypass canonical workflow step states (`planned/executing/review/test/done/failed`); preserve transition constraints in `STEP_ALLOWED_TRANSITIONS`.
- Avoid introducing alternate CLI wiring style; keep explicit `cli.add_command(...)` registration for consistency.
- Keep command input validation at CLI boundary (required options/choices) rather than hidden runtime assumptions.

---

## Follow-up Research Needed

- [ ] Confirm whether guided idea-to-draft should map to an existing L-level template (likely L3/L5) or a new deterministic guided template in engine.
- [ ] Confirm exact persisted artifact/evidence contract boundary to avoid overlap with US-002/US-003 responsibilities.

---

## Checklist

- [x] All research topics investigated
- [x] Existing codebase patterns reviewed
- [x] Implementation recommendations documented
- [x] Pitfalls identified
- [x] Follow-up items noted
