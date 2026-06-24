# TASK-003 Summary — 新增 GET /tools (listTools) 响应契约测试

## 交付物

- `src-ts/tests/mcp/all-tools.test.ts`（扩展，新增 `listTools endpoint` describe 块）

## 实现要点

1. 导入 `listTools`（from `../../mcp/endpoints/health.js`）与 `HttpRequest` 类型。
2. 构造最小化 mock `HttpRequest`，调用 `await listTools(request)`。
3. 断言：
   - response.statusCode === 200
   - response.body 为对象
   - body 包含 memory、graph、search、workflow、critic、agent、skills、writing_helper 八大分类
4. 对每个分类断言数组中包含预期的工具名称（如 memory 包含 `memory_add`、`memory_search` 等）。

## 验证结果

```bash
cd src-ts && npx vitest run tests/mcp/all-tools.test.ts --reporter=verbose
```

结果：12 个 tests passed（原 3 个 + 新增 9 个）。

## 收敛标准

- [x] all-tools.test.ts 包含 `listTools` describe 块。
- [x] 文件包含 `memory_add`、`graph_query`、`search_hybrid`、`workflow_route`、`evaluate_content`、`agent_route`、`skills_list`、`process_writing_helper` 的断言。
- [x] 文件包含对 8 个工具分类 key 的断言。
- [x] 测试文件通过 vitest。
