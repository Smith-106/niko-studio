# Roadmap: Niko-Studio M18 — Knowledge Expansion + UX Enhancement + LLM Analysis

## Overview

M13-M17 构建了完整的写作知识引擎和 UI 集成。M18 从三个方向扩展：(1) 继续挖掘剩余写作书籍覆盖知识盲区，(2) 增强 UI 交互体验（内联标注、趋势图、导出），(3) 将关键词检测升级为 LLM 驱动的深度分析。三者相互独立，通过 Wave 并行执行。

## Phases

- [ ] **Phase 1: Knowledge Expansion + UX Enhancement + LLM Analysis** — 三方向并行推进，扩展知识引擎覆盖面、提升 UI 交互质量、引入 LLM 深度分析能力

## Phase Details

### Phase 1: Knowledge Expansion + UX Enhancement + LLM Analysis
**Goal**: 完成剩余书籍知识挖掘、UI 交互增强、LLM 分析集成，让写作分析系统从关键词检测进化为智能写作助手。
**Depends on**: M17 (completed)

**Requirements**:
- REQ-001: 剩余书籍知识挖掘 — 剧本游戏、游戏叙事、漫画叙事、实用指南、评论写作、口头叙事
- REQ-002: 编辑器内联标注 — 在编辑器中直接标注分析问题位置
- REQ-003: 跨章节趋势分析图 — 可视化展示各维度分数跨章节变化
- REQ-004: 分析结果导出 — 支持 Markdown 报告导出
- REQ-005: LLM 增强分析 — 用 LLM 替代/增强关键词检测，提供深度写作建议

**Success Criteria** (what must be TRUE):
1. 新增 6 本写作书的知识模块，每个遵循 enum+interface+Record 模式
2. 编辑器中问题文本位置有可视化标注，点击可查看详情
3. 多章节分析后显示趋势折线图，可按维度筛选
4. 一键导出完整分析报告为 Markdown 文件
5. 至少 3 个维度支持 LLM 深度分析模式，返回比关键词检测更具体的建议
6. 所有新增功能有对应测试覆盖

## Scope Decisions

- **In scope**:
  - 6 本写作书知识挖掘（剧本游戏、游戏叙事、漫画叙事、实用指南、评论写作、口头叙事）
  - 编辑器内联标注（Tiptap decorator/extension）
  - 跨章节趋势图（简单折线图组件）
  - Markdown 报告导出
  - LLM 增强分析（对 3+ 维度的 LLM 深度分析 prompt 设计 + API 集成）

- **Deferred**:
  - PDF 导出（后续接入 PDF 渲染库）
  - 自定义分析模板（用户选择检测维度组合）
  - 实时协作分析
  - 多语言分析（当前仅中文）

- **Out of scope**:
  - Plugin/extension 架构
  - 云同步 / 多设备支持
  - Code signing

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Knowledge Expansion + UX Enhancement + LLM Analysis | Not started | - |
