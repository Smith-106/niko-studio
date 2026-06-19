# Debug: M24 Phase 1 TASK-006 blockage

## Current Understanding
Cycle 1：`run_stream` 断言失败不是 barrel 导致，而是 `WorkflowEngine` 公共 API 常量与测试约定不一致。源码公开的是 `runStream`，测试仍断言 `run_stream`。

Cycle 2：`better-sqlite3`/`vitest` 运行失败不是单个导入文件坏掉，而是测试执行上下文落在仓库根 worktree；根目录没有 `package.json`，且 `src-ts/package-lock.json` 虽记录依赖，但 `src-ts/node_modules` 实际不存在，根 `node_modules` 也没有 `vitest`/`better-sqlite3`。因此从根目录运行 `npx vitest` 时，Vitest 使用临时下载版本并在错误 root 下解析模块，无法找到 `src-ts` 子包依赖。

## Root Cause
1. `WorkflowEngine` 公共 API 契约已切换为 camelCase `runStream`，但测试仍按 snake_case `run_stream` 断言，导致契约测试过期。
2. `src-ts` 是独立 Node 子包，但依赖未在其本地安装；同时从仓库根运行测试时，使用了根级 `vitest.config.ts` 或默认 root，未进入 `src-ts` 包上下文，造成 `vitest` 与 `better-sqlite3` 都无法按 `src-ts/package.json` 解析。

## Fix Applied
Pending（按要求未改代码）

## Hypotheses Tested
1. Barrel `workflow-engine.ts` 丢失了兼容导出导致 `run_stream` 失败：refuted/partially confirmed -- barrel 仅 `export *`，真正公开常量在 `workflow-engine-core.ts`，其值明确为 `runStream`，所以问题是测试约定过期，不是 barrel 丢导出。
2. `better-sqlite3` 缺失来自导入链本身损坏：refuted -- `vector-search.ts` 与 `unified-memory.ts` 确有顶层导入 `better-sqlite3`，但更深层原因是测试运行上下文不在 `src-ts` 包且依赖未实际安装。
3. 根目录执行 `npx vitest` 仍应自动解析 `src-ts/package.json`：refuted -- 根目录无 `package.json`；默认运行时 root 在当前 worktree，找不到测试文件；显式加载 `src-ts/vitest.config.ts` 时又因本地 `vitest` 未安装而无法解析 `vitest/config`。
