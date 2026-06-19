# Harvest Report — 2026-06-13

## Source
- Type: scan (all sources)
- Artifacts scanned: 28
- Path: .workflow/scratch/ + .workflow/active/ + .workflow/.lite-plan/

## Extraction Summary
- Fragments found: ~174
- Filtered by confidence ≥ 0.5: ~141
- Duplicates skipped: 33 (cross-source overlap)

## Routing Results

### Wiki (42 entries)
| # | Type | Slug | Title | Status |
|---|------|------|-------|--------|
| 1 | note | harvest-analysis-release-evidence-drift | Release NO_GO 根因是 evidence 版本漂移 | CREATED |
| 2 | note | harvest-analysis-release-blockers | 剩余 release blocker 详解 | CREATED |
| 3 | note | harvest-analysis-project-audit | 项目整体评分 82/100 | CREATED |
| 4 | note | harvest-analysis-console-hygiene | Desktop 零 console.* 直接调用 | CREATED |
| 5 | note | harvest-analysis-revision-orchestrator-logger | RevisionOrchestrator 正确使用 logger | CREATED |
| 6 | note | harvest-analysis-visualization-existing | 可视化模块已集成到编辑器侧边栏 | CREATED |
| 7 | note | harvest-analysis-readerstate-disconnected | ReaderState 未被可视化面板消费 | CREATED |
| 8 | note | harvest-analysis-llmprovider-duplicate | 两个同名 LLMProvider 接口 | CREATED |
| 9 | note | harvest-session-narrative-auth-gaps | Narrative authority 关键缺口 | CREATED |
| 10 | note | harvest-analysis-e2e-ux-context-gap | AI 续写缺少跨章节上下文 | CREATED |
| 11 | note | harvest-analysis-no-save-shortcut | 缺少 Ctrl+S + dirty check | CREATED |
| 12 | note | harvest-analysis-duplicate-types | NarrativeVisualization 类型重复定义 | CREATED |
| 13 | note | harvest-analysis-circular-deps | Container 与 MCP 双向依赖 | CREATED |
| 14 | note | harvest-analysis-gatewaydeps-isp | GatewayDeps 违反接口隔离 | CREATED |
| 15 | note | harvest-analysis-catalog-issues | craft-catalog const + 循环依赖 | CREATED |
| 16 | note | harvest-analysis-revision-issues | RevisionOrchestrator 复杂度+冗余调用 | CREATED |
| 17 | note | harvest-analysis-showtell-perf | ShowTell 逐段 transaction 卡顿 | CREATED |
| 18 | note | harvest-analysis-deps-complex | 二进制依赖复杂 | CREATED |
| 19 | knowhow | harvest-debug-logger-noop | Logger isDev-based noop 模式 | CREATED |
| 20 | knowhow | harvest-debug-camelcase-api | 公共 API camelCase 命名约定 | CREATED |
| 21 | knowhow | harvest-debug-reexport-anchor | 组件子目录 + re-export 锚 | CREATED |
| 22 | knowhow | harvest-debug-i18n-split | i18n 模块拆分 + 聚合器 | CREATED |
| 23 | knowhow | harvest-debug-craft-catalog-json | Craft catalog JSON data 模式 | CREATED |
| 24 | knowhow | harvest-debug-test-design | 测试计划设计 know-how | CREATED |
| 25 | knowhow | harvest-other-bookworld-worldview | BookWorld worldview extraction | CREATED |
| 26 | knowhow | harvest-other-bookworld-scene | BookWorld scene simulation | CREATED |
| 27 | knowhow | harvest-other-bookworld-ablation | BookWorld ablation 核心因子 | CREATED |
| 28 | knowhow | harvest-other-lifecycle-hooks | OpenStory lifecycle hooks | CREATED |
| 29 | knowhow | harvest-other-mirofish-graphrag | MiroFish GraphRAG | CREATED |
| 30 | knowhow | harvest-other-m10-multi-pass | 多遍修订自主循环 | CREATED |
| 31 | knowhow | harvest-other-m10-style-learning | Style learning 流程 | CREATED |
| 32 | knowhow | harvest-other-m10-consistency | 一致性检查三种触发 | CREATED |
| 33 | knowhow | harvest-other-workflowservice | WorkflowService checkpoint 门控 | CREATED |
| 34 | knowhow | harvest-other-intelligence-cache | IntelligenceService 缓存 | CREATED |
| 35 | spec | harvest-brainstorm-m24-scope | M24 范围共识 | CREATED |
| 36 | spec | harvest-brainstorm-m26-scope | M26 范围 | CREATED |
| 37 | spec | harvest-brainstorm-obsidian-architecture | Obsidian 三层架构 | CREATED |
| 38 | spec | harvest-brainstorm-cytoscape | Cytoscape.js 4 视图 | CREATED |
| 39 | spec | harvest-brainstorm-sync-engine | 同步引擎策略 | CREATED |
| 40 | spec | harvest-brainstorm-embedding | Embedding 方案 | CREATED |
| 41 | spec | harvest-brainstorm-error-propagation | M24 错误传播规则 | CREATED |
| 42 | spec | harvest-brainstorm-backward-compat | M24 5 接口向后兼容 | CREATED |

### Spec (51 entries)
| File | New | Existing | Total |
|------|-----|----------|-------|
| architecture-constraints.md | 28 | 0 | 28 |
| coding-conventions.md | 12 | 1 | 13 |
| learnings.md | 2 | 3 | 5 |
| debug-notes.md | 3 | 0 | 3 |
| review-standards.md | 2 | 0 | 2 |
| quality-rules.md | 2 | 0 | 2 |
| ui-conventions.md | 2 | 0 | 2 |

### Issue (59 entries)
| Severity | Count | Representative |
|----------|-------|---------------|
| critical | 2 | Cypher 注入, API key 明文传输 |
| high | 18 | WritingDashboard 未挂载, 章节切换丢状态, CJK 剥离, HTTP 超时缺, SSE 跨 chunk 丢失 |
| medium | 19 | Embedding cache 无 TTL, .env 缺文档, 测试覆盖 0, AntiPattern 缺失, Logger 命名不一致 |
| low | 20 | Deferred UI 不可达, 代码签名, 二进制依赖, release blocker 残留 |

## Skipped
| Fragment | Reason |
|----------|--------|
| 500 错误泄露 (duplicate) | 与 ISS-20260613-011 重复 |

## Source Artifacts NOT Modified
All source files in .workflow/scratch/ and .workflow/active/ remain unchanged.
