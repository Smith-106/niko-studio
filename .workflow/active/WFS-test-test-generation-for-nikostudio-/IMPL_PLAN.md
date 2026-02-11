---
identifier: WFS-test-test-generation-for-nikostudio-
source: "User requirements"
analysis: D:/工作目录/niko-studio/.workflow/active/WFS-test-test-generation-for-nikostudio-/.process/TEST_ANALYSIS_RESULTS.md
artifacts: D:/工作目录/niko-studio/.workflow/active/WFS-test-test-generation-for-nikostudio-/.brainstorming/
context_package: D:/工作目录/niko-studio/.workflow/active/WFS-test-test-generation-for-nikostudio-/.process/context-package.json
workflow_type: "tdd"
verification_history:
  concept_verify: "passed"
  action_plan_verify: "pending"
phase_progression: "brainstorm → context → analysis → concept_verify → planning"
---

# Implementation Plan: nikostudio 自动化测试规划

## 1. Summary
本次规划目标是为 nikostudio 构建可自动执行、无需人工干预的测试体系，并在测试完成后自动验证结果。当前 CI 已存在集成测试入口与覆盖率门槛，但单元测试覆盖不足、pytest 配置缺失及覆盖率标准不一致，导致自动化质量门槛存在偏差。

计划以 pytest 为统一测试框架，分层补齐 L0-L3 测试能力，并将质量门槛明确量化。通过新增单元与集成测试、补齐 pytest.ini 与验证脚本入口，保证测试自动运行、覆盖率可度量、结果可复现。

**Core Objectives**:
- 建立可自动执行的 L0-L3 测试矩阵，覆盖 Workflow、Memory、Graph 与 Services 核心模块。
- 统一 pytest 参数与覆盖率门槛，确保 CI 与本地执行一致。

**Technical Approach**:
- 以 pytest + pytest-asyncio 作为统一框架，按 L0/L1/L2/L3 分层补齐测试。

## 2. Context Analysis

### CCW Workflow Context
**Phase Progression**:
- ⏭️ Phase 1: Brainstorming (role analyses skipped)
- ✅ Phase 2: Context Gathering (context-package.json: 15 files, 5 modules analyzed)
- ✅ Phase 3: Enhanced Analysis (TEST_ANALYSIS_RESULTS.md + gemini-test-analysis.md)
- ✅ Phase 4: Concept Verification (0 clarifications answered, skipped)
- ⏳ Phase 5: Action Planning (current phase - generating IMPL_PLAN.md)

**Quality Gates**:
- concept-verify: ✅ Passed (analysis 结论充分)
- plan-verify: ⏳ Pending (recommended before /workflow:execute)

**Context Package Summary**:
- **Focus Paths**: ["tests/integration", "tests/unit", "src/workflow", "src/memory", "src/graph", "src/services", ".github/workflows"]
- **Key Files**: [".github/workflows/integration-tests.yml", "tests/unit/mcp/conftest.py", "tests/unit/test_workflow.py"]
- **Module Depth Analysis**: 未提供（需在执行阶段补齐）
- **Smart Context**: 15 files, 5 modules, 11 dependencies identified

### Project Profile
- **Type**: Enhancement
- **Scale**: 单仓多模块测试补齐，覆盖率与自动化提升
- **Tech Stack**: Python + Starlette + pytest
- **Timeline**: 短期分阶段补齐测试基线

### Module Structure
```
src/
  workflow/
  memory/
  graph/
  services/
  cli/
tests/
  unit/
  integration/
  performance/
```

### Dependencies
**Primary**: pytest, pytest-asyncio, pytest-cov, coverage
**APIs**: 无外部 API 依赖
**Development**: GitHub Actions (integration-tests.yml)

### Patterns & Conventions
- **Architecture**: layered + adapter
- **Component Design**: fixture-based isolation in tests
- **State Management**: workflow threshold routing
- **Code Style**: existing pytest fixtures in tests/unit/mcp/conftest.py

## 3. Brainstorming Artifacts Reference

### Artifact Usage Strategy
**Primary Reference (role analyses)**:
- **What**: 本次未生成 role analyses，使用测试分析结果作为主参考。
- **When**: 任务定义与验收标准引用 TEST_ANALYSIS_RESULTS.md 与 gemini-test-analysis.md。
- **How**: 从分析结果提取 L0-L3 测试清单与覆盖率门槛。
- **Priority**: 分析结果为最高优先级。
- **CCW Value**: 保留测试缺口与风险提示用于任务拆解。

**Context Intelligence (context-package.json)**:
- **What**: Smart context (测试目录、CI 配置、核心模块)。
- **Usage**: 任务 pre_analysis 阶段加载以定位测试目标与依赖。

**Technical Analysis (TEST_ANALYSIS_RESULTS.md / gemini-test-analysis.md)**:
- **What**: 覆盖率门槛、pytest.ini 缺失、测试层级清单。
- **Usage**: 定义 L0-L3 测试范围与质量门槛。

### Integrated Specifications (Highest Priority)
- **test-analysis results**: TEST_ANALYSIS_RESULTS.md + gemini-test-analysis.md
  - Contains: 覆盖率差距、分层测试清单、缺口与风险

### Supporting Artifacts (Reference)
- **docs/tdd/01_Unit_Tests_Plan.md**: 单元测试规范
- **docs/tdd/03_Test_Cases_Inventory.md**: 测试清单与执行指南

**Artifact Priority in Development**:
1. TEST_ANALYSIS_RESULTS.md / gemini-test-analysis.md
2. context-package.json
3. docs/tdd/*

## 4. Implementation Strategy

### Execution Strategy
**Execution Model**: Sequential

**Rationale**: 先补齐测试与配置，再修复运行中的失败，保证自动化闭环。

**Parallelization Opportunities**:
- 无（测试生成与修复存在依赖）

**Serialization Requirements**:
- IMPL-002 依赖 IMPL-001 完成后的测试基线

### Architectural Approach
**Key Architecture Decisions**:
- 以 pytest 作为统一测试框架，维持现有 CI 入口。
- 以 L0-L3 分层测试确保覆盖范围可控。

**Integration Strategy**:
- 集成测试与单元测试在相同 pytest 配置下执行，覆盖率门槛统一。

### Key Dependencies
**Task Dependency Graph**:
```
IMPL-001 → IMPL-001.5 → IMPL-002
```

**Critical Path**: IMPL-001

### Testing Strategy
**Testing Approach**:
- Unit testing: pytest + pytest-asyncio (覆盖 Workflow/Memory/Graph/Services)
- Integration testing: pytest (tests/integration)
- E2E testing: L3 workflows (独立执行)

**Coverage Targets**:
- Lines: ≥70% (短期)
- Functions: ≥70%
- Branches: ≥65%

**Quality Gates**:
- CI coverage gate: coverage report --fail-under=70
- Quality review gate: IMPL-001.5

## 5. Task Breakdown Summary

### Task Count
**3 tasks** (flat hierarchy, sequential execution)

### Task Structure
- **IMPL-001**: 生成 L0-L3 测试与 pytest 配置
- **IMPL-001.5**: 测试质量评审与覆盖率门槛校验
- **IMPL-002**: 修复测试失败并稳定自动化

### Complexity Assessment
- **High**: 无
- **Medium**: IMPL-001, IMPL-002
- **Low**: IMPL-001.5

### Dependencies
[Reference Section 4.3 for dependency graph]

**Parallelization Opportunities**:
- 无

## 6. Implementation Plan (Detailed Phased Breakdown)

### Execution Strategy

**Phase 1 (Week 1): 测试生成与配置**
- **Tasks**: IMPL-001, IMPL-001.5
- **Deliverables**:
  - pytest.ini 与新增 L0-L3 测试覆盖
  - 质量评审报告与覆盖率门槛确认
- **Success Criteria**:
  - pytest.ini 存在且包含覆盖率配置
  - 质量评审确认覆盖率门槛与测试范围一致

**Phase 2 (Week 2): 测试修复与稳定**
- **Tasks**: IMPL-002
- **Deliverables**:
  - 修复失败测试并确保自动化通过
- **Success Criteria**:
  - `pytest` 在指定范围内通过

### Resource Requirements

**Development Team**:
- 测试工程师 + Python 开发

**External Dependencies**:
- 无

**Infrastructure**:
- GitHub Actions

## 7. Risk Assessment & Mitigation

| Risk | Impact | Probability | Mitigation Strategy | Owner |
|------|--------|-------------|---------------------|-------|
| 覆盖率门槛不一致导致质量漂移 | High | Medium | 在 IMPL-001.5 明确门槛并同步 pytest.ini | QA |
| pytest.ini 缺失导致参数不一致 | Medium | Medium | 在 IMPL-001 补齐 pytest.ini 并记录配置 | QA |
| Mock 与实际 API 签名不一致 | Medium | Medium | 在集成测试中增加接口签名一致性校验 | QA |

**Critical Risks** (High impact + High probability):
- 无

**Monitoring Strategy**:
- 通过 CI 覆盖率与测试执行日志跟踪

## 8. Success Criteria

**Functional Completeness**:
- [ ] IMPL-001/001.5/002 的任务验收项全部达成
- [ ] L0-L3 测试清单覆盖全部关键模块

**Technical Quality**:
- [ ] Test coverage ≥70%
- [ ] pytest 配置统一且自动化可复现

**Operational Readiness**:
- [ ] CI 自动化可执行并输出覆盖率报告
- [ ] 关键验证脚本可纳入自动化

**Business Metrics**:
- [ ] 无

## Template Usage Guidelines

### Validation Checklist
- [x] All frontmatter fields populated correctly
- [x] CCW workflow context reflects actual phase progression
- [x] Brainstorming artifacts correctly referenced
- [x] Task breakdown matches generated task JSONs
- [x] Dependencies are acyclic and logical
- [x] Success criteria are measurable
- [x] Risk assessment includes mitigation strategies
- [x] All {placeholder} variables replaced with actual values
