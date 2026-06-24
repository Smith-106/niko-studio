---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260624-analyze-p2-architecture-decoupling-context
  - scratch-20260624-analyze-p2-architecture-decoupling-discussion
---

# Analysis: M28 Phase 2 — Architecture Decoupling

## Goal

解决三个架构耦合点：
1. Container↔MCP 双向依赖
2. GatewayDeps 胖接口（ISP 违反）
3. craft-catalog ↔ catalog-loader 循环依赖 + eager const 缓存失效

## Dimension Scoring

| Dimension | Score | Evidence | Confidence |
|-----------|-------|----------|------------|
| Correctness | 4.5 | Refactor preserves runtime behavior; only import paths and interface shapes change. Existing tests (health, craft-catalog, container) provide regression harness. | high |
| Security | 3.5 | Decoupling reduces cross-layer surface but no direct vulnerability addressed. No new attack vectors introduced by pure refactor. | medium |
| Performance | 4.0 | craft-catalog lazy getters defer catalog loading; GatewayDeps split has negligible runtime cost. | high |
| Maintainability | 4.5 | ISP split clarifies contracts; breaking cycles enables independent module evolution; tests require smaller mocks. | high |
| Scalability | 4.0 | Cleaner layering supports future container/MCP evolution; craft-types enables new catalog consumers without cycle risk. | medium |
| Operability | 4.0 | Health endpoints remain unchanged externally; reloadCatalog semantics fixed improves runtime reload behavior. | high |

**Overall Score: 4.08 / 5**

## Confidence Factor Decomposition

- **Evidence coverage**: high — cli-explore agents produced concrete file/line anchors for all three subsystems.
- **Stakeholder alignment**: high — roadmap explicitly lists these three targets as Phase 2.
- **Technical feasibility**: high — changes are mechanical with clear backward-compatible paths.
- **Risk surface**: medium — craft-catalog const→getter change touches multiple consumers.
- **Unknown unknowns**: medium — hidden dynamic imports or build-time side effects may surface.

## Go/No-Go Verdict

**GO**

The three decoupling targets are well-scoped, evidence-backed, and implementable with low-to-medium risk. Recommended next step: `/maestro-plan 2`.

## Recommendations

1. **Container/MCP**: Point `mcp/gateway-bootstrap.ts` import at `composition-root/gateway-control-plane.ts`; abstract `WorkflowEventRelay` behind `IWorkflowEventRelay` in `container/types.ts`.
2. **GatewayDeps ISP**: Split `GatewayDeps` into `IHealthEngineAccess`, `IServiceRegistryAccess`, `IRuntimeStateAccess`, `IObservabilityAccess`, `IConfigAccess`, `IGatewayMetadata`; keep `GatewayDeps` as a backward-compatible alias.
3. **craft-catalog**: Extract `craft-types.ts`, convert 18 eager const exports to lazy getter functions, update consumers and tests.

## Risks

- **Consumer churn**: craft-catalog const consumers (dialogue-analyzer, suspense-analyzer, reader-satisfaction-analyzer, tests) must switch from `import { X }` to `getX()` calls.
- **Test mock updates**: Health endpoint tests currently mock the full 17-method object; splitting requires updating mocks to satisfy narrower interfaces.
- **Build side effects**: Removing type imports may expose latent ESM import ordering issues.

## Related Issues

- ISS-20260613-032: Container 与 MCP 双向依赖
- ISS-20260613-033: GatewayDeps 违反接口隔离
- ISS-20260613-035: craft-catalog const 架空延迟缓存
- ISS-20260613-036: catalog-loader 与 craft-catalog 循环依赖
