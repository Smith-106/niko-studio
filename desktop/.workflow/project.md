# Project: Niko-Studio Desktop

## What This Is

Niko Studio 是一款面向中文作家的本地 AI 写作助手桌面应用，核心是富文档编辑器（TipTap）与 AI 聊天/Agent 工作流的深度集成，通过本地 Node.js 网关提供隐私安全的写作体验。目标用户是进行长篇创作的中文小说作家，不依赖云端 SaaS。

## Core Value

**AI 写作闭环**：文档编辑器与聊天/Agent 草稿管线必须通过本地网关稳定连接。如果这条链路断裂，产品核心价值归零。

## Requirements

### Validated

<!-- 已交付并验证有价值的功能 -->

- TipTap 富文档编辑器（Slash 命令、气泡工具栏、内联 AI 重写/生成）
- 多模型 AI 聊天（流式输出、Skill 选择、L1–L5 工作流级别控制）
- Agent 模式：write / revise / context-fetch，全部流式写入编辑器
- Story Bible / 知识库（本地图谱 + 记忆检索）
- 大纲生成器 + 修改技能包（运行时从 `skills/` 加载）
- 双语 UI（zh-CN / en-US）+ i18n 框架
- Cherry Studio 风格作曲家工具栏 + 模式切换（M1 交付）
- 跨面板布局一致性和交互状态标准化（M1 交付）
- WCAG 2.1 无障碍访问修复（M1 交付）
- 结构化错误分类 + 自动重试恢复（M1 交付）
- 知识图谱完整 CRUD（角色/地点/情节 + 删除确认 + 重命名）（M1 交付）

### Active

<!-- 当前正在构建的目标（交付前都是假设） -->

- [ ] 向量嵌入语义搜索 — 知识图谱实体的混合检索（关键词 + 向量相似度）
- [ ] 输入框富文本附件 — 图片/文件拖拽上传到聊天输入区
- [ ] Skill 标签页 CRUD — 创建、编辑、重命名、删除技能包
- [ ] L4/L5 工作流可靠性 — 多轮头脑风暴、多步协调器、并发会话压力测试
- [ ] 代码清理 — 移除废弃引用、完善类型定义

### Out of Scope

- 云端同步 / SaaS 化 — 核心定位是本地隐私优先，不引入云存储
- 多用户协作 — 单用户桌面工具，不设计协作层
- 通用文档处理（PDF 批注、表格等）— 聚焦长篇小说创作场景

## Context

- **版本**: 9.2.5（成熟产品，持续迭代中）
- **前端**: React 18 + TypeScript + Vite + Zustand + TailwindCSS
- **桌面壳**: Tauri 2 / Rust
- **网关**: Node.js + TypeScript (`src-ts/`)，本地 SQLite 向量库（fastembed + better-sqlite3）
- **测试**: Vitest + React Testing Library，852 测试用例

## Constraints

- **本地优先**: 所有 AI 推理和知识存储均走本地网关，不直接调用外部 API
- **向后兼容**: 现有功能不得破坏，每次变更需保持测试全绿
- **Tauri 2 签名构建**: 发布流程依赖 Tauri 2 + code signing，需注意 CI/CD 路径

## Tech Stack

- **Language**: TypeScript (前端 + 网关), Rust (Tauri 壳)
- **Framework**: React 18 + Tauri 2 + TipTap
- **Database**: better-sqlite3（本地知识库 + 记忆），.writing/memory.db / graph.db

## Milestone History

### M1: UX & Stability Sprint (completed 2026-05-03)

Two-phase sprint delivering frontend UX polish and backend stability/knowledge CRUD. 21 tasks across 4 plans, 852 tests passing, 0 critical/high review findings.

**Phase 1 deliverables**: Composer toolbar, cross-panel layout consistency, WCAG a11y fixes, draft persistence with debounce+cancel pattern.

**Phase 2 deliverables**: Structured error classification with auto-retry, error class badge UI, full CRUD for Character/Location/Plot knowledge entries with extra fields, delete-with-confirmation, rename fix for graph node dedup.

**Key patterns established**: Inline makeDebounce with cancel, local-variable retry tracking in React useCallback, MATCH+SET-before-MERGE for safe graph renames, `<span role="status">` for screen reader announcements.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 本地 Node.js 网关替代 Python sidecar | 启动速度、TypeScript 一致性、更易调试 | 已上线 v9.x |
| Cherry Studio 风格工具栏 | 更紧凑、减少模式切换摩擦 | 已完成（v9.2.5） |
| `DESTRUCTIVE_STEP_NAMES` 移除 checkpoint | checkpoint 误触 No-Go 横幅影响正常工作流 | 已修复（v9.2.5） |
| `showAdvancedControls` 默认折叠 | 减少初始 UI 噪音，高级控件按需展开 | 已完成（v9.2.5） |

## Stakeholders

- 主要用户: 中文长篇小说作家（个人用户）
- 开发者: Niko（sole developer）

---
*Last updated: 2026-05-02 after brownfield init*
