# Roadmap: Niko Studio Novel Quality & Reader Experience Enhancement

## Overview

基于对 Niko Studio 代码库的全面审计和头脑风暴，从"读者体验"和"写作质量"双维度出发，实现 6 大创新方向。核心思路：从"作者视角的工具"进化为"模拟读者心理的创作伙伴"。第一阶段优先实现章首钩子/章末悬念评分（网文粘性命脉）和角色声音指纹（一致性盲区），再逐步构建情感轨迹、展示讲述分析、读者代入感引擎和节奏导航器。全部基于现有 `writing-craft` / `intelligence` / `consistencyEngine` 架构扩展，无需重构。

## Phases

**Minimum-phase principle:** Default 1 phase. Only add phases for hard dependencies (runtime + not parallelizable + full barrier). Wave DAG inside each phase handles task ordering.

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases count toward the total phase limit.

- [x] **Phase 1: Novel Quality Enhancement Core** — 6 大方向 8 个任务通过 3 波次实现，扩展 writing-craft 维度 + 一致性引擎 + 分析面板

## Phase Details

### Phase 1: Novel Quality Enhancement Core

**Goal**: 实现 6 大创新方向：章首钩子/章末悬念四维评分、角色声音指纹提取与一致性检查、跨章节情感弧线可视化、Show vs Tell 五感分析与热力图、读者沉浸度状态模型与流失风险评分、节奏导航器与处方生成。全部集成到现有写作工艺分析架构。

**Depends on**: Nothing (first phase)

**Requirements**: DIR-B, DIR-C, DIR-D, DIR-E, DIR-A, DIR-F

**Success Criteria** (what must be TRUE):
1. `HookCliffhangerScorer` 对章节首尾 200 字进行四维评分（冲突暗示/信息差/感官冲击/节奏切入 + 未解问题/情感峰值/反转冲击/期待感），集成到 `WritingCraftDimension` 类型和 MCP 端点。
2. `CharacterVoiceFingerprint` 从对话中提取声音指纹（句式偏好/口头禅/正式度/情感表达倾向/修辞习惯），检测对话偏离并标注 warning。
3. `EmotionalArcTracker` 跨章节聚合情感维度评分，渲染交互式时间线，检测"张力荒漠"（连续 N 章无情感波动），匹配经典叙事曲线偏离度。
4. `ShowTellAnalyzer` 分析五感覆盖率、抽象 vs 具体比例、情感表达方式，生成段落级热力图数据。
5. `ReaderImmersionEngine` 建模读者心理状态（好奇心/情感投入/认知负荷/悬念张力/代入感），跨章节追踪并生成流失风险评分。
6. `PacingNavigator` 提供前瞻性节奏分析，生成节奏处方（高潮/转折/喘息/伏笔回收时机），与 `ForeshadowingTracker` 协同推荐伏笔收获时机。
7. 所有新模块通过 DI 注册，不修改现有核心模块公共接口。
8. 新增测试覆盖率 ≥ 80%，现有测试无回归。

## Scope Decisions

- **In scope**:
  - `src-ts/narrative/writing-craft/hook-cliffhanger-scorer.ts` — Hook & Cliffhanger 评分引擎
  - `src-ts/narrative/character-voice-fingerprint.ts` — 角色声音指纹 + 一致性检查
  - `src-ts/narrative/emotional-arc.ts` — 情感弧线时间线 + 沙漠检测 + 叙事曲线匹配
  - `src-ts/narrative/show-tell-analyzer.ts` — Show vs Tell 五感分析 + 热力图
  - `src-ts/narrative/reader-immersion-engine.ts` — 读者沉浸度状态模型 + 流失风险
  - `src-ts/narrative/pacing-navigator.ts` — 节奏导航 + 处方生成
  - MCP 端点扩展：`writing-craft.ts` 新增 `hook` / `cliffhanger` 维度
  - LLM Prompt 扩展：`writing-craft-llm.ts` 新增对应 system prompt
  - 单元测试（6 个测试文件）

- **Deferred**:
  - 编辑器内 TipTap extension 行级色彩标记（Show vs Tell 热力图可视化）
  - WritingDashboard UI 组件（EmotionalArcChart 交互式图表）
  - 实时对话一致性 warning 标注（需编辑器集成）
  - 前端面板（读者沉浸度仪表盘、节奏处方面板）

- **Out of scope**:
  - 修改现有核心模块公共接口
  - Rust/Tauri 侧变更
  - CI/CD 流程变更
  - TinyStyler 音频风格迁移

## Progress

| Phase | Status | Completed |
|-------|--------|-----------|
| 1. Novel Quality Enhancement Core | Completed | 2026-05-15 |
