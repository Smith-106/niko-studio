# F-005: Craft Catalog Externalize — System Architect Analysis

## Architecture Approach

将 1584 行的 `craft-catalog.ts` 中的静态数据从 TypeScript 代码中提取为外部 JSON 数据文件，保留 TypeScript 类型定义和运行时类型守卫。数据与代码分离后，catalog 可独立更新、热加载，且不需要重新编译。

### Design Rationale

- 1584 行中 90%+ 是纯数据（pattern 定义、keywords、structure 描述），不是逻辑
- 数据更新（新增写作技巧）当前需要完整编译周期
- 外置后可支持用户自定义 catalog 扩展（未来方向）
- JSON 格式便于非开发者（编辑、写作教练）贡献内容

## Data Model

### File Structure (After)

```
src-ts/narrative/writing-craft/
├── craft-catalog.ts          // 类型定义 + loader + type guards (< 200 lines)
├── craft-catalog.schema.json // JSON Schema for validation
└── data/
    ├── satisfaction-patterns.json    // SatisfactionPattern 数据
    ├── tension-techniques.json       // 张力技巧数据
    ├── character-archetypes.json     // 角色原型数据
    ├── narrative-structures.json     // 叙事结构数据
    └── genre-conventions.json        // 类型惯例数据
```

### Entity: CatalogManifest

```typescript
interface CatalogManifest {
  version: string;                    // semver, 用于兼容性检查
  modules: CatalogModuleRef[];        // 模块引用列表
  checksum: string;                   // 完整性校验
}

interface CatalogModuleRef {
  id: string;                         // 'satisfaction-patterns'
  path: string;                       // 相对路径
  schema: string;                     // schema $ref
  entryCount: number;                 // 条目数（快速校验）
}
```

### Entity: CatalogEntry (Generic)

```typescript
interface CatalogEntry<T extends string> {
  id: T;                              // enum value
  label: string;                      // 显示名称
  category: string;                   // 分类
  metadata: Record<string, unknown>;  // 类型特定数据
}
```

### Relationships

```
CatalogManifest ──(1:N)──> CatalogModuleRef
CatalogModuleRef ──(1:1)──> JSON data file
craft-catalog.ts ──(loads)──> CatalogManifest ──(resolves)──> data files
TypeScript enums (SatisfactionPattern, etc.) ──(unchanged)──> consumer code
```

## State Machine: Catalog Loading

```
[unloaded] ──(init)──> [loading-manifest]
                             │
                             ├──(manifest valid)──> [loading-modules]
                             │                           │
                             │                           ├──(all loaded)──> [ready]
                             │                           │                     │
                             │                           └──(partial fail)──> [degraded]
                             │                                                  │
                             └──(manifest invalid)──> [fallback-bundled]        │
                                                           │                    │
                                                           └────────────────────┴──> [ready]
```

| From | Event | To | Side Effect |
|------|-------|----|-------------|
| unloaded | init | loading-manifest | 读取 manifest.json |
| loading-manifest | valid | loading-modules | 并行加载所有 module |
| loading-manifest | invalid | fallback-bundled | 使用编译时内嵌的 fallback 数据 |
| loading-modules | all loaded | ready | schema 校验 + 类型守卫 |
| loading-modules | partial fail | degraded | 可用模块正常，失败模块用 fallback |

## Error Handling Strategy

- Manifest 不存在或损坏 MUST fallback 到编译时内嵌的最小数据集
- 单个 module JSON 解析失败 MUST NOT 影响其他 module 的可用性
- Schema 校验失败 MUST 记录详细错误路径（哪个字段、期望什么类型）
- 版本不兼容 SHOULD 提示用户更新，但 MUST NOT 阻塞应用启动

### Fallback Chain

```
External JSON → Bundled JSON (build-time snapshot) → Empty catalog (graceful degradation)
```

## Integration Points

### Export 接口不变

```typescript
// 现有 consumer 代码无需修改
import { SATISFACTION_PATTERNS, SatisfactionPattern } from './craft-catalog';
// 类型和 enum 保持原样导出
// 数据对象在 loader 初始化后填充
```

### 与 F-007/F-008 的关系

- F-007 叙事可视化 MAY 需要 catalog 数据来标注可视化节点
- F-008 修订工作流 SHOULD 使用 catalog 中的技巧定义来生成修订建议
- 外置后的 catalog 支持运行时扩展，为个性化推荐铺路

### Build Pipeline

- 构建时 MUST 将 JSON 数据文件复制到 dist 目录
- SHOULD 生成 bundled fallback（将 JSON inline 到一个 .ts 文件作为 fallback）
- MAY 支持 `--catalog-path` 命令行参数指定外部 catalog 路径

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| JSON 数据与 TypeScript 类型不同步 | Medium | High | CI 中运行 schema 校验 + type guard 测试 |
| 加载性能下降（多文件 I/O） | Low | Medium | 并行加载 + 缓存 + bundled fallback |
| 用户自定义 catalog 格式错误 | Medium | Low | Schema 校验 + 详细错误提示 |
| 构建流程复杂度增加 | Low | Low | 简单的 copy 步骤，不引入新工具 |

**总体风险**: LOW-MEDIUM — 数据与代码分离是成熟模式，关键在于 schema 校验的完备性。
