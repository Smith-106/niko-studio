# Roadmap: Niko Studio M25 — Intelligent Revision + Session Intelligence + Style Personalization

## Overview

M25 在 M24 稳定的基础设施上，交付三大智能化能力：(1) 激活 revision-loop 的 MCP 端点，实现多轮交叉学习修订；(2) 写作会话行为模式分析，从单会话扩展到跨会话模式挖掘；(3) 风格个性化推荐引擎，将 preference-tracker 信号转化为可操作的风格建议。三者共享新 protocol 层，形成 revision → session → personalization 的闭环。

## Phases

**Minimum-phase principle:** 三项功能间存在数据流依赖（personalization 需要 session 数据，session 需要 revision 信号），但不构成全屏障——可以并行开发 + 集成验证。单 phase + wave DAG。

- [ ] **Phase 1: Intelligent Revision & Session & Personalization** — F-008 激活 + 会话智能 + 风格个性化

## Phase Details

### Phase 1: Intelligent Revision & Session & Personalization

**Goal**: 三项能力一体化交付，形成修订→会话感知→个性化建议的智能闭环。

**Depends on**: M24 (stable workflow-engine, 3-way data integration, knowledge service)

**Requirements**: F-008, F-009, F-010

**Success Criteria** (what must be TRUE):
1. MCP `revision` 端点不再返回 placeholder，支持完整的 Critic 驱动多轮修订，含跨迭代学习
2. 写作会话智能层采集 UI 写作行为遥测（打字节奏、修订频率、回退次数），跨会话聚类和模式挖掘产出 actionable insights
3. 风格推荐引擎读取 preference-tracker 信号 + 会话模式，产出按维度的个性化修订建议（weak point detection + suggestion）
4. preference-tracker 信号持久化到 KnowledgeService（通过现有 memoryEngine bridge）
5. 新增 protocol 定义：`IRevisionService`、`ISessionIntelligence`、`IPersonalizationService`
6. 新增测试覆盖率 ≥ 80%，现有测试无回归
7. TypeScript 编译零错误

**Wave DAG (内部批次):**

| Wave | Tasks | Rationale |
|------|-------|-----------|
| W1 | T1: Revision protocol + MCP endpoint 激活 | 基础协议先建，下游依赖接口 |
| W1 | T2: Session intelligence protocol + telemetry collector | 与 T1 并行，独立协议层 |
| W2 | T3: Cross-iteration revision learning | 依赖 T1 的 protocol |
| W2 | T4: Cross-session pattern mining | 依赖 T2 的 telemetry 数据 |
| W3 | T5: Personalization protocol + recommendation engine | 依赖 T3/T4 的输出信号 |
| W3 | T6: Preference persistence bridge | 依赖 T5 + KnowledgeService |
| W3 | T7: Integration tests + regression | 全链路验证 |

## Scope Decisions

- **In scope**:
  - F-008: 智能修订工作流增强 — MCP 端点激活 + 跨迭代学习
  - F-009: 写作会话智能 — 遥测采集 + 跨会话模式挖掘
  - F-010: 写作知识个性化 — 推荐引擎 + preference 持久化

- **Deferred (M26)**:
  - 实时写作辅助（打字时即时建议）
  - 读者仿真模型增强（多读者视角）
  - 协作修订工作流（多人批注）

- **Out of scope**:
  - UI 重写或框架迁移
  - 破坏现有 MCP API 向后兼容性
  - 训练自定义 LLM 模型

## Implementation Strategies

| Strategy | Applies To | Description |
|----------|-----------|-------------|
| Protocol-first | F-008~F-010 | 先定义 interface + type，再实现 |
| 遥测注入 | F-009 | 在现有写作 UI 组件中注入轻量 event emitter |
| 信号持久化 | F-010 | preference-tracker 信号通过 CompositeKnowledgeMemoryBridge 写入 KnowledgeService |
| 渐进激活 | F-008 | MCP 端点替换 placeholder，保持旧调用路径兼容 |

## Progress

| Wave | Status | Completed |
|------|--------|-----------|
| W1 | Not started | - |
| W2 | Not started | - |
| W3 | Not started | - |