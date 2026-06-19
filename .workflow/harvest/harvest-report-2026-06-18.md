# Harvest Report — 2026-06-18

## 摘要

| 指标 | 数值 |
|------|------|
| 扫描 artifact | 16 |
| 提取片段 | 33 |
| 重复跳过 | 6 |
| 实际路由 | 27 |
| Wiki pending | 15 |
| Spec 条目 | 6 |
| Issue 条目 | 6 |
| 标记 harvested artifact | 14 |

## 来源 Artifact 列表

1. `20260525-plan-P2-narrative-visualization-mvp`
2. `ralph-20260526-190000`
3. `20260602-plan-writing-tool-new-capabilities`
4. `20260614-review-stability`
5. `20260615-review-stability`
6. `20260614-review-consistency`
7. `20260614-debug-consistency-gaps`
8. `20260614-plan-consistency-fix`
9. `20260614-review-frontend-backend-interface`
10. `20260614-plan-interface-gaps`
11. `20260614-debug-interface-gaps`
12. `20260614-test-security-regression`
13. `20260616-analyze-test-coverage`
14. `20260616-plan-test-coverage`

## 新增 Issue（6）

| ID | 标题 | 严重度 | 优先级 |
|----|------|--------|--------|
| ISS-20260618-001 | 后端 30% MCP endpoints 无测试覆盖 | high | 2 |
| ISS-20260618-002 | 稳定性审查发现 3 个关键一致性 bug | high | 2 |
| ISS-20260618-003 | 接口一致性 8 个关键根因修复计划 | high | 2 |
| ISS-20260618-004 | 3 个 P1 架构一致性修复计划 | medium | 3 |
| ISS-20260618-005 | 安全回归测试：3 个 major 问题待修复 | high | 2 |
| ISS-20260618-006 | Knowledge API 模块应拆分为 4 个子模块 | medium | 3 |

位置：`.workflow/issues/issues.jsonl`

## 新增 Wiki Pending（15）

| 文件 | 标题 |
|------|------|
| `wiki-pending-harvest-lite-plan-20260525-p2-narrative-viz.md` | Phase 2 可视化 MVP 测试覆盖率达标 |
| `wiki-pending-harvest-lite-plan-20260525-p2-narrative-viz-readerstate.md` | ReaderState 集成张力曲线风险可控 |
| `wiki-pending-harvest-session-ralph-20260526-190000.md` | M25 里程碑全部完成：智能修订 + 会话智能 + 个性化 |
| `wiki-pending-harvest-analysis-20260616-test-coverage-store.md` | Store 层是最大测试风险点 |
| `wiki-pending-harvest-analysis-20260616-test-coverage-roadmap.md` | 四阶段测试覆盖率补救路线图 |
| `wiki-pending-harvest-lite-plan-20260616-test-coverage-baseline.md` | 实际覆盖率基线远超阈值 |
| `wiki-pending-harvest-analysis-20260614-review-stability-corr.md` | 11 个 CORR 修复全部完成 |
| `wiki-pending-harvest-analysis-20260614-review-stability-api-shape.md` | API 形状变更需同步更新四方 |
| `wiki-pending-harvest-debug-20260614-debug-consistency-gaps.md` | 10 个确认假设覆盖 7 个模块 |
| `wiki-pending-harvest-analysis-20260614-review-consistency-endpoints.md` | 65 个端点接口一致性审查结果 |
| `wiki-pending-harvest-analysis-20260614-review-consistency-envelope.md` | 系统性问题：前端类型信封不一致 |
| `wiki-pending-harvest-lite-plan-20260614-plan-interface-gaps.md` | 3 个 P0 安全缺口修复计划 |
| `wiki-pending-harvest-debug-20260614-debug-interface-gaps-rollout.md` | 安全/上下文功能推广不完整是共同根因 |
| `wiki-pending-harvest-debug-20260614-debug-interface-gaps-defense.md` | 纵深防御原则被违反 |
| `wiki-pending-harvest-analysis-20260614-review-frontend-backend-interface-workspace.md` | Workspace 上下文 3 种不同追加模式需统一 |

位置：`.workflow/harvest/`

## 新增 Spec 条目（6）

| 分类 | 标题 | 目标文件 |
|------|------|----------|
| coding | Protocol-first 执行模式验证成功 | `specs/coding-conventions.md` |
| coding | Companion pattern 测试策略规范 | `specs/coding-conventions.md` |
| coding | 系统性修复模式：前端 + 后端 + 测试同步更新 | `specs/coding-conventions.md` |
| coding | callApi 外层封装模式：禁止内层信封 | `specs/coding-conventions.md` |
| arch | 写作工具新能力开放决策 | `specs/architecture-constraints.md` |
| learning | 决策阈值不一致已修复 | `specs/learnings.md` |

## 重复跳过片段（6）

以下片段在现有 spec 或 issue 中已存在，未重复写入：

- Co-Writing Engine 三模式共享上下文管线（已存在于 `architecture-constraints.md`）
- Reader Simulation 并行双引擎架构（已存在于 `architecture-constraints.md`）
- api-evolution-test-drift（已存在于 `architecture-constraints.md`）
- 后端 MCP endpoint 测试覆盖率不足相关 issue（已有 ISS-001/ISS-002）
- 接口一致性/安全回归相关 issue（已有 ISS-016/ISS-017）

## 元数据

- 执行时间：2026-06-18
- source：`harvest`
- harvest-log：`.workflow/harvest/harvest-log.jsonl`（新增 27 条 provenance 记录）
- state.json：已标记 14 个 artifact 为 harvested

## 下一步建议

1. 审阅新增 issue：`/manage-issue list --source harvest`
2. 加载最新 spec：`/spec-load --role implement`
3. 连接 wiki 图谱：`/manage-wiki connect --fix`
4. 做全周期回顾：`/quality-retrospective`
