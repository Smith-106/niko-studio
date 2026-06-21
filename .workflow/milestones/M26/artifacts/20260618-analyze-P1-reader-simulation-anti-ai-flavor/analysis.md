# M26 Phase 1 Analysis: Reader Simulation 2.0 + Anti-AI-Flavor Suite

## Executive Summary

M26 Phase 1 在现有 Reader Simulation Dual-Engine（M23）和 RevisionService / Style Personalization（M25）基础上，扩展读者 Persona 体系、A/B 测试、分析权重反馈、反 AI 味检测与 De-AI 重写能力。整体评估为 **GO**，置信度 **78%**。主要信心来自清晰的模块化扩展路径和已验证的 MCP endpoint 模式；主要风险来自 `/reader/analyze` endpoint 的空文本 TODO、前后端 ConsensusReport 数据契约漂移，以及自定义画像的内存缓存。

## Overall Assessment

- **Recommendation**: GO (with conditions)
- **Overall Confidence**: 78%
- **Pressure Pass**: Completed — 最高置信度发现（A/B 测试可复用 ConsensusEngine）经受住了边界/替代方案/根因检查。
- **Residual Risks**: 空文本 TODO 必须修复；数据契约需统一；自定义画像持久化建议纳入 Phase 1 但不阻塞核心交付。

## Dimension Scoring

| Dimension | Score (1-5) | Confidence | Key Evidence |
|-----------|-------------|------------|--------------|
| Feasibility | 4 | 80% | `PersonaDefinition.ts:203-207` 工厂模式易于新增 preset；`DualEngine.ts:93-110` Promise.all 便于横向加引擎；CLI 分析确认集成点清晰。 |
| Impact | 5 | 85% | 读者模拟是 niko-studio 唯一性护城河；反 AI 味直接补齐竞品 QMAI 的 De-AI 能力；中文 i18n 强化区域竞争力。 |
| Risk | 3 | 70% | 空文本 TODO (`reader-endpoints.ts:165-167`)、前后端类型漂移 (`OverlayBridge.ts:54-62` vs `ConsensusEngine.ts:23-31`)、writerFn identity (`revision-service.ts:103-105`)。 |
| Complexity | 3 | 75% | 涉及 reader/analysis/revision/i18n 四个模块联动；9 维度权重反馈需要 UI + 后端 + MCP 协同；A/B 测试需要新增 compare endpoint。 |
| Dependencies | 3 | 75% | 强依赖 M23 reader-state 模型与 M25 IRevisionService / style model；需要 workspace/manuscript 服务提供真实文本。 |
| Alternatives | 4 | 80% | Anti-AI-flavor 有独立 detector vs 新增 QualityDimension 两种方案；De-AI 有 RevisionService vs Co-Writing 两种接入；已评估并选定最小侵入方案。 |

## Risk Matrix

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| `/reader/analyze` 空文本导致功能虚假 | 高 | 高 | Phase 1 Wave 1 必须修复，接入 workspace/manuscript 服务。 |
| 前后端 ConsensusReport 漂移导致 UI 静默损坏 | 中 | 高 | 统一 `/reader/analyze` 返回后端 `ConsensusReport`，前端删除本地聚合。 |
| 自定义画像内存缓存丢失 | 中 | 中 | 纳入 Phase 1 但不阻塞；迁移到 `.niko-studio/reader-personas.json` 或 SQLite。 |
| De-AI writerFn 未实现导致 rewrite 无效果 | 中 | 高 | Plan 阶段明确 writerFn 实现任务，复用 Model Router。 |
| LLM 调用成本与超时 | 中 | 中 | 增加缓存、降级策略、timeout；第一层规则过滤减少 LLM 调用。 |

## Go/No-Go Recommendation

**GO** — 条件：
1. Phase 1 计划必须以修复 `/reader/analyze` 空文本 TODO 作为 Wave 0/Wave 1 前置任务。
2. 在 execute 之前统一前后端 ConsensusReport / OverlayMarker 数据契约。
3. 新增 anti-AI-flavor detector 保持独立，不改动 `QualityDimension` 枚举。
4. De-AI rewrite 复用 RevisionService，必须在 plan 中安排 writerFn 实现。

## Key Conclusions

1. **Persona 扩展（R-M26-001）**: 在 `PersonaDefinition.ts` 新增 4+ presets（如 `createPacingHawk`、`createAntiAIFlavorCritic`、`createYoungAdultReader`、`createWebNovelVeteran`），扩展 `parameters` 增加 `ageGroup`、`culturalBackground`、`readingPreference`、`genrePreference`、`aiFlavorSensitivity` 字段；前端 `PersonaSelector.tsx` 同步新增 preset 并调用 `/reader/personas/custom` 持久化。
2. **分析联动（R-M26-002）**: 新增 `/reader/feedback` endpoint，接收用户对某条 reader feedback 的 helpful 评价，聚合为 preference profile 后回写该 persona 的 9 维度权重；前端在 ReaderOverlay/DetailPanel 增加反馈按钮。
3. **反 AI 味检测（R-M26-003）**: 新建 `src-ts/reader/ai-flavor-detector.ts`，输出 `{ aiFlavorScore, indicators[], confidence, evidence[], suggestions[] }`；规则层检测模板化表达、风格指纹漂移、感官覆盖不足；LLM 层增强判定；通过 `/reader/ai-flavor` endpoint 暴露并在写作分析面板显示评分。
4. **De-AI / 风格变换重写（R-M26-004）**: 新增 `/reader/de-ai` endpoint，调用 anti-AI-flavor detector 生成 instructions，注入 `RevisionService.revise` 作为 `qualityGoals`；用户可在修订工作流选择「降低 AI 味」或「切换风格」模式。
5. **A/B 测试（R-M26-005）**: 新增 `/reader/compare` endpoint，请求体 `{ novelId, versionA, versionB, personaIds }`；复用 `DualEngine.analyze` 分别分析 A/B，再用 `ConsensusEngine` 做差异共识；前端新增 A/B 测试视图对比 2-3 persona 反馈。
6. **中文市场适配（R-M26-006）**: 审核 translations key，补齐 reader-simulation / anti-ai-flavor / ab-test 相关中文术语；在 webnovel 维度增强钩子、cliffhanger 检测。

## Implementation Scope for Plan

| ID | Objective | Priority | Target Modules | Acceptance Criteria |
|----|-----------|----------|----------------|---------------------|
| S1 | 修复 `/reader/analyze` 空文本 TODO | P0 | `src-ts/reader/mcp/reader-endpoints.ts`, workspace/manuscript service | `/reader/analyze` 能读取真实小说内容并返回非空分析 |
| S2 | 扩展 PersonaDefinition 与 PersonaSelector | P0 | `src-ts/reader/PersonaDefinition.ts`, `desktop/src/components/reader/PersonaSelector.tsx` | 新增 ≥4 presets，含 age/culture/genre/reading preference 字段；前端可选 |
| S3 | 统一前后端 reader API 层 | P0 | `desktop/src/api/reader.ts`, `desktop/src/components/reader/ReportGenerator.tsx` | 新建 `reader.ts` API 层，ReportGenerator 不再本地聚合 consensus |
| S4 | 实现 Anti-AI-Flavor Detector | P0 | `src-ts/reader/ai-flavor-detector.ts`, `src-ts/reader/DualEngine.ts`, `src-ts/reader/mcp/reader-endpoints.ts` | 覆盖 ≥3 种子类型，输出 confidence/evidence/suggestions，endpoint 暴露 |
| S5 | 实现 De-AI rewrite | P0 | `src-ts/services/revision-service.ts`, `src-ts/reader/mcp/reader-endpoints.ts`, `src-ts/protocols/revision.ts` | RevisionService writerFn 实现，/reader/de-ai 可返回重写文本 |
| S6 | 实现 A/B 测试 compare endpoint | P1 | `src-ts/reader/mcp/reader-endpoints.ts`, `src-ts/reader/ConsensusEngine.ts` | `/reader/compare` 接受 A/B 文本+personas，返回差异共识 |
| S7 | 实现分析权重反馈 | P1 | `src-ts/reader/mcp/reader-endpoints.ts`, `src-ts/analysis/personalized-craft-profile.ts`, `desktop/src/components/reader/DetailPanel.tsx` | `/reader/feedback` 接收反馈并回写 persona weight |
| S8 | 中文 i18n 与网文维度增强 | P1 | `desktop/src/i18n/translations*.ts`, `desktop/src/api/writing-craft.ts`, analysis dimensions | 关键术语中文覆盖，webnovel/hook/cliffhanger 维度增强 |
| S9 | 持久化自定义画像 | P2 | `src-ts/reader/mcp/reader-endpoints.ts`, persistence layer | 自定义画像进程重启不丢失 |
| S10 | 测试覆盖 ≥80% | P0 | test files | 新增功能测试覆盖率 ≥80%，现有测试无回归 |

## Confidence Summary

- **Feasibility 80%**: 集成点清晰，现有工厂/endpoint 模式可复用。
- **Impact 85%**: 直接强化核心护城河与竞品差异化。
- **Risk 70%**: 空文本 TODO 与数据契约漂移是已知高影响项。
- **Complexity 75%**: 多模块联动，但 wave DAG 可并行推进。
- **Dependencies 75%**: 依赖 M23/M25 已有能力，均已 delivered。
- **Alternatives 80%**: 已评估并选定最小侵入方案。
- **Overall 78%**: GO，前提是 Wave 0 修复空文本 TODO 与数据契约。

## Related
- [[knowhow-knw-retro-verification-green-not-healthy-2026-06-21]]
