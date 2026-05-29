# F-004: Translations Modularize — System Architect Analysis

## Architecture Approach

将 2892 行的单体 `translations.ts` 按功能域拆分为独立模块，支持按需加载和独立维护。核心约束：保持所有 translation key 路径不变，确保 `useI18n()` hook 的返回类型 `Translations` 接口向后兼容。

### Design Rationale

- 2892 行单文件编辑体验极差，IDE 响应慢
- 多人协作时合并冲突频繁（所有翻译修改都在同一文件）
- 无法 tree-shake 未使用的翻译（整体打包）
- 按需加载可减少初始 bundle 大小

## Data Model

### Module Structure

```
desktop/src/i18n/
├── index.ts              // re-export useI18n, Translations type
├── types.ts              // Translations interface (完整类型定义)
├── loader.ts             // ModuleLoader<TranslationModule> 实现
├── modules/
│   ├── common.ts         // appTitle, serviceRunning, etc. (~200 lines)
│   ├── chat.ts           // startWriting, thinking, workflow, etc. (~400 lines)
│   ├── editor.ts         // 编辑器相关 (~300 lines)
│   ├── evaluation.ts     // 评估面板相关 (~400 lines)
│   ├── knowledge.ts      // 知识库相关 (~350 lines)
│   ├── settings.ts       // 设置页面 (~250 lines)
│   ├── workflow.ts       // 工作流相关 (~400 lines)
│   └── export.ts         // 导出相关 (~200 lines)
└── legacy.ts             // 过渡期：完整合并对象（渐进迁移用）
```

### Entity Relationships

```
Translations (interface) ──(composed of)──> TranslationModule[] (8 modules)
useI18n() ──(returns)──> Translations (merged object, type unchanged)
loader.ts ──(loads)──> modules/*.ts (lazy or eager based on config)
```

### Key Constraint: Interface Stability

```typescript
// types.ts — 完整接口保持不变
export interface Translations {
  appTitle: string;
  serviceRunning: string;
  // ... 所有现有 key 保持原位
}

// 每个 module 导出 partial
export type ChatTranslations = Pick<Translations, 'startWriting' | 'thinking' | ...>;
```

## State Machine: Translation Loading

```
[boot] ──(app start)──> [loading-common]
                              │
                              ├──(common loaded)──> [ready-partial]
                              │                          │
                              │    (module requested) ───┘
                              │         │
                              │         v
                              │    [loading-module]
                              │         │
                              │         ├──(loaded)──> [ready-partial] (updated)
                              │         └──(error)──> [ready-partial] (fallback to key)
                              │
                              └──(error)──> [fallback-keys]
```

| From | Event | To | Side Effect |
|------|-------|----|-------------|
| boot | app start | loading-common | 加载 common module |
| loading-common | loaded | ready-partial | 渲染可用 |
| loading-common | error | fallback-keys | 显示 raw key |
| ready-partial | module requested | loading-module | 按需加载 |
| loading-module | loaded | ready-partial | 合并到 translations 对象 |
| loading-module | error | ready-partial | 该模块 key 显示 fallback |

## Error Handling Strategy

- Common module 加载失败 MUST 降级为显示 key 本身（`appTitle` 显示为 "appTitle"）
- 非 common module 加载失败 SHOULD 不阻塞页面渲染，仅影响对应功能区域
- 语言切换时 MUST 原子性替换所有已加载模块（避免中英混显）
- 模块文件损坏 MUST 有 integrity check（hash 校验或 type guard）

## Integration Points

- `useI18n()` hook 返回类型 MUST NOT 变更——所有 consumer 无感知
- `Language` type (`'zh' | 'en'`) MUST NOT 变更
- 构建系统 SHOULD 支持两种模式：eager（全量打包，兼容现有）和 lazy（按需加载）
- 初期 SHOULD 使用 eager 模式确保零回归，验证后切换到 lazy

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Key 遗漏（拆分时丢失某个 key） | Medium | High | TypeScript 编译检查 + 完整性测试 |
| 加载顺序导致闪烁 | Medium | Medium | Common module 同步加载，其余预加载 |
| 合并冲突（过渡期两套文件并存） | Low | Low | 短过渡期，一次性迁移 |
| i18n 工具链不兼容 | Low | Medium | 保持 flat key 结构，不引入 namespace |

**总体风险**: LOW-MEDIUM — 类型系统提供强保障，但需要仔细的 key 完整性验证。
