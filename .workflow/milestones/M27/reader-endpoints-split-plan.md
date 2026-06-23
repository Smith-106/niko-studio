# reader-endpoints.ts 拆分方案

**文档性质**: 拆分方案文档化，执行 deferred 到 M28+（ISS-20260621-013）
**日期**: 2026-06-22
**来源**: M27 Phase 2 analyze (ANL-20260622-P2-frontend-integration, F-005 / C-004)

## 概述

`src-ts/reader/mcp/reader-endpoints.ts` 当前 1146 行，承载 13 个导出函数 + 11 个导出接口，已成 god module。本次 M27 Phase 2 仅文档化拆分方案，**不执行拆分**。执行 deferred 到 M28+，届时需专项测试与架构决策。

**既有 issue**: ISS-20260621-013 (来源: M26-P1 quality-retrospective, INS-19806c80)

## 当前导出清单

### 导出函数（13 个）

| 行号 | 函数名 | 类型 |
|------|--------|------|
| L379 | `rsAnalyzeEndpoint` | async HTTP endpoint |
| L527 | `rsGetPersonasEndpoint` | async HTTP endpoint |
| L547 | `rsCreateCustomPersonaEndpoint` | async HTTP endpoint |
| L621 | `rsGetOverlayEndpoint` | async HTTP endpoint |
| L662 | `rsAIFlavorEndpoint` | async HTTP endpoint |
| L711 | `clearReaderStores` | async utility |
| L718 | `getCustomPersonaStore` | sync singleton getter |
| L722 | `getAnalysisResultCache` | sync singleton getter |
| L726 | `getFeedbackAggregateStore` | sync singleton getter |
| L730 | `clearFeedbackAggregateStore` | sync utility |
| L744 | `rsFeedbackEndpoint` | async HTTP endpoint |
| L925 | `rsCompareEndpoint` | async HTTP endpoint |
| L1050 | `rsDeAIEndpoint` | async HTTP endpoint |

### 导出接口（11 个）

| 行号 | 接口名 |
|------|--------|
| L160 | `AnalyzeRequest` |
| L166 | `CreatePersonaRequest` |
| L171 | `DeAIRequest` |
| L178 | `DeAIResponse` |
| L197 | `FeedbackRequest` |
| L205 | `FeedbackAggregate` |
| L216 | `FeedbackResponse` |
| L228 | `CompareVersionInput` |
| L233 | `CompareRequest` |
| L240 | `CompareResult` |
| L359 | `OverlayMarker` |

## 4 个功能组划分

### 组 A: analyze + overlay

**职责**: 文本分析 + 覆盖层标记

| 类型 | 符号 |
|------|------|
| endpoint | `rsAnalyzeEndpoint` |
| endpoint | `rsGetOverlayEndpoint` |
| interface | `AnalyzeRequest` |
| interface | `OverlayMarker` |
| store getter | `getAnalysisResultCache` |

**内部依赖**: `getAnalysisResultCache` 被 `rsAnalyzeEndpoint` 缓存结果；`OverlayMarker` 被 overlay endpoint 使用

### 组 B: personas

**职责**: 读者画像管理

| 类型 | 符号 |
|------|------|
| endpoint | `rsGetPersonasEndpoint` |
| endpoint | `rsCreateCustomPersonaEndpoint` |
| interface | `CreatePersonaRequest` |
| store getter | `getCustomPersonaStore` |

**内部依赖**: `getCustomPersonaStore` 被 `rsCreateCustomPersonaEndpoint` 创建新 persona；personas 被 analyze/feedback 组读取

### 组 C: feedback

**职责**: 读者反馈收集与聚合

| 类型 | 符号 |
|------|------|
| endpoint | `rsFeedbackEndpoint` |
| interface | `FeedbackRequest` |
| interface | `FeedbackAggregate` |
| interface | `FeedbackResponse` |
| store getter | `getFeedbackAggregateStore` |
| store utility | `clearFeedbackAggregateStore` |

**内部依赖**: `FeedbackAggregate` 被 `rsFeedbackEndpoint` 聚合；store 被 `clearReaderStores` 清理

### 组 D: compare + deai

**职责**: 版本对比 + 去 AI 味处理

| 类型 | 符号 |
|------|------|
| endpoint | `rsCompareEndpoint` |
| endpoint | `rsDeAIEndpoint` |
| interface | `CompareVersionInput` |
| interface | `CompareRequest` |
| interface | `CompareResult` |
| interface | `DeAIRequest` |
| interface | `DeAIResponse` |

**内部依赖**: `CompareResult` 可能引用 `DualEngineResult`（来自 analyze）；`DeAIResponse` 独立

### 跨组共享

| 符号 | 依赖组 |
|------|--------|
| `clearReaderStores` | 所有组（清理全部 store） |
| `DualEngineResult` (类型) | 组 A + 组 D |

## 组间依赖关系

```
组 A (analyze+overlay)
  ├─ 组 B (personas): analyze 读取 personas 作为分析上下文
  └─ 组 D (compare): compare 引用 DualEngineResult 类型

组 B (personas)
  └─ 无上游依赖（叶子组）

组 C (feedback)
  └─ 无上游依赖（叶子组）

组 D (compare+deai)
  ├─ 组 A: CompareResult 引用 DualEngineResult
  └─ 组 B: deai 可能读取 personas

共享: clearReaderStores 跨组清理
```

## 拆分顺序

最小化破坏面，叶子组优先：

1. **组 B (personas)** — 叶子组，零上游依赖，独立拆出 `reader-endpoints-personas.ts`
2. **组 C (feedback)** — 叶子组，零上游依赖，独立拆出 `reader-endpoints-feedback.ts`
3. **组 A (analyze+overlay)** — 依赖组 B 的 personas 读取，拆出 `reader-endpoints-analyze.ts`
4. **组 D (compare+deai)** — 依赖组 A 的 DualEngineResult，拆出 `reader-endpoints-compare.ts`
5. **主文件** — 保留 `clearReaderStores` + 全组 re-export 路由（向后兼容），逐步瘦身

### 每步验证

| 步骤 | 验证动作 |
|------|---------|
| 拆出组 B | `tsc --noEmit` + personas 相关测试 |
| 拆出组 C | `tsc --noEmit` + feedback 相关测试 |
| 拆出组 A | `tsc --noEmit` + analyze + overlay 测试 |
| 拆出组 D | `tsc --noEmit` + compare + deai 测试 |
| 主文件瘦身 | 全量 `vitest run` 回归 |

## 测试影响范围

### 生产消费者

| 文件 | import 符号 |
|------|------------|
| `src-ts/mcp/server.ts` | 全部 6 个 HTTP endpoint 路由注册 |
| `src-ts/reader/mcp/reader-endpoints.test.ts` | endpoint 函数测试 |
| `src-ts/tests/reader/reader-endpoints.validation.test.ts` | 输入校验测试 |

### 拆分后需更新

- `src-ts/mcp/server.ts`: import 路径从单文件拆分为 4 个子文件（或从主文件 re-export）
- 测试文件: import 路径同步更新
- `src-ts/mcp/services/` 中引用 reader-endpoints 类型的服务文件

### 向后兼容策略

主文件保留 re-export 锚点（遵循 `组件子目录 + 兼容性 re-export 锚模式` coding spec），允许旧 import 路径继续工作，逐步迁移：

```typescript
// reader-endpoints.ts (向后兼容 re-export 锚)
export { rsAnalyzeEndpoint, rsGetOverlayEndpoint, ... } from './reader-endpoints-analyze'
export { rsGetPersonasEndpoint, rsCreateCustomPersonaEndpoint, ... } from './reader-endpoints-personas'
// ... 逐步清理
```

## 风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 拆分后 singleton store 跨文件共享问题 | Medium | High | store 统一放在 `reader-stores.ts` 或 DI 容器 |
| 组间依赖比预期复杂 | Low | Medium | 按实际代码复核，本方案标注为「初步划分，M28+ 执行时复核」 |
| 路由注册文件改动大 | Medium | Medium | re-export 锚保持旧路径兼容 |
| 测试文件 import 路径批量更新 | Medium | Low | grep 辅助批量替换 + tsc 验证 |

## 备注

- 本方案为 M27 Phase 2 analyze 产出（ANL-20260622-P2-frontend-integration），**初步划分，M28+ 执行时复核**
- 既有 issue ISS-20260621-013 跟踪实际拆分执行
- lazy singleton (ARCH-002) 问题需在拆分时一并解决——store 应改为 DI 或显式初始化
