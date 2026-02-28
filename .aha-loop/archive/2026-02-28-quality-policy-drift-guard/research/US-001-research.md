# Research Report: US-001 - Define repeatable runtime-policy conformance checks

**Date:** 2026-02-27
**Status:** Complete

---

## Research Topics

From `prd.json` `researchTopics`:

1. Current runtime gate evaluation entry points across workflow modes
2. Authoritative policy contract surfaces under `docs/quality/*`

---

## Findings

### Topic 1: Runtime gate evaluation entry points across modes

**Summary:** Runtime gate decisions are distributed across three main layers: workflow engine execution/risk-wave gates, novel chapter routing decisions, and MCP terminal contract normalization. Release summary provides an additional deterministic Go/No-Go layer for release-mode enforcement.

**Sources Consulted:**
- [x] Existing codebase patterns
- [x] Runtime source code
- [ ] Library source code (`.vendor/...`) (not needed)
- [ ] External documentation (not needed)

**Key entry points (runtime):**

1. **Workflow engine risk gate + wave gate orchestration**
   - `src/workflow/workflow_engine.py:1053` `_evaluate_risk_gate(...)`
   - `src/workflow/workflow_engine.py:1068` destructive-step branch emits `GO/NO_GO`
   - `src/workflow/workflow_engine.py:1251` `_run_wave_gate_orchestration(...)`
   - `src/workflow/workflow_engine.py:1263`, `:1268`, `:1273` threshold checks for risk/pass-rate/recovery-latency
   - `src/workflow/workflow_engine.py:2319` final wave-chain decision (`GO`/`NO_GO`)

2. **Novel workflow chapter decision routing**
   - `src/workflow/adapters/novel_adapter.py:779` `route_after_critic(...)`
   - Uses configured thresholds and critic outputs (`APPROVED/HUMAN_REVIEW/REVISE/REWRITE`) to route to `finalize`, `writer`, or `human_reviewer`

3. **MCP gateway terminal contract normalization**
   - `src/mcp/gateway.py:431` `_with_terminal_contract(...)`
   - Default decision fallback is `go` when missing
   - Mapping to publish recommendation semantics:
     - `src/mcp/gateway.py:585-588` (`go->pass`, `soft_go->revise`, `no_go->block`)

4. **Release gate deterministic Go/No-Go decision**
   - `scripts/release_check_summary.py:1478-1483` computes `no_go_reasons` from blocking checks and emits `GO/NO_GO`
   - Explicit policy rule in output: `any P0 FAIL => NO_GO` (`scripts/release_check_summary.py:1508`)

**Mode coverage observation (manual/hybrid/full-auto):**
- Runtime level has explicit gate logic in workflow execution and novel adapter routing.
- Gateway provides normalized API-level terminal decision contract.
- Release summary applies deterministic blocking policy over P0 checks.
- This provides cross-mode building blocks but still requires explicit conformance checks to ensure policy/runtime drift is detected continuously.

### Topic 2: Authoritative quality policy contract surfaces under `docs/quality/*`

**Summary:** Authoritative thresholds and blocker semantics are primarily defined in `docs/quality/QUALITY_CRITERIA.md` and expanded in `docs/PDD.md` sections 35/36. Current runtime thresholds in some modules are not fully aligned to policy targets (notably strict >=99 acceptance path).

**Primary policy sources:**

1. **Quality criteria baseline**
   - `docs/quality/QUALITY_CRITERIA.md:12` pass threshold `>= 99%`
   - `docs/quality/QUALITY_CRITERIA.md:30-31` runtime publish gate should align to strict threshold; heuristic endpoint is precheck only

2. **P0/P1/P2 blocker semantics + anchors**
   - `docs/PDD.md:1089-1101` layered rule fields + blocker semantics (`P0 => NO_GO/BLOCKED`)
   - `docs/PDD.md:1106-1115` top rules table with `code_anchor`, `test_anchor`, `evidence_anchor`

3. **Decision consistency acceptance matrix**
   - `docs/PDD.md:1137-1140` requires enum/threshold/BLOCKED branch consistency
   - `docs/PDD.md:1143-1149` boundary assertions (99/95/94/<50 + evidence_missing/memory_precheck_missing => BLOCKED)

4. **Release-level Go/No-Go contract**
   - `docs/release/RELEASE_NOTES.md:9-12` external release Go conditions
   - `docs/release/RELEASE_NOTES.md:91,105` explicit Go/No-Go conclusion workflow

**Current drift-risk hotspots found during research:**
- `src/workflow/state.py:18-21` defines novel thresholds (`99`, `95`, `C>=7`) as runtime constants (good single-source candidate).
- `src/workflow/novel_quality.py:455-459` currently applies pass/block heuristic (`pass if score>=99 and no high issues`, `block if score<50 or high_issues>=2`, else `revise`), which may diverge from broader `BLOCKED` semantics defined in policy docs unless conformance checks explicitly verify mapping.
- `src/mcp/gateway.py:433-434` default-missing decision fallback to `go` requires policy conformance guard to prevent accidental softening when payloads are partial.

---

## Implementation Recommendations

1. **Approach:** Add deterministic runtime-policy conformance checks that compare:
   - documented threshold/blocker policy (`docs/quality/*`, `docs/PDD.md`), and
   - runtime gate behavior/mappings (`state.py`, `novel_quality.py`, `novel_adapter.py`, `workflow_engine.py`, `mcp/gateway.py`, `release_check_summary.py`).

2. **Pattern to Follow:**
   - Deterministic machine-readable detail format (`key=value` pairs) already used by release summary checks.
   - Reference pattern: `scripts/release_check_summary.py:133` `_format_detail_pairs(...)`.

3. **Key files likely for US-001 implementation:**
   - `scripts/release_check_summary.py`
   - `tests/unit/scripts/test_release_check_summary.py`
   - `src/workflow/state.py`
   - `src/workflow/novel_quality.py`
   - `src/workflow/adapters/novel_adapter.py`
   - `src/mcp/gateway.py`

4. **Dependencies:** none expected (use existing modules/tests).

### Pitfalls to Avoid

- Treating heuristic output (`publish_recommendation`) as final release decision without policy reconciliation.
- Allowing fallback defaults (e.g., missing decision => `go`) to bypass blocker semantics.
- Mixing human-readable prose and machine checks in a way that breaks deterministic regression tests.

---

## Follow-up Research Needed

- [ ] Confirm exact intended precedence between chapter-level decision enums and release-level `GO/NO_GO/BLOCKED` when evidence is missing.
- [ ] Define canonical conversion table from runtime chapter decisions to release decision states for all workflow modes.

---

## Knowledge Base Updates

- Added project pattern note for deterministic policy-runtime conformance check design.
- Added gotcha on policy/runtime threshold drift and fallback semantic drift.

---

## Checklist

- [x] All research topics investigated
- [x] Existing code paths traced for runtime gates and release gate
- [x] Policy contracts under `docs/quality/*` and `docs/PDD.md` identified
- [x] Implementation recommendations documented
- [x] Pitfalls identified
- [x] Knowledge base updates drafted
