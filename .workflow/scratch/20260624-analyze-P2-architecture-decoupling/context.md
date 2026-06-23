# Context: M28 Phase 2 — Architecture Decoupling

## Scope

- Milestone: M28
- Phase: 2
- Title: Architecture Decoupling
- Analysis artifact: ANL-20260624-P2-architecture-decoupling

## Interview Decisions

| Decision | Classification | Value |
|----------|----------------|-------|
| Scope | Locked | Phase 2 micro analysis |
| Depth | Locked | Standard |
| Dimensions | Locked | All 6 |
| Verdict | Locked | GO |

## Locked Decisions

1. **Three target subsystems**: Container/MCP coupling, GatewayDeps ISP, craft-catalog circular dependency.
2. **Backward compatibility must be preserved**: `GatewayDeps` remains as an alias; public endpoint behavior and HTTP contracts stay unchanged.
3. **No new dependency injection framework**: Use existing interface + composition-root patterns, not tsyringe or similar.
4. **Tests must compile and pass after each wave**: Follow incremental progress over big bang.

## Free Decisions

1. Naming of new interfaces (e.g., `IHealthEngineAccess` vs `HealthEngineAccess`).
2. Whether to split `buildGatewayDeps` into multiple factories or return one object implementing all interfaces.
3. Whether craft-catalog lazy getters are exported as functions or as getter properties.

## Deferred Decisions

1. Full DI container adoption (P4 long-term option) — out of Phase 2 scope.
2. Additional container/MCP abstraction layers beyond the three identified edges — only if new cycles appear during execution.

## Gray Areas

- `mcp/engine.ts` currently uses `getContainer()` for engine accessors. The recommended fix is to route through `GatewayDeps`, but this may require updating callers outside health endpoints.

## Key Constraints

- `src-ts/mcp/endpoints/index.ts` must continue to export all handlers.
- `src-ts/narrative/writing-craft/index.ts` barrel export must remain stable for external consumers.
- Existing issue references (ISS-20260613-032/033/035/036) should be linked and updated during execution.

## Confidence

- Overall: medium
- Highest: GatewayDeps ISP split (existing `config.ts` pattern proves feasibility)
- Lowest: craft-catalog consumer churn (multiple analyzers and tests need updates)

## Next Step

`/maestro-plan 2`
