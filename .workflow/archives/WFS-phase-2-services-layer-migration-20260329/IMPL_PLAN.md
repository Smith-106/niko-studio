# Implementation Plan: Phase 2 - Services Layer Migration

## 1. Goal

将 Python services/ (6,006行) 和 search/ (3,160行) 模块迁移到 TypeScript，实现具体服务并注册到 DI 容器。

## 2. Scope

### Included

**Services Migration** (6,006 lines):
- `services/distill_service.py` → `src-ts/services/distill-service.ts` (核心蒸馏服务)
- `services/llm_service.py` → `src-ts/services/llm-service.ts` (LLM 服务抽象)
- `services/embedding_service.py` → `src-ts/services/embedding-service.ts` (Embedding 服务抽象)
- `services/knowledge_service.py` → `src-ts/services/knowledge-service.ts` (知识服务)

**Search Migration** (3,160 lines):
- `search/smart_search.py` → `src-ts/search/smart-search.ts` (智能搜索)
- `search/hybrid_search.py` → `src-ts/search/hybrid-search.ts` (混合搜索)
- `search/vector_search.py` → `src-ts/search/vector-search.ts` (向量搜索)

**Integration & Testing**:
- DI 容器服务注册
- 测试迁移到 vitest

### Excluded

- Phase 3: Domain Logic Migration (agents/, workflow/, narrative/)
- Phase 4: Data Layer Migration (memory/, graph/, store/)
- Phase 5: Integration (sidecar elimination)

## 3. Context

### Phase 1 Foundation

**Completed Infrastructure** (Git Commit: 8ab598a):
- ✅ TypeScript DI Container (InversifyJS, `src-ts/container/`)
- ✅ 11 Protocol Interfaces (`src-ts/protocols/`)
  - LLMService, LLMProvider
  - EmbeddingService, EmbeddingProvider, EmbeddingCache
  - AgentProtocol, ServiceProtocol
  - SearchInterface, MemoryInterface, GraphInterface
- ✅ AgentFactory Integration (Python)
- ✅ SearchInterface Abstraction (Python)
- ✅ Shared Protocols Module (`src/protocols/`)
- ✅ 6531 Python tests passing
- ✅ 99 TypeScript tests passing

### Dependencies

**Services Dependencies**:
```
services/ depends on:
  ├── src-ts/protocols/ (LLMService, EmbeddingService)
  ├── src-ts/container/ (DI Container)
  ├── Python LLM providers (LangChain, OpenAI, etc.)
  └── Python embeddings (FastEmbed)
```

**Search Dependencies**:
```
search/ depends on:
  ├── src-ts/protocols/ (SearchInterface)
  ├── src-ts/container/ (DI Container)
  ├── Vector Database
  └── Embedding Service
```

### Technology Stack Mapping

| Python | TypeScript | Purpose |
|--------|------------|---------|
| `services/distill_service.py` | `src-ts/services/distill-service.ts` | Core distillation |
| `services/llm_service.py` | `src-ts/services/llm-service.ts` | LLM abstraction |
| `services/embedding_service.py` | `src-ts/services/embedding-service.ts` | Embedding abstraction |
| `services/knowledge_service.py` | `src-ts/services/knowledge-service.ts` | Knowledge management |
| `search/smart_search.py` | `src-ts/search/smart-search.ts` | Smart search |
| `search/hybrid_search.py` | `src-ts/search/hybrid-search.ts` | Hybrid search |
| `search/vector_search.py` | `src-ts/search/vector-search.ts` | Vector search |

## 4. Implementation Strategy

### Execution Model: Sequential with Dependency-Based Parallelization

**Phase 1: Services Layer** (IMPL-007 to IMPL-010)
- **Sequential**: IMPL-007 → IMPL-008, IMPL-009 (depends on IMPL-007)
- **Parallel**: IMPL-008, IMPL-009 (no interdependencies)
- **Sequential**: IMPL-008, IMPL-009 → IMPL-010 (depends on both)

**Phase 2: Search Layer** (IMPL-011 to IMPL-013)
- **Sequential**: IMPL-009 → IMPL-011, IMPL-012, IMPL-013 (all depend on IMPL-009)
- **Parallel**: IMPL-011, IMPL-012, IMPL-013 (no interdependencies)

**Phase 3: Integration** (IMPL-014 to IMPL-015)
- **Sequential**: IMPL-007 to IMPL-013 → IMPL-014 (all services must exist)
- **Sequential**: IMPL-014 → IMPL-015 (DI registration must complete first)

### Critical Path

```
IMPL-007 (DistillService)
  ↓
  ├─→ IMPL-008 (LLMService) ──┐
  └─→ IMPL-009 (EmbeddingService) ──┼─→ IMPL-010 (KnowledgeService)
                                    │
                                    └─→ IMPL-011 (SmartSearch)
                                    └─→ IMPL-012 (HybridSearch)
                                    └─→ IMPL-013 (VectorSearch)
                                          ↓
                                    IMPL-014 (DI Registration)
                                          ↓
                                    IMPL-015 (Test Migration)
```

### Parallelization Opportunities

**Batch 1**: IMPL-008 + IMPL-009 (after IMPL-007 completes)
**Batch 2**: IMPL-011 + IMPL-012 + IMPL-013 (after IMPL-009 completes)

### Risk Mitigation

**High-Risk Areas**:
- LLM Provider Integration (IMPL-008): Multiple providers (OpenAI, Anthropic, LangChain)
- Vector Database Integration (IMPL-013): External dependency
- Knowledge Service (IMPL-010): Complex dependencies (LLM + Embedding)

**Mitigation Strategies**:
- Mock external dependencies in tests
- Incremental provider support (start with OpenAI, add others incrementally)
- Maintain Python fallback during migration

## 5. Task Breakdown

### Services Migration

#### IMPL-007: Migrate DistillService to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 500
- **Dependencies**: None (foundation task)
- **Convergence Criteria**:
  - `src-ts/services/distill-service.ts` implements DistillService interface
  - TypeScript strict mode passing
  - Functional equivalence with Python version
  - Python backend remains functional

#### IMPL-008: Migrate LLMService to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 800
- **Dependencies**: IMPL-007
- **Convergence Criteria**:
  - Multiple LLM providers supported (OpenAI, Anthropic, LangChain)
  - TypeScript strict mode passing
  - Unit tests cover generation, streaming, embedding

#### IMPL-009: Migrate EmbeddingService to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 600
- **Dependencies**: IMPL-007
- **Convergence Criteria**:
  - FastEmbed and other embedding providers supported
  - Embedding cache mechanism implemented
  - TypeScript strict mode passing
  - Unit tests cover embedding generation and caching

#### IMPL-010: Migrate KnowledgeService to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 1000
- **Dependencies**: IMPL-008, IMPL-009
- **Convergence Criteria**:
  - LLMService and EmbeddingService dependencies injected correctly
  - Knowledge distillation, storage, retrieval implemented
  - TypeScript strict mode passing
  - Unit tests cover core knowledge service functionality

### Search Migration

#### IMPL-011: Migrate SmartSearch to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 700
- **Dependencies**: IMPL-009
- **Convergence Criteria**:
  - SearchInterface implemented (search, index, delete)
  - Hybrid search strategy (keyword + semantic)
  - TypeScript strict mode passing
  - Unit tests cover search, index, delete functionality

#### IMPL-012: Migrate HybridSearch to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 600
- **Dependencies**: IMPL-009
- **Convergence Criteria**:
  - Multiple search strategies combined (keyword, semantic, vector)
  - TypeScript strict mode passing
  - Unit tests cover hybrid search strategy

#### IMPL-013: Migrate VectorSearch to TypeScript
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 800
- **Dependencies**: IMPL-009
- **Convergence Criteria**:
  - Vector database connection and query supported
  - TypeScript strict mode passing
  - Unit tests cover vector search and indexing

### Integration & Testing

#### IMPL-014: Register services to DI Container
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 400
- **Dependencies**: IMPL-007 to IMPL-013
- **Convergence Criteria**:
  - All services registered in ContainerModule
  - Lazy initialization implemented
  - Mock injection supported for testing
  - TypeScript strict mode passing
  - Integration tests verify service resolution

#### IMPL-015: Migrate service tests to vitest
- **Priority**: High
- **Agent**: code-developer
- **Estimated Lines**: 1500
- **Dependencies**: IMPL-014
- **Convergence Criteria**:
  - All service vitest test files exist
  - Test coverage >= Python version
  - All tests passing
  - Mock injection tests passing
  - Integration tests verify service interactions

## 6. Quality Gates

### Services Migration Gates

- [ ] Each service implements corresponding protocol interface
- [ ] TypeScript strict mode passing
- [ ] Unit tests migrated to vitest (coverage >= Python version)
- [ ] Python backend remains functional

### Search Migration Gates

- [ ] Each search implements SearchInterface
- [ ] TypeScript strict mode passing
- [ ] Unit tests migrated to vitest (coverage >= Python version)
- [ ] Python backend remains functional

### Integration Gates

- [ ] All services registered in DI container
- [ ] Lazy initialization working
- [ ] Mock injection for testing
- [ ] Dual runtime validated

## 7. Estimated Timeline

**Total Tasks**: 9
**Estimated Time**: 2-3 weeks

**Phase 1 (Services)**: 1.5 weeks
- IMPL-007: 2 days
- IMPL-008 + IMPL-009 (parallel): 3 days
- IMPL-010: 2 days

**Phase 2 (Search)**: 1 week
- IMPL-011 + IMPL-012 + IMPL-013 (parallel): 4 days

**Phase 3 (Integration)**: 0.5 weeks
- IMPL-014: 2 days
- IMPL-015: 3 days

## 8. Rollback Plan

If critical issues arise:
1. **Feature Flag**: Use environment variable to switch between Python and TypeScript implementations
2. **Dual Runtime**: Python backend remains functional throughout migration
3. **Incremental Rollout**: Each service can be rolled back independently
4. **Testing**: Comprehensive test coverage ensures regression detection

## 9. Success Metrics

- [ ] All 9 tasks completed
- [ ] TypeScript strict mode passing for all migrated code
- [ ] Test coverage >= Python version baseline
- [ ] All vitest tests passing
- [ ] All Python tests still passing (dual runtime validation)
- [ ] No functionality regression
- [ ] Services properly registered in DI container
- [ ] Mock injection working for testing
