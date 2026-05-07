# Roadmap: Niko-Studio M17 — Writing Intelligence UI Integration

## Overview

M13-M16 构建了强大的写作知识引擎（20+ 检测函数、35+ 本写作书覆盖），但这些能力停留在 TypeScript 分析层，用户无法通过 UI 访问。M17 将这些知识引擎暴露为可用的分析面板：用户选择文本 → 一键获得多维度写作质量分析 → 获得可操作建议。

## Phases

- [ ] **Phase 1: Writing Craft API Bridge + Analysis Dashboard** — 将 M13-M16 检测函数桥接到 UI 层，创建统一的写作分析面板

## Phase Details

### Phase 1: Writing Craft API Bridge + Analysis Dashboard
**Goal**: 用户可以在桌面端选择文本，一键获得 6 大维度写作质量分析（结构、角色、悬疑、情感、对话、网文专项），每个维度展示分数、证据和改进建议。
**Depends on**: M13-M16 (completed)

**Requirements**:
- REQ-001: Writing Craft API 端点 — 将 20+ 检测函数封装为 HTTP 端点
- REQ-002: 统一分析结果格式 — 标准化所有检测函数的返回结构
- REQ-003: Writing Dashboard 面板 — 桌面端写作分析主面板
- REQ-004: 6 维度分析标签页 — 结构/角色/悬疑/情感/对话/网文 6 个分析维度
- REQ-005: 分数可视化 — 每维度 0-10 分 + 进度条 + 色标
- REQ-006: 证据和建议面板 — 每维度展示检测到的证据和改进建议
- REQ-007: 反面模式警告 — 在分析中突出显示严重反面模式

**Success Criteria** (what must be TRUE):
1. 用户选择章节文本 → 点击"写作分析"→ 6 秒内获得完整分析结果
2. 结构维度显示：三幕/Snyder/Truby/Edson 节拍对齐度 + 反面模式检测
3. 角色维度显示：角色弧线评估 + OCEAN 画像 + 角色创造质量 + 情节人物平衡
4. 悬疑维度显示：叙事技巧密度 + 推理逻辑链 + 悬疑子类型 + 金字塔检测
5. 情感维度显示：Show/Tell 比率 + 情感层次丰富度 + 描写质量评估
6. 对话维度显示：潜台词丰富度 + 冲突驱动 + 角色声音区分度
7. 网文维度显示：升级体系检测 + 金手指分析 + 爽感曲线
8. 每个维度至少 1 条可操作建议，严重问题用红色标记

## Scope Decisions

- **In scope**:
  - Writing Craft API 桥接层（desktop/src/api/writing-craft.ts）
  - 统一结果格式化器
  - WritingDashboard 组件（6 标签页）
  - 分数可视化组件（MetricValue + ProgressBar 复用）
  - 证据/建议列表组件
  - 反面模式警告组件
  - 端到端测试（API → 组件）

- **Deferred**:
  - 实时编辑器内联标注（在编辑器中直接标注问题位置）
  - 历史趋势（跨章节分析趋势图）
  - 分析结果导出（PDF/Markdown 报告）
  - 自定义分析模板（用户选择检测哪些维度）
  - LLM 增强分析（当前用关键词检测，后续接入 LLM 深度分析）

- **Out of scope**:
  - 新建独立的 Web UI（使用现有 Tauri 桌面端）
  - 后端知识库扩展（M13-M16 已完成）
  - 多语言分析（当前仅中文）

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Writing Craft API Bridge + Analysis Dashboard | Not started | - |
