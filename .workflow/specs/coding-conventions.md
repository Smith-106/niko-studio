---
title: Coding Conventions
readMode: required
priority: high
category: coding
keywords:
  - coding
  - style
  - naming
  - import
  - formatting
  - pattern
related:
  - "knowhow-doc-harvest-debug-reexport-anchor"
  - "spec:project:learnings"---






# Coding Conventions

Auto-generated from project analysis. Update manually as patterns evolve.

## Formatting
- Indentation: 2 spaces
- Line length: not enforced
- Trailing commas: yes (ES5, multi-line)
- Semicolons: no
- Quotes: single (ESLint/Prettier)

## Naming
- Variables/functions: camelCase
- Classes/types/interfaces: PascalCase
- Constants: camelCase
- Files: kebab-case (.ts/.tsx), PascalCase (.vue)
- CSS classes: BEM or utility-first (Tailwind)

## Imports
- Style: named imports (ESM)
- Path aliases: @ → src/
- Order: vue → external → internal → relative

## Patterns
- Vue 3 Composition API with `<script setup lang="ts">`
- Nuxt 3 auto-imports (ref, computed, navigateTo, etc.)
- Pinia stores for state (defineStore + composition style)
- Server routes in server/ (Nitro)
- Composables for shared logic (useAuth, useI18n, etc.)
- Tailwind CSS for styling
- Shadcn-vue + Radix Vue for UI components

## Entries

<spec-entry category="coding" keywords="search,codegraph,代码搜索" date="2026-06-01">

### mcp-semantic-search

代码搜索优先使用 CodeGraph MCP（`mcp__codegraph__codegraph_context`），精确符号查找用 `codegraph_search`/`codegraph_callers`，简单文本匹配用 Grep

</spec-entry>

<spec-entry category="coding" keywords="component-structure,re-export-anchor,backward-compat" date="2026-06-13" title="组件子目录 + 兼容性 re-export 锚模式" description="子目录组织组件，旧路径保留兼容性 re-export 锚点">
### 组件子目录 + 兼容性 re-export 锚模式
子目录组织组件，旧路径保留兼容性 re-export 锚点。
</spec-entry>

<spec-entry category="coding" keywords="i18n,module-split,aggregator-pattern" date="2026-06-13" title="i18n 模块拆分 + index 聚合器模式" description="分模块拆分，translations.ts 聚合导出">
### i18n 模块拆分 + index 聚合器模式
分模块拆分，translations.ts 聚合导出。
</spec-entry>

<spec-entry category="coding" keywords="craft-catalog,JSON-data,catalog-loader" date="2026-06-13" title="Craft catalog JSON data file 模式" description="JSON 数据文件在 catalog-data/，catalog-loader 加载，craft-catalog re-export">
### Craft catalog JSON data file 模式
JSON 数据文件在 catalog-data/，catalog-loader 加载，craft-catalog re-export。
</spec-entry>

<spec-entry category="coding" keywords="writing-craft,detector-pattern,keyword-first" date="2026-06-13" title="写作分析关键词检测为第一层、LLM 为增强层" description="新检测函数必须返回结构化结果对象（带 confidence/evidence/suggestions），关键词检测优先，LLM 增强">
### 写作分析关键词检测为第一层、LLM 为增强层
新检测函数必须返回结构化结果对象（带 confidence/evidence/suggestions），关键词检测优先，LLM 增强。
</spec-entry>

<spec-entry category="coding" keywords="writing-craft,enum-interface-record,four-layer" date="2026-06-13" title="写作知识引擎四层扩展模式：enum+interface+Record+检测函数" description="M13 验证的四层模式：enum 定义维度→interface 定义结构→Record<Enum,Interface> 注册数据→检测函数实现分析">
### 写作知识引擎四层扩展模式：enum+interface+Record+检测函数
M13 验证的四层模式：enum 定义维度→interface 定义结构→Record<Enum,Interface> 注册数据→检测函数实现分析。
</spec-entry>

<spec-entry category="coding" keywords="di,service-container,bindings,singleton" date="2026-06-13" title="DI 注册模式：bindSingleton + ServiceTypes Symbol" description="bindSingleton<T>(ServiceTypes.Symbol, () => new Impl(config))">
### DI 注册模式：bindSingleton + ServiceTypes Symbol
bindSingleton<T>(ServiceTypes.Symbol, () => new Impl(config))。
</spec-entry>

<spec-entry category="coding" keywords="voice-fingerprint,character-analysis,frontend-only" date="2026-06-13" title="Voice fingerprint 五维度特征提取" description="sentence_length_preference/catchphrases/formality_level/emotional_expression_tendency/rhetorical_habits">
### Voice fingerprint 五维度特征提取
sentence_length_preference/catchphrases/formality_level/emotional_expression_tendency/rhetorical_habits。
</spec-entry>

<spec-entry category="coding" keywords="architecture,three-layer-bridge,mcp,desktop-api" date="2026-06-13" title="三层桥接架构：MCP Endpoint → Desktop API → React Components" description="复用现有 intelligence 组件模式">
### 三层桥接架构：MCP Endpoint → Desktop API → React Components
复用现有 intelligence 组件模式。
</spec-entry>

<spec-entry category="coding" keywords="hot-reload,data-externalization,cache-invalidation" date="2026-06-13" title="热重载协议：file watcher → schema validate → atomic swap → event emit" description="验证失败保留前版本，事件驱动非轮询，开发启用生产禁用">
### 热重载协议：file watcher → schema validate → atomic swap → event emit
验证失败保留前版本，事件驱动非轮询，开发启用生产禁用。
</spec-entry>

<spec-entry category="coding" keywords="naming-convention,camelCase,public-API" date="2026-06-13" title="Workflow engine 公共 API 使用 camelCase" description="runStream 非 run_stream，确认 camelCase 为公共 API 命名约定">
### Workflow engine 公共 API 使用 camelCase
runStream 非 run_stream，确认 camelCase 为公共 API 命名约定。
</spec-entry>

<spec-entry category="coding" keywords="editor-state,tiptap,caching,chapter-switching" date="2026-06-13" title="Editor state cache 解决 Tiptap 重挂载" description="Map<chapterId, {json, text, selection, scrollY}> 避免 remount">
### Editor state cache 解决 Tiptap 重挂载
Map<chapterId, {json, text, selection, scrollY}> 避免 remount。
</spec-entry>

<spec-entry category="coding" keywords="onboarding,welcome-wizard,localStorage,gating" date="2026-06-13" title="Onboarding localStorage 门控避免重复引导" description="localStorage flag 'niko-onboarding-done'，Zustand slice pattern">
### Onboarding localStorage 门控避免重复引导
localStorage flag 'niko-onboarding-done'，Zustand slice pattern。
</spec-entry>

<spec-entry category="coding" keywords="protocol-first,typescript,execution-pattern,interface" date="2026-06-18" title="Protocol-first 执行模式验证成功" description="先定义 interface + type 再实现的模式在 M25 中验证有效">
### Protocol-first 执行模式验证成功
先定义 interface + type 再实现的模式在 M25 中验证有效，7 个目标全部达成，零回归，新增代码覆盖率 >= 80%，TypeScript 编译零错误。
</spec-entry>

<spec-entry category="coding" keywords="companion-pattern,testing,zustand,mcp-endpoint,vitest" date="2026-06-18" title="Companion pattern 测试策略规范" description="使用 .additional.test.ts 扩展测试，不重写现有测试结构">
### Companion pattern 测试策略规范
使用 .additional.test.ts 和 .branches.additional.test.ts 扩展测试，不重写现有测试结构。Zustand slice 测试遵循 createHarness()/getLiveStore() 模式，MCP endpoint 测试遵循 makeRequest() + 直接导入模式。
</spec-entry>

<spec-entry category="coding" keywords="fix-pattern,synchronization,frontend,backend,test" date="2026-06-18" title="系统性修复模式：前端 + 后端 + 测试同步更新" description="一致性修复的标准模式：前端类型修正 + 后端逻辑修复 + 测试 mock 更新">
### 系统性修复模式：前端 + 后端 + 测试同步更新
一致性修复的标准模式：前端类型修正 + 后端逻辑修复 + 测试 mock 更新，三方必须同步。仅修复一方会导致新的不匹配。
</spec-entry>

<spec-entry category="coding" keywords="callapi,api-pattern,envelope,frontend-type,anti-pattern" date="2026-06-18" title="callApi 外层封装模式：禁止内层信封" description="callApi 已在 2xx 响应时将原始 body 封装为 ApiResponse，禁止再添加内层信封">
### callApi 外层封装模式：禁止内层信封
callApi 已在 2xx 响应时将原始 body 封装为 {success: true, data: rawBody}。前端类型必须使用 ApiResponse<T> 其中 T 是原始后端 body 形状，禁止再添加内层 {success, data: T} 封装。
</spec-entry>

<spec-entry category="coding" keywords="API层,reader,callApi,ApiResponse,前端封装" date="2026-06-20" title="前端新建 reader.ts API 层复用 callApi/ApiResponse 模式" description="消除裸 fetch，统一前端 reader API 调用">
### 前端新建 reader.ts API 层复用 callApi/ApiResponse 模式
M26 新建 desktop/src/api/reader.ts 统一前端 reader API 调用，暴露 analyzeReader/compareReaderVersions/submitReaderFeedback/detectAIFlavor/deAiRewrite，均复用 callApi/ApiResponse 模式。消除组件内裸 fetch 调用，降低 API 签名漂移风险。
参考：desktop/src/api/reader.ts, desktop/src/api/reader.test.ts
</spec-entry>

<spec-entry category="coding" keywords="parseint,nan,validation,config,范围校验" date="2026-06-21" title="parseInt NaN 语义陷阱 — NaN 通过范围校验" description="parseInt() 返回 NaN 时，NaN < 1 === false 且 NaN > 65535 === false，导致 NaN 通过范围校验">
### parseInt NaN 语义陷阱 — NaN 通过范围校验
`parseInt(nonNumeric, 10)` 返回 NaN，后续 `NaN < 1` 和 `NaN > 65535` 均为 false，校验被穿透。必须用 `Number.isFinite()` 显式排除 NaN 和 Infinity。修复模板：`parseIntSafe()` 辅助函数或 `!Number.isFinite(parsed)` guard。
来源：odyssey-debug EG-21/EG-23, gateway-bootstrap.ts, config/index.ts
</spec-entry>

<spec-entry category="coding" keywords="health,probe,concurrent,tokio,冷启动,串行" date="2026-06-21" title="并发健康检查减少冷启动延迟" description="串行 HTTP 健康检查用 tokio::join!/Promise.all 并发化，共享 HTTP client 避免连接池浪费">
### 并发健康检查减少冷启动延迟
串行 HTTP 健康检查（3 次 × 2s 超时）叠加导致冷启动 6s+ 延迟。修复：`tokio::join!` 并发探测 + 共享 `reqwest::Client`（或 `Promise.all`），将延迟降至 ~2s。
来源：odyssey-improve C1+H1, gateway_runtime.rs:180-230
</spec-entry>

<spec-entry category="coding" keywords="http,headers,catch,streaming,headersSent,二次写入" date="2026-06-21" title="HTTP handler headersSent 检查防止二次写入" description="catch 块中写响应前必须检查 res.headersSent，否则 destroy 响应">
### HTTP handler headersSent 检查防止二次写入
流式响应已发送 header 后 catch 块二次 writeHead 导致 ERR_HTTP_HEADERS_SENT。处理策略：`if (!res.headersSent) { writeHead+end } else { res.destroy() }`。
来源：odyssey-improve H20/GP1, gateway-request-handler.ts:179-187
</spec-entry>

<spec-entry category="coding" keywords="cors,cache,reload,config,invalidate" date="2026-06-21" title="CORS 缓存 + config reload 时 invalidate" description="CORS origins 每请求重新计算浪费资源，改用缓存 + config reload 失效模式">
### CORS 缓存 + config reload 时 invalidate
`resolveCorsOrigins()` 每次请求调用（遍历 NIKO_ALLOWED_ORIGINS + 环境变量解析），浪费资源。修复：`_cachedCorsOrigins + invalidateCorsCache()` 模式，config reload 时调用 invalidate。
来源：odyssey-improve H5/GP3, gateway-http-adapter.ts:126-140
</spec-entry>

<spec-entry category="coding" keywords="wave-planning,depends_on,collision-notes,file-contention,parallel-edit" date="2026-06-21" title="共享文件多任务编辑通过 depends_on 串行化" description="单文件被 3+ 任务编辑时，显式 depends_on 串行化而非仅依赖 wave 分组，并在 collision_notes 标注热点" source="retrospective">
### 共享文件多任务编辑通过 depends_on 串行化
单文件被 3+ 任务编辑时，仅靠 wave 分组不足以防止并行编辑冲突，需显式 `depends_on` 边串行化。M26 的 reader-endpoints.ts 被 6/10 任务编辑，规划时在 collision_notes 标注 `TASK-007 depends_on TASK-006`，W3 三任务串行完成无合并冲突，0 rework iterations。

**规则**：任何被 3+ 任务编辑的文件，在 plan 的 collision_notes 显式声明串行顺序，并在 task JSON 的 `depends_on` 建立边，即使同 wave 内也串行。
来源：quality-retrospective M26-P1 INS-1f83f679, plan.json#collision_notes, TASK-007.json#depends_on, index.json#waves[2]
</spec-entry>

<spec-entry category="coding" keywords="mcp-endpoint,input-validation,security-contract,max-length,path-traversal,finite-range" date="2026-06-21" title="MCP endpoint 强制输入校验三件套（长度/路径/数值范围）" description="任何接收文本/env-derived 路径/数值权重的 endpoint 都应内置 max-length + path containment + finite-in-range 三道校验" source="retrospective">
### MCP endpoint 强制输入校验三件套（长度/路径/数值范围）
MCP endpoint 接收外部输入时必须强制三道校验，缺一不可（M26 review 的 SEC-001/002/004 同源缺失）：

1. **长度上限**（SEC-001）：文本输入必须有 max-length，防止内存耗尽 / 超长 payload
2. **路径收容**（SEC-002）：env-derived 路径必须 path containment 校验（path.resolve 后检查是否在允许根目录内），防 path traversal
3. **数值范围**（SEC-004）：数值权重必须 `Number.isFinite(x) && x >= min && x <= max`，防 NaN/Infinity 污染计算（与 ConsensusEngine 除零 CORR-003 同类）

**规则**：新建 endpoint 的验收清单必须包含这三道校验，作为可复用 endpoint 安全契约。
来源：quality-retrospective M26-P1 INS-5e45e297, review.json SEC-001/002/004, reader-endpoints.ts:39,547,640
</spec-entry>
