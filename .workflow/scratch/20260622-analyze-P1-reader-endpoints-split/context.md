---
related:
  - project-project
  - roadmap-roadmap
  - scratch-20260622-analyze-p1-reader-endpoints-split-analysis
  - scratch-20260622-analyze-p1-reader-endpoints-split-discussion
---

# Context: Phase 1 — Reader Endpoints Split + Remaining Input Validation

**Date**: 2026-06-24
**Areas discussed**: 模块拆分边界、向后兼容策略、校验补齐范围、初始化顺序与测试隔离

## Decisions

### Decision 1: 拆分方案与文件职责
- **Context**: `src-ts/reader/mcp/reader-endpoints.ts` 包含 8 个 endpoint handler、10+ 类型、5 个 lazy singleton、3 个 mutable store、文件持久化 helper、反馈权重逻辑，已成 god module。
- **Options**:
  1. 校验优先，拆分后续
  2. 拆分优先，校验后续
  3. 拆分 + 校验 + 兼容性 shim
- **Chosen**: 3 — 拆分 + 校验 + 兼容性 shim
- **Reason**: 一次 phase 内同时收敛 ISS-20260621-013 与 ISS-20260622-006；shim 保护既有测试与 barrel 调用方，避免 CI 断裂。

### Decision 2: 新增通用校验 helper 的位置
- **Context**: 需要为数组、枚举、标签等新增可复用校验。
- **Options**:
  1. 全部放入 `reader-validation.ts`
  2. 通用 helper 放入 `input-validation.ts`，Reader 领域校验放入 `reader-validation.ts`
- **Chosen**: 2
- **Reason**: 复用 M27 已建立的共享校验模块，避免 ad-hoc 内联；`validateStringArray` / `validateEnum` 可被其他 endpoint 复用。

### Decision 3: DIMENSION_TO_PARAM 归属
- **Context**: 反馈权重调整依赖维度到参数的映射，当前与 endpoint handler 同文件。
- **Options**:
  1. 随 singleton/store 放入 `reader-services.ts`
  2. 随校验逻辑放入 `reader-validation.ts`
- **Chosen**: 2
- **Reason**: 该映射是领域规则而非服务状态，放入 validation 层可避免 routes→services 的隐藏依赖。

### Decision 4: customPersonaStore 初始化顺序
- **Context**: `loadCustomPersonas()` 在模块顶层调用，拆分后不能丢失 ready 语义。
- **Options**:
  1. 每个 endpoint 手动 await load promise
  2. `reader-services.ts` 提供 ready guard / getter 隐式等待
- **Chosen**: 2
- **Reason**: 最小改动，保持现有调用语义，避免每个 endpoint 重复 await。

## Constraints

### Locked
1. **必须保留 `reader-endpoints.ts` 作为 re-export shim 直到所有测试迁移完成。**  
   原因：8 个测试文件直接 import 该路径；硬拆会立即破坏 CI。
2. **新增校验必须优先扩展 `src-ts/mcp/input-validation.ts`，禁止在 endpoint handler 中写 ad-hoc 校验。**  
   原因：保持与 M27 一致，便于统一测试和维护。
3. **`DIMENSION_TO_PARAM` 必须作为单一真相源从 `reader-validation.ts` 导出。**  
   原因：避免重复映射和隐藏依赖。
4. **`loadCustomPersonas()` 的 ready 语义必须保留；任何读取 `customPersonaStore` 的 endpoint 必须等待初始化完成。**  
   原因：防止模块拆分后出现 custom persona 丢失的 race。

### Free
1. **常量具体取值**（如 `MAX_ARRAY_LENGTH`、`MAX_ARRAY_ITEM_LENGTH`、`MAX_LABEL_LENGTH`）可在实现时根据业务调整，但需满足“足够小以限制 DoS，足够大以不影响正常用例”。  
   建议默认值：`MAX_ARRAY_LENGTH = 64`，`MAX_ARRAY_ITEM_LENGTH = 200`，`MAX_LABEL_LENGTH = 200`，`MAX_PERSONA_ID_LENGTH = 256`，`MAX_FEEDBACK_ID_LENGTH = 256`，`MAX_DIMENSION_LENGTH = 100`，`MAX_TARGET_STYLE_LENGTH = 200`。
2. **ready guard 的具体实现形式**（Promise 变量 / getter 包装 / 显式 `getCustomPersonaStoreReady()`）由实现者选择，只要满足 Locked #4 即可。
3. **barrel 文件是否直接指向子模块或仍指向 shim** 由实现者选择；最终目标是在 shim 移除前所有外部 import 通过 barrel 即可。

### Deferred
1. **彻底移除 `reader-endpoints.ts` shim** — 待测试文件逐步迁移到子模块后再执行。  
   当前已有 issue 覆盖：ISS-20260621-013。
2. **buildPersonalizedCraftProfile MCP endpoint 升级** — 不在 Phase 1 范围，见 roadmap Deferred / ISS-20260622-011。
3. **workspace.ts 桥接模式重构** — 不在 Phase 1 范围，见 roadmap Deferred / ISS-20260622-012。

## Code Context

- `src-ts/reader/mcp/reader-endpoints.ts:379` — 8 endpoint handler 起点
- `src-ts/reader/mcp/reader-endpoints.ts:160` — request/response 类型定义
- `src-ts/reader/mcp/reader-endpoints.ts:137` — lazy singleton 声明
- `src-ts/reader/mcp/reader-endpoints.ts:254` — mutable store 声明
- `src-ts/reader/mcp/reader-endpoints.ts:278` — `DIMENSION_TO_PARAM`
- `src-ts/reader/mcp/reader-endpoints.ts:578` — `focusAreas`/`biases` 仅 `Array.isArray`
- `src-ts/reader/mcp/reader-endpoints.ts:785` — `dimension` 无长度上限
- `src-ts/reader/mcp/reader-endpoints.ts:1056` — `targetStyle` 无校验
- `src-ts/reader/mcp/reader-endpoints.ts:397` — `personaIds` 元素仅类型校验
- `src-ts/reader/mcp/reader-endpoints.ts:770` — `feedbackId` 复用 `MAX_NOVEL_ID_LENGTH`
- `src-ts/reader/mcp/reader-endpoints.ts:1030-1031` — `versionA.label` / `versionB.label` 无校验
- `src-ts/mcp/input-validation.ts` — 共享校验模块
- `src-ts/mcp/routes/content.ts:151-158` — endpoint 注册
- `src-ts/mcp/endpoints/index.ts:218-227` — 全部 8 handler re-export
- `src-ts/reader/mcp/index.ts:5-23` — barrel 子集
- 8 个测试文件位于 `src-ts/tests/reader/` 和 `src-ts/reader/mcp/reader-endpoints.test.ts`
