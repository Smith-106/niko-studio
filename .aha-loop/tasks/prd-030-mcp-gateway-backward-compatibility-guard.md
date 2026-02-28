# PRD: MCP Gateway Backward-Compatibility Guard

**ID:** PRD-030
**Milestone:** M7
**Status:** Pending

## Overview

Protect chat/stream/health/tools/models endpoint contracts and compatibility-critical helpers with deterministic regression tests.

## Context

Gateway regressions can break CLI/desktop/automation consumers even when internal refactors seem small. Legacy helpers and payload shapes need contract-level protection.

## Goals

- Establish compatibility baseline for gateway endpoints and helper behavior.
- Prevent accidental removal/renaming of compatibility-critical symbols.
- Keep request/response contracts stable while allowing internal refactor.

## Compatibility Scope (V1)

- Endpoints: `/chat`, `/chat/stream`, `/health`, `/tools`, `/models`
- Key compatibility expectations:
  - Stable error-code/status mapping for validation and runtime failures.
  - Stable response envelope fields for downstream consumers.
  - Compatibility-critical helpers remain available or have explicit migration alias.

## Planned Code Touchpoints

- `src/mcp/gateway.py`: restore/protect compatibility-critical helper symbols and endpoint response envelopes.
- `src/cli/commands/runtime.py`: keep gateway-invocation assumptions aligned with endpoint contract changes.
- `tests/unit/mcp/test_gateway_endpoints.py`: lock helper existence, endpoint payload keys, and `__main__` startup resolution behavior.
- `tests/unit/mcp/test_gateway_chat.py`: validate non-stream contract, fallback semantics, and failure mapping.
- `tests/unit/mcp/test_gateway_stream.py`: validate SSE event sequence, terminal states, and parity with non-stream route semantics.

## Recommended Execution Order

1. Reconcile compatibility helper symbols and startup resolution path in gateway.
2. Freeze endpoint response envelopes and error/status mapping.
3. Re-run and update chat/stream/endpoints contract tests.
4. Validate runtime command integration against final gateway contract.

## User Stories

### US-001: 端点契约稳定
- 作为调用方，我希望核心端点响应结构稳定，以便客户端升级不被无预警破坏。
- 范围：response schema、status code、required keys。

### US-002: 兼容辅助函数守卫
- 作为维护者，我希望兼容关键 helper 有回归保护，以避免重构误删导致连锁错误。
- 范围：helper existence/behavior tests、deprecation path。

### US-003: 流式与非流式一致语义
- 作为集成方，我希望 `/chat` 与 `/chat/stream` 在路由与失败语义上可对齐，以便前后端行为一致。
- 范围：routing semantics、fallback semantics、terminal states。

## Automated Test Anchors

- **US-001（端点契约稳定）**
  - `tests/unit/mcp/test_gateway_endpoints.py`: endpoint status/response contract assertions.
  - `tests/unit/mcp/test_gateway_chat.py`: chat envelope and error mapping contract.
- **US-002（helper 守卫）**
  - `tests/unit/mcp/test_gateway_endpoints.py`: compatibility helper existence and behavior tests.
  - `tests/unit/mcp/test_gateway_endpoints.py`: module `__main__` runtime settings resolution coverage.
- **US-003（流式一致语义）**
  - `tests/unit/mcp/test_gateway_stream.py`: stream event sequence and terminal-state contract tests.
  - `tests/unit/mcp/test_gateway_chat.py`: non-stream route semantics and fallback parity tests.

## Implementation Plan (Research -> Plan Review -> Implement -> Quality)

### Phase R: Research
- Inventory current gateway public contracts and legacy-dependent fields.
- Identify helper/function names that must remain compatibility-protected.

### Phase P: Plan Review
- Freeze V1 contract table for endpoint payloads and status mapping.
- Define compatibility policy (`keep`, `alias+deprecate`, `versioned-break`).

### Phase I: Implement
- I1（US-001）：normalize endpoint response envelope contract and required keys.
- I2（US-002）：restore/protect compatibility helpers and add guarded migration aliases.
- I3（US-003）：unify stream/non-stream semantics for routing, failure, and completion.

### Phase Q: Quality
- Q1: Unit regression tests for endpoint payload compatibility.
- Q2: Symbol-level compatibility tests for helper availability.
- Q3: Stream vs non-stream semantic parity tests and failure-path verification.

## Dependencies

- PRD-029: Release Readiness Gate Contract Hardening.

## Acceptance Criteria

- [ ] Core gateway endpoints preserve documented compatibility contract.
- [ ] Compatibility-critical helpers are guarded by automated regression tests.
- [ ] `/chat` and `/chat/stream` share consistent route/failure semantics.
- [ ] US-001/US-002/US-003 each has at least one automated test anchor.

---

*This PRD will be fully expanded when it becomes the active PRD.*
