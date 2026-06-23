# Debug: interface-consistency-gaps

## Status
resolved

## Issue
前后端接口一致性问题：8 个 critical 响应形状不匹配 + 12 个 workspace context 丢弃 + 多个语义默认值不匹配

## Symptoms
- 前端 knowledge.ts 5 个函数返回类型含内层 `{ success, data: T }` 封装，但 `callApi` 已提供外层封装 → `result.data.data` 为 undefined
- `novelQualityCheck` 期望 `decision` 字段但后端从不返回
- `detectPatterns`/`clusterSessions` 前端期望 `{ success, data }` 封装但后端返回裸数组
- `getStyleProfile` 返回 null 但前端类型为 `Record<string, unknown>`
- `listSkills` 前端期望扁平数组但后端返回 `{ skills: [] }`
- `PluginResult` 前后端类型完全不同
- `registerPlugin` 期望 `{ id, status }` 但后端返回 `{ id, name }`
- story-bible CREATE/UPDATE 的 workspace 数据泄漏到实体存储
- foreshadowStats 后端完全忽略 workspace header
- 多个 M10 端点前端发送 workspace 但后端不读取

## Hypotheses

### H1: 前端类型系统存在两层 { success, data } 封装不一致 [CONFIRMED]
**证据**: `callApi` (core.ts) 在 2xx 响应时将原始 body 封装为 `{ success: true, data: rawBody }`。knowledge.ts 的 5 个函数额外在泛型参数中嵌套了 `{ success: boolean; data: T }`，导致运行时出现双层封装。而同模块的 `queryGraph`、`getCharacter`、`getForeshadows` 正确使用 `ApiResponse<T>` 其中 T 是原始 body 形状。

**根因**: knowledge.ts 的 foreshadow/character 端点函数在定义时错误地在泛型参数中添加了 `{ success, data: T }` 封装。正确模式参考同文件 `queryGraph: ApiResponse<unknown[]>` — T 是裸数据，封装由 callApi 提供。

**影响函数**: plantForeshadow, getForeshadowStats, analyzeCharacterDepth, getCharacterProfile, getCharacterRelationships

**修复方向**: 将 `ApiResponse<{ success: boolean; data: T }>` 改为 `ApiResponse<T>`，T 保持原类型但去除内层封装。

### H2: writing/quality 后端从未实现 decision 推导逻辑 [CONFIRMED]
**证据**: `novelQualityCheckEndpoint` 调用 `evaluateNovelQuality()` 返回 `{ status, total_score, lock_score, style_score, logic_score, actionable_feedback, suggestions }`。前端 `NovelQualityCheckResult` 要求 `decision: 'APPROVED'|'REVISE'|'REWRITE'|'HUMAN_REVIEW'`。后端无任何代码从 score 推导 decision。

**根因**: 后端 endpoint 缺少 score→decision 映射逻辑。同文件的 `evaluateWithModules` 使用 `/critic/evaluate` 端点（正确返回 decision），但 `novelQualityCheck` 使用不同端点 `/writing/quality`（从未实现 decision）。

**修复方向**: 后端在 `novelQualityCheckEndpoint` 中添加 score→decision 映射（如 total_score>=80→APPROVED, >=60→REVISE, >=40→REWRITE, else→HUMAN_REVIEW），或前端从 score 自行推导。

### H3: analysis 端点返回裸数组但前端期望封装 [CONFIRMED]
**证据**: `analysisPatternsEndpoint` 返回 `jsonResponse(patterns)` 其中 patterns 是 `DetectedPattern[]`。`analysisSessionsEndpoint` 返回 `jsonResponse([])`（stub）。前端类型 `ApiResponse<{ success: boolean; data: T[] }>` 期望内层封装。

**根因**: 与 H1 同源 — 前端错误地添加了内层 `{ success, data }` 封装。后端返回裸数组，callApi 封装后 `data` = 裸数组，而非 `{ success, data: [] }`。

**修复方向**: 将 `ApiResponse<{ success: boolean; data: T[] }>` 改为 `ApiResponse<T[]>`。

### H4: getStyleProfile 后端未实现 [CONFIRMED]
**证据**: `styleProfileEndpoint` (m10-style.ts) 直接 `return jsonResponse(null)` 无论 projectId。前端类型 `ApiResponse<Record<string, unknown>>` 不允许 null。

**根因**: 功能未实现。端点存在但返回占位符 null。

**修复方向**: 前端类型改为 `ApiResponse<Record<string, unknown> | null>` 并在消费端添加 null guard；或后端实现实际逻辑。

### H5: skills/list 后端封装与前端类型不一致 [CONFIRMED]
**证据**: `skillsListEndpoint` 返回 `jsonResponse({ skills: skillEngine.list() })`。前端 `listSkills` 返回类型 `ApiResponse<Array<{ id: string; name: string }>>`。

**根因**: 后端在 `{ skills: [...] }` 对象中封装了数组，但前端类型期望裸数组作为 data。

**修复方向**: 前端类型改为 `ApiResponse<{ skills: Array<{ id: string; name: string }> }>`。

### H6: PluginResult 前后端类型不匹配源于接口定义时未参照后端实现 [CONFIRMED]
**证据**: 前端 `PluginResult = { success: boolean; output: string; error?: string }`，后端 plugin-engine `PluginResult = { pluginId, pluginName, score, maxScore, evidence, suggestions, details }`。完全不同的字段集。

**根因**: 前端 PluginResult 接口是基于预期行为（成功/失败/输出）的推测性定义，而非基于后端 plugin-engine 实际输出。

**修复方向**: 重定义前端 `PluginResult` 匹配后端形状。

### H7: registerPlugin 后端返回 { id, name } 但前端期望 { id, status } [CONFIRMED]
**证据**: `pluginRegisterEndpoint` 返回 `jsonResponse({ id: plugin.id, name: plugin.name })`。前端类型 `ApiResponse<{ id: string; status: string }>`。

**根因**: 后端未在注册响应中包含 status 字段。

**修复方向**: 前端类型改为 `{ id: string; name: string }` 或后端添加 status。

### H8: story-bible workspace 数据泄漏到实体存储 [CONFIRMED]
**证据**: `sbCreateEntity` 和 `sbUpdateEntity` 前端通过 `appendWorkspacePayload` 将 workspace 注入 POST body。后端 `sbCreateEntityEndpoint` 将整个 body spread 进 `{ ...base, ...partial }` 工厂函数，`sbUpdateEntityEndpoint` 做同样 `{ ...existing, ...body }`。workspace 键未被剥离。

**根因**: 后端仅剥离 id/novelId/type/createdAt 等不可变字段，但未剥离 `workspace` 键。

**修复方向**: 后端在 spread 前添加 `delete body.workspace`（与 delete body.id 同模式）。

### H9: foreshadowStats 后端完全忽略 workspace context [CONFIRMED]
**证据**: `foreshadowStatsEndpoint(_request: HttpRequest)` — 参数名 `_request` 表示未使用。内部调用 `graphGetForeshadows('planted')` 等时未传入 scope。前端通过 `X-Workspace-Id` header 发送 workspace 但后端不读 header。

**根因**: 端点实现为全局统计，不支持 workspace 范围过滤。

**修复方向**: 后端从 request 中提取 workspace（参考其他端点的 resolveGraphScope 模式），并将 scope 传入 graphGetForeshadows 调用。

### H10: 多个 M10/writing 端点前端发送 workspace 但后端不消费 [CONFIRMED]
**证据**: `/style/apply`、`/consistency/cross-chapter`、`/suggestions/context-aware`、`/agent/revise-multi-pass`、`/writing/helper`、`/writing/stream` 的后端端点处理函数均不读取 body.workspace。

**根因**: workspace 支持是后加的架构特性，前端已系统性接入但后端端点尚未逐步跟进消费。

**修复方向**: 优先级 P2 — 逐步在后端端点中添加 workspace 消费逻辑。

## Root Cause Summary

| ID | Root Cause | Priority | Affected Modules | Fix Direction |
|---|---|---|---|---|
| RC-1 | 前端类型错误嵌套 { success, data } 内层封装 | P0 | knowledge, analysis | 移除内层封装，T 改为裸数据形状 |
| RC-2 | writing/quality 后端未实现 decision 推导 | P0 | writing/evaluation | 后端添加 score→decision 映射 |
| RC-3 | getStyleProfile 未实现 | P1 | m10 | 前端类型改为 nullable 或后端实现 |
| RC-4 | skills/list 后端封装与前端类型不匹配 | P1 | skills | 前端类型加 { skills: } 包装 |
| RC-5 | PluginResult 前后端类型完全不同 | P1 | plugins | 重定义前端 PluginResult |
| RC-6 | registerPlugin 后端返回 { id, name } 而非 { id, status } | P1 | plugins | 修正前端类型 |
| RC-7 | story-bible workspace 数据泄漏 | P0 | story-bible | 后端 delete body.workspace |
| RC-8 | foreshadowStats 忽略 workspace | P1 | knowledge | 后端添加 workspace 解析 |
| RC-9 | M10/writing workspace context 丢弃 | P2 | m10, writing | 逐步添加后端 workspace 消费 |

## Fix
See maestro-plan --gaps for prioritized fix plan.

## Related
- [[spec:project:coding-conventions-025]]
- [[spec:project:coding-conventions-026]]
