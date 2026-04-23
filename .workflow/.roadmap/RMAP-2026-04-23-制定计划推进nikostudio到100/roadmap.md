# Requirement Roadmap

**Session**: RMAP-2026-04-23-制定计划推进nikostudio到100
**Requirement**: 制定计划推进nikostudio到100%
**Strategy**: progressive
**Status**: Ready
**Created**: 2026-04-23T22:44:00+08:00

---

## Original Goal
- 以可验证方式将 niko-studio 推进到“100%完成态”（不仅功能可用，还要治理与可持续达成）。
- 保持现有发布 GO 质量门禁能力，同时收敛剩余治理风险（恢复并发、契约单源、可观测闭环）。
- 将“100%”定义转化为可执行 issue 队列与波次推进路径。

---

## Strategy Assessment

- **Uncertainty Level**: medium-high
- **Decomposition Mode**: progressive
- **Assessment Basis**: 现有 release-check 为 GO，但分析结论仍有治理类高优缺口；“100%”目标包含定义统一、风险收敛、持续化三层目标，适合按波次渐进收敛。
- **Goal**: 从“当前可发布”推进到“可证明100%且可持续保持100%”。
- **Constraints**: 不破坏现有主链路稳定性；每波都必须可验证；依赖关系清晰无环。
- **Stakeholders**: 开发维护者、发布责任人、质量治理责任人。

> **Decision**: Decomposition strategy — progressive
> - **Context**: 目标跨越“定义→落地→持续化”，存在中高不确定性（治理边界与验证口径）。
> - **Options considered**: progressive (MVP→iterations) / direct (topological)
> - **Chosen**: progressive — **Reason**: 可先锁定验收口径与高风险缺口，再逐波扩展到质量体系与持续治理，降低一次性重规划风险。
> - **Impact**: 采用 4 waves（MVP / Usable / Refined / Optimized）推进。

---

## Current Understanding (Final)

### What We Established
- 当前仓库已具备发布 GO 基线（release-check-summary 为 GO，关键 P0 checks PASS）。
- “100%”下一步关键不是新增功能，而是治理闭环：恢复并发/原子性、runtime与契约单源、观测闭环、质量可度量与持续巡检。

### What Was Corrected
- ~~100% = 所有功能都已完成~~ → **100% = 功能闭环 + 治理风险收敛 + 自动化验收口径 + 持续达成机制**。

### Roadmap Health
- **Issues**: 9
- **Waves**: 4
- **Confidence**: high（基于既有分析结论 + 已创建issue + 依赖拓扑清晰）

---

## Roadmap

| Wave | Issue ID | Layer | Goal | Priority | Dependencies |
|------|----------|-------|------|----------|--------------|
| 1 | ISS-20260423-001 | MVP | 100%验收口径与门禁统一 | 1 | - |
| 1 | ISS-20260423-002 | MVP | 恢复/回滚并发与状态原子性补齐 | 1 | ISS-20260423-001 |
| 2 | ISS-20260423-003 | Usable | workflow runtime 与 workspace 契约单一事实源收敛 | 2 | ISS-20260423-001 |
| 2 | ISS-20260423-004 | Usable | 可观测闭环落地（metrics+tracing） | 2 | ISS-20260423-001 |
| 3 | ISS-20260423-005 | Refined | 测试分层与质量门槛体系化 | 2 | ISS-20260423-002, ISS-20260423-003 |
| 3 | ISS-20260423-006 | Refined | 发布就绪与100%达成看板（scorecard+自动判定） | 2 | ISS-20260423-001, ISS-20260423-004, ISS-20260423-005 |
| 3 | ISS-20260423-008 | Refined | 知识层持久化策略与完成态校验 | 2 | ISS-20260423-003, ISS-20260423-004 |
| 3 | ISS-20260423-009 | Refined | 文档-路由一致性自动校验（防漂移） | 2 | ISS-20260423-001, ISS-20260423-004 |
| 4 | ISS-20260423-007 | Optimized | 100%持续达成治理（回归基线自动巡检） | 3 | ISS-20260423-006 |

---

## Convergence Criteria

### ISS-20260423-001: [MVP] 100%验收口径与门禁统一
- **Criteria**: 形成单一 scorecard（功能/测试/发布/治理）并在仓库可追溯。
- **Verification**: 运行 release check + issue pending 检查 + 关键回归集。
- **Definition of Done**: 团队可用同一套标准判断“是否100%”。

### ISS-20260423-002: [MVP] 恢复/回滚并发与状态原子性补齐
- **Criteria**: 并发恢复无跨会话污染；失败态不出现伪成功状态。
- **Verification**: workflow-engine integration tests 覆盖并发/失败分支并通过。
- **Definition of Done**: 恢复能力在故障场景下可预测、可审计。

### ISS-20260423-003: [Usable] runtime与契约单源收敛
- **Criteria**: service 不再直接构建 runtime；前后端契约一致并有快照测试。
- **Verification**: grep 零残留 + 契约一致性测试全绿。
- **Definition of Done**: 调用路径与契约语义单源可追溯。

### ISS-20260423-004: [Usable] 可观测闭环
- **Criteria**: 关键链路有可聚合指标与可追踪 trace id。
- **Verification**: 指标输出校验 + 关键请求 trace 贯穿测试。
- **Definition of Done**: 故障定位可定位到具体链路节点。

### ISS-20260423-005: [Refined] 测试质量体系化
- **Criteria**: 输出分层/flake/mutation 质量报告并有门槛。
- **Verification**: CI 产出并可追溯。
- **Definition of Done**: 测试质量可持续观测并驱动改进。

### ISS-20260423-006: [Refined] 100%达成看板自动判定
- **Criteria**: 一次命令可输出当前完成度与阻塞项。
- **Verification**: 本仓运行并生成可复核报告。
- **Definition of Done**: 团队日常可据此判断是否达到100%。

### ISS-20260423-007: [Optimized] 持续达成治理
- **Criteria**: 周期巡检可自动发现回退并给出修复路径。
- **Verification**: 演练一次故意回退并验证告警与拦截。
- **Definition of Done**: 100%状态可持续维护而非一次性达成。

### ISS-20260423-008: [Refined] 知识层持久化策略与完成态校验
- **Criteria**: KnowledgeService 持久化模式与回退策略文档化并通过验证。
- **Verification**: 持久化启停/故障回退测试 + 集成回归通过。
- **Definition of Done**: 知识能力在重启/故障后保持一致行为。

### ISS-20260423-009: [Refined] 文档-路由一致性自动校验（防漂移）
- **Criteria**: 文档声明关键路由与实际注册路由自动对齐校验。
- **Verification**: CI 校验脚本 + 漂移样例测试。
- **Definition of Done**: 关键路由文档与实现长期保持一致。

---

## Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| 把“100%”误解为仅功能完成，忽略治理闭环 | High | Wave1 先冻结验收口径（ISS-20260423-001） |
| 并发恢复/回滚故障在高压场景复现困难 | High | 把并发与失败态注入纳入固定回归（ISS-20260423-002） |
| 观测闭环落地后噪声过高影响使用 | Medium | 先定义最小关键维度，再逐步扩展（ISS-20260423-004） |
| 质量指标采集引入维护负担 | Medium | 先关键模块试点 mutation，避免全量铺开（ISS-20260423-005） |

---

## Goal Coverage (Post-Decomposition)

| # | Original Goal Aspect | Status | Addressed By | Notes |
|---|---------------------|--------|--------------|-------|
| 1 | 定义并证明“100%完成态” | ✅ Covered | ISS-20260423-001, ISS-20260423-006 | 口径+自动判定双重保障 |
| 2 | 收敛已识别治理风险 | ✅ Covered | ISS-20260423-002, ISS-20260423-003, ISS-20260423-004, ISS-20260423-008, ISS-20260423-009 | 对齐既有分析中的高优风险 + 新扫描发现 |
| 3 | 建立可持续达成机制 | ✅ Covered | ISS-20260423-007 | 防止后续回退 |
| 4 | 保持发布稳定性 | 🔄 Partially | 全波次共同约束 | 需执行期持续验证 |

---

## Final Goal Coverage Matrix

| # | Original Goal Aspect | Status | Addressed By | Notes |
|---|---------------------|--------|--------------|-------|
| 1 | 100%口径可验证 | ✅ Covered | ISS-20260423-001, ISS-20260423-006 | |
| 2 | 高风险治理项收敛 | ✅ Covered | ISS-20260423-002, ISS-20260423-003, ISS-20260423-004, ISS-20260423-008, ISS-20260423-009 | |
| 3 | 长期持续达成 | ✅ Covered | ISS-20260423-007 | |
| 4 | 发布稳定不回退 | 🔄 Partially | ISS-20260423-005, ISS-20260423-006, ISS-20260423-007 | 依赖执行期验证 |

## Decision Trail

| Phase/Round | Decision | Outcome |
|-------------|----------|---------|
| Phase 1 | 选择 progressive | 4 waves 逐层收敛 |
| Phase 2 | 以治理缺口为主线分解 | 创建 7 个 issues |
| Phase 3 | 用户确认“路线图+执行” | 进入可执行 handoff |
| Phase 3.5 | 用户要求纳入共享扫描新发现 | 追加 ISS-20260423-008 / ISS-20260423-009 |
| Phase 4 | 输出按 wave 的 issue 依赖图 | 可直接交给 team-planex |

---

## Iteration History

### Round 1 - 2026-04-23T22:44:00+08:00

**User Feedback**: 目标为“制定计划推进到100%”，执行方式选择“路线图+执行”，策略选择“Progressive”。
**Changes Made**: 从分析结论收敛为 4-wave issue 路线图，创建并关联 issue 依赖。
**Status**: approved

> **Decision**: 以“治理收敛优先”定义 100% 路径
> - **Context**: 当前版本发布信号为 GO，但已有分析揭示治理缺口。
> - **Options considered**: 功能扩展优先 / 治理收敛优先
> - **Chosen**: 治理收敛优先 — **Reason**: 更直接对齐“100%可验证、可持续”。
> - **Impact**: wave-1/2 聚焦高风险治理项，wave-3/4 完成体系化与持续化。

**Narrative Synthesis**:
**起点**: 基于现有开发状态分析与 release GO 证据，本轮从“如何把可发布升级为可证明100%”切入。
**关键进展**: 完成 progressive 分解并落地 7 个 issues，形成从口径定义到持续巡检的全链路。
**决策影响**: 采用治理优先策略，避免误把“100%”简化为功能堆叠。
**当前理解**: 路线图已稳定，可直接进入 wave 执行。

### Round 2 - 2026-04-23T22:59:30+08:00

**User Feedback**: 基于新增模块扫描结果，要求追加 2 个 issue 后再继续执行。
**Changes Made**: 新增 wave-3 两个 refined issue（知识层持久化、文档-路由一致性校验），并更新 goal coverage 与 decision trail。
**Status**: approved

> **Decision**: 吸收 shared-discovery 的高价值发现进入路线图
> - **Context**: 新扫描指出知识层持久化完成态不明确、文档与路由可能发生后续漂移。
> - **Options considered**: 保持原 7 issue / 先专项深挖 / 追加 2 issue
> - **Chosen**: 追加 2 issue — **Reason**: 两项直接影响“100%完成态”的可持续可信度，且依赖关系清晰、可并入 wave-3。
> - **Impact**: issue 总数从 7 提升到 9，策略不变，执行链可继续。

**Narrative Synthesis**:
**起点**: 基于 Round 1 已稳定路线图，本轮从“新证据是否改变完成定义”切入。
**关键进展**: 将 shared-discovery 中最关键的两项缺口结构化落地为可执行 issue。
**决策影响**: 保持 progressive 主线不变，仅增强 Refined 波次的治理完备度。
**当前理解**: 路线图完整性提升，后续进入执行更稳健。

---

## Codebase Context (Optional)

- **Relevant Modules**:
  - `src-ts/workflow/*`（恢复/回滚核心链）
  - `src-ts/mcp/*`（gateway/request-handler/observability链）
  - `desktop/src/types/workspace.ts` + `src-ts/project/workspace-model.ts`（契约一致性）
  - `src-ts/tests/*` + `desktop/src/**/*.test.tsx`（测试分层与回归）
- **Existing Patterns**: 现有 release gate 与 evidence 机制完整，适合作为 100% scorecard 基线。
- **Integration Points**: workflow service ↔ engine，request handler ↔ endpoint/service，frontend workspace types ↔ backend model。
