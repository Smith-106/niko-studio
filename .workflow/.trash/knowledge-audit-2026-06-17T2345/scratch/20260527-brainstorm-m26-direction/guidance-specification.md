# Guidance Specification: M26 Milestone Direction

## §1 Problem Statement

niko-studio 已完成 M25（智能修订 + 会话智能 + 风格个性化），系统具备完整的写作分析、修订循环、偏好学习管线。但存在两个关键缺口：

1. **性能瓶颈** — 全量测试 OOM、telemetry 无限累积、分析无缓存、服务全量初始化
2. **LLM 空壳** — 所有"智能"功能依赖 LLM 但未实际接入，系统价值无法体现

## §2 Goals

- G1: 解决性能瓶颈，使系统在正常负载下稳定运行
- G2: 建立统一 LLM 调用层，使智能功能真正可用
- G3: 为后续实时辅助和插件生态奠定基础

## §3 Non-Goals

- 不做实时推送/WebSocket（属于 M27）
- 不做插件市场/动态加载（属于 M28）
- 不做 UI 改造
- 不做新分析维度

## §4 Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM adapter 粒度 | 按 provider 分 adapter（OpenAI/Anthropic/Ollama） | 各 provider API 差异大，统一抽象层成本过高 |
| 缓存策略 | LRU + TTL，分析结果缓存 | 简单有效，避免缓存一致性复杂度 |
| 性能优化切入点 | telemetry windowing + lazy service init | 直接解决 OOM + 启动慢，投入产出比最高 |
| Prompt 管理 | 模板字符串 + 变量注入，不用外部引擎 | 保持简单，避免引入新依赖 |

## §5 Feature Breakdown

### F-013: Performance Optimization

| ID | Feature | Priority | Effort |
|----|---------|----------|--------|
| F-013-1 | Telemetry windowing（最近 N 条 + 聚合摘要） | P0 | S |
| F-013-2 | Lazy service initialization（DI 按需加载） | P0 | M |
| F-013-3 | Analysis result cache（LRU + TTL） | P1 | M |
| F-013-4 | Memory pressure monitor + graceful degradation | P1 | M |
| F-013-5 | Worker thread for CPU-intensive clustering | P2 | L |

### F-014: Deep LLM Integration

| ID | Feature | Priority | Effort |
|----|---------|----------|--------|
| F-014-1 | ILLMProvider protocol + adapter implementations | P0 | M |
| F-014-2 | Prompt template registry + variable binding | P0 | S |
| F-014-3 | Token budget tracker + cost control | P1 | S |
| F-014-4 | Model routing（task complexity → model selection） | P1 | M |
| F-014-5 | Batch processing（多请求合并单次调用） | P2 | M |
| F-014-6 | Streaming response support | P2 | M |

## §6 Architecture Sketch

```
┌─────────────────────────────────────────────────┐
│                 Service Layer                    │
│  Revision ←── ILLMProvider ──→ Personalization  │
│  SessionIntel ←──────┘                          │
├─────────────────────────────────────────────────┤
│              LLM Integration Layer               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │ OpenAI   │  │ Anthropic│  │  Ollama  │      │
│  │ Adapter  │  │ Adapter  │  │ Adapter  │      │
│  └──────────┘  └──────────┘  └──────────┘      │
│  Prompt Registry │ Token Tracker │ Model Router │
├─────────────────────────────────────────────────┤
│              Performance Layer                   │
│  Telemetry Window │ LRU Cache │ Lazy Init       │
│  Memory Monitor   │ Worker Pool                 │
└─────────────────────────────────────────────────┘
```

## §7 Milestone Roadmap

- **M26**: F-013 (Performance) + F-014 (LLM Integration)
- **M27**: F-011 (Real-time Assistance) — 依赖 M26 的 LLM 层 + 性能基础
- **M28**: F-012 (Plugin Ecosystem) — 依赖 M26-M27 积累的稳定 API 契约

## §8 Success Criteria

- [ ] 全量测试可在默认内存下运行（无需 --max-old-space-size）
- [ ] 服务启动时间减少 50%（lazy init）
- [ ] ILLMProvider 协议定义 + 3 个 adapter 实现（OpenAI / Anthropic / Ollama）
- [ ] Prompt 模板注册 + 变量绑定可用
- [ ] Revision/Personalization 可通过 ILLMProvider 调用 LLM
- [ ] 新增测试覆盖率 ≥ 80%
- [ ] TypeScript 编译零错误

## §9 Resolved Decisions

1. **API key 管理 → 环境变量** — `dotenv` + `process.env`，12-factor 标准做法，零额外依赖。`OPENAI_API_KEY` / `ANTHROPIC_API_KEY`。Ollama 无需 key。
2. **Ollama → 纳入 M26** — API 与 OpenAI 兼容，adapter 成本极低，3 个 adapter 验证协议抽象质量。仅支持 chat completion。
3. **Token 预算 → 功能维度** — `TokenBudget { revision: 50000, personalization: 20000, analysis: 30000 }` 可配置。功能需求可预估且稳定，会话/章节维度不可控。
4. **Worker 通信 → MessageChannel** — 聚类结果是结构化 JSON，`postMessage` 天然支持。SharedArrayBuffer 需 Atomics + COOP/COEP headers，过度复杂。
