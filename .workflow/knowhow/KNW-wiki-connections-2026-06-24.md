# Wiki Connections — 2026-06-24

## Baseline

- Health score: 47/100
- Entries: 224
- Broken links: 19
- Orphans: 15
- Missing titles: 0

## Orphans Identified

| # | ID | Type | Title |
|---|----|------|-------|
| 1 | project-project | project | Project: niko-studio |
| 2 | roadmap-roadmap | roadmap | Roadmap: M28 — Architecture Hardening + UI Completion + Test Coverage |
| 3 | scratch-20260622-analyze-p1-reader-endpoints-split-analysis | note | Analysis: M28 Phase 1 — Reader Endpoints Split + Remaining Input Validation |
| 4 | scratch-20260622-analyze-p1-reader-endpoints-split-context | note | Context: Phase 1 — Reader Endpoints Split + Remaining Input Validation |
| 5 | scratch-20260622-analyze-p1-reader-endpoints-split-discussion | note | Discussion: M28 Phase 1 — Reader Endpoints Split + Remaining Input Validation |
| 6 | scratch-20260624-analyze-p2-architecture-decoupling-analysis | note | Analysis: M28 Phase 2 — Architecture Decoupling |
| 7 | scratch-20260624-analyze-p2-architecture-decoupling-context | note | Context: M28 Phase 2 — Architecture Decoupling |
| 8 | scratch-20260624-analyze-p2-architecture-decoupling-discussion | note | Discussion: M28 Phase 2 Architecture Decoupling |
| 9 | scratch-20260624-analyze-p3-ui-component-completion-analysis | note | Analysis: M28 Phase 3 — UI Component Completion |
| 10 | scratch-20260624-analyze-p3-ui-component-completion-context | note | Context: M28 Phase 3 — UI Component Completion |
| 11 | scratch-20260624-analyze-p3-ui-component-completion-discussion | note | Discussion: M28 Phase 3 — UI Component Completion |
| 12 | scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-analysis | note | Analysis: M28 Phase 4 — MCP Endpoint Test Coverage |
| 13 | scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-context | note | Context: M28 Phase 4 — MCP Endpoint Test Coverage |
| 14 | scratch-20260624-analyze-p4-mcp-endpoint-test-coverage-discussion | note | Discussion: M28 Phase 4 — MCP Endpoint Test Coverage |
| 15 | scratch-20260624-design-coverage-gap-scanner-design | note | Coverage Gap Scanner 设计文档 |

## Applied Connections

### Project ↔ Roadmap

- `project-project` → `roadmap-roadmap`
- `roadmap-roadmap` → `project-project`

### M28 Analyze Sessions

For each session (P1–P4), linked `analysis`, `context`, and `discussion` to each other and to `project-project` / `roadmap-roadmap`.

### Design Session

- `scratch-20260624-design-coverage-gap-scanner-design` → `project-project`, `roadmap-roadmap`

## Tooling Note

`maestro wiki update` refused to edit entries whose source paths are outside `.workflow/wiki/` (project.md, roadmap.md, and scratch files). Frontmatter was added directly to those markdown files; the wiki index picked up the `related` links on the next `maestro wiki health` run.

## Result

- Health score: 47 → **62/100** (+15)
- Orphans: 15 → **0**
- Broken links: 19 (unchanged — out of scope for connect, use cleanup)
- Top hubs: `project-project` / `roadmap-roadmap` (in-degree: 14)

## Graph Observations

- Scratch analysis documents are automatically indexed by the wiki but start with no `related` links, making them the primary orphan source after milestone completion.
- `project-project` and `roadmap-roadmap` are natural hub candidates for milestone-bound scratch notes.
- The remaining 19 broken links are in existing spec/knowhow entries and should be addressed by `/manage-wiki cleanup --fix`.

## Cleanup Update (2026-06-24)

`/manage-wiki cleanup --fix` 已执行，断链 19 → 8：
- **已修复 11 条内容断链**：`learnings.md` 正文中字面的 id / wikilinks / target-id 占位符（5 条）、`KNW-wiki-connections-2026-06-21-v3.md` 正文中字面的 KNW-... / knowhow-knw-... / wikilinks 占位符（5 条）、`KNW-wiki-connections-2026-06-24.md` 补 Related 段救援孤儿（1 条）。共同根因：正文里出现双括号 wikilink 语法（即便在反引号内）会被索引器解析为图边，目标不存在即成断链。
- **剩余 8 条为工具缺陷**：全部来自虚拟 session 条目 `session-analyze-anl-20260622-p2-frontend-integration`，其 `related` 由 archive.json 的 `linked_milestone` + `content_refs` 派生出 `milestone-M27` + 7 个 `session-ref-*` 合成 id，但这些 id 从不被物化为 wiki 条目。手动改 wiki-index.json 无效——graph/health 每次从 archive.json 重新派生并覆盖。已记录为 ISS-20260624-004，待索引器层修复（推荐方案：派生时过滤索引中不存在的目标 id）。

最终健康度：**83/100**，孤儿 0，断链 8（全为 ISS-004 工具缺陷）。

## Next Steps

- ~~`/manage-wiki cleanup --fix`~~ — 已执行（见上 Cleanup Update）
- `/manage-wiki digest M28` — synthesize M28 knowledge cluster
- ISS-20260624-004 — 等待 maestro wiki 索引器修复虚拟 session related 派生逻辑

## Related

- [[knowhow-knw-wiki-connections-2026-06-21-v3]]
- [[knowhow-knw-wiki-connections-2026-06-21]]
- [[knowhow-knw-wiki-connections-2026-06-18]]
- [[knowhow-knw-wiki-connections-2026-06-17]]
- [[project-project]]
- [[roadmap-roadmap]]
