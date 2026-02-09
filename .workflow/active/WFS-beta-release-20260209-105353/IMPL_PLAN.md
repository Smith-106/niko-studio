# Niko-Studio Beta 版本实施计划

**Session**: WFS-beta-release-20260209-105353
**Created**: 2026-02-09
**Target**: Beta Release (测试覆盖率 ≥ 60%)

---

## 📊 当前状态

| 模块 | 完成度 | 状态 |
|------|--------|------|
| P1-P5 Core | 100% | ✅ 完成 |
| P6 Knowledge Layer | 85% | ⚠️ 需验证 |
| P7-P9 Services | 90% | ⚠️ 需验证 |
| 测试覆盖率 | 45% | ❌ 需提升至 60% |

---

## 🎯 实施阶段

### Stage 1: 异步初始化修复 (优先级: P0)

**目标**: 修复 async-init-fix 分支问题，确保 ServiceManager 正确初始化

**任务**:
- IMPL-001: 审查 ServiceManager.initialize() 调用点
- IMPL-002: 添加异步初始化验证测试

**验收标准**:
- 所有服务启动时正确 await initialize()
- 无运行时 "service not initialized" 错误

---

### Stage 2: 测试覆盖率提升 (优先级: P0)

**目标**: 从 45% 提升至 60%+

**任务**:
- IMPL-003: P7 服务测试套件 (ServiceManager, LLM, Embedding)
- IMPL-004: P6 知识层测试 (GraphEngine, HybridSearch)
- IMPL-005: 端到端工作流测试
- IMPL-006: 集成测试补充

**验收标准**:
- pytest --cov 报告 ≥ 60%
- CI 测试全部通过

---

### Stage 3: 集成验证 (优先级: P1)

**目标**: 确认 P6-P9 模块集成完整性

**任务**:
- IMPL-007: 验证 StoreManager 实现
- IMPL-008: 验证 Reranker 策略集成
- IMPL-009: 验证多 Provider fallback 机制

**验收标准**:
- 所有集成点有对应测试
- 无模块间调用错误

---

### Stage 4: 文档与发布准备 (优先级: P2)

**目标**: Beta 版本发布准备

**任务**:
- IMPL-010: 更新 README 和 API 文档
- IMPL-011: 配置 CI 覆盖率报告
- IMPL-012: 创建 Beta Release Notes

**验收标准**:
- 文档与代码同步
- CI 流水线绿色

---

## 📋 任务依赖图

```
IMPL-001 (异步修复)
    ↓
IMPL-002 (初始化测试)
    ↓
┌───┴───┬───────┬───────┐
↓       ↓       ↓       ↓
IMPL-003 IMPL-004 IMPL-005 IMPL-006
(P7测试) (P6测试) (E2E)   (集成)
    └───────┴───────┴───────┘
              ↓
    ┌─────────┴─────────┐
    ↓         ↓         ↓
IMPL-007  IMPL-008  IMPL-009
(Store)   (Rerank)  (Provider)
    └─────────┴─────────┘
              ↓
    ┌─────────┴─────────┐
    ↓         ↓         ↓
IMPL-010  IMPL-011  IMPL-012
(文档)     (CI)      (Release)
```

---

## ⏱️ 预估工时

| Stage | 任务数 | 预估时间 |
|-------|--------|----------|
| Stage 1 | 2 | 0.5 天 |
| Stage 2 | 4 | 2 天 |
| Stage 3 | 3 | 1 天 |
| Stage 4 | 3 | 0.5 天 |
| **总计** | **12** | **4 天** |

---

## 🚀 执行命令

```bash
# 执行任务
/workflow:execute --session WFS-beta-release-20260209-105353

# 查看状态
/workflow:status --session WFS-beta-release-20260209-105353
```
