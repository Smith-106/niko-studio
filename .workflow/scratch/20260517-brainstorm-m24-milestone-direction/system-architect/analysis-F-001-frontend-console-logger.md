# F-001: Frontend Console Logger — System Architect Analysis

## Architecture Approach

将前端 17 个文件中散落的 `console.*` 调用统一收口到结构化 LogService。后端已完成此迁移（收口到 `logger` 模块），前端 MUST 采用对称设计，确保全栈日志行为一致。

### Design Rationale

- 生产环境 `console.*` 泄露用户敏感信息（文本内容、API 响应）
- 无结构化日志无法做运行时问题诊断
- 后端已有成熟模式，前端 SHOULD 复用相同接口契约

## Data Model

### LogEntry

```typescript
interface LogEntry {
  timestamp: number;        // Date.now()
  level: LogLevel;          // 'debug' | 'info' | 'warn' | 'error'
  tag: string;              // 模块标识，如 'api.chat', 'hook.evaluation'
  message: string;          // 人类可读描述
  meta?: Record<string, unknown>;  // 结构化附加数据
  error?: {                 // 错误详情（仅 error 级别）
    name: string;
    message: string;
    stack?: string;
  };
}
```

### LogConfig

```typescript
interface LogConfig {
  level: LogLevel;          // 当前生效级别
  structured: boolean;      // 是否输出 JSON 格式
  maxBufferSize: number;    // 内存 buffer 上限（条数）
  sinkTargets: LogSink[];   // 输出目标：console, buffer, remote
}
```

### Relationships

- LogService → LogConfig (1:1, runtime mutable)
- LogService → LogEntry[] (1:N, ring buffer)
- React Components → LogService (N:1, via Context or import)

## Error Handling Strategy

| Scenario | Handling |
|----------|----------|
| LogService 初始化失败 | Fallback 到原生 console（不阻塞应用） |
| Buffer 溢出 | 丢弃最旧条目，记录 overflow 计数 |
| Structured 序列化失败 | 降级为 plain text 输出 |
| Remote sink 不可达 | 静默忽略，本地 buffer 保留 |

LogService 自身 MUST NOT 抛出异常——日志系统的故障不应成为应用故障。

## Integration Points

### 受影响文件（17 个）

**非测试文件（需迁移）**:
- `desktop/src/api/core.ts` — HTTP 错误日志
- `desktop/src/api/chat.ts` — 流式响应调试
- `desktop/src/api/gateway/models.ts` — 模型列表调试
- `desktop/src/hooks/useEditorAI.ts` — AI 调用追踪
- `desktop/src/hooks/useEvaluationData.ts` — 数据加载日志
- `desktop/src/components/knowledge/SkillTab.tsx` — 技能加载
- `desktop/src/components/knowledge/PersistedEntityTab.tsx` — 实体操作
- `desktop/src/components/StoryBiblePanel.tsx` — 面板状态
- `desktop/src/services/revisionOrchestrator.ts` — 修订流程

**测试文件（保留 console.* 或 mock）**:
- 测试文件中的 `console.*` MAY 保留，但 SHOULD 使用 `vi.spyOn(console, 'warn')` 模式

### 与后端 Logger 的对称性

后端 `src-ts/` 已使用 `import { logger } from '../logger.js'` 模式。前端 SHOULD 采用：

```typescript
import { useLogger } from '../services/logService';
// 或
import { log } from '../services/logService';
```

## Implementation Strategy

1. 创建 `desktop/src/services/logService.ts`（LogService 实现）
2. 创建 `desktop/src/contexts/LogContext.tsx`（React Context provider）
3. 逐文件替换 `console.*` → `log.{level}(tag, message, meta)`
4. 添加 ESLint rule `no-console`（warn 级别，允许渐进迁移）
5. 生产构建配置 `log.level = 'warn'`（过滤 debug/info）

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| 遗漏 console 调用 | Low | Low | ESLint rule 自动检测 |
| 性能开销（高频日志） | Low | Medium | Buffer + 批量写入 + level 过滤 |
| 测试 mock 复杂度增加 | Medium | Low | 提供 `createMockLogger()` 工具 |

**总体风险**: LOW — 纯机械替换，无逻辑变更，回归概率极低。
