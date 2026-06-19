# Context: 修复剩余风险与建议

**Date**: 2026-06-19
**Areas discussed**: 依赖漏洞、TODO/控制台输出、工作树整理、部署/回滚/监控文档
**Session**: maestro-20260619-184051
**Artifact**: ANL-20260619-fix-remaining-risks
**Scope**: adhoc / macro

## Decisions

### Decision 1: 低/中危依赖漏洞修复策略
- **Context**: desktop 与 src-ts 仍存在低/中危漏洞（@babel/core、brace-expansion、esbuild、js-yaml、react-router 等），但已无 critical/high。
- **Options**:
  1. 全部升级到无漏洞版本（可能破坏构建/测试）。
  2. 仅升级 `npm audit fix` 可自动修复、不破坏现有工具链的版本；其余记录为风险/issue。
  3. 完全不升级，仅做记录。
- **Chosen**: 选项 2 — 优先自动修复，破坏性升级必须评估影响并向后兼容。
- **Reason**: 交付窗口内优先消除可低成本修复的漏洞，避免引入破坏性变更导致回归。

### Decision 2: TODO 与控制台输出清理策略
- **Context**: desktop CoWritingPanel.tsx 有 3 处 TODO 和 1 处 console.log；src-ts 多个 MCP endpoint 有 TODO 注释。
- **Options**:
  1. 全部实现。
  2. 删除或转为 issue。
  3. 保留 TODO 但清理 console.log。
- **Chosen**: 结合实际完成度：已实现则删除 TODO；未实现但本次不做的必须转 issue；console.log 移除或替换为 logger。
- **Reason**: 不留下无法解释的 TODO 与生产调试输出，同时不阻塞交付。

### Decision 3: 工作树整理策略
- **Context**: git status 显示约 2088 个变更文件，包含 .workflow 治理文件删除、测试/组件修改、依赖更新。
- **Options**:
  1. 一次性提交。
  2. 按语义分块提交（deps、tests、components、cleanup、governance 等）。
- **Chosen**: 选项 2 — 分块提交，<=5 个语义清晰的 commit。
- **Reason**: 便于回滚、审查和发布说明生成。

### Decision 4: 部署/回滚/监控文档策略
- **Context**: 仓库中缺少独立的部署运行手册、回滚方案或监控检查清单。
- **Options**:
  1. 编写完整运维手册。
  2. 补充最小可操作的检查清单与回滚命令入口。
  3. 确认现有 CI/发布脚本已覆盖，并在 README 中引用。
- **Chosen**: 选项 2 + 3 — 在 docs/ 补充最小运行手册/回滚方案/监控检查清单；若 CI/脚本已覆盖则明确引用。
- **Reason**: 满足交付前最低文档要求，不引入完整运维手册的范围膨胀。

## Constraints

### Locked
- 修复后 `npm audit --audit-level=high` 必须无 critical/high。
- 修复后 desktop/src-ts 的 `lint/typecheck/test/build` 必须保持通过。
- 语句覆盖率目标：desktop 与 src-ts 保持 100% statements。
- TODO/控制台输出不能仅 suppressed，必须实现、删除、转 issue 或替换为 logger。
- 工作树必须按语义分块提交，不得一次性大杂烩提交。
- 文档必须可从 docs/ 或 README 中检索到，或明确引用现有 CI/发布脚本。

### Free
- 具体分块提交命名与顺序由执行者根据实际 git status 决定。
- 对于无法自动修复且不在生产运行路径上的低/中危漏洞，允许记录为 issue 延后处理。
- 运行手册的详细程度：最小可操作检查清单即可，不强求完整运维手册。

### Deferred
- 大规模代码重构或新增业务功能超出本次范围。
- 100% 分支覆盖率等更高覆盖目标不在本次交付要求内。
- 生产环境真实部署执行不在本次范围。

## Code Context
- `desktop/package.json`, `desktop/package-lock.json`
- `src-ts/package.json`, `src-ts/package-lock.json`
- `desktop/src/components/cowriting/CoWritingPanel.tsx`
- `src-ts/reader/mcp/reader-endpoints.ts`
- `src-ts/knowledge/mcp/story-bible-endpoints.ts`
- `src-ts/knowledge/mcp/qc-endpoints.ts`
- `docs/`, `README.md`, `scripts/release_check_summary.py`
