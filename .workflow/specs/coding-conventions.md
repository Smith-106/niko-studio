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
  - "spec:project:coding-conventions-020"
  - "spec:project:coding-conventions-021"
  - "spec:project:coding-conventions-018"
  - "spec:project:coding-conventions-019"
---



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
