# TASK-004 Summary — 实现 coverage-gap-scanner 脚本与 package.json script

## 交付物

- `src-ts/scripts/coverage-gap-scanner.ts`（新建，零依赖正则解析）
- `src-ts/package.json`（新增 `coverage:gap` script）

## 实现要点

1. 使用 `node:fs`、`node:path` 同步读取文件，零外部依赖。
2. 扫描 `src-ts/mcp/routes/*.ts`（排除 `index.ts`），正则提取：
   - `export const {constName}Routes: GatewayRoute[] = [...]`
   - 每条 route 的 method、pattern source/flags、handler 名称、paramNames
3. 递归扫描 `src-ts/tests/**/*.test.ts`。
4. route module 覆盖判定：测试文件中包含 route 模块变量名（如 `agentRoutes`）或 import 路径 `mcp/routes/{module}`。
5. handler 覆盖判定：handler 函数名出现在任意测试文件中（因此跨目录测试如 `tests/knowledge/story-bible-endpoints.test.ts` 不会被漏扫）。
6. 输出 JSON（stdout）+ 表格（stdout）：
   - `uncoveredRouteModules`
   - `uncoveredHandlers`
   - `summary`
7. 支持 `--check` 模式：存在缺口时 `process.exit(1)`，否则 `exit(0)`。

## 偏差与调整

- 文件顶部原 JSDoc 包含 `**` 与 `*.ts` 字样，在 Node 24 原生 TypeScript 解析下触发 SyntaxError。将注释改写为不含 `**` 的普通描述后解决。
- package.json script 使用 `ts-node --esm scripts/coverage-gap-scanner.ts`（与项目现有 `dev`、`consistency-check` 脚本一致）。

## 验证结果

```bash
cd src-ts && npm run coverage:gap
```

结果：7 个 route modules 全部 covered，132 条 route handlers 全部 covered，无缺口。

```bash
cd src-ts && npm run coverage:gap -- --check
```

结果：exit 0。

## 收敛标准

- [x] coverage-gap-scanner.ts 存在且可执行。
- [x] package.json 的 scripts 字段包含 `coverage:gap`。
- [x] scanner 正确识别当前 agents/m10/m11 为 covered（TASK-001/002 完成后）。
- [x] scanner 正确识别 story-bible/qc/cowriting 相关 handler 为 covered（跨目录测试不误报）。
- [x] scanner 支持 `--check` 模式，无缺口时 exit(0)。
