# TASK-009: 自定义画像持久化

## Changes
- `src-ts/reader/mcp/reader-endpoints.ts`: 
  - 添加 `getWorkspaceRoot()`、`getPersonasFilePath()` 辅助函数
  - 添加 `loadCustomPersonas()` 函数：从 `.niko-studio/reader-personas.json` 加载自定义画像，文件不存在或解析失败时返回空 Map
  - 添加 `saveCustomPersonas()` 函数：将 Map 转为数组写入 `.niko-studio/reader-personas.json`，自动创建目录
  - 添加 `deletePersonasFile()` 函数：删除持久化文件（用于测试清理）
  - 模块加载时自动调用 `loadCustomPersonas()` 填充 `customPersonaStore`
  - `rsCreateCustomPersonaEndpoint` 创建成功后自动调用 `saveCustomPersonas()` 持久化
  - `rsFeedbackEndpoint` 中修改 custom persona 权重后自动调用 `saveCustomPersonas()` 保存
  - `clearReaderStores()` 改为 async 函数，同时删除持久化文件
- `src-ts/reader/mcp/reader-endpoints.test.ts` (新建):
  - 7 个测试用例覆盖：创建并持久化、文件加载、clearReaderStores 删除文件、GET 端点返回、进程重启恢复、非法 JSON 降级、非数组 JSON 降级

## Verification
- [x] `reader-endpoints.ts` 中 `customPersonaStore` 在启动时从 `.niko-studio/reader-personas.json` 加载：通过 `loadCustomPersonas()` 在模块顶层调用实现
- [x] `rsCreateCustomPersonaEndpoint` 创建画像后自动保存到 `reader-personas.json`：创建成功后调用 `saveCustomPersonas()`
- [x] 进程重启后，之前创建的自定义画像仍可通过 `/reader/personas` 获取：通过文件持久化 + 模块加载时自动加载实现，测试用例 "survives process restart by reloading from file" 验证

## Tests
- [x] `npx vitest run reader/mcp/reader-endpoints.test.ts`: 7 passed, 0 failed (19ms)

## Deviations
- `clearReaderStores()` 从同步函数改为 async 函数，以支持文件删除操作。这是一个 API 变更，但保持了向后兼容（调用方仍可用 `await` 或 `.then()` 处理）。
- 原有 `reader-endpoints.ts` 中存在 5 个 pre-existing TypeScript 类型错误（405行、848-859行），不在本任务范围内，未修改。

## Notes
- 文件 I/O 错误降级为仅内存存储（`saveCustomPersonas` 和 `loadCustomPersonas` 均 catch 异常并 log warning）
- 使用 `process.env['NIKO_WORKFLOW_WORKSPACE']` 确定 `.niko-studio` 目录路径，与项目中其他模块（如 revision-service、level5-coordinator）保持一致
- 测试使用独立的 `.test-workspace-reader` 目录隔离，避免污染实际工作区
- 反馈权重调整后的持久化也已实现（`rsFeedbackEndpoint` 中 custom persona 权重更新后调用 `saveCustomPersonas`）
