# TASK-005: 实现 De-AI rewrite 复用 RevisionService

## Changes
- `src-ts/workflow/revision-loop.ts`: 扩展 `RevisionConfig` 接口，新增 `quality_goals`（修订指令注入）、`target_style`（目标风格）、`revision_mode`（修订模式）三个可选字段
- `src-ts/services/revision-service.ts`: 重写 `RevisionServiceImpl.writerFn`，从 identity 函数改为三层策略：1) LLM 重写（通过环境变量配置）、2) 规则降级（替换中英文 AI 模板词）、3) 无改动时返回原文。新增 `applyRuleBasedDeAI`、`buildDeAIPrompt`、`callLLMForRewrite` 辅助函数
- `src-ts/reader/mcp/reader-endpoints.ts`: 新增 `rsDeAIEndpoint` 处理 `POST /reader/de-ai`，接收 `{ novelId, text?, mode: 'de-ai'|'style-shift', targetStyle? }`，调用 `detectAIFlavor` 生成 instructions，构造 `RevisionConfig` 注入 `quality_goals`，调用 `IRevisionService.revise`，返回 `{ originalText, revisedText, aiFlavorScore, improvements, suggestions, mode }`
- `src-ts/tests/reader/reader-endpoints-de-ai.test.ts`: 新增 8 个测试覆盖验证、空文本、AI 模板检测、重写差异、style-shift 模式、自然文本、英文模板

## Verification
- [x] `reader-endpoints.ts` 中新增 `rsDeAIEndpoint` 函数，处理 `POST /reader/de-ai`：grep 确认 `rsDeAIEndpoint` 存在于第 504 行
- [x] `RevisionServiceImpl.writerFn` 不再是 identity 函数：原 `return draft` 被替换为 LLM 调用 + 规则降级逻辑，仅在最内层 fallback（无改动时）返回原文
- [x] `/reader/de-ai` 对非空文本返回的 `finalDraft` 与输入文本不同：测试 "rewrites AI template text" 验证中文模板文本被重写（`revisedText !== originalText`），英文模板测试同样通过

## Tests
- [x] `npm test -- --grep 'revision-service'`：13 个测试全部通过
- [x] `npm test -- --grep 'reader-endpoints'`：10 个测试全部通过（原有）
- [x] `reader-endpoints-de-ai.test.ts`：8 个新测试全部通过
- 总计：31 个测试通过，0 失败

## Deviations
- 无。严格按 implementation 步骤顺序执行：先扩展 RevisionConfig，再实现 writerFn，最后新增 endpoint。

## Notes
- `writerFn` 的 LLM 调用依赖环境变量 `LLM_API_KEY`、`LLM_BASE_URL`、`LLM_MODEL`，未配置时自动降级到规则重写
- 规则重写覆盖 40+ 中文 AI 模板词和 25+ 英文模板词，测试中已验证中英文文本都能正确检测并改写
- `RevisionServiceImpl` 中的 `revisionServiceInstance` 为单例模式，在 reader-endpoints 中通过 `getRevisionService()` 获取
- 后续如需增强 LLM 重写效果，可接入 `ModelRouter`（`src-ts/cowriting/ModelRouter.ts`）进行模型路由
