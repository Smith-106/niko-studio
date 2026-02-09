# Implementation Plan - Niko Studio 完整实现

**Session**: WFS-niko-full-impl-20260209
**Created**: 2026-02-09
**Current Completion**: ~75%
**Target Completion**: 100%

---

## 1. Overview

### 1.1 Project Context

**Platform**: Niko-Studio - Multi-Agent Narrative Writing Platform
**Architecture**: OpenKL Memory + CCW Workflow + LangGraph State Machine
**Current Status**: Core agents and workflow levels implemented, missing critical service integrations

### 1.2 Implementation Scope

**Goal**: 完成 niko-studio 平台所有缺失功能，达到生产就绪状态

**Missing Components**:
- P1: TokenService (blocking BaseAgent)
- P2: AgentKnowledgeLayer integration (blocking Writer)
- P2: SequentialThinking integration (blocking Architect)
- P3: BackupService (platform service)
- P3: ObsidianSyncService (platform service)
- P4: Integration tests expansion (30% → 80%+)

**Constraints**:
1. 遵循现有 MemoryManager/CitationManager 实现模式
2. 增量添加，无破坏性变更
3. 完整测试覆盖
4. 保持代码质量和文档完整性

---

## 2. Task Breakdown

### Stage 1: Critical Service Implementation (P1)

#### IMPL-001: TokenService Implementation
**Priority**: P1 (Critical)
**Estimated Hours**: 3
**Status**: pending
**Dependencies**: None
**Blocks**: BaseAgent token management

**Objective**: 实现 TokenService，提供 LLM token 计数、成本估算和预算控制

**Deliverables**:
- 创建 1 个文件: src/services/token_service.py
- 实现 5 个核心类: TokenService, TokenCounter, CostEstimator, BudgetTracker, ModelRegistry
- 集成到 BaseAgent (src/agents/base.py 的 _get_tokenizer, count_tokens, estimate_cost 方法)
- 单元测试: tests/unit/services/test_token_service.py

**Acceptance Criteria**:
- TokenService 支持 tiktoken 和 fallback counting
- CostEstimator 支持 GPT-4/Claude/Gemini 定价
- BudgetTracker 实现 per-request 和 per-session 限制
- BaseAgent 集成无破坏性变更
- 测试覆盖率 ≥ 85%: 验证 pytest --cov=src/services/token_service

---

### Stage 2: Agent Enhancement (P2)

#### IMPL-002: AgentKnowledgeLayer Integration
**Priority**: P2 (High)
**Estimated Hours**: 2
**Status**: pending
**Dependencies**: None
**Blocks**: Writer agent knowledge retrieval

**Objective**: 验证 AgentKnowledgeLayer 实现并完成 Writer agent 集成

**Note**: src/services/knowledge_layer.py 已存在 AgentKnowledgeLayer 类，需要验证其与 Writer agent 的集成

**Deliverables**:
- 验证现有实现: src/services/knowledge_layer.py (AgentKnowledgeLayer 类)
- 完成集成: src/agents/writer.py (知识层初始化和调用)
- 修改 2 个方法: write_with_knowledge, sync_to_knowledge_layer (确保正确调用)
- 集成测试: tests/integration/test_writer_knowledge_integration.py

**Acceptance Criteria**:
- Writer agent 可以调用 knowledge_layer.query_hybrid()
- 知识检索结果正确注入到写作上下文
- 写作输出同步到 knowledge_layer
- 集成测试验证端到端流程

#### IMPL-003: SequentialThinking Integration
**Priority**: P2 (High)
**Estimated Hours**: 3
**Status**: pending
**Dependencies**: None
**Blocks**: Architect agent sequential reasoning

**Objective**: 完成 SequentialThinking 在 Architect agent 中的集成

**Note**: src/agents/sequential_thinking.py 已存在，需要在 Architect 中集成

**Deliverables**:
- 修改 1 个文件: src/agents/architect.py
- 集成 SequentialThinking: 添加 thinking_chain 调用到 plan_scenes 方法
- 实现 2 个新方法: _apply_sequential_thinking, _extract_scene_decisions
- 单元测试: tests/unit/agents/test_architect_thinking.py

**Acceptance Criteria**:
- Architect 调用 SequentialThinking 进行场景规划
- 思维链输出影响 scene cards 生成
- 集成不破坏现有 Architect 功能
- 测试覆盖 SequentialThinking 调用路径

---

### Stage 3: Platform Services (P3)

#### IMPL-004: BackupService Implementation
**Priority**: P3 (Medium)
**Estimated Hours**: 4
**Status**: pending
**Dependencies**: None

**Objective**: 实现自动备份服务，保护 .writing/ 目录数据

**Deliverables**:
- 创建 1 个文件: src/services/backup_service.py
- 实现 4 个核心类: BackupService, BackupScheduler, BackupArchiver, BackupRestore
- 支持 3 种策略: incremental, full, differential
- 配置文件: config/backup.yaml
- CLI 工具: scripts/backup_manager.py
- 单元测试: tests/unit/services/test_backup_service.py

**Acceptance Criteria**:
- 支持 scheduled backups (cron-like)
- 备份压缩 (.tar.gz) 并保留版本
- 支持 restore 操作: 验证 backup_service.restore(timestamp)
- 配置化备份策略
- 测试覆盖率 ≥ 80%

#### IMPL-005: ObsidianSyncService Implementation
**Priority**: P3 (Medium)
**Estimated Hours**: 3
**Status**: pending
**Dependencies**: None

**Objective**: 实现 Obsidian vault 同步服务，支持双向同步

**Deliverables**:
- 创建 1 个文件: src/services/obsidian_sync.py
- 实现 3 个核心类: ObsidianSyncService, VaultWatcher, ConflictResolver
- 支持 2 个同步模式: one-way (niko → obsidian), two-way (bidirectional)
- 文件监视: 使用 watchdog 监听 .writing/ 和 vault 变化
- 配置文件: config/obsidian.yaml
- 单元测试: tests/unit/services/test_obsidian_sync.py

**Acceptance Criteria**:
- 同步 .writing/memories/ 到 Obsidian vault
- 支持冲突检测和解决策略 (latest-wins, manual)
- 文件变化实时同步: 验证 watchdog 触发
- 支持 Obsidian 元数据 (frontmatter) 保留
- 测试覆盖率 ≥ 75%

---

### Stage 4: Integration Testing Expansion (P4)

#### IMPL-006: Integration Tests Expansion
**Priority**: P4 (Quality Assurance)
**Estimated Hours**: 8
**Status**: pending
**Dependencies**: IMPL-001, IMPL-002, IMPL-003, IMPL-004, IMPL-005

**Objective**: 将集成测试覆盖率从 30% 提升到 80%+

**Deliverables**:
- 扩展 3 个测试文件:
  - tests/integration/test_e2e_workflow.py (L1-L5 workflow 完整覆盖)
  - tests/integration/test_memory_integration.py (MemoryManager + Citation + Distillation)
  - tests/integration/test_knowledge_layer.py (StoreManager + GraphManager + VectorSearch)
- 新增 3 个测试文件:
  - tests/integration/test_service_layer.py (TokenService + BackupService + ObsidianSync)
  - tests/integration/test_agent_integration.py (Commander + Architect + Writer + Critic)
  - tests/integration/test_session_resume.py (SessionManager + ResumeStrategy)
- 实现 15+ 新测试用例
- CI/CD 集成: .github/workflows/integration-tests.yml

**Acceptance Criteria**:
- E2E workflow 测试覆盖 L1-L5: 验证每个 level 执行成功
- Service layer 测试覆盖所有 P1-P3 服务
- Agent integration 测试覆盖 multi-agent collaboration
- 整体集成测试覆盖率 ≥ 80%: pytest --cov=src --cov-report=term
- 所有测试通过: pytest tests/integration/ -v

---

## 3. Implementation Strategy

### 3.1 Development Approach

**Incremental Implementation**:
1. Stage 1 (P1): TokenService → unblocks BaseAgent
2. Stage 2 (P2): AgentKnowledgeLayer + SequentialThinking → unblocks Writer/Architect
3. Stage 3 (P3): Platform services → complete service layer
4. Stage 4 (P4): Integration tests → ensure quality

**Code Patterns to Follow**:
- Service initialization: `__init__(self, base_path: str)` (参考 MemoryManager)
- Error handling: `try-except with logging` (参考 CitationManager)
- Async support: `async def` for I/O operations (参考 DistillationManager)
- File organization: OpenKL contract (参考 MemoryManager 的 by_date 结构)
- Testing: pytest fixtures + mocking (参考 test_memory_manager.py)

### 3.2 Quality Standards

**Code Quality**:
- Type hints: 所有 public API
- Docstrings: Google style
- Logging: Python logging module
- Error handling: Explicit try-except with context

**Testing Requirements**:
- Unit tests: ≥85% coverage for new code
- Integration tests: ≥80% overall coverage
- All tests pass before merging
- Mock external dependencies (LLM APIs)

**Documentation**:
- API documentation: Inline docstrings
- Service README: Usage examples
- Architecture updates: Update docs/ARCHITECTURE.md

---

## 4. Risk Management

### 4.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| TokenService integration breaks BaseAgent | Low | High | Gradual rollout, fallback mechanism |
| Obsidian sync conflicts | Medium | Medium | Conflict resolution strategy, manual override |
| Test coverage gaps | Low | Medium | Comprehensive test planning upfront |

### 4.2 Dependency Risks

**External Dependencies**:
- tiktoken: Required for TokenService → ensure installation in requirements.txt
- watchdog: Required for file sync → already in requirements.txt
- pytest-asyncio: Required for async tests → verify version compatibility

**Internal Dependencies**:
- BaseAgent relies on TokenService → implement first (P1)
- Integration tests rely on all services → implement last (P4)

---

## 5. Success Criteria

### 5.1 Completion Checklist

- [ ] **IMPL-001**: TokenService implemented and integrated
- [ ] **IMPL-002**: AgentKnowledgeLayer verified and working
- [ ] **IMPL-003**: SequentialThinking integrated in Architect
- [ ] **IMPL-004**: BackupService operational
- [ ] **IMPL-005**: ObsidianSyncService operational
- [ ] **IMPL-006**: Integration test coverage ≥80%

### 5.2 Quality Gates

**Code Quality**:
- [ ] All linters pass (flake8, mypy)
- [ ] Type coverage ≥90%
- [ ] No critical code smells (SonarQube)

**Testing**:
- [ ] Unit test coverage ≥85%
- [ ] Integration test coverage ≥80%
- [ ] All CI/CD pipelines green

**Documentation**:
- [ ] API documentation complete
- [ ] Architecture diagrams updated
- [ ] User guides written

---

## 6. Timeline Estimate

| Stage | Tasks | Hours | Dependencies |
|-------|-------|-------|--------------|
| Stage 1 | IMPL-001 | 3h | None |
| Stage 2 | IMPL-002, IMPL-003 | 5h | None |
| Stage 3 | IMPL-004, IMPL-005 | 7h | None |
| Stage 4 | IMPL-006 | 8h | All previous stages |
| **Total** | **6 tasks** | **23h** | Sequential + Parallel |

**Parallelization Opportunities**:
- Stage 2 and Stage 3 can run in parallel
- IMPL-002 and IMPL-003 independent
- IMPL-004 and IMPL-005 independent

**Critical Path**: IMPL-001 → IMPL-006 (11 hours)

---

## 7. Post-Implementation

### 7.1 Validation

**Service Validation**:
1. TokenService: Run cost estimation on sample prompts
2. AgentKnowledgeLayer: Query hybrid search with test data
3. BackupService: Create and restore backup
4. ObsidianSync: Verify bidirectional sync

**Integration Validation**:
1. Run full E2E workflow (L1-L5)
2. Execute all integration tests
3. Performance benchmarking

### 7.2 Documentation Updates

**Required Updates**:
- docs/API_REFERENCE.md: Add new service APIs
- docs/ARCHITECTURE.md: Update service layer diagram
- docs/TESTING_GUIDE.md: Integration test guidelines
- README.md: Update completion status to 100%

---

## 8. Appendix

### 8.1 Reference Implementations

**Service Pattern Reference**: src/memory/memory_manager.py
- Initialization pattern
- File organization (OpenKL)
- Error handling
- Logging

**Agent Integration Reference**: src/agents/writer.py
- Knowledge layer integration
- Async method patterns
- LLM fallback handling

**Testing Reference**: tests/unit/memory/test_memory_manager.py
- Fixture setup
- Mock patterns
- Assertion strategies

### 8.2 Validation Checklist Template

**For Each Task**:
```markdown
## IMPL-XXX Validation

### Pre-Implementation
- [ ] Read reference implementations
- [ ] Understand integration points
- [ ] Plan test cases

### Implementation
- [ ] Code follows existing patterns
- [ ] Type hints complete
- [ ] Docstrings written
- [ ] Error handling comprehensive

### Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Coverage meets threshold
- [ ] Manual testing complete

### Documentation
- [ ] API documented
- [ ] Usage examples added
- [ ] Architecture updated
```

---

**Document Version**: 1.0
**Last Updated**: 2026-02-09
**Status**: Ready for Implementation
