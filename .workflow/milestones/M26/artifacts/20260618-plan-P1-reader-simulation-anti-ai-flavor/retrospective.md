# Retrospective — M26 Phase 1: Reader Simulation 2.0 + Anti-AI-Flavor Suite

> **Phase**: `PLN-20260618-m26-p1-reader-simulation-anti-ai-flavor` · **Status**: verified · **Completed**: 2026-06-19 · **Lenses**: technical · process · quality · decision

**Tweetable**: 10/10 tasks, 0 rework, 6/6 truths verified — but review surfaced 21 findings (2 high) shipped as accepted_risk with **zero issues created**. The phase shipped clean structurally yet accumulated deferred tech debt. Core wins: independent detector layer + service reuse via config injection. Core gaps: frontend/backend import leak, constant duplication, accepted_risks not tracked.

---

## Metrics

| 指标 | 值 |
|------|-----|
| tasks planned / completed / deferred | 10 / 10 / 0 |
| verification gaps | 0 |
| antipatterns / constraint_violations | 0 / 0 |
| issues opened / closed | **0 / 0** ⚠️ |
| rework iterations | 0 |
| review verdict / level | WARN / standard |
| severity (C/H/M/L/total) | 0 / 2 / 12 / 7 / 21 |
| UAT blockers | 0 |
| UAT accepted_risk (major) | 2 (CORR-003, SEC-003) |
| coverage_score | 0.85 |
| estimate planned / actual | 12h / ~2.6h (**4.6× 高估**) |

**关键张力**：verification 0-gap 的绿色与 review 21 findings 形成显著反差——结构验证通过不代表代码健康，must-have truths 未纳入边界与安全约束。

---

## Per-lens findings

### technical
- **Wins**: ① 独立 detector 层避免 enum 扩散 ② De-AI 复用 revise 注入 quality_goals ③ 统一 ConsensusReport 契约
- **Challenges**: ① ReportGenerator 跨边界 import 后端类型 ② AI 模板词双写并已 diverged ③ 2 个 high 以 accepted_risk 出货
- **Watch**: MCP singleton 阻碍测试 / 维度名 3 套命名约定 / 前端按字符串匹配而非稳定 id

### process
- **Wins**: ① 5 波顺序存活 0 rework ② collision_notes 正确串行化 6 任务共享文件 ③ 验证首次通过
- **Challenges**: ① 估算 4.6× 高估 ② TASK-001 范围静默收窄遗留 TODO ③ 2 high 延后但 0 issue
- **Watch**: 中文路径 e2e gateway 失败跨任务重复 / accepted_risk 无 issue 易丢失 / wave 编号漂移

### quality
- **Wins**: ① 高测试覆盖无回归 ② UAT 与 review 证据闭环 ③ 降级路径稳健
- **Challenges**: ① reader-endpoints.ts 跨 8 维度 findings ② 0 gaps vs 21 findings ③ 2 high 未被 verification 捕获
- **Watch**: 常量跨文件复制已发散 / MCP 输入校验三件套缺失 / 字符串匹配脆弱

### decision
- **Wins**: ① DEC-1 独立 detector 层最小侵入 ② DEC-2 复用 revise 零额外管线 ③ DEC-3 契约统一单一来源
- **Challenges**: ① DEC-1 被 MAINT-002 反噬（双写）② DEC-3 被 ARCH-001 打破（跨边界 import）③ 闭环率 84.6%
- **Watch**: 独立层决策诱导常量双写 / 契约统一被 import 捷径绕过 / WARN+0 issue 等于 finding 沉淀

---

## Distilled insights (14)

### → spec (5)

| INS | 标题 | 目标文件 |
|-----|------|---------|
| INS-67dcee40 | 新增分析轴作为独立 detector 层而非 enum 扩展，并显式指定共享常量模块 | architecture-constraints.md |
| INS-e7dac8cc | 复用 transformation service 通过 config 注入意图而非 fork | architecture-constraints.md |
| INS-d5187f08 | 前端模块只从 desktop/src/api 导入领域类型，禁止跨 desktop/src-ts 边界 | architecture-constraints.md |
| INS-1f83f679 | 共享文件多任务编辑通过 depends_on 串行化 | coding-conventions.md |
| INS-5e45e297 | MCP endpoint 强制输入校验三件套（长度/路径/数值范围） | coding-conventions.md |

### → issue (5)

| INS | issue_id | 标题 | gap_ref | 严重度 |
|-----|----------|------|---------|--------|
| INS-1f9cb386 | ISS-20260621-010 | 提取 ai-templates 共享模块消除模板词双写 | MAINT-002 | high |
| INS-d1289883 | ISS-20260621-011 | ConsensusEngine 除零 NaN 传播 | CORR-003 | high |
| INS-76ba7cb1 | ISS-20260621-012 | RevisionService LLM fetch 缺 HTTPS/超时 | SEC-003 | high |
| INS-19806c80 | ISS-20260621-013 | reader-endpoints.ts god file 拆分 | ARCH-002 | medium |
| INS-d73c23ee | ISS-20260621-014 | 修复 ReportGenerator 跨边界 import | ARCH-001 | medium |

### → note (4)

| INS | 标题 |
|-----|------|
| INS-8ab166cd | 分析功能规则优先 + LLM 增强分层，降级记录可观测日志 |
| INS-f54a8bff | 结构验证 0-gap 不代表代码健康，must-have truths 纳入边界与安全约束 |
| INS-0f0144a2 | 执行期收窄 definition_of_done 必须记入 plan deferred 列表 |
| INS-31c776c2 | 新 endpoint 前端 API 层复用 callApi/ApiResponse 包装 |

---

## Routing summary

| 路由 | 数量 | 目标 |
|------|------|------|
| spec | 5 | architecture-constraints.md ×3, coding-conventions.md ×2 |
| issue | 5 | .workflow/issues/issues.jsonl (ISS-20260621-010..014) |
| note | 4 | .workflow/knowhow/ (KNW-retro-* ×4) |
| learnings (all) | 14 | .workflow/specs/learnings.md (source=retrospective) |

**总写入**: 5 spec-entry（分类文件）+ 5 issue + 4 knowhow + 14 spec-entry（learnings.md）+ retrospective.json/md

---

## Next steps

1. `/manage-issue list --source retrospective` — 审阅 5 个新 issue，特别 3 个 high（ISS-010/011/012）
2. `/spec-load --role implement` — 加载新增 arch + coding 规范
3. 将 ISS-011/012（2 个 high accepted_risk）纳入下一阶段 must_haves，不再 drift
4. `/manage-status` — 查看状态全貌

## Related
- [[knowhow-knw-retro-rule-first-llm-enhancement-2026-06-21]]
