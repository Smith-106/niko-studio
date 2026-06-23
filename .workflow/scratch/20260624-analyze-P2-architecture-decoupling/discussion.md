# Discussion: M28 Phase 2 Architecture Decoupling

## Scope

- Phase: M28 Phase 2
- Goal: 解决 Container↔MCP 双向依赖、GatewayDeps 胖接口拆分、craft-catalog ↔ catalog-loader 循环依赖
- Trigger: `maestro-analyze 2`

## Interview Decisions

| Decision | Value | Rationale |
|----------|-------|-----------|
| Scope | Phase 2 micro | User explicitly requested sequential execution of M28 phases |
| Depth | Standard | Three distinct subsystems; need code evidence |
| Dimensions | All 6 | Architecture refactor requires correctness, security, performance, maintainability, scalability, operability |
| Auto mode | Enabled | No interactive scoping; defaults accepted |

## Current Understanding

1. **Container/MCP** — composition-root already exists as a partial bridge. The remaining high-severity edge is `container/adapters.ts` importing `WorkflowEventRelay` from `mcp/gateway-ws.ts`. Low-effort fix: point `gateway-bootstrap.ts` to `composition-root`; medium-effort fix: abstract the relay.
2. **GatewayDeps ISP** — `health.ts` defines a 17-method `GatewayDeps` interface, but `listModels` uses only 1 method and `listTools` uses 0. Existing `config.ts` already demonstrates the right pattern with `IConfigAccess`. Splitting into role interfaces reduces mock/test burden and clarifies contracts.
3. **craft-catalog cycle** — `craft-catalog.ts` eagerly calls 18 getters at module load, capturing snapshots that never update after `reloadCatalog()`. Extracting `craft-types.ts` breaks the cycle; converting const exports to lazy getters fixes reload semantics.

## Evidence

- `src-ts/container/gateway-control-plane.ts` is a re-export shim (lines 8-13).
- `src-ts/container/adapters.ts:97` imports `WorkflowEventRelay` from `mcp/gateway-ws.ts`.
- `src-ts/mcp/endpoints/health.ts:58` defines `GatewayDeps` with 17 members.
- `src-ts/mcp/gateway-state.ts:24` exports `GatewayDeps` type alias.
- `src-ts/narrative/writing-craft/craft-catalog.ts` top-level exports call getters 18 times.
- `src-ts/narrative/writing-craft/catalog-loader.ts` imports types from `craft-catalog.ts`, closing the cycle.

## Open Questions

- None; auto mode accepted defaults.

## Updates

- 2026-06-24: Initial analysis complete; GO verdict with medium confidence.
