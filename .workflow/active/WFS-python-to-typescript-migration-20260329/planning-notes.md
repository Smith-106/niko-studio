# Planning Notes

**Session**: WFS-python-to-typescript-migration-20260329
**Created**: 2026-03-29T00:00:00Z

## User Intent (Phase 1)

- **GOAL**: 大规模 Python → TypeScript 迁移 - 将 src/ 下 75,132 行 Python 业务逻辑迁移到 TypeScript，重写核心模块
- **KEY_CONSTRAINTS**: 渐进式迁移保持系统可运行，保留现有测试覆盖，维护 Desktop 应用兼容性，避免功能回退；已有 Node sidecar（86行代理指向 Python 后端）

---

## Context Findings (Phase 2)

### [Context-Search Agent] 2026-03-29

**Key Findings**:

1. **Codebase Metrics**:
   - Python: 202 files, 75,132 lines (src/)
   - TypeScript: 72 files, 16,919 lines (desktop/src/)
   - Rust: 38 files (desktop/src-tauri/)
   - Core modules: narrative (14,985 lines), workflow (13,890 lines), memory (9,401 lines)

2. **Architecture Patterns**:
   - Layered architecture with Platform Core + Domain Adapters
   - ServiceContainer (DI) with lazy loading and factory pattern
   - Registry Pattern for adapters and workflow levels
   - Protocol/Interface Pattern for LLM/Embedding services
   - Strategy Pattern for workflow levels and domain adapters

3. **Critical Dependencies**:
   - ServiceContainer → all engines (memory, graph, search, workflow)
   - WorkflowEngine → WorkflowLevels → Agents (tight coupling issues ARCH-001, ARCH-002)
   - MCP Gateway → WorkflowEngine → SessionManager (HTTP API boundary)
   - Desktop frontend → HTTP/SSE contract → MCP Gateway

4. **Migration Prerequisites**:
   - ARCH-001/ARCH-002: Refactor agent instantiation to use DI before migration
   - ARCH-003: Decouple memory layer from search layer
   - ARCH-004: Extract shared protocols from service layer

5. **Dependency Injection Pattern** (src/container.py):
   - Lazy initialization via `@property` with factory functions
   - Mock injection support for testing (`register_mock()`)
   - Async initialization with task management
   - Plugin system for engine extensions

6. **Existing TypeScript Infrastructure**:
   - Desktop app with React 18, TypeScript 5.4, Tauri 2.0
   - Vitest testing framework already in place
   - Zustand for state management
   - Node sidecar (86 lines) proxying to Python backend

7. **Testing Coverage**:
   - Python: 74 test files (pytest, pytest-asyncio)
   - TypeScript: Limited tests (vitest, @testing-library/react)
   - Migration strategy: Module-by-module test migration

8. **Phased Migration Order**:
   - Phase 1: Infrastructure (container.py, protocols.py, gateway.py)
   - Phase 2: Services (services/, search/) - minimal dependencies
   - Phase 3: Domain Logic (agents/, workflow/, narrative/)
   - Phase 4: Data Layer (memory/, graph/, store/)
   - Phase 5: Integration (eliminate sidecar proxy)

**Detailed Analysis**: See context-package.json for full dependency graph, risk assessment, and prioritized context.

## Conflict Decisions (Phase 3)

- **RESOLVED**: ARCH-001 (DI重构) -> 预迁移 DI 重构; ARCH-002 (分层依赖注入) -> 分层依赖注入; ARCH-003 (搜索层解耦) -> 搜索层抽象接口; ARCH-004 (共享协议提取) -> 共享协议提取
- **MODIFIED_ARTIFACTS**: None (constraints added to planning phase)
- **CONSTRAINTS**: [Conflict] Add AgentFactory to ServiceContainer; [Conflict] Use container.get_agent() in workflow levels; [Conflict] Introduce SearchInterface abstraction; [Conflict] Extract shared protocols to independent module

## Consolidated Constraints (Phase 4 Input)
1. 渐进式迁移保持系统可运行，保留现有测试覆盖，维护 Desktop 应用兼容性，避免功能回退；已有 Node sidecar（86行代理指向 Python 后端）

---

## Task Generation (Phase 4)

### [Action-Planning Agent] 2026-03-29

**Plan Structure**:
- **Total Tasks**: 6 (Pre-Migration: 4, Phase 1: 2)
- **Phased Approach**: Pre-Migration Refactoring → Phase 1 Infrastructure
- **Execution Mode**: Agent mode for refactoring, CLI mode for TypeScript migration

**Task Breakdown**:
1. **Pre-Migration Refactoring** (IMPL-001 to IMPL-004):
   - IMPL-001: Add AgentFactory to ServiceContainer (resolve ARCH-001)
   - IMPL-002: Refactor Workflow Levels to Use DI (resolve ARCH-002)
   - IMPL-003: Introduce SearchInterface Abstraction (resolve ARCH-003)
   - IMPL-004: Extract Shared Protocols Module (resolve ARCH-004)

2. **Phase 1: Infrastructure Migration** (IMPL-005 to IMPL-006):
   - IMPL-005: Migrate ServiceContainer to TypeScript DI (InversifyJS)
   - IMPL-006: Migrate Protocols to TypeScript Interfaces

**Execution Strategy**:
- **Parallel Pre-Migration**: IMPL-003 and IMPL-004 can run in parallel (no dependencies)
- **Sequential DI Refactoring**: IMPL-001 → IMPL-002 (dependency)
- **Merge Fork for Phase 1**: IMPL-005 merges all pre-migration context
- **Resume for Protocols**: IMPL-006 resumes from IMPL-005

**Key Decisions**:
- DI Framework: InversifyJS (production-grade, lazy initialization support)
- Validation Library: zod (TypeScript-first, replaces Pydantic)
- Testing Framework: vitest (already in use, replaces pytest)
- Dual Runtime: Python and TypeScript backends coexist during migration

**Quality Gates**:
- Pre-Migration: 74 Python tests passing, no functional changes
- Phase 1: 90+ vitest tests, TypeScript strict mode, dual runtime validated

**Future Phases** (Not in current session):
- Phase 2: Services Migration (services/, search/ - 9,166 lines)
- Phase 3: Domain Logic Migration (agents/, workflow/, narrative/ - 34,382 lines)
- Phase 4: Data Layer Migration (memory/, graph/, store/ - 12,891 lines)
- Phase 5: Integration (sidecar elimination)

**Generated Artifacts**:
- `.task/IMPL-001.json` to `.task/IMPL-006.json`
- `plan.json` (machine-readable overview)
- `IMPL_PLAN.md` (comprehensive implementation plan)
- `TODO_LIST.md` (task tracking)

## N+1 Context
### Decisions
| Decision | Rationale | Revisit? |
|----------|-----------|----------|
| InversifyJS for DI | Production-grade, lazy initialization, strong TypeScript support | No |
| zod for validation | TypeScript-first, runtime validation, replaces Pydantic | No |
| Phase 1 scope limited to infrastructure | Foundation for all subsequent migrations | No |
| Pre-migration refactoring required | Resolve architecture coupling before TypeScript migration | No |
| Dual runtime approach | Maintain Python backend during migration, desktop compatibility | Yes (Phase 5) |

### Deferred
- [ ] Backend framework selection (Fastify/NestJS/Hono) - Phase 2
- [ ] Services module migration (6,006 lines) - Phase 2
- [ ] Domain logic migration (34,382 lines) - Phase 3
- [ ] Data layer migration (12,891 lines) - Phase 4
- [ ] Sidecar proxy elimination - Phase 5
