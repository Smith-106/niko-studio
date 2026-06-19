# Roadmap: M26 — Competitive Differentiation & Reader Simulation Deepening

## Overview

M26 承接 M24（技术债清理 + 叙事可视化 MVP）与 M25（智能修订 + 会话智能 + 风格个性化），聚焦竞品分析报告识别的核心机会：在 QMAI、NovelForge、AI-Novel-Writing-Assistant 等直接竞品快速迭代的背景下，深化 niko-studio 的**读者模拟**唯一护城河，并补齐**反 AI 味**能力，巩固“专业作家 AI 副驾”定位。

## Milestones

### Milestone M26: Competitive Differentiation & Reader Simulation Deepening
**Target**: 交付读者模拟 2.0 与反 AI 味能力套件，形成对 QMAI / NovelForge 的明确差异化。
**Status**: active

**Minimum-phase principle:** 默认 1 phase。M26 内部模块间存在运行时依赖（反 AI 味检测需复用 M25 风格模型，读者模拟深化需复用 M23 reader-state 模型），但可通过 wave DAG 在同一 phase 内并行推进，无需拆分。

#### Phases

- [ ] **Phase 1: Reader Simulation 2.0 + Anti-AI-Flavor Suite** — 深化读者模拟护城河，补齐反 AI 味与风格变换能力

#### Phase Details

##### Phase 1: Reader Simulation 2.0 + Anti-AI-Flavor Suite

**Goal**: 基于 M23 reader-state 模型与 M25 风格个性化能力，扩展读者模拟的多 persona 体系，并与 9 维度写作分析联动；同时引入 De-AI / 风格变换能力，降低文本“AI 味”。

**Depends on**: M23 (reader-state model, emotional arc), M25 (style personalization, IRevisionService)

**Requirements**: 
- R-M26-001: 读者 Persona 扩展（年龄、文化背景、阅读偏好、类型小说偏好）
- R-M26-002: 读者模拟与写作分析联动（读者反馈 → 分析维度权重调整）
- R-M26-003: 反 AI 味检测（模板化表达、风格指纹漂移、感官覆盖不足）
- R-M26-004: De-AI / 风格变换重写（参考 QMAI）
- R-M26-005: 读者模拟 A/B 测试（同一文本多 persona 反馈对比）
- R-M26-006: 中文市场适配优化（i18n 完整覆盖、网文维度增强）

**Success Criteria** (what must be TRUE):
1. 至少新增 4 种可配置的读者 persona，每种 persona 有独立的偏好向量和反馈生成逻辑
2. 读者模拟面板支持 A/B 测试视图，可同时对比 2-3 个 persona 的反馈
3. 反 AI 味检测覆盖 ≥3 种子类型（模板化表达、风格漂移、感官覆盖不足），并在写作分析面板显示评分
4. De-AI / 风格变换重写功能集成到修订工作流，用户可选择“降低 AI 味”或“切换风格”两种模式
5. 读者反馈可反向调整 9 维度分析中各维度的权重，形成“分析 → 模拟 → 修订”闭环
6. 中文界面关键术语与提示词完成审核，网文特定维度（钩子、 cliffhanger）增强
7. 新增功能测试覆盖率 ≥ 80%，现有测试无回归

## Scope Decisions

- **In scope**:
  - 读者 persona 扩展与 A/B 测试
  - 读者模拟与 9 维度写作分析联动
  - 反 AI 味检测（模板化表达、风格指纹漂移、感官覆盖不足）
  - De-AI / 风格变换重写
  - 中文市场 i18n 与网文维度优化

- **Deferred (M27+)**:
  - 作家 + 编辑 + AI 三方协作
  - MCP 多 Agent 协作工作流
  - Web 版本 / Obsidian 插件 / 移动端
  - 企业版多租户与 RBAC
  - 插件市场

- **Out of scope**:
  - 商业模式/许可证变更（仅做调研，不实施）
  - 重写 workflow-engine 架构
  - 多人实时协作底层
  - 跨平台框架迁移

## Implementation Strategies

| Strategy | Applies To | Description |
|----------|-----------|-------------|
| 护城河深化 | R-M26-001/002/005 | 将读者模拟从“单一反馈”升级为“多 persona + A/B 对比 + 分析联动” |
| 反 AI 味 | R-M26-003/004 | 复用 M25 风格模型，增加检测器与重写策略 |
| 闭环设计 | R-M26-002 | 读者反馈 → 分析维度权重 → 修订建议 → 验证 |
| i18n 硬着陆 | R-M26-006 | 对中文术语、提示词、网文维度做专项审核与补齐 |

## Progress

| Milestone | Phase | Status | Completed |
|-----------|-------|--------|-----------|
| M26. Competitive Differentiation | 1. Reader Simulation 2.0 + Anti-AI-Flavor Suite | active | - |

## Source

- 上游竞品分析报告：`.workflow/.maestro/maestro-20260618-034959/comprehensive-analysis-report.md`
- 访问日期：2026-06-18
