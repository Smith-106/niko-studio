---
slug: harvest-stale-brn-20260517-m24-milestone-direction
title: Brainstorm: M24 milestone direction - tech debt cleanup + narrative visualization.
type: note
tags: harvest,stale,brainstorm,M24
source: harvest
source_ref: BRN-20260517-m24-milestone-direction
created_at: 2026-06-17T23:39:47.995Z
---

# Guidance Specification: M24 Milestone Direction

## 1. Project Positioning & Goals

Niko Studio 是一款 AI 驱动的桌面小说写作工具（Electron + TypeScript），已完成 M10-M23 共 14 个里程碑。当前版本 v9.26.1，具备完整的叙事分析引擎、写作技巧知识库、读者体验评估、智能学习能力和云同步功能。

**M24 目标**：在 M23 功能完备的基础上，通过技术债清理提升代码健康度，同时探索高价值新功能方向，为下一阶段产品演进奠定基础。

**成功标准**：
- 技术债项完成率 ≥ 80%
- 无回归（所有现有测试通过）
- 至少 1 个新功能方向进入可交付状态

## 2. Concepts & Terminology

| Term | Definition | Category |
||-|
| Console 收口 | 将散落的 `console.*` 调用统一收口到结构化 logger | technical |
| 巨型组件 | 超过 1500 行的 React 组件，违反单一职责原则 | technical |
| craft-catalog | 写作技巧维度的静态数据目录，当前内嵌于代码 | core |
| workflow-engine | 工作流执行引擎，管理分析任务的编排与状态 | core |
| 逻辑下沉 | 将 UI 层混入的业务逻辑移至 service/hook 层 | technical |
| translations 拆分 | 将 2892 行的单体翻译文件按模块拆分 | technical |
| as any | TypeScript 类型断言逃逸，削弱类型安全 | technical |
| 读者体验模型 | M23 新增的 reader-state + hook/cliffhanger 分析能力 | core |

## 3. Non-Goals (Out of Scope)

- MUST NOT 重写现有工作流引擎架构（仅重构，不重建）
- MUST NOT 引入新的 UI 框架或状态管理库
- MUST NOT 破坏现有 API 接口的向后兼容性
- SHOULD NOT 在本里程碑引入多人协作功能（复杂度过高）
- SHOULD NOT 更换 Electron 为其他框架（风险过大）

## 4. Technical Debt Inventory

### 4.1 Console 收口（前端）
- **现状**: 后端已完成，前端 17 个文件仍有 `console.*` 直接调用
- **影响**: 
