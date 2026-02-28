# Research Report: PRD-013 / US-001 - Optional UI bridge stage control parity

**Date:** 2026-02-25
**Status:** Complete

---

## Research Topics

From PRD-013 `US-001.researchTopics`:

1. Existing CLI command registration and runtime orchestration boundaries reusable for optional UI bridge triggers
2. Existing gateway endpoint parity and artifact contract surfaces required to keep CLI/UI semantics deterministic

---

## Findings

### Topic 1: CLI workflow/runtimes already expose deterministic command boundaries

**Summary:**
Current command boundaries are explicit and stable: user-facing workflow execution via `run` command and runtime gateway operations via `runtime` command group. This supports an optional UI bridge by reusing these orchestration boundaries instead of introducing parallel control logic.

**Sources Consulted:**
- [x] CLI command registration patterns
- [x] Workflow run command orchestration flow
- [x] Runtime command gateway invocation boundaries
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Command registration/export pattern:
  - `src/cli/commands/__init__.py`
  - `src/cli/main.py`
- Deterministic workflow run orchestration:
  - `src/cli/commands/run.py:16`
  - `src/cli/commands/run.py:121`
- Runtime command -> gateway transport boundary:
  - `src/cli/commands/runtime.py:18`
  - `src/cli/commands/runtime.py:100`

**Implementation implications:**
- UI bridge should call the same engine/gateway orchestration entrypoints used by CLI commands.
- Keep UI command adapter additive (thin bridge), no duplicate workflow state machine logic.

### Topic 2: Gateway already publishes stable endpoint + observability envelope for parity

**Summary:**
Gateway service exposes stable health/metrics/search runtime endpoints and keeps deterministic runtime/observability payloads. Optional UI can consume these same endpoints, preserving contract parity between CLI and UI-triggered runs.

**Sources Consulted:**
- [x] Gateway runtime metrics/health payload assembly
- [x] Runtime command endpoint consumption shape
- [x] Existing deterministic payload conventions in workflow/release contracts
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Gateway runtime payload + metrics envelope:
  - `src/mcp/gateway.py:72`
  - `src/mcp/gateway.py:120`
  - `src/mcp/gateway.py:192`
- Runtime CLI endpoint consumers:
  - `src/cli/commands/runtime.py:42`
  - `src/cli/commands/runtime.py:70`
  - `src/cli/commands/runtime.py:100`

**Implementation implications:**
- UI bridge should reuse gateway endpoint payload contracts (`status`, `metrics`, deterministic key sets).
- UI-disabled mode can remain a simple no-op config path if bridge entrypoint is isolated from core CLI command flow.

---

## Implementation Recommendations

1. **Approach:**
   - Implement optional UI bridge as a thin adapter layer that forwards to existing workflow engine and gateway command boundaries.
   - Keep bridge feature toggled/additive; default CLI path remains unchanged.

2. **Pattern to Follow:**
   - Reuse deterministic command/gateway contracts.
   - Preserve additive schema evolution: append optional bridge metadata, do not rename/remove existing payload keys.

3. **Key Files to Modify (next phases):**
   - `src/cli/commands/runtime.py`
   - `src/mcp/gateway.py`
   - `tests/unit/test_cli_runtime_commands.py`
   - `tests/unit/mcp/test_gateway_endpoints.py`

4. **Dependencies:**
   - Reuse existing Click command registration and gateway transport helpers.
   - No new external dependency required for US-001.

### Pitfalls to Avoid

- Building a second workflow execution path in UI bridge layer.
- Diverging UI payload semantics from existing runtime/gateway contracts.
- Binding core CLI flow to UI availability (violates optional/disable requirement).

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-001. Existing CLI and gateway boundaries are sufficient for additive bridge entrypoint implementation.

---

## Checklist

- [x] CLI orchestration boundaries mapped
- [x] Gateway parity/observability envelopes mapped
- [x] Additive implementation direction for optional UI bridge defined
- [x] Pitfalls identified
