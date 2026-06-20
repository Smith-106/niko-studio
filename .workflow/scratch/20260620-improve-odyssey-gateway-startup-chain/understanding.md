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

（待审查）

## 4. Root Cause Diagnosis

（待诊断）

## 5. Fix & Verification

（待修复验证）

## 6. Generalization

（待泛化）

## 7. Discoveries

（待分类）

## 8. Improvement Metrics

（待对比）

## 9. Engineering Learnings

（待沉淀）
