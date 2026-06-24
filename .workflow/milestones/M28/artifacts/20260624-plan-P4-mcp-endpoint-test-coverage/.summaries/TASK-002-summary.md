# TASK-002 Summary — 扩展 content route contract tests 覆盖剩余分组

## 交付物

- `src-ts/tests/mcp/routes/content-routes-additional.test.ts`（新建，`content-routes-chat.test.ts` 的 companion）

## 实现要点

导入 `contentRoutes` 并断言：

1. contentRoutes 总数为 66（与 `content-routes-chat.test.ts` 一致）。
2. 每条 route method 合法、handler 为 function、pattern 为 RegExp。
3. 按 11 个剩余功能分组编写 describe 块与循环断言：
   - writing-craft（6 条）
   - plugins（3 条）
   - sync（4 条）
   - foreshadow（2 条）
   - character（3 条）
   - analysis（3 条）
   - learning（7 条）
   - story-bible（7 条，含 `entityId` param 提取）
   - qc（2 条）
   - cowriting（4 条）
   - reader（8 条）
4. pattern specificity 断言（如 `/cowriting/generate/auto` 不匹配 `/cowriting/generate/autoX`）。
5. handler 均为 function（不强制 distinct，因为 `/writing-helper/process` 与 `/writing/helper` 共用同一 handler）。

## 偏差与调整

- 原计划断言所有 handler 彼此 distinct，但实际 `writingHelperProcessEndpoint` 被两个 route 共用。改为仅断言所有 handler 为 function，保持与代码一致。

## 验证结果

```bash
cd src-ts && npx vitest run tests/mcp/routes/content-routes-additional.test.ts --reporter=verbose
```

结果：58 个 tests passed。同时 `content-routes-chat.test.ts` 未受影响（单独运行通过）。

## 收敛标准

- [x] content-routes-additional.test.ts 存在并包含 `contentRoutes`、`toHaveLength(66)`。
- [x] 文件包含 11 个剩余分组的 describe 块。
- [x] 关键 endpoint（`/story-bible/entities/list`、`/story-bible/entity/`、`/qc/validate`、`/cowriting/generate/auto`、`/reader/analyze`）均有断言。
- [x] 测试文件通过 vitest。
