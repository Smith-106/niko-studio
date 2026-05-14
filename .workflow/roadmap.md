# Roadmap: Niko Studio Intelligent Learning Capabilities

## Overview

将 Niko Studio 从「写作工具」升级为「会学习的写作伙伴」。三大核心能力——导入作品自动学习、自主进化写作、阅读中自动学习——通过共享知识层（GraphManager + KnowledgeService + DistillationManager）在单阶段内并行落地。参考 AI-Reader-V2、ACE、novel-reading-assistant、marginalia 等开源实现，全部基于现有 TypeScript 架构（`src-ts/`）集成。

## Phases

**Minimum-phase principle:** Default 1 phase. Only add phases for hard dependencies (runtime + not parallelizable + full barrier). Wave DAG inside each phase handles task ordering.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases count toward the total phase limit.

- [ ] **Phase 1: Intelligent Learning Pipelines** - 导入学习 + 自主进化 + 阅读学习三条管线并行开发，通过共享接口与知识层集成

## Phase Details

### Phase 1: Intelligent Learning Pipelines

**Goal**: 实现三大智能学习能力：导入作品自动学习（文档解析→实体/风格/世界观提取→知识图谱沉淀）、自主进化写作（Generator-Reflector-Curator 反思循环→风格规则演化→偏好追踪）、阅读中自动学习（会话追踪→章节门控→轻/重提取→洞察蒸馏→交叉引用）。通过 MCP 端点暴露给桌面前端。

**Depends on**: Nothing (first phase)

**Requirements**: CAP-001, CAP-002, CAP-003

**Success Criteria** (what must be TRUE):
1. `ImportLearningPipeline` 接受 TXT/MD/PDF/DOCX 输入，自动提取实体、风格特征（30 维）、世界观元素并写入 GraphManager，关键路径有单元测试覆盖。
2. `SelfEvolvingWritingAgent`（Generator-Reflector-Curator）在写作过程中积累反馈证据，证据阈值≥3 时自动演化风格规则，`StyleDriftDetector` 可检测并报告风格漂移。
3. `ReadingLearningPipeline` 通过章节门控（SpoilerGate）分轻/重两级提取，蒸馏结果写入知识图谱，支持 `CrossReference` 跨作品引用。
4. 三条管线均通过 DI Container 注册（inversify），可独立启用/禁用，不修改现有核心模块（narrative/memory/graph）的公共接口。
5. 新增 MCP 端点（`POST /import/learn`、`POST /writing/evolve`、`POST /reading/learn`、`GET /learning/status`）注册到 `mcp/endpoints/index.ts`。
6. `src-ts/` 下新增模块的测试覆盖率≥80%，`npm --prefix src-ts run check:local` 通过。

## Scope Decisions

- **In scope**:
  - `src-ts/learning/` 目录：三条管线的核心实现（import-pipeline、self-evolving-agent、reading-pipeline）
  - 共享基础设施：`learning-types.ts`（类型定义）、`learning-orchestrator.ts`（管线协调）、`extraction-utils.ts`（提取工具）
  - 风格规则演化器：`rule-evolver.ts`（证据阈值规则）、`preference-tracker.ts`（偏好追踪）
  - 阅读学习专用：`spoiler-gate.ts`（章节门控）、`insight-distiller.ts`（洞察蒸馏）
  - MCP 端点扩展：`src-ts/mcp/endpoints/learning.ts`
  - DI Container 注册：`src-ts/container/` 扩展
  - 单元测试与集成测试

- **Deferred**:
  - TinyStyler 音频风格迁移（需 native 依赖，单独评估）
  - BookNLP 级别的深层 NLP 管线（可作为未来增强）
  - 前端 UI 面板（Learning Dashboard、进度展示、手动触发）——本阶段只提供 API
  - 跨作品知识迁移（CrossBookTransfer）——需单作品学习稳定后再开启

- **Out of scope**:
  - 修改现有核心模块（narrative/、memory/、graph/）的公共接口——仅通过继承/组合扩展
  - Rust/Tauri 侧变更
  - CI/CD 流程变更
  - 前端 React 组件

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Intelligent Learning Pipelines | Not started | - |
