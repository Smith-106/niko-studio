# Research Report: PRD-013 / US-002 - Deterministic stage controls via optional UI bridge

**Date:** 2026-02-26
**Status:** Complete

---

## Research Topics

From PRD-013 `US-002.researchTopics`:

1. Current workflow lifecycle/stage action surfaces and transition guard boundaries
2. Existing runtime command transport and error boundary patterns

---

## Findings

### Topic 1: Stage/lifecycle semantics are already deterministic and machine-guarded

**Summary:**
Workflow stage control is centralized in canonical state transitions and lifecycle APIs. Transition validity, waiting-confirmation behavior, and rejection payloads are already deterministic. UI bridge controls should forward into these existing boundaries instead of introducing any new state machine.

**Sources Consulted:**
- [x] Workflow lifecycle transition boundaries in engine
- [x] Step transition state machine and risk gate behavior
- [x] Existing tests for transition rejection and waiting-confirmation semantics
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Step transition boundary:
  - `src/workflow/workflow_engine.py:960`
  - `src/workflow/workflow_engine.py:2277`
- Runner/lifecycle transition guard boundary:
  - `src/workflow/workflow_engine.py:1328`
  - `src/workflow/workflow_engine.py:2042`
- Risk gate / waiting confirmation contract:
  - `src/workflow/workflow_engine.py:1044`
  - `src/workflow/workflow_engine.py:2207`
- Deterministic behavior tests:
  - `tests/unit/workflow/test_workflow_engine.py:627`
  - `tests/unit/workflow/test_workflow_engine.py:875`

**Implementation implications:**
- UI bridge stage actions must map 1:1 to existing lifecycle/execute endpoints.
- Keep transition semantics canonical: bridge layer should only forward payloads and preserve response envelopes (`waiting_confirmation`, `transition_rejection`, etc.).

### Topic 2: Runtime transport boundary already normalizes endpoint calls and abort behavior

**Summary:**
Runtime command transport already uses one helper for gateway calls and one error boundary shape (URL/timeout/json decode -> abort). This is suitable as a deterministic transport reference for UI bridge stage-control invocation behavior.

**Sources Consulted:**
- [x] Runtime CLI transport helper + endpoint call shape
- [x] Runtime CLI error boundary behavior
- [x] Existing runtime CLI tests around endpoint outputs
- [ ] Library source code (`.vendor/...`)
- [ ] Web search results

**Codebase evidence:**
- Gateway transport helper:
  - `src/cli/commands/runtime.py:19`
- Runtime endpoint consumers:
  - `src/cli/commands/runtime.py:52`
  - `src/cli/commands/runtime.py:80`
  - `src/cli/commands/runtime.py:121`
- Shared error boundary pattern:
  - `src/cli/commands/runtime.py:53`
  - `src/cli/commands/runtime.py:81`
  - `src/cli/commands/runtime.py:122`
- Runtime CLI tests:
  - `tests/unit/test_cli_runtime_commands.py:27`
  - `tests/unit/test_cli_runtime_commands.py:75`

**Implementation implications:**
- Optional UI bridge should keep transport behavior additive and deterministic: forward to existing workflow handlers and preserve payload/error semantics.
- For disabled bridge mode, explicit machine-checkable response (`status=disabled`, reason code) is acceptable as additive behavior, as long as CLI path remains untouched.

---

## Implementation Recommendations

1. **Approach:**
   - Build US-002 controls on top of already added `/ui/workflow/*` forwarding endpoints.
   - Ensure stage action mapping remains 1:1:
     - route -> `workflow_route_endpoint`
     - plan -> `workflow_plan_endpoint`
     - execute -> `workflow_execute_endpoint`
     - lifecycle -> `workflow_lifecycle_endpoint`

2. **Pattern to Follow:**
   - Forward-only adapter in UI bridge layer.
   - No duplicate transition logic, no alternative state mutation paths.
   - Preserve canonical response contracts from workflow engine.

3. **Key Files to Modify (next phase):**
   - `src/mcp/gateway.py`
   - `tests/unit/mcp/test_gateway_endpoints.py`
   - (if needed for parity assertions) `tests/unit/workflow/test_workflow_engine.py`

4. **Dependencies:**
   - Existing workflow engine transition/risk gate contracts.
   - Existing runtime transport and error-boundary conventions.

### Pitfalls to Avoid

- Mapping UI actions to new custom state transitions not present in workflow engine.
- Returning bridge-specific success semantics that diverge from existing workflow endpoint results.
- Coupling CLI runtime commands to UI bridge enablement state.

---

## Exploration Decision Points

No major architecture split requiring parallel exploration was identified for US-002. Existing workflow transition guard boundaries and runtime transport patterns are sufficient for deterministic additive bridge stage controls.

---

## Checklist

- [x] Lifecycle/stage transition guard boundaries mapped
- [x] Runtime transport and error boundary patterns mapped
- [x] Deterministic 1:1 bridge action mapping direction defined
- [x] Pitfalls identified
