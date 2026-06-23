# Milestone: M27 — Security Hardening + Frontend Integration Completion

**Completed**: 2026-06-24
**Artifacts**: 8 (roadmap: 1, analyze: 1, plan: 2, execute: 2, review: 1, test: 1)

## Key Outcomes

### Phase 1: Security Hardening
- 创建共享输入校验模块 `src-ts/mcp/input-validation.ts`（validateStringLength / safeResolveWorkspaceRoot / validateWeight）
- 修复 3 个安全 HIGH issues：ISS-20260620-007（文本长度）、ISS-20260620-008（路径遍历）、ISS-20260620-009（数值范围）
- Reader 7 endpoint 全部添加文本长度守卫（413 Payload Too Large）
- safeResolveWorkspaceRoot 在 12 文件 11 处 endpoint/service 替换，含路径遍历拦截 + 通用错误消息
- Persona 权重 Number.isFinite + [0,1] 范围校验 + NaN fallback
- 30 单元测试 + 11 集成测试 + 22 UAT 场景全部通过

### Phase 2: Frontend Integration Completion
- 清除 desktop/src/ 全部跨边界 import，仅保留 4 个已批准桥接点
- types/narrative-visualization.ts 新建类型真相源（7 类型从 src-ts/ 下沉到 types/ 层）
- api/analysis.ts 新增 buildPersonalizedCraftProfile re-export + 语义边界注释
- DocumentEditor.tsx import 重指向 api/analysis
- 4 个测试文件 vi.mock/import 路径同步迁移
- workspace.ts + writingSessionTelemetry.ts 追加已批准桥接注释
- reader-endpoints.ts 1146 行拆分方案文档化（4 功能组，叶子优先拓扑排序）
- tsc --noEmit 0 errors + 25/25 测试通过

### Cross-Phase Integration Audit
- 0 HIGH gaps / 2 MEDIUM gaps / 2 LOW gaps
- Phase 1 HIGH gap（error propagation 500 + path leak）已通过 tryResolveWorkspaceRoot 解决
- GAP-01 (MEDIUM): chat.ts 状态码不一致（413 vs 400）
- GAP-02 (MEDIUM): ALLOW_OUTSIDE 环境变量静默跳过路径遍历检查
- 4 个已批准桥接点 grep 验收通过

## Learnings

1. **safeResolveWorkspaceRoot 替换需区分三种委托模式** — endpoint 委托 / service 委托（保留额外逻辑） / 内联替换，盲目统一破坏有附加逻辑的调用点
2. **校验模块共享后 HTTP 状态码变更需同步测试断言** — 400→413 语义更正但测试断言需 grep 同步
3. **NaN/Infinity 防御需双层：入口校验 + 内部 fallback** — 持久化数据可能在入口校验前已损坏
4. **path containment 安全重构触发批量测试 ALLOW_OUTSIDE 注入** — 14+ 测试文件 + Windows path.resolve 规范化
5. **安全加固回归验证须用 git stash 基线对照** — 区分预存失败与引入失败
6. **vi.mock 路径必须与生产 import 路径一致且测试 import 也需同步** — mockReturnValue is not a function 的根因
7. **reader-endpoints 拆分按叶子组优先拓扑排序** — B→C→A→D 最小破坏面
8. **grep 验收已批准桥接集合须动态包含本次新建桥接点** — 不能仅列 pre-existing 桥接

## Deferred to M28+
- reader-endpoints.ts 实际拆分执行（ISS-20260621-013）
- chat.ts 413/400 状态码统一（GAP-01）
- ALLOW_OUTSIDE 环境变量警告日志（GAP-02）
- workspace.ts 桥接模式重构为 types/ 真相源 + api/ wrapper（ISS-20260622-012）
- buildPersonalizedCraftProfile 升级为 MCP endpoint（ISS-20260622-011 / Option C）

## Next Milestone

Project idle — no pending milestone. Next milestone to be planned.
