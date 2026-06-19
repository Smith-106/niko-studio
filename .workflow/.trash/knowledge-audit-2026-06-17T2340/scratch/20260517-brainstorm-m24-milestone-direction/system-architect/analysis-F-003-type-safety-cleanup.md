# F-003: Type Safety Cleanup — System Architect Analysis

## Architecture Approach

消除前端 4 个非测试文件中的 `as any` 类型断言，通过引入精确类型定义和类型守卫恢复完整的类型安全链。这不是简单的类型标注——每个 `as any` 背后都有一个类型系统无法表达的运行时假设，MUST 将这些假设显式化。

### Design Rationale

- `as any` 是类型系统的"逃生舱"，每个使用点都是潜在的运行时错误
- 4 个文件分布在不同模块（编辑器扩展、导出、写作助手、修订编排），影响面广
- 类型加固为后续 F-006 workflow-engine 重构提供安全网

## Data Model

### 受影响文件分析

| File | `as any` Count | Root Cause | Fix Strategy |
|------|---------------|-----------|--------------|
| `MathView.tsx` | ~2 | ProseMirror node attrs 类型不完整 | 扩展 NodeSpec 类型定义 |
| `ExportDialog.tsx` | ~2 | 第三方导出库 API 类型缺失 | 声明 `.d.ts` 补充或 wrapper |
| `WritingHelperPanel.tsx` | ~3 | API 响应类型与组件 state 不匹配 | 统一 response type + 类型守卫 |
| `revisionOrchestrator.ts` | ~3 | 动态 workflow 数据结构类型丢失 | 引入 discriminated union |

### Type Enhancement Patterns

```typescript
// Pattern 1: 类型守卫替代 as any
function isRevisionResult(data: unknown): data is RevisionResult {
  return typeof data === 'object' && data !== null && 'candidates' in data;
}

// Pattern 2: Generic constraint 替代 as any
function getNodeAttr<T extends keyof MathNodeAttrs>(
  node: ProseMirrorNode, attr: T
): MathNodeAttrs[T] { ... }

// Pattern 3: Branded type 防止原始类型混用
type ChapterId = string & { readonly __brand: 'ChapterId' };
type EntityId = string & { readonly __brand: 'EntityId' };
```

## Error Handling Strategy

类型加固本身不改变运行时行为，但 MUST 确保：

- 类型守卫失败时 MUST 有明确的 fallback 路径（不是 throw）
- 新增的类型约束 MUST NOT 导致现有合法数据被拒绝
- 第三方库类型补充 SHOULD 使用 `declare module` 扩展，不修改 node_modules

## Integration Points

- `MathView.tsx` 依赖 ProseMirror 类型系统——SHOULD 检查 `@tiptap/core` 是否已有更精确的类型
- `revisionOrchestrator.ts` 与 F-006 workflow-engine 重构有交集——类型加固 MUST 先于重构完成
- `WritingHelperPanel.tsx` 的 API 响应类型与后端 `src-ts/` 的 contract types 对齐

## State Machine

不适用——本特性是纯静态分析层面的改进，无运行时状态变更。

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 类型收紧导致编译错误蔓延 | Medium | Medium | 逐文件处理，每文件独立 PR |
| 第三方库类型不完整 | Medium | Low | `.d.ts` 补充 + `// @ts-expect-error` 标注原因 |
| 过度类型化降低可读性 | Low | Low | 遵循"够用即可"原则，不追求完美 |

**总体风险**: LOW — 编译期可完全验证，不影响运行时行为。
