# M26 Brainstorm: Next Version Direction

## Scope

Four candidate directions for M26 milestone:
1. **Real-time Writing Assistance** (F-011) — 基于 session intelligence 的实时提示、打字节奏感知、智能续写建议、上下文感知推荐
2. **Plugin Ecosystem** (F-012) — 第三方插件 API、插件市场、钩子扩展系统、动态加载/卸载
3. **Performance Optimization** (F-013) — 大文档编辑性能、内存占用、响应时间、懒加载策略
4. **Deep LLM Integration** (F-014) — 本地/云端模型切换、批处理优化、prompt 工程化、多模型协作

---

## 1. Real-time Writing Assistance (F-011)

### Current Foundation
- `ISessionIntelligence` 已收集 telemetry（activeMinutes, saveCount, rewriteCount, jumpEditCount）
- `IPersonalizationService` 已有 preference signal + style recommendation
- `IRevisionService` 已有多轮修订 + critic 循环
- MCP endpoint 层是请求-响应模型，无推送能力

### Feature Ideas

| Feature | Description | Leverages |
|---------|-------------|-----------|
| Typing rhythm awareness | 检测打字停顿、犹豫点（长时间无输入后删除重写），标记为"创作困惑区" | session-intelligence telemetry |
| Smart continuation | 当用户停顿超过阈值，基于上下文 + 偏好 profile 生成续写建议 | personalization + revision |
| Context-aware hints | 基于当前章节角色/关键词/风格维度，推送写作建议 | session-intelligence patterns |
| Adaptive suggestion frequency | 根据用户对建议的接受/拒绝率自动调整推荐频率 | personalization preference signals |
| Writing flow states | 识别"心流"vs"探索"vs"修订"三种写作模式，针对性提供建议 | session-intelligence clustering |

### Architecture Implications
- **需要事件驱动架构**: 当前 MCP 是 HTTP 请求-响应，实时提示需要 WebSocket/SSE 推送通道
- **需要 debounce/throttle 机制**: 打字节奏分析需要高频 telemetry 上报 + 服务端聚合
- **需要 suggestion pipeline**: 生成→过滤→排序→推送 的流式处理

### Risks
- 实时推送增加服务端复杂度（连接管理、背压控制）
- 过度提示可能干扰创作心流
- Telemetry 高频上报可能影响编辑器性能

---

## 2. Plugin Ecosystem (F-012)

### Current Foundation
- DI 容器有 `bindSingleton` 模式，服务可替换
- Protocol interfaces 定义了清晰的服务契约
- MCP endpoint 是独立路由，天然可扩展
- 但无插件加载/生命周期管理基础设施

### Feature Ideas

| Feature | Description | Leverages |
|---------|-------------|-----------|
| Plugin manifest | JSON schema 定义插件元数据、依赖、入口点 | — |
| Hook system | 写作生命周期钩子：before-save, after-save, before-revision, after-analysis | MCP endpoint pattern |
| Plugin API surface | 暴露 `IPluginContext`：注册分析器、注册建议提供者、注册 MCP 端点 | DI container + protocols |
| Dynamic loading | 运行时加载/卸载插件，热插拔 | DI container rebind |
| Plugin marketplace | 插件注册表 + 版本管理 + 依赖解析 | — |
| Sandboxed execution | 插件运行在受限环境中，防止破坏核心 | — |

### Architecture Implications
- **需要 Plugin Registry**: 插件注册、发现、依赖解析
- **需要 Hook Bus**: 事件总线 + 中间件链（同步/异步钩子）
- **需要 Plugin Lifecycle**: install → activate → deactivate → uninstall
- **需要 Capability Declaration**: 插件声明所需权限和扩展点

### Risks
- 插件安全模型复杂（沙箱 vs 信任）
- API 稳定性承诺一旦做出难以收回
- 插件间冲突（多个插件 hook 同一事件返回矛盾结果）
- 动态加载在 TypeScript/Node 中需要特别处理（ESM/CJS 兼容）

---

## 3. Performance Optimization (F-013)

### Current Foundation
- 全量测试 OOM（`--max-old-space-size=8192` 才能运行）
- 内存中存储所有 session telemetry（无分页/淘汰）
- 分析模块每次全量计算（无增量/缓存）
- 无 lazy loading 机制

### Feature Ideas

| Feature | Description | Leverages |
|---------|-------------|-----------|
| Large document chunking | 大文档分块处理，避免全量加载到内存 | analysis modules |
| Telemetry windowing | telemetry 只保留最近 N 条 + 聚合摘要 | session-intelligence |
| Incremental analysis | 分析结果缓存 + 增量更新（只分析变更部分） | writing-session-intelligence-core |
| Lazy service loading | DI 容器按需初始化，未使用的服务不加载 | DI container |
| Memory pressure handling | 监控内存使用，达到阈值自动降级（如关闭聚类、减少缓存） | — |
| Worker threads | CPU 密集分析（聚类、NLP）移到 worker thread | writing-session-cluster |

### Architecture Implications
- **需要缓存层**: 分析结果缓存，避免重复计算
- **需要分页/窗口**: telemetry 和分析结果分页
- **需要资源监控**: 内存/CPU 使用监控 + 降级策略
- **需要 worker 抽象**: 跨线程通信协议

### Risks
- 过早优化可能引入不必要的复杂度
- 缓存一致性维护成本
- Worker thread 通信开销可能抵消并行收益
- 需要基准测试数据驱动优化方向

---

## 4. Deep LLM Integration (F-014)

### Current Foundation
- `IRevisionService` 已有多轮修订（但 LLM 调用是 mock/stub）
- `IPersonalizationService` 有推荐生成（但未接入真实 LLM）
- 无统一的 LLM 调用层/适配器
- 无 prompt 模板管理

### Feature Ideas

| Feature | Description | Leverages |
|---------|-------------|-----------|
| LLM adapter layer | 统一接口适配 OpenAI / Anthropic / 本地模型（Ollama/vLLM） | revision + personalization |
| Prompt template engine | 模板化的 prompt 管理，支持变量注入 + 版本控制 | — |
| Batch processing | 多个分析请求合并为单次 LLM 调用，降低延迟和成本 | all analysis modules |
| Model routing | 根据任务复杂度自动选择模型（简单→小模型，复杂→大模型） | — |
| Multi-model collaboration | critic 用一个模型，creator 用另一个，交叉验证 | revision critic loop |
| Token budget management | 按章节/会话分配 token 预算，防止超支 | — |
| Streaming responses | LLM 响应流式返回，提升用户感知速度 | MCP SSE |

### Architecture Implications
- **需要 ILLMProvider 协议**: 统一 LLM 调用接口
- **需要 Prompt Registry**: 模板注册 + 变量绑定 + 版本管理
- **需要 Token Tracker**: 调用计数 + 预算控制
- **需要 Response Parser**: 结构化解析 LLM 输出（JSON/Markdown）

### Risks
- LLM API 变更频繁，适配器维护成本高
- 本地模型质量不稳定
- Token 成本控制不当可能产生高额账单
- 流式响应的错误处理更复杂

---

## Priority Assessment

| Direction | Impact | Effort | Dependencies | Risk | M26 Fit |
|-----------|--------|--------|-------------|------|---------|
| F-011 Real-time Assistance | High | High | 需要 WebSocket 基础 | Medium | Phase 2+ |
| F-012 Plugin Ecosystem | High | Very High | 无现有基础 | High | Phase 3+ |
| F-013 Performance | Medium-High | Medium | 自含，无外部依赖 | Low | **M26 推荐** |
| F-014 LLM Integration | High | Medium-High | 无现有基础 | Medium | **M26 推荐** |

## Recommended M26 Scope

**核心**: F-013 (性能优化) + F-014 (LLM 深度集成)

**理由**:
1. **F-013 是技术债务优先级** — OOM 问题、全量分析、无缓存已影响开发效率，越晚解决累积成本越高
2. **F-014 是功能核心** — 当前所有"智能"功能（revision、personalization、session intelligence）都依赖 LLM 但未实际接入，这是系统价值的关键路径
3. **F-011 和 F-012 依赖 F-013 + F-014** — 实时辅助需要性能基础 + LLM 能力；插件生态需要稳定的 API 契约（由 LLM 集成验证）
4. **渐进式交付** — F-013 + F-014 可在 1 个里程碑内交付可工作版本，F-011/F-012 需要更多基础建设

**M26 Milestone 建议**:
- **M26**: F-013 Performance Optimization + F-014 Deep LLM Integration
- **M27**: F-011 Real-time Writing Assistance (依赖 M26 的 LLM 层 + 性能基础)
- **M28**: F-012 Plugin Ecosystem (依赖 M26-M27 积累的稳定 API 契约)
