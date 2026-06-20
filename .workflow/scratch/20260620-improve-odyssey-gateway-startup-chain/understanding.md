# Improve Odyssey: Gateway Startup Chain 运行质量提升

## 1. Target & Baseline

**Target**: Gateway 启动链 — `desktop/src-tauri/src/gateway_runtime.rs` → `src-ts/mcp/gateway-bootstrap.ts` → `src-ts/mcp/gateway-request-handler.ts` → `src-ts/mcp/routes.ts` → `src-ts/config/index.ts` → `src-ts/container/gateway-control-plane.ts` → `src-ts/mcp/gateway-ws.ts`

**Rationale**: 刚完成 odyssey-debug 修复 5 个崩溃级错误间隙。现在对同一链路做 6 维度质量审查，确保修复后无新退化，并发现剩余改进机会。

**Dimensions**: performance, security, architecture, reliability, observability, maintainability

**Baseline Metrics**:
| Metric | Value |
|--------|-------|
| TS source files | 1230 |
| TS source lines | 118,054 |
| Rust source files | 10 |
| Rust source lines | 1,355 |
| Rust tests | 0 |
| Previous debug fixes | 5 (EG-08/17/21/23/15) |

## 2. Current State Survey

### 文件结构

| File | Lines | Role |
|------|-------|------|
| gateway_runtime.rs | 460 | Tauri sidecar 启动/健康检查/停止 |
| gateway-bootstrap.ts | 123 | Node.js HTTP 服务启动/CLI 入口 |
| gateway-request-handler.ts | 179 | 请求路由 + rate limit + phase gate + 异常处理 |
| gateway-http-adapter.ts | 148 | HTTP 工具：readBody/parseQuery/CORS/response |
| gateway-ws.ts | 243 | WebSocket 事件推送 relay |
| gateway-state.ts | 169 | Gateway 运行时状态 + 依赖注入 |
| gateway-control-plane.ts (composition-root) | 126 | 控制面板：初始化 + prewarm + 绑定 |
| config.ts (mcp/) | 366 | 配置解析：host/port/CORS/localhost/reload |
| config/index.ts | ~900 | ConfigManager 全局配置加载/校验 |
| metrics.ts | 173 | 请求 metrics 采集 + snapshot |
| rate-limiter.ts | 99 | In-memory 滑动窗口 rate limiter |
| routes/index.ts | 57 | 路由注册 + 正则匹配 |

### 依赖关系

```
Tauri Shell
  └→ gateway_runtime.rs (sidecar 管理)
      └→ gateway-bootstrap.ts (HTTP server 启动)
          └→ gateway-control-plane.ts (初始化控制面板)
              ├→ ConfigManager (配置)
              ├→ ServiceContainer (DI 容器)
              └→ gateway-state.ts (运行时状态)
          └→ gateway-request-handler.ts (请求处理)
              ├→ routes/index.ts (路由)
              ├→ gateway-http-adapter.ts (HTTP 工具)
              ├→ rate-limiter.ts (限流)
              ├→ metrics.ts (指标)
              └→ phase-orchestrator (阶段门控)
          └→ gateway-ws.ts (WebSocket relay)
```

### 已知问题状态（来自 odyssey-debug）

- 5 个 EG 已修复：EG-08/17/21/23/15
- 5 个 _initSchema deferred：unified-memory, workflow-state-store, memory-mcp, writing-session-cluster, graph-engine
- 测试覆盖：gateway-bootstrap 7 tests, config-init 1 test, gateway-http-adapter 有完整测试
- Rust 端零测试

### 复杂度热点

| File | Issue |
|------|-------|
| gateway_runtime.rs | 同步 Mutex + 异步 start_lock 混用，460 行单文件 |
| config/index.ts | ~900 行 ConfigManager，6 层配置合并 |
| gateway-control-plane.ts | 7 个 `set*()` 全局状态注入，WeakMap 内存管理 |
| metrics.ts | 全局 METRICS 对象无线程安全保护 |

### 错误处理模式

- ✅ readRequestBody: 30s timeout + 10MB limit + close/error 事件
- ✅ gateway-request-handler: try-catch + 500 fallback
- ✅ gateway-ws close(): try-catch per client + 1s timeout
- ⚠️ prewarmGatewayControlPlane: catch 但不暴露哪些服务降级
- ⚠️ CORS: resolveCorsOrigins 每次请求调用（无缓存）
- ⚠️ rate-limiter: cleanup 在 allow() 内触发（请求路径上 GC）

## 3. Audit Findings

### Severity Distribution

| Dimension | Critical | High | Medium | Low | Total |
|-----------|----------|------|--------|-----|-------|
| Performance | 2 | 4 | 6 | 4 | 16 |
| Security | 1 | 5 | 7 | 2 | 15 |
| Architecture | 1 | 3 | 6 | 1 | 11 |
| Reliability | 1 | 5 | 8 | 2 | 16 |
| Observability | 0 | 8 | 7 | 2 | 17 |
| Maintainability | 0 | 3 | 10 | 6 | 19 |
| **Total** | **5** | **28** | **44** | **17** | **94** |

### Critical Findings (5)

| ID | Dimension | Title | File | Line |
|----|-----------|-------|------|------|
| C1 | Perf | 串行 health probe 冷启动 6s+ 延迟 | gateway_runtime.rs | 180 |
| C2 | Perf | Ephemeral port TcpListener 未 drop — 端口竞争 | gateway_runtime.rs | 248 |
| C3 | Sec | localhost-only guard 已配置但请求处理未执行 | gateway-request-handler.ts | 40 |
| C4 | Arch | set*() 全局可变状态替代 proper DI | health/config/mcp-admin/workflow | 多处 |
| C5 | Rel | shutdownGatewayControlPlane 是 no-op | container/gateway-control-plane.ts | 21 |

### High Findings (28 — 摘要)

| ID | Dim | Title | File |
|----|-----|-------|------|
| H1 | Perf | reqwest::Client 每次 is_gateway_healthy 新建 | gateway_runtime.rs:124 |
| H2 | Perf | std::thread::sleep 阻塞 async runtime | gateway_runtime.rs:439 |
| H3 | Perf | startGatewayServer 串行初始化 | gateway-bootstrap.ts:63 |
| H4 | Perf | ServiceContainer._doInitialize 串行初始化 | ServiceContainer.ts:357 |
| H5 | Perf | CORS origins 每请求重新计算 | gateway-http-adapter.ts:136 |
| H6 | Sec | 默认 host 0.0.0.0 绑定所有接口 | config.ts:143 |
| H7 | Sec | CORS wildcard 反射 Origin 头 | gateway-http-adapter.ts:138 |
| H8 | Sec | Config endpoint 可修改 localhost-only guard | endpoints/config.ts:73 |
| H9 | Sec | Secret endpoint 无认证走 HTTP | endpoints/config.ts:225 |
| H10 | Sec | WebSocket relay 无认证无 origin 校验 | gateway-ws.ts:60 |
| H11 | Sec | Admin endpoints 无认证 | routes/admin.ts:1 |
| H12 | Arch | gateway-state.ts 跨 4 层的 god module | gateway-state.ts:1 |
| H13 | Arch | `as unknown as` 类型绕过 | gateway-state.ts:111 |
| H14 | Arch | MCP 层直接导入 container | gateway-request-handler.ts:4 |
| H15 | Rel | prewarm 失败丢弃已有健康服务 | gateway-control-plane.ts:124 |
| H16 | Rel | 无 unhandledRejection handler | gateway-bootstrap.ts:59 |
| H17 | Rel | WS close 后立即 terminate — 客户端收到非优雅关闭 | gateway-ws.ts:124 |
| H18 | Rel | ServiceContainer.initializeAll 设 initialized=true 即使部分失败 | ServiceContainer.ts:338 |
| H19 | Rel | readRequestBody 超时未 destroy socket | gateway-http-adapter.ts:16 |
| H20 | Rel | 请求 catch 未检查 headersSent | gateway-request-handler.ts:165 |
| H21 | Obs | 无启动耗时 metric | gateway-bootstrap.ts:85 |
| H22 | Obs | health-poll loop 无诊断日志 | gateway_runtime.rs:402 |
| H23 | Obs | sidecar 终止仅发 frontend 不进系统日志 | gateway_runtime.rs:359 |
| H24 | Obs | requestId 非唯一且未传播到下游 | gateway-request-handler.ts:27 |
| H25 | Obs | 500 响应无 requestId | gateway-request-handler.ts:165 |
| H26 | Obs | health 返回 200 即使 degraded | endpoints/health.ts:330 |
| H27 | Obs | Metrics map 达 500 key 全清丢失历史 | metrics.ts:99 |
| H28 | Obs | 无 prewarm 失败标记 | gateway-control-plane.ts:119 |
| H29 | Maint | ConfigManager.loadFromEnv 30+ if 分支 | config/index.ts:601 |
| H30 | Maint | gateway_runtime.rs start_local_sidecar 复杂度 ~15 | gateway_runtime.rs:223 |
| H31 | Maint | Rust 端零测试 | gateway_runtime.rs:1 |

## 4. Root Cause Diagnosis

### Critical Findings 根因

| ID | Root Cause | Hypothesis | Result | Fix Approach |
|----|-----------|------------|--------|-------------|
| C1 | resolve_base_uncached 串行 health probe，3 次 2s 超时叠加 | 并发探测可将 6s+ 降至 ~2s | CONFIRMED | `tokio::join!` 并发 3 次 is_gateway_healthy |
| C2 | TcpListener::bind("0") 后 listener 未 drop | sidecar 绑定同端口时竞争 | CONFIRMED | port = listener.local_addr().port(); drop(listener); |
| C3 | localhost-only guard 已实现但请求处理未集成 | 开发者实现了配置解析但忘记在 handler 中添加检查 | CONFIRMED | 在 createGatewayRequestHandler 顶部加 localhost 检查 |
| C4 | 手动 DI 模式 set*() 替代构造器注入 | 历史渐进：初始单模块 → 拆分时用 set* 保持兼容 | CONFIRMED — DEFERRED | 重构为 GatewayContext（高成本，defer 到架构专项） |
| C5 | container/gateway-control-plane.ts re-export 未实现 shutdown | 迁移时只写了 log 占位，未接入 ServiceContainer.shutdown() | CONFIRMED | 实现 shutdownGatewayControlPlane 调用 container.shutdown() |

### High Findings 根因分类

| Category | Count | Root Cause Pattern |
|----------|-------|--------------------|
| 性能串行 | 5 | 初始化/探测串行执行，可并发 |
| 安全缺失 | 6 | 认证/授权层完全缺失 |
| 类型安全 | 3 | `as unknown as` 绕过、Parameters<> 推导 |
| 资源泄漏 | 4 | socket/timer/connection 未清理 |
| 可观测性 | 8 | 缺 metric/log/trace 的 8 处关键路径 |
| 代码复杂度 | 2 | 30+ if 分支和 ~15 圈复杂度 |

### 修复优先级（有把握才改）

**立即修复（高把握）:**
1. C2 — drop(listener) — 1 行修改
2. C5 — shutdownGatewayControlPlane 实现 — 小范围改动
3. C3 — localhost-only middleware — 小范围改动
4. C1 — 并发 health probe + 共享 reqwest::Client — 中范围
5. H1 — 共享 reqwest::Client — 与 C1 合并
6. H5 — CORS origins 缓存 — 小范围改动
7. H25 — 500 响应含 requestId — 1 行修改
8. H20 — headersSent 检查 — 3 行修改
9. H16 — unhandledRejection handler — 5 行修改
10. Rate limiter stop on shutdown — 小范围改动
11. WS upgrade 非 /ws/events 路径 socket.destroy() — 2 行修改

**DEFERRED（需架构决策）:**
- C4 — set*() → GatewayContext DI 重构
- H12 — gateway-state.ts god module 拆分
- H13 — `as unknown as` 消除
- H14 — MCP↔container 层违规
- H6 — 默认 host 改为 127.0.0.1（破坏性变更）
- H18 — ServiceContainer initialized 标记逻辑
- 安全认证层（H8-H11）— 需设计认证方案

## 5. Fix & Verification

### 已修复（11 项）

| ID | Fix | File | 验证 |
|----|-----|------|------|
| C2 | `drop(listener)` 释放 ephemeral 端口 | gateway_runtime.rs:248 | Rust cargo check ✅ |
| C5 | `shutdownGatewayControlPlane` 调用 `container.shutdown()` + 清理全局状态 | composition-root/gateway-control-plane.ts | TS 编译 ✅ |
| C1+H1 | `tokio::join!` 并发 health probe + 共享 `health_client` | gateway_runtime.rs:190-230 | Rust cargo check ✅ |
| C3 | localhost-only guard 中间件 (403 拒绝非本地) | gateway-request-handler.ts:45-58 | TS 编译 ✅ + 54 tests passed |
| H5 | CORS origins 缓存 + `invalidateCorsCache()` on config reload | gateway-http-adapter.ts:126-140, gateway-control-plane.ts | 25 adapter tests ✅ |
| H16 | `unhandledRejection` + `uncaughtException` 全局处理器 | gateway-bootstrap.ts:105-112 | TS 编译 ✅ |
| H25 | 500 响应包含 `requestId` | gateway-request-handler.ts:182 | TS 编译 ✅ |
| H20 | `headersSent` 检查，流式响应 destroy | gateway-request-handler.ts:179-187 | TS 编译 ✅ |
| Rate limiter | `stopRateLimiter()` 导出 + shutdown 调用 | gateway-request-handler.ts:21, gateway-bootstrap.ts:95 | TS 编译 ✅ |
| WS upgrade | 非 `/ws/events` 路径 `socket.destroy()` + try-catch | gateway-ws.ts:50-62 | TS 编译 ✅ |
| Bootstrap | WS relay close + rate limiter stop + 超时日志 | gateway-bootstrap.ts:91-113 | 7 bootstrap tests ✅ |

### 验证结果
- TypeScript `tsc --noEmit`: ✅ 零错误
- Rust `cargo check`: ✅ 编译通过（3 个预存警告）
- Unit tests: ✅ 54/54 passed（gateway-bootstrap 7, gateway-http-adapter 25, gateway-request-handler 12, gateway-ws 9, config-init 1）
- 测试适配: gateway-http-adapter CORS 测试添加 `invalidateCorsCache()` beforeEach

### DEFERRED（需架构决策）
| ID | 原因 |
|----|------|
| C4 — set*() → GatewayContext DI | 高成本重构，需专项排期 |
| H12 — gateway-state.ts god module | 拆分依赖架构决策 |
| H13 — `as unknown as` 消除 | 需要接口对齐 container/types.ts |
| H6 — 默认 host 127.0.0.1 | 破坏性变更，需版本规划 |
| H8-H11 — 安全认证层 | 需设计认证方案（API key / JWT） |
| H18 — ServiceContainer initialized 标记 | 需设计 per-service 重试机制 |

## 6. Generalization

### 提取的 Patterns（3 层）

| ID | Layer | Signature | Source | Risk | Fix Template |
|----|-------|-----------|--------|------|-------------|
| GP1 | Syntax | `res.writeHead(5xx)` without `headersSent` check | H20 | MEDIUM | `if (!res.headersSent) { res.writeHead(...); res.end(...) } else { res.destroy() }` |
| GP2 | Semantic | `process.on('SIGTERM/SIGINT', () => { shutdown(); process.exit(0) })` 独立注册无协调 | 本次改进 | LOW | 统一到 gateway-bootstrap shutdown 链，各服务仅暴露 `shutdown()` 方法 |
| GP3 | Structural | 缓存计算结果仅在 config reload 时失效 | H5 CORS 缓存 | LOW | `_cache + invalidate()` 模式，onReload 时 invalidate |

### 代码库扫描命中

#### GP1 — headersSent 未检查

| File | Line | Risk | Note |
|------|------|------|------|
| gateway-request-handler.ts | 188 | FIXED | ✅ 已添加 |
| 其他 endpoint handler | — | SAFE | 通过 `sendHttpResponse()` 统一输出，handler 不直接操作 res |

**结论**: GP1 仅 1 处命中，已修复。

#### GP2 — 独立 SIGTERM 处理器

| File | Line | Risk | Note |
|------|------|------|------|
| db/pool.ts | 180-181 | LOW | 数据库连接池，独立注册合理 |
| services/backup-manager.ts | 970-971 | LOW | 备份服务，独立注册合理 |
| services/indexing-service.ts | 235-236 | LOW | 索引服务，独立注册合理 |
| services/token-service.ts | 415-416 | LOW | Token 服务，独立注册合理 |
| mcp/gateway-bootstrap.ts | 119-120 | FIXED | ✅ 统一优雅关闭链 |

**结论**: GP2 的独立服务注册是合理的——这些服务在非 gateway 上下文独立运行。Gateway bootstrap 已有统一关闭链。

#### GP3 — 缓存计算

| File | Line | Risk | Note |
|------|------|------|------|
| gateway-http-adapter.ts | CORS origins | FIXED | ✅ `_cachedCorsOrigins + invalidateCorsCache()` |
| gateway_runtime.rs | cached_base | SAFE | ✅ 已有 BASE_CACHE_TTL + config reload 时 invalidate |

**结论**: GP3 仅 1 处命中，已修复。

### 泛化统计

- Patterns extracted: 3
- Total hits: 8
- Cross-layer confirmed: 0
- Regression risks: 0
- Deepening triggered: no

## 7. Discoveries

（待分类）

## 8. Improvement Metrics

（待对比）

## 9. Engineering Learnings

（待沉淀）
