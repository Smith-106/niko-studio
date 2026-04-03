# Implementation Plan: Python → TypeScript Migration (Phase 1)

**Session**: WFS-python-to-typescript-migration-20260329
**Created**: 2026-03-29
**Status**: Planning Complete - Ready for Execution

---

## Executive Summary

### Goal
大规模 Python → TypeScript 迁移 - 将 src/ 下 75,132 行 Python 业务逻辑迁移到 TypeScript，重写核心模块

### Scope
- **Python Codebase**: 202 files, 75,132 lines
- **TypeScript Target**: Backend services, infrastructure, domain logic
- **Critical Modules**: narrative (14,985 lines), workflow (13,890 lines), memory (9,401 lines), services (6,006 lines), mcp (5,569 lines), agents (5,507 lines)

### Key Constraints
1. **渐进式迁移保持系统可运行** - Gradual migration maintaining system operability
2. **保留现有测试覆盖** - Preserve existing test coverage
3. **维护 Desktop 应用兼容性** - Maintain Desktop application compatibility
4. **避免功能回退** - Avoid feature regression
5. **已有 Node sidecar（86行代理指向 Python 后端）** - Existing Node sidecar (86-line proxy to Python backend)

### Phased Approach
- **Pre-Migration** (IMPL-001 to IMPL-004): Architecture refactoring to resolve coupling issues
- **Phase 1** (IMPL-005 to IMPL-006): Infrastructure migration (DI container, protocols)
- **Phase 2-5** (Future sessions): Services, domain logic, data layer, integration

---

## Architecture Analysis

### Current Architecture Patterns
- **Layered Architecture**: Platform Core + Domain Adapters
- **Dependency Injection**: ServiceContainer with lazy loading and factory pattern
- **Registry Pattern**: AdapterRegistry, LevelRegistry
- **Protocol/Interface Pattern**: knowledge/services/protocols.py
- **Factory Pattern**: RerankerFactory, WorkflowFactory
- **Strategy Pattern**: Workflow levels (L1-L5), domain adapters

### Dependency Graph
```
ServiceContainer → all engines (memory, graph, search, workflow)
WorkflowEngine → WorkflowLevels → Agents (tight coupling - ARCH-001, ARCH-002)
MCP Gateway → WorkflowEngine → SessionManager (HTTP API boundary)
Memory Layer → Search Layer (tight coupling - ARCH-003)
Services Layer ← Agents Layer (shared protocols - ARCH-004)
Desktop frontend → HTTP/SSE contract → MCP Gateway → Python backend
Desktop sidecar → 86-line proxy → Python backend
```

### Architecture Coupling Issues (Must Resolve Before Migration)

#### ARCH-001: Agent Instantiation Coupling
- **Issue**: Workflow levels directly instantiate agents instead of using DI
- **Impact**: Prevents TypeScript DI framework migration
- **Resolution**: IMPL-001 - Add AgentFactory to ServiceContainer

#### ARCH-002: Workflow-Level Agent Coupling
- **Issue**: Multiple agent instantiations without lifecycle management
- **Impact**: Tight coupling prevents independent testing and migration
- **Resolution**: IMPL-002 - Refactor workflow levels to use DI

#### ARCH-003: Memory-Search Layer Coupling
- **Issue**: Memory layer depends directly on search implementation
- **Impact**: Cannot migrate layers independently
- **Resolution**: IMPL-003 - Introduce SearchInterface abstraction

#### ARCH-004: Services-Agents Protocol Coupling
- **Issue**: Services layer and agents layer share protocols without abstraction
- **Impact**: Circular dependencies, prevents clean interface migration
- **Resolution**: IMPL-004 - Extract shared protocols to independent module

---

## Task Breakdown

### Pre-Migration Refactoring (4 tasks)

#### IMPL-001: Pre-Migration: Add AgentFactory to ServiceContainer
- **Type**: refactor
- **Scope**: src/container.py, src/agents/
- **Dependencies**: None
- **Deliverables**:
  - AgentFactory class with lazy initialization
  - ServiceContainer integration with get_agent()
  - 5 agent types supported (Commander, Architect, Writer, Critic, Plot)
  - 74 pytest tests passing
- **Conflict Resolution**: ARCH-001
- **Files**: 5 files (1 create, 3 modify, 1 test create)
- **Verification**: `python -m pytest tests/ -v && grep -r 'AgentFactory' src/container.py src/agents/factory.py | wc -l >= 2`

#### IMPL-002: Pre-Migration: Refactor Workflow Levels to Use DI
- **Type**: refactor
- **Scope**: src/workflow/levels/
- **Dependencies**: IMPL-001
- **Deliverables**:
  - 5 workflow level files refactored
  - 0 direct agent instantiations
  - Constructor injection of ServiceContainer
  - 74 pytest tests passing
- **Conflict Resolution**: ARCH-002
- **Files**: 7 files (6 modify, 1 test modify)
- **Verification**: `python -m pytest tests/ -v && grep -c 'Agent(' src/workflow/levels/*.py || echo '0'`

#### IMPL-003: Pre-Migration: Introduce SearchInterface Abstraction
- **Type**: refactor
- **Scope**: src/memory/, src/search/
- **Dependencies**: None
- **Deliverables**:
  - SearchInterface protocol with 3 methods
  - Memory layer decoupled from search implementation
  - 74 pytest tests passing
- **Conflict Resolution**: ARCH-003
- **Files**: 7 files (1 create, 5 modify, 1 test create)
- **Verification**: `python -m pytest tests/ -v && grep -c 'SearchInterface' src/knowledge/services/protocols.py src/memory/core_memory_store.py | wc -l >= 2`

#### IMPL-004: Pre-Migration: Extract Shared Protocols Module
- **Type**: refactor
- **Scope**: src/services/, src/agents/, src/knowledge/services/protocols.py
- **Dependencies**: None
- **Deliverables**:
  - New src/protocols/ module
  - 4 protocols extracted (LLMProtocol, EmbeddingProtocol, AgentProtocol, ServiceProtocol)
  - 0 circular dependencies
  - 74 pytest tests passing
- **Conflict Resolution**: ARCH-004
- **Files**: 9 files (5 create, 3 modify, 1 test create)
- **Verification**: `python -m pytest tests/ -v && python -c "from protocols import LLMProtocol, EmbeddingProtocol, AgentProtocol, ServiceProtocol"`

---

### Phase 1: Infrastructure Migration (2 tasks)

#### IMPL-005: Phase 1: Migrate Core Infrastructure - ServiceContainer to TypeScript DI
- **Type**: feature
- **Scope**: src-ts/container/
- **Dependencies**: IMPL-001, IMPL-002, IMPL-003, IMPL-004
- **Deliverables**:
  - TypeScript DI container using InversifyJS
  - Lazy initialization with property getters
  - Mock injection for testing
  - Async initialization with Promise pattern
  - 10+ service registrations
  - 50+ vitest tests
  - Dual runtime validation
- **Files**: 7 files (4 create, 3 modify)
- **Verification**: `cd src-ts && npm test && ts-node -e "import { ServiceContainer } from './container/ServiceContainer'; const c = new ServiceContainer(); console.log('OK');"`

#### IMPL-006: Phase 1: Migrate Protocols to TypeScript Interfaces
- **Type**: feature
- **Scope**: src-ts/protocols/
- **Dependencies**: IMPL-005
- **Deliverables**:
  - 15+ TypeScript interfaces
  - LLMProtocol, EmbeddingProtocol, AgentProtocol, ServiceProtocol migrated
  - SearchInterface, MemoryInterface, GraphInterface added
  - JSDoc documentation
  - 40+ type tests
  - TypeScript strict mode passing
- **Files**: 10 files (9 create, 1 test create)
- **Verification**: `cd src-ts && npm test && tsc --noEmit --strict`

---

## Execution Strategy

### Sequential Execution with Parallel Pre-Migration

#### Parallel Tracks (Pre-Migration)
```
Track A: Agent DI Refactoring
  IMPL-001 (AgentFactory) → IMPL-002 (Workflow DI)

Track B: Layer Decoupling
  IMPL-003 (SearchInterface) [parallel]
  IMPL-004 (Protocols Module) [parallel]
```

#### Sequential Track (Phase 1)
```
Phase 1:
  IMPL-001 + IMPL-002 + IMPL-003 + IMPL-004 (all complete)
    ↓
  IMPL-005 (TypeScript DI Container)
    ↓
  IMPL-006 (TypeScript Protocols)
```

### Execution Mode
- **Pre-Migration (IMPL-001 to IMPL-004)**: Agent mode (`execution_config.method: "agent"`)
  - Standard refactoring tasks
  - Python-to-Python changes
  - Existing test framework (pytest)

- **Phase 1 (IMPL-005 to IMPL-006)**: CLI mode (`execution_config.method: "cli"`)
  - Complex TypeScript migration
  - New framework introduction (InversifyJS)
  - New test framework (vitest)

### CLI Execution Strategy
- **IMPL-005**: Merge fork from all pre-migration tasks
  ```
  cli_execution:
    strategy: "merge_fork"
    merge_from: [IMPL-001, IMPL-002, IMPL-003, IMPL-004]
  ```

- **IMPL-006**: Resume from IMPL-005
  ```
  cli_execution:
    strategy: "resume"
    resume_from: IMPL-005
  ```

---

## Testing Strategy

### Python Testing (Pre-Migration & During Migration)
- **Framework**: pytest, pytest-asyncio, pytest-mock
- **Current Coverage**: 74 test files
- **Strategy**: Module-by-module test migration maintaining coverage
- **Command**: `python -m pytest tests/ -v`

### TypeScript Testing (Phase 1+)
- **Framework**: vitest, @testing-library/react
- **Target Coverage**: 90% for new TypeScript code
- **Strategy**: Write tests alongside implementation
- **Commands**:
  - `cd src-ts && npm test`
  - `cd src-ts && npm test -- --coverage`

### Dual Runtime Validation
- **Strategy**: Python backend and TypeScript backend coexist during migration
- **Validation**: Both test suites must pass simultaneously
- **Commands**:
  ```bash
  # Python tests
  python -m pytest tests/ -v

  # TypeScript tests
  cd src-ts && npm test

  # Both must pass
  ```

---

## Risk Mitigation

### High Priority Risks

#### R1: Breaking Existing Functionality
- **Risk**: Pre-migration refactoring breaks existing Python functionality
- **Mitigation**:
  - Run full test suite (74 tests) after each task
  - No functional changes - behavior must remain identical
  - Quantified acceptance criteria in each task
  - Verification commands for each task

#### R2: DI Framework Incompatibility
- **Risk**: InversifyJS lazy initialization pattern doesn't match Python ServiceContainer
- **Mitigation**:
  - Research InversifyJS capabilities in IMPL-005 pre-analysis
  - Use toDynamicValue for lazy initialization
  - Comprehensive test coverage (50+ tests)
  - Performance validation

#### R3: Circular Dependencies
- **Risk**: TypeScript module system reveals circular dependencies
- **Mitigation**:
  - Resolve ARCH-001 to ARCH-004 before TypeScript migration
  - Extract shared protocols (IMPL-004)
  - Use dependency inversion principle
  - Runtime validation with `ts-node` import tests

#### R4: Test Coverage Gaps
- **Risk**: TypeScript tests don't cover all Python test scenarios
- **Mitigation**:
  - Map Python tests to TypeScript equivalents
  - 90% coverage target for new code
  - Integration tests for API contracts
  - Maintain pytest coverage until module fully migrated

### Medium Priority Risks

#### R5: Performance Overhead
- **Risk**: Reflection and decorators in InversifyJS add performance overhead
- **Mitigation**: Benchmark critical paths, lazy initialization, caching

#### R6: Desktop Compatibility
- **Risk**: Desktop app breaks during migration
- **Mitigation**: Maintain HTTP API contract, sidecar proxy remains, integration tests

---

## Success Criteria

### Pre-Migration Success Criteria
- [ ] ARCH-001 resolved: AgentFactory integrated, 0 direct agent instantiations
- [ ] ARCH-002 resolved: Workflow levels use container.get_agent()
- [ ] ARCH-003 resolved: Memory layer uses SearchInterface abstraction
- [ ] ARCH-004 resolved: Shared protocols extracted to independent module
- [ ] All 74 Python tests passing after refactoring
- [ ] No functional changes - behavior identical

### Phase 1 Success Criteria
- [ ] TypeScript DI container operational with InversifyJS
- [ ] 10+ services registered in container
- [ ] 50+ vitest tests passing for container
- [ ] 15+ TypeScript protocol interfaces defined
- [ ] TypeScript strict mode passing (no 'any' types)
- [ ] Dual runtime validated (Python + TypeScript coexist)
- [ ] Desktop app unaware of migration (API compatibility maintained)

### Overall Migration Success Criteria (Future Phases)
- [ ] TypeScript version feature parity
- [ ] Test coverage >= Python version
- [ ] Desktop app no感知迁移
- [ ] Performance maintained or improved
- [ ] API compatibility preserved
- [ ] Sidecar proxy eliminated (Phase 5)

---

## Technology Decisions

### Backend Framework (TBD)
- **Options**: Fastify, NestJS, Hono
- **Decision Criteria**:
  - Performance
  - TypeScript native support
  - DI framework integration
  - Community support
- **Decision Point**: Phase 2 (Services Migration)

### DI Framework (Decided)
- **Choice**: InversifyJS
- **Rationale**:
  - Production-grade DI
  - Lazy initialization support (toDynamicValue)
  - Decorator-based injection
  - Strong TypeScript support

### Validation Library (Decided)
- **Choice**: zod
- **Rationale**:
  - TypeScript-first validation
  - Type inference
  - Runtime validation
  - Replaces Pydantic

---

## Timeline

### Pre-Migration (IMPL-001 to IMPL-004)
- **Duration**: 1 week (parallel execution possible)
- **Dependencies**: IMPL-001 → IMPL-002 (sequential), IMPL-003 and IMPL-004 (parallel)

### Phase 1: Infrastructure (IMPL-005 to IMPL-006)
- **Duration**: 1-2 weeks
- **Dependencies**: IMPL-005 depends on all pre-migration tasks, IMPL-006 depends on IMPL-005

### Total Phase 1 Timeline
- **Estimated**: 2-3 weeks

### Complete Migration Timeline (5 Phases)
- **Estimated**: 4-6 months (based on 75K lines, 6 core modules)

---

## Dependencies

### Internal Dependencies
- ServiceContainer → all engines (memory, graph, search, workflow)
- WorkflowEngine → WorkflowLevels → Agents
- MCP Gateway → WorkflowEngine → SessionManager
- Memory Layer → Search Layer
- Desktop frontend → HTTP/SSE contract → MCP Gateway

### External Dependencies (Python → TypeScript Mapping)

| Python Library | TypeScript Alternative | Migration Strategy |
|----------------|------------------------|-------------------|
| FastAPI | Fastify/NestJS/Hono | Phase 2 |
| pydantic | zod | Phase 1-2 |
| pytest | vitest | Phase 1 |
| asyncio | Promise/async-await | Native |
| LangChain | @langchain/core | Phase 3 |
| LangGraph | @langchain/langgraph | Phase 3 |
| FastEmbed | External service or TS equivalent | Phase 4 |
| aiosqlite | better-sqlite3 or sqlite3 | Phase 4 |

---

## Documentation

### Generated Artifacts
- **Task JSONs**: `.workflow/active/WFS-python-to-typescript-migration-20260329/.task/IMPL-{001-006}.json`
- **Plan Overview**: `.workflow/active/WFS-python-to-typescript-migration-20260329/plan.json`
- **Implementation Plan**: `.workflow/active/WFS-python-to-typescript-migration-20260329/IMPL_PLAN.md` (this document)
- **TODO List**: `.workflow/active/WFS-python-to-typescript-migration-20260329/TODO_LIST.md`

### Session Tracking
- **Session Metadata**: `.workflow/active/WFS-python-to-typescript-migration-20260329/session-metadata.json`
- **Planning Notes**: `.workflow/active/WFS-python-to-typescript-migration-20260329/planning-notes.md`
- **Context Package**: `.workflow/active/WFS-python-to-typescript-migration-20260329/.process/context-package.json`
- **Conflict Resolution**: `.workflow/active/WFS-python-to-typescript-migration-20260329/.process/conflict-resolution.json`

---

## Next Steps

### Immediate Actions
1. Review and approve this implementation plan
2. Execute IMPL-001 (AgentFactory) and IMPL-003/IMPL-004 in parallel
3. Execute IMPL-002 after IMPL-001 completion
4. Execute IMPL-005 after all pre-migration tasks complete
5. Execute IMPL-006 after IMPL-005 completion

### Future Sessions
- **Phase 2**: Services Migration (services/, search/) - 9,166 lines
- **Phase 3**: Domain Logic Migration (agents/, workflow/, narrative/) - 34,382 lines
- **Phase 4**: Data Layer Migration (memory/, graph/, store/) - 12,891 lines
- **Phase 5**: Integration (eliminate sidecar proxy) - 86 lines

---

## Quality Gates

### Pre-Migration Quality Gates
- [ ] All 74 Python tests passing
- [ ] No direct agent instantiation in workflow levels
- [ ] Memory layer decoupled from search implementation
- [ ] Shared protocols extracted with no circular dependencies
- [ ] Code review approved for all refactoring changes

### Phase 1 Quality Gates
- [ ] 50+ vitest tests passing for TypeScript DI container
- [ ] 40+ vitest tests passing for TypeScript protocols
- [ ] TypeScript strict mode passing (no 'any' types)
- [ ] Dual runtime validated (Python + TypeScript)
- [ ] Performance benchmarks acceptable
- [ ] Code review approved for TypeScript implementation

---

## Appendix

### Task Dependency Graph
```
IMPL-001 (AgentFactory) ────────┐
                                 │
IMPL-002 (Workflow DI) ◄─────────┤
                                 │
IMPL-003 (SearchInterface) ──────┤
                                 │
IMPL-004 (Protocols Module) ─────┤
                                 │
                                 ▼
                       IMPL-005 (TypeScript DI)
                                 │
                                 ▼
                       IMPL-006 (TypeScript Protocols)
```

### Module Migration Order (Complete Plan)
1. **Pre-Migration**: Refactoring (IMPL-001 to IMPL-004)
2. **Phase 1**: Infrastructure (IMPL-005 to IMPL-006)
3. **Phase 2**: Services (services/ 6,006 lines, search/ 3,160 lines)
4. **Phase 3**: Domain Logic (agents/ 5,507 lines, workflow/ 13,890 lines, narrative/ 14,985 lines)
5. **Phase 4**: Data Layer (memory/ 9,401 lines, graph/ 1,717 lines, store/ 1,773 lines)
6. **Phase 5**: Integration (sidecar elimination)

### Codebase Metrics
- **Total Python Lines**: 75,132
- **Total Python Files**: 202
- **Critical Modules**: 6 (narrative, workflow, memory, services, mcp, agents)
- **Test Coverage**: 74 pytest files
- **TypeScript Lines (existing)**: 16,919 (desktop frontend)
- **TypeScript Files (existing)**: 72

---

**End of Implementation Plan**
