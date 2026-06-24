---
related:
  - project-project
  - roadmap-roadmap
---

# Coverage Gap Scanner 设计文档

## 1. 目标与输入输出

### 目标
自动盘点 MCP endpoint handler 的测试覆盖缺口，识别哪些 endpoint handler 在测试中被直接调用（命中），哪些仅通过 route 结构测试被间接引用（未真正执行 handler 逻辑），以及哪些完全没有被任何测试触及。

### 输入
- `src-ts/mcp/routes/*.ts` — 路由注册文件（7 个）
- `src-ts/mcp/endpoints/index.ts` — barrel export 索引
- `src-ts/coverage/coverage-final.json` — Vitest v8 coverage 输出
- `src-ts/tests/**/*.test.ts` — 测试文件（跨目录扫描）

### 输出
- 控制台表格（按 route 分组）
- JSON 报告（`coverage-gap-report.json`）

### 保存位置
`src-ts/scripts/coverage-gap-scanner.ts`

---

## 2. 算法步骤

### Step 1: 解析路由文件，提取 handler 名称

遍历 `src-ts/mcp/routes/*.ts`（platform.ts, admin.ts, agents.ts, workflow.ts, content.ts, m10.ts, m11.ts），用 regex 提取：

```
handler:\s*(\w+)
```

同时提取对应的 `method` 和 `pattern`（用于生成人类可读的路由标识）。

**示例输出：**
```
platform.ts: healthCheck, metricsEndpoint, listTools, listModels, getConfig, updateConfig, ...
workflow.ts: workflowRouteEndpoint, workflowPlanEndpoint, workflowExecuteEndpoint, ...
content.ts: chatEndpoint, chatStreamEndpoint, memorySearchEndpoint, ...
```

### Step 2: 解析 barrel export，建立 handler -> 源文件映射

读取 `src-ts/mcp/endpoints/index.ts`，提取 re-export 关系：

```
export { foo, bar } from './baz';
export { foo, bar } from '../../knowledge/mcp/qc-endpoints';
```

建立映射：`handlerName -> sourceFilePath`（如 `healthCheck -> mcp/endpoints/health.ts`）。

**关键：处理跨目录 re-export**
- `../../knowledge/mcp/story-bible-endpoints` → `knowledge/mcp/story-bible-endpoints.ts`
- `../../cowriting/mcp/cowriting-endpoints` → `cowriting/mcp/cowriting-endpoints.ts`
- `../../reader/mcp/reader-routes` → `reader/mcp/reader-endpoints.ts`（注意文件名差异：reader-routes → reader-endpoints.ts）

### Step 3: 读取 coverage-final.json，提取每个 handler 的命中次数

coverage-final.json 使用 Istanbul 格式，每个文件包含：
- `fnMap`: 函数定义映射（`{name, decl}`）
- `f`: 函数命中次数数组（索引对应 fnMap）

**匹配逻辑：**
1. 根据 Step 2 的 `handlerName -> sourceFilePath` 找到 coverage 中的文件路径
2. 在该文件的 `fnMap` 中搜索函数名等于 `handlerName`
3. 读取对应的 `f[index]` 命中次数

**注意：** coverage 中的路径是绝对路径（如 `C:\Users\...\src-ts\mcp\endpoints\health.ts`），需要按文件名匹配。

### Step 4: 解析测试文件，检测 handler 的直接调用

遍历 `src-ts/tests/**/*.test.ts`，用 regex 检测两种直接调用模式：

**模式 A: 直接 import endpoint 并调用**
```typescript
import { healthCheck } from '../../mcp/endpoints/health';
// ...
const response = await healthCheck(request);
```

**模式 B: 动态 import 并调用**
```typescript
const { workflowRouteEndpoint } = await import('../../mcp/endpoints/workflow.js');
const response = await workflowRouteEndpoint(request);
```

**检测 regex：**
```
// 静态 import
import\s*\{[^}]*\b(handlerName)\b[^}]*\}\s*from\s*['"][^'"]*endpoints[^'"]*['"]

// 动态 import
await\s+import\s*\([^)]*endpoints[^)]*\)\s*;?\s*\n(?:[^\n]*\n)*?\b(handlerName)\b\s*\(

// 直接调用
\b(handlerName)\b\s*\(
```

### Step 5: 分类判定

每个 handler 分为三类：

| 分类 | 条件 | 含义 |
|------|------|------|
| `covered` | coverage hits > 0 且测试文件中有直接调用 | 有真正的 endpoint 逻辑测试 |
| `indirect` | coverage hits > 0 但测试文件中无直接调用 | 仅通过 route 结构测试或间接调用覆盖（如 `typeof route.handler === 'function'`） |
| `uncovered` | coverage hits === 0 | 完全没有测试覆盖 |

### Step 6: 生成报告

按 route 文件分组，输出每个 handler 的状态、命中次数、测试文件引用列表。

---

## 3. 文件路径与运行方式

### 文件位置
```
src-ts/scripts/coverage-gap-scanner.ts    # 主脚本
src-ts/scripts/coverage-gap-types.ts      # 类型定义（可选）
```

### 命令行运行
```bash
# 基本运行（需要先有 coverage 数据）
cd src-ts && npx ts-node --esm scripts/coverage-gap-scanner.ts

# 指定 coverage 文件路径
npx ts-node --esm scripts/coverage-gap-scanner.ts --coverage ./coverage/coverage-final.json

# 输出 JSON 报告到文件
npx ts-node --esm scripts/coverage-gap-scanner.ts --json ./coverage-gap-report.json

# 只显示未覆盖和间接覆盖的（过滤 covered）
npx ts-node --esm scripts/coverage-gap-scanner.ts --filter gap
```

### package.json 集成
```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:coverage:gap": "npm run test:coverage && npx ts-node --esm scripts/coverage-gap-scanner.ts",
    "check:release": "npm run lint && npm run format:check && npm run typecheck && npm run test:coverage:gap && npm run test:release"
  }
}
```

---

## 4. 依赖建议

| 方案 | 依赖 | 复杂度 | 准确性 | 推荐 |
|------|------|--------|--------|------|
| A: 纯 regex | 无额外依赖 | 低 | 中（足够） | **推荐** |
| B: ts-morph | `ts-morph` | 中 | 高 | 过度 |
| C: TypeScript compiler API | `typescript` (已有) | 高 | 高 | 过度 |

**选择 A（纯 regex）理由：**
1. 路由文件结构极其规则（`handler: fooEndpoint`）
2. barrel export 结构规则（`export { ... } from '...'`）
3. coverage-final.json 是结构化 JSON，无需 AST 解析
4. 测试文件中的直接调用模式有限且可枚举
5. 项目已有 `typescript`、`vitest`，无需引入新依赖
6. 复杂度与收益比最优 — 200 行 regex 脚本即可覆盖 95%+ 场景

**处理 corner case：**
- 重命名导出：通过 barrel export 解析自然解决（`index.ts` 中的名称就是路由使用的名称）
- 默认导入：本项目不使用默认导入 endpoint，可忽略或加 TODO
- wrapper 函数：如 `withAuth(handler)`，regex 会提取 `handler` 名称，coverage 中查找的是 wrapper 函数名 — 这种情况标记为 `needs-manual-review`

---

## 5. CI / 覆盖率流程集成点

### 集成点 1: test:coverage 后自动运行
```json
"test:coverage:gap": "vitest run --coverage && npx ts-node --esm scripts/coverage-gap-scanner.ts --threshold 0"
```

### 集成点 2: 阈值告警
- `--threshold <number>`: 允许的最大 `uncovered` + `indirect` handler 数量
- 超过阈值时 exit code = 1，CI 失败

### 集成点 3: 与现有 check:release 集成
```json
"check:release": "npm run lint && npm run format:check && npm run typecheck && npm run test:coverage:phase4 -- --coverage.reporter=text && npm run test:coverage:gap && npm run test:release"
```

### 集成点 4: 定期报告（可选）
GitHub Action 或本地 cron 运行，将 JSON 报告提交到 `.workflow/scratch/` 供趋势分析。

---

## 6. 验收标准

### 功能验收
- [ ] 能正确解析 7 个 route 文件，提取所有 handler 名称（当前约 120+ 个）
- [ ] 能正确通过 barrel export 建立 handler -> 源文件映射
- [ ] 能从 coverage-final.json 读取每个 handler 的命中次数
- [ ] 能扫描 `tests/**/*.test.ts` 检测直接调用（跨目录）
- [ ] 正确分类 `covered` / `indirect` / `uncovered`
- [ ] 输出控制台表格 + JSON 报告

### 准确性验收
- [ ] `healthCheck` 标记为 `covered`（tests/mcp/health-endpoints.test.ts 直接调用）
- [ ] `listModels` 标记为 `covered`（同上）
- [ ] `workflowRouteEndpoint` 标记为 `covered`（workflow-endpoints.integration.test.ts 直接调用）
- [ ] `workflowPlanEndpoint` 标记为 `covered`（同上）
- [ ] `writingCraftAnalyzeEndpoint` 标记为 `covered`（writing-craft-endpoints.test.ts 直接调用）
- [ ] `pluginListEndpoint` 标记为 `covered`（plugin-endpoints.test.ts 直接调用）
- [ ] `metricsEndpoint` 标记为 `indirect`（仅 platform-routes.test.ts 测试 route 结构，无直接调用）
- [ ] `listTools` 标记为 `indirect`（同上）
- [ ] `getConfig` 标记为 `indirect`（同上）
- [ ] `updateConfig` 标记为 `indirect`（同上）
- [ ] `getSecrets` 标记为 `indirect`（同上）
- [ ] `updateSecrets` 标记为 `indirect`（同上）
- [ ] `reloadConfig` 标记为 `indirect`（同上）
- [ ] `chatStreamEndpoint` 标记为 `indirect`（仅 content-routes-chat.test.ts 测试 route 存在性）
- [ ] `memorySearchEndpoint` 标记为 `indirect`（同上）
- [ ] `graphQueryEndpoint` 标记为 `indirect`（同上）
- [ ] `wikiListEndpoint` 标记为 `indirect`（同上）
- [ ] `novelQualityCheckEndpoint` 标记为 `indirect`（同上）
- [ ] `workspaceContextEndpoint` 标记为 `indirect`（同上）
- [ ] `writingHelperProcessEndpoint` 标记为 `indirect`（同上）
- [ ] `writingStreamEndpoint` 标记为 `indirect`（同上）
- [ ] `writingCraftEmotionalArcEndpoint` 标记为 `indirect`（同上）
- [ ] `writingCraftVoiceConsistencyEndpoint` 标记为 `indirect`（同上）
- [ ] `writingCraftReaderImmersionEndpoint` 标记为 `indirect`（同上）
- [ ] `writingCraftPacingNavigatorEndpoint` 标记为 `indirect`（同上）
- [ ] `writingCraftLLMEndpoint` 标记为 `covered`（writing-craft-endpoints.test.ts 直接调用）
- [ ] `pluginExecuteEndpoint` 标记为 `covered`（plugin-endpoints.test.ts 直接调用）
- [ ] `pluginRegisterEndpoint` 标记为 `covered`（同上）
- [ ] `syncStatusEndpoint` 标记为 `indirect`（同上）
- [ ] `syncPushEndpoint` 标记为 `indirect`（同上）
- [ ] `syncPullEndpoint` 标记为 `indirect`（同上）
- [ ] `syncFullEndpoint` 标记为 `indirect`（同上）
- [ ] `foreshadowPlantEndpoint` 标记为 `indirect`（同上）
- [ ] `foreshadowStatsEndpoint` 标记为 `indirect`（同上）
- [ ] `characterProfileEndpoint` 标记为 `indirect`（同上）
- [ ] `characterDepthEndpoint` 标记为 `indirect`（同上）
- [ ] `characterRelationshipsEndpoint` 标记为 `indirect`（同上）
- [ ] `analysisPatternsEndpoint` 标记为 `indirect`（同上）
- [ ] `analysisSessionsEndpoint` 标记为 `indirect`（同上）
- [ ] `analysisNarrativeVisualizationEndpoint` 标记为 `indirect`（同上）
- [ ] `learningImportEndpoint` 标记为 `indirect`（同上）
- [ ] `learningStyleFeedbackEndpoint` 标记为 `indirect`（同上）
- [ ] `learningStyleDriftEndpoint` 标记为 `indirect`（同上）
- [ ] `learningRulesEndpoint` 标记为 `indirect`（同上）
- [ ] `learningReadingSessionEndpoint` 标记为 `indirect`（同上）
- [ ] `learningReadingExtractEndpoint` 标记为 `indirect`（同上）
- [ ] `learningStatusEndpoint` 标记为 `indirect`（同上）
- [ ] `sbGetEntitiesEndpoint` 标记为 `indirect`（同上）
- [ ] `sbGetEntityEndpoint` 标记为 `indirect`（同上）
- [ ] `sbCreateEntityEndpoint` 标记为 `indirect`（同上）
- [ ] `sbUpdateEntityEndpoint` 标记为 `indirect`（同上）
- [ ] `sbDeleteEntityEndpoint` 标记为 `indirect`（同上）
- [ ] `sbExtractFromManuscriptEndpoint` 标记为 `indirect`（同上）
- [ ] `sbGetCompletenessEndpoint` 标记为 `indirect`（同上）
- [ ] `qcValidateOutputEndpoint` 标记为 `indirect`（同上）
- [ ] `qcGetCreativityConfigEndpoint` 标记为 `indirect`（同上）
- [ ] `cwGenerateAutoEndpoint` 标记为 `indirect`（同上）
- [ ] `cwGenerateGuidedEndpoint` 标记为 `indirect`（同上）
- [ ] `cwGetModesEndpoint` 标记为 `indirect`（同上）
- [ ] `cwGetCreativityPresetsEndpoint` 标记为 `indirect`（同上）
- [ ] `rsAnalyzeEndpoint` 标记为 `indirect`（同上）
- [ ] `rsGetPersonasEndpoint` 标记为 `indirect`（同上）
- [ ] `rsCreateCustomPersonaEndpoint` 标记为 `indirect`（同上）
- [ ] `rsGetOverlayEndpoint` 标记为 `indirect`（同上）
- [ ] `rsAIFlavorEndpoint` 标记为 `indirect`（同上）
- [ ] `rsFeedbackEndpoint` 标记为 `indirect`（同上）
- [ ] `rsCompareEndpoint` 标记为 `indirect`（同上）
- [ ] `rsDeAIEndpoint` 标记为 `indirect`（同上）
- [ ] `agentRouteEndpoint` 标记为 `indirect`（仅 agents-routes.test.ts 测试 route 结构）
- [ ] `agentWriteEndpoint` 标记为 `indirect`（同上）
- [ ] `agentReviseEndpoint` 标记为 `indirect`（同上）
- [ ] `agentContextEndpoint` 标记为 `indirect`（同上）
- [ ] `criticEvaluateEndpoint` 标记为 `indirect`（同上）
- [ ] `criticSuggestionsEndpoint` 标记为 `indirect`（同上）
- [ ] `criticConsistencyEndpoint` 标记为 `indirect`（同上）
- [ ] `consistencyCheckEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsListEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsLoadEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsMatchEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsChainEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsCreateEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsSaveEndpoint` 标记为 `indirect`（同上）
- [ ] `skillsDeleteEndpoint` 标记为 `indirect`（同上）
- [ ] `reviseMultiPassEndpoint` 标记为 `indirect`（同上）
- [ ] `styleExtractEndpoint` 标记为 `indirect`（同上）
- [ ] `styleProfileEndpoint` 标记为 `indirect`（同上）
- [ ] `styleApplyEndpoint` 标记为 `indirect`（同上）
- [ ] `crossChapterConsistencyEndpoint` 标记为 `indirect`（同上）
- [ ] `contextAwareSuggestionsEndpoint` 标记为 `indirect`（同上）
- [ ] `worldviewExtractEndpoint` 标记为 `indirect`（同上）
- [ ] `worldviewGetEndpoint` 标记为 `indirect`（同上）
- [ ] `listMcpServices` 标记为 `indirect`（同上）
- [ ] `createMcpService` 标记为 `indirect`（同上）
- [ ] `updateMcpService` 标记为 `indirect`（同上）
- [ ] `deleteMcpService` 标记为 `indirect`（同上）
- [ ] `setMcpServiceEnabled` 标记为 `indirect`（同上）
- [ ] `probeMcpServiceHealth` 标记为 `indirect`（同上）
- [ ] `workflowQuickRollbackEndpoint` 标记为 `covered`（workflow-endpoints.integration.test.ts 直接调用）
- [ ] `workflowRevisionStartSessionEndpoint` 标记为 `covered`（同上）
- [ ] `workflowRevisionAnalyzeEndpoint` 标记为 `covered`（同上）
- [ ] `workflowRevisionSuggestEndpoint` 标记为 `covered`（同上）
- [ ] `workflowRevisionMarkRevisedEndpoint` 标记为 `covered`（同上）
- [ ] `workflowRevisionCompareEndpoint` 标记为 `covered`（同上）
- [ ] `workflowRevisionHistoryEndpoint` 标记为 `covered`（同上）
- [ ] `workflowSchedulerRegisterEndpoint` 标记为 `covered`（同上）
- [ ] `workflowSchedulerListEndpoint` 标记为 `covered`（同上）
- [ ] `workflowSchedulerPauseEndpoint` 标记为 `covered`（同上）
- [ ] `workflowSchedulerResumeEndpoint` 标记为 `covered`（同上）
- [ ] `workflowSchedulerRunNowEndpoint` 标记为 `covered`（同上）
- [ ] `workflowSchedulerImportLitePlanEndpoint` 标记为 `covered`（同上）
- [ ] `checkpointCreateEndpoint` 标记为 `covered`（同上）
- [ ] `checkpointRestoreEndpoint` 标记为 `covered`（同上）
- [ ] `checkpointListEndpoint` 标记为 `covered`（同上）
- [ ] `uiBridgeWorkflowRouteEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowPlanEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowExecuteEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowLifecycleEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowSchedulerRegisterEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowSchedulerListEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowSchedulerPauseEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowSchedulerResumeEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowSchedulerRunNowEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `uiBridgeWorkflowSchedulerImportLitePlanEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `chatEndpoint` 标记为 `indirect`（无直接测试）
- [ ] `memoryAddEndpoint` 标记为 `indirect`（同上）
- [ ] `memoryUploadEndpoint` 标记为 `indirect`（同上）
- [ ] `memoryTemporalEndpoint` 标记为 `indirect`（同上）
- [ ] `graphCharacterEndpoint` 标记为 `indirect`（同上）
- [ ] `graphForeshadowsEndpoint` 标记为 `indirect`（同上）
- [ ] `wikiPromoteEndpoint` 标记为 `indirect`（同上）
- [ ] `wikiReadPageEndpoint` 标记为 `indirect`（同上）

### 性能验收
- [ ] 扫描全部 120+ handler + 100+ 测试文件，运行时间 < 5 秒
- [ ] 内存占用 < 100MB（coverage-final.json 约 10MB）

---

## 7. 示例输出格式

### 控制台表格

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                    MCP Endpoint Coverage Gap Report                            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Route File: platform.ts (11 handlers)                                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Status    │ Handler              │ Hits │ Source File                        ║
╠════════════╪══════════════════════╪══════╪════════════════════════════════════╣
║  covered   │ healthCheck          │  72  │ mcp/endpoints/health.ts            ║
║  covered   │ listModels           │  10  │ mcp/endpoints/health.ts            ║
║  indirect  │ metricsEndpoint      │  55  │ mcp/endpoints/health.ts            ║
║  indirect  │ listTools            │  54  │ mcp/endpoints/health.ts            ║
║  indirect  │ getConfig            │   3  │ mcp/endpoints/config.ts            ║
║  indirect  │ updateConfig         │   7  │ mcp/endpoints/config.ts            ║
║  indirect  │ getSecrets           │   3  │ mcp/endpoints/config.ts            ║
║  indirect  │ updateSecrets        │   7  │ mcp/endpoints/config.ts            ║
║  indirect  │ reloadConfig         │   3  │ mcp/endpoints/config.ts            ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  Route File: workflow.ts (32 handlers)                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  ...                                                                         ║
╠══════════════════════════════════════════════════════════════════════════════╣
║  SUMMARY                                                                     ║
║  Total handlers: 120                                                         ║
║  Covered (direct test):  23 (19%)                                            ║
║  Indirect (route test only): 87 (73%)                                        ║
║  Uncovered (0 hits):     10 (8%)                                             ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

### JSON 输出

```json
{
  "generatedAt": "2026-06-24T12:00:00Z",
  "summary": {
    "totalHandlers": 120,
    "covered": 23,
    "indirect": 87,
    "uncovered": 10,
    "coverageRate": 0.19
  },
  "routes": [
    {
      "routeFile": "mcp/routes/platform.ts",
      "handlerCount": 11,
      "handlers": [
        {
          "name": "healthCheck",
          "status": "covered",
          "hits": 72,
          "sourceFile": "mcp/endpoints/health.ts",
          "testFiles": ["tests/mcp/health-endpoints.test.ts"]
        },
        {
          "name": "metricsEndpoint",
          "status": "indirect",
          "hits": 55,
          "sourceFile": "mcp/endpoints/health.ts",
          "testFiles": ["tests/mcp/routes/platform-routes.test.ts"]
        }
      ]
    }
  ],
  "gaps": [
    {
      "name": "someUncoveredEndpoint",
      "status": "uncovered",
      "hits": 0,
      "sourceFile": "mcp/endpoints/some.ts",
      "routeFile": "mcp/routes/content.ts",
      "method": "POST",
      "pattern": "^/some/path$"
    }
  ]
}
```

---

## 8. 代码框架（TypeScript）

```typescript
#!/usr/bin/env node
// src-ts/scripts/coverage-gap-scanner.ts

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Types ──────────────────────────────────────────────────────────────────

interface HandlerInfo {
  name: string;
  routeFile: string;
  method: string;
  pattern: string;
  sourceFile: string | null;
  hits: number;
  status: 'covered' | 'indirect' | 'uncovered';
  testFiles: string[];
}

interface RouteGroup {
  routeFile: string;
  handlers: HandlerInfo[];
}

interface CoverageReport {
  summary: { total: number; covered: number; indirect: number; uncovered: number };
  routes: RouteGroup[];
  gaps: HandlerInfo[];
}

// ── Config ─────────────────────────────────────────────────────────────────

const ROOT = join(fileURLToPath(import.meta.url), '../..');
const ROUTES_DIR = join(ROOT, 'mcp/routes');
const ENDPOINTS_INDEX = join(ROOT, 'mcp/endpoints/index.ts');
const COVERAGE_PATH = join(ROOT, 'coverage/coverage-final.json');
const TESTS_DIR = join(ROOT, 'tests');

// ── Step 1: Parse route files ────────────────────────────────────────────────

function parseRouteFiles(): Omit<HandlerInfo, 'sourceFile' | 'hits' | 'status' | 'testFiles'>[] {
  const handlers: Omit<HandlerInfo, 'sourceFile' | 'hits' | 'status' | 'testFiles'>[] = [];
  const routeFiles = readdirSync(ROUTES_DIR).filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'));

  for (const routeFile of routeFiles) {
    const content = readFileSync(join(ROUTES_DIR, routeFile), 'utf-8');
    const lines = content.split('\n');

    let currentMethod = '';
    for (const line of lines) {
      const methodMatch = line.match(/method:\s*['"](\w+)['"]/);
      if (methodMatch) currentMethod = methodMatch[1];

      const handlerMatch = line.match(/handler:\s*(\w+)/);
      if (handlerMatch) {
        const patternMatch = line.match(/pattern:\s*\/\^(.*)\$\//);
        handlers.push({
          name: handlerMatch[1],
          routeFile: `mcp/routes/${routeFile}`,
          method: currentMethod,
          pattern: patternMatch ? patternMatch[1] : 'unknown',
        });
      }
    }
  }
  return handlers;
}

// ── Step 2: Parse barrel export index ──────────────────────────────────────

function parseBarrelExports(): Map<string, string> {
  const content = readFileSync(ENDPOINTS_INDEX, 'utf-8');
  const map = new Map<string, string>();

  // Match: export { foo, bar } from './path';
  const blockRegex = /export\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?/g;
  let match;
  while ((match = blockRegex.exec(content)) !== null) {
    const names = match[1].split(',').map(s => s.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    let sourcePath = match[2];

    // Resolve relative path to project-relative path
    if (sourcePath.startsWith('./')) {
      sourcePath = `mcp/endpoints/${sourcePath.slice(2)}`;
    } else if (sourcePath.startsWith('../../')) {
      // ../../knowledge/mcp/story-bible-endpoints -> knowledge/mcp/story-bible-endpoints
      sourcePath = sourcePath.replace(/^\.\.\/\.\.\//, '');
    }
    // Add .ts extension if missing
    if (!sourcePath.endsWith('.ts')) {
      sourcePath += '.ts';
    }
    // Handle reader-routes -> reader-endpoints.ts mapping
    if (sourcePath.includes('reader-routes')) {
      sourcePath = sourcePath.replace('reader-routes', 'reader-endpoints');
    }

    for (const name of names) {
      map.set(name, sourcePath);
    }
  }
  return map;
}

// ── Step 3: Read coverage data ─────────────────────────────────────────────

function readCoverage(handlerMap: Map<string, string>): Map<string, number> {
  const coverage = JSON.parse(readFileSync(COVERAGE_PATH, 'utf-8'));
  const hits = new Map<string, number>();

  for (const [handlerName, sourcePath] of handlerMap) {
    // Find matching coverage file key (absolute path ending with sourcePath)
    const coverageKey = Object.keys(coverage).find(k => k.replace(/\\/g, '/').endsWith(sourcePath));
    if (!coverageKey) {
      hits.set(handlerName, -1); // not found in coverage
      continue;
    }

    const fileData = coverage[coverageKey];
    const fnMap = fileData.fnMap || {};
    const f = fileData.f || {};

    // Find function index matching handler name
    let handlerHits = 0;
    for (const [idx, fn] of Object.entries(fnMap)) {
      if ((fn as any).name === handlerName) {
        handlerHits = f[idx] || 0;
        break;
      }
    }
    hits.set(handlerName, handlerHits);
  }
  return hits;
}

// ── Step 4: Scan test files for direct calls ─────────────────────────────────

function findTestReferences(handlerNames: string[]): Map<string, string[]> {
  const refs = new Map<string, string[]>();
  for (const name of handlerNames) refs.set(name, []);

  function scanDir(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(path);
      } else if (entry.name.endsWith('.test.ts')) {
        const content = readFileSync(path, 'utf-8');
        for (const name of handlerNames) {
          // Check for direct call: handlerName(
          const callRegex = new RegExp(`\\b${name}\\b\\s*\\(`);
          // Check for import from endpoints
          const importRegex = new RegExp(`import\\s*\\{[^}]*\\b${name}\\b[^}]*\\}\\s*from\\s*['"][^'"]*endpoints[^'"]*['"]`);
          // Check for dynamic import
          const dynImportRegex = new RegExp(`import\\s*\\([^)]*endpoints[^)]*\\).*{[^}]*\\b${name}\\b`);

          if (callRegex.test(content) || importRegex.test(content) || dynImportRegex.test(content)) {
            const relPath = relative(ROOT, path).replace(/\\/g, '/');
            const list = refs.get(name)!;
            if (!list.includes(relPath)) list.push(relPath);
          }
        }
      }
    }
  }

  scanDir(TESTS_DIR);
  return refs;
}

// ── Step 5: Classify and report ──────────────────────────────────────────────

function classify(handlers: ReturnType<typeof parseRouteFiles>, barrelMap: Map<string, string>, coverageHits: Map<string, number>, testRefs: Map<string, string[]>): CoverageReport {
  const routes: RouteGroup[] = [];
  const gaps: HandlerInfo[] = [];

  // Group by route file
  const byRouteFile = new Map<string, HandlerInfo[]>();

  for (const h of handlers) {
    const sourceFile = barrelMap.get(h.name) || null;
    const hits = coverageHits.get(h.name) ?? 0;
    const testFiles = testRefs.get(h.name) || [];

    // Determine status
    let status: HandlerInfo['status'];
    if (hits <= 0) {
      status = 'uncovered';
    } else if (testFiles.length > 0 && testFiles.some(f => !f.includes('routes/'))) {
      // Has direct test in non-route test file
      status = 'covered';
    } else if (testFiles.length > 0) {
      // Only referenced in route tests (indirect)
      status = 'indirect';
    } else {
      // Has coverage hits but no test file reference (maybe called by other code)
      status = 'indirect';
    }

    const info: HandlerInfo = { ...h, sourceFile, hits, status, testFiles };

    if (!byRouteFile.has(h.routeFile)) {
      byRouteFile.set(h.routeFile, []);
    }
    byRouteFile.get(h.routeFile)!.push(info);

    if (status !== 'covered') {
      gaps.push(info);
    }
  }

  for (const [routeFile, handlers] of byRouteFile) {
    routes.push({ routeFile, handlers });
  }

  const total = handlers.length;
  const covered = routes.flatMap(r => r.handlers).filter(h => h.status === 'covered').length;
  const indirect = routes.flatMap(r => r.handlers).filter(h => h.status === 'indirect').length;
  const uncovered = routes.flatMap(r => r.handlers).filter(h => h.status === 'uncovered').length;

  return { summary: { total, covered, indirect, uncovered }, routes, gaps };
}

// ── Console output ───────────────────────────────────────────────────────────

function printTable(report: CoverageReport) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                    MCP Endpoint Coverage Gap Report                            ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════════╣');

  for (const route of report.routes) {
    console.log(`║  Route File: ${route.routeFile} (${route.handlers.length} handlers)`);
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
    console.log('║  Status    │ Handler              │ Hits │ Source File                        ║');
    console.log('╠════════════╪══════════════════════╪══════╪════════════════════════════════════╣');
    for (const h of route.handlers) {
      const statusTag = h.status === 'covered' ? 'covered  ' : h.status === 'indirect' ? 'indirect ' : 'uncovered';
      const source = (h.sourceFile || 'unknown').padEnd(34);
      console.log(`║  ${statusTag} │ ${h.name.padEnd(20)} │ ${String(h.hits).padStart(4)} │ ${source} ║`);
    }
    console.log('╠══════════════════════════════════════════════════════════════════════════════╣');
  }

  const { summary } = report;
  console.log('║  SUMMARY                                                                     ║');
  console.log(`║  Total handlers: ${String(summary.total).padEnd(63)}║`);
  console.log(`║  Covered (direct test):  ${String(summary.covered).padEnd(53)}║`);
  console.log(`║  Indirect (route test only): ${String(summary.indirect).padEnd(50)}║`);
  console.log(`║  Uncovered (0 hits):     ${String(summary.uncovered).padEnd(52)}║`);
  console.log('╚══════════════════════════════════════════════════════════════════════════════╝');
}

// ── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const handlers = parseRouteFiles();
  const barrelMap = parseBarrelExports();
  const coverageHits = readCoverage(barrelMap);
  const testRefs = findTestReferences(handlers.map(h => h.name));
  const report = classify(handlers, barrelMap, coverageHits, testRefs);

  printTable(report);

  // JSON output
  const jsonPath = process.argv.find(a => a.startsWith('--json='))?.slice(7) || 'coverage-gap-report.json';
  if (process.argv.includes('--json') || process.argv.some(a => a.startsWith('--json='))) {
    const fs = await import('node:fs');
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\nReport written to ${jsonPath}`);
  }

  // Threshold check
  const thresholdArg = process.argv.find(a => a.startsWith('--threshold='));
  if (thresholdArg) {
    const threshold = parseInt(thresholdArg.slice(12), 10);
    const gapCount = report.gaps.length;
    if (gapCount > threshold) {
      console.error(`\nERROR: ${gapCount} handlers have coverage gaps, threshold is ${threshold}`);
      process.exit(1);
    }
  }
}

main();
```

---

## 9. 已知限制与后续改进

1. **reader-routes.ts 文件名映射**: `endpoints/index.ts` 中 re-export 自 `../../reader/mcp/reader-routes`，但实际文件名为 `reader-endpoints.ts`。脚本已硬编码处理此映射，若未来新增类似差异需扩展映射表。
2. **Wrapper 函数**: 若 route 使用 `handler: withAuth(fooEndpoint)`，regex 会提取 `withAuth` 而非 `fooEndpoint`。此类情况需手动审查，或扩展 AST 解析。
3. **跨 workspace 间接调用**: 某些测试通过 gateway-e2e helpers 间接调用 endpoint，无法通过静态分析检测。这类情况归为 `indirect` 是合理近似。
4. **Phase 4 增量**: 当前 coverage 数据来自 `test:coverage:phase4`，若需完整覆盖分析应使用 `test:coverage`（全量测试）。
