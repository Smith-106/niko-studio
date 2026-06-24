# TASK-001 Summary — 新增 agents / m10 / m11 route contract tests

## 交付物

- `src-ts/tests/mcp/routes/agents-routes.test.ts`（新建）
- `src-ts/tests/mcp/routes/m10-routes.test.ts`（新建）
- `src-ts/tests/mcp/routes/m11-routes.test.ts`（新建）

## 实现要点

复用 `admin-routes.test.ts` 的 helper 模式（`findRoute`、`extractParams`），对每个路由模块断言：

1. route 总数（agents=15、m10=6、m11=2）。
2. 每条 route 的 method、pattern、handler 形状。
3. 按功能分组 positive pattern matching（agent、critic、consistency、skills、style、suggestions、worldview 等）。
4. negative pattern matching（错误 method、缺少 param、错误 path）。
5. param 提取（m10 `style/profile/:projectId`、m11 `worldview/:projectId`）。
6. handler 均为 function（agents/m10/m11 中彼此 distinct）。

## 偏差与调整

- m11 的 `GET /worldview/:projectId` pattern `/^\/worldview\/(.+)$/` 实际上也会匹配 `/worldview/extract`（method 不同），但 contract test 记录了真实行为：原 negative case 被移除，避免与 pattern 语义冲突。

## 验证结果

```bash
cd src-ts && npx vitest run tests/mcp/routes/agents-routes.test.ts tests/mcp/routes/m10-routes.test.ts tests/mcp/routes/m11-routes.test.ts --reporter=verbose
```

结果：3 个测试文件全部通过，47 个 tests passed。

## 收敛标准

- [x] agents-routes.test.ts 存在并包含 `agentRoutes`、`toHaveLength(15)`、`POST /agent/route`、`GET /skills/list`。
- [x] m10-routes.test.ts 存在并包含 `m10Routes`、`toHaveLength(6)`、`POST /style/extract`、`paramNames`、`projectId`。
- [x] m11-routes.test.ts 存在并包含 `m11Routes`、`toHaveLength(2)`、`POST /worldview/extract`、`GET /worldview/`、`paramNames`、`projectId`。
- [x] 三个测试文件全部通过 vitest。
