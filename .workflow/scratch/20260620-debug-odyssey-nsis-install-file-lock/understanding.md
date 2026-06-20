# Debug Odyssey: NSIS 安装 + 运行时零错误

## 1. Issue & Scope

**Issue**: Niko-Studio Desktop 从安装到运行全过程存在多个可导致错误/崩溃的错误间隙。核心问题是启动链路的错误处理不完整，导致用户在某些条件下遇到无法诊断的启动失败。

**Scope**: 全启动链 — Tauri shell → gateway_runtime.rs → gateway-bootstrap.ts → gateway.ts → core-memory-store.ts

**Flags**: --auto (no delegate confirmation)

## 2. Archaeology Summary

### Git 历史关键发现
- gateway_runtime.rs 经历 9 次 commit，4 次为 fix 性质
- gateway-bootstrap.ts 经历 5 次 commit，3 次为重大运行时 BUG 修复
- 项目经历多轮"修复-回归-再修复"循环：3 轮打包前 BUG 修复，2 轮 13/15 项运行时 BUG 修复
- 修复频次最高的领域：API 契约不一致、gateway 连接管理、TypeScript 编译错误

### Open Issues 影响
- 18 个 HIGH 级别 open issue 直接影响运行
- P0: readRequestBody 无超时、SSE parser 跨 chunk 丢弃、ConsensusEngine 除零、CoreMemoryStore 连接泄漏
- P1: 章节切换丢编辑器状态、CJK 字符处理、API Key 无引导

## 3. Exploration

### 错误间隙（27 个发现）
- **崩溃级 8 个** — 直接导致进程崩溃或挂起
- **降级级 9 个** — 功能异常但不会崩溃
- **警告级 6 个** — 静默失败或误导

### 最需修复的 3 个间隙
1. **EG-17**: `listen()` 端口占用时进程挂起无日志
2. **EG-08**: Windows `kill()` 后未等待进程退出，端口未释放
3. **EG-21**: `NaN` gateway.port 通过校验

## 4. Hypotheses & Testing

### H1 [HIGH] ✅ CONFIRMED — listen() 无 error 事件监听，端口占用时进程挂起
- 证据: gateway-bootstrap.ts:46-50 `listen()` 函数从不 reject，未监听 server 'error' 事件
- 测试: 代码审查确认 `listen()` 仅监听 `listening` 事件，无 `error` 处理
- 修复: 添加 `server.on('error', ...)` 监听，EADDRINUSE 时 reject

### H2 [HIGH] ✅ CONFIRMED — gateway_runtime.rs kill() 后进程未真正退出，Windows 端口释放延迟
- 证据: gateway_runtime.rs:384 `stop_child_best_effort` 调用 `kill()` 但 `CommandChild` 无 `wait()` 方法
- 测试: Rust 编译验证 `child.wait()` 报错 E0599，确认 API 缺失
- 修复: kill 后用 `OpenProcess(SYNCHRONIZE)` 轮询 PID 确保进程退出（3s 超时）

### H3 [HIGH] ✅ CONFIRMED — NaN port 通过 validateConfig 校验
- 证据: config/index.ts `parseInt(env.NIKO_GATEWAY_PORT)` 产生 NaN，`NaN < 1` 和 `NaN > 65535` 都是 false
- 测试: 代码审查确认 `Number.isFinite(NaN) === false`
- 修复: `validateConfig()` 用 `!Number.isFinite(port) || port < 1 || port > 65535`；`parseIntSafe()` 替代所有 `parseInt()`

### H4 [MEDIUM] ✅ CONFIRMED — createDefaultConfigFile 无 try-catch
- 证据: config/index.ts:570-571 `fs.writeFileSync` 直接调用
- 修复: 包裹 try-catch，失败时 `log.warn()` 而非 crash

### H5 [MEDIUM] ⏸ DEFERRED — CoreMemoryStore 构造函数 _initSchema 无 try-catch
- 证据: core-memory-store.ts:194 直接调用
- 决策: 推迟到 S_DISCOVER 阶段与同类问题统一处理

## 5. Root Cause

启动链中存在 3 类根因导致"运行出错"：

1. **静默失败**（最难诊断）— listen() 挂起、kill() 未 wait、NaN 通过校验 → ✅ 已修复
2. **未捕获异常**（最易崩溃）— createDefaultConfigFile → ✅ 已修复；_initSchema → 待泛化处理
3. **降级无通知**（用户体验差）— onError 可选、Mutex poison 无日志、global config 解析失败静默 → 待泛化扫描

根因确认：**Tauri `CommandChild` API 缺失 + Node.js `listen()` 错误传播缺失 + `parseInt` NaN 语义陷阱** 三者叠加导致启动链在异常条件下静默挂起或崩溃，用户无法诊断。

## 6. Fix & Confirmation

### 已修复（5 项）

| EG | 文件 | 修复 | 验证 |
|----|------|------|------|
| EG-17 | gateway-bootstrap.ts | `listen()` 添加 server error 事件 + EADDRINUSE reject | TS 编译 ✅ + 8 tests passed |
| EG-08 | gateway_runtime.rs | kill() 后 OpenProcess 轮询 PID 确保进程退出 | Rust cargo check ✅ |
| EG-21 | config/index.ts | `!Number.isFinite(port)` 替代 NaN 比较 | TS 编译 ✅ |
| EG-23 | config/index.ts | `parseIntSafe()` 替代 6 处 `parseInt()` | TS 编译 ✅ |
| EG-15 | config/index.ts | `createDefaultConfigFile()` 包裹 try-catch | TS 编译 ✅ |

### 验证结果
- TypeScript `tsc --noEmit`: ✅ 零错误
- Rust `cargo check`: ✅ 编译通过（3 个预存警告，无新增）
- Unit tests (gateway-bootstrap + config): ✅ 8/8 passed
- Python smoke script tests: ✅ passed

## 7. Generalization

### 提取的 Patterns（3 层）

| ID | Layer | Signature | Description | Risk | Fix Template |
|----|-------|-----------|-------------|------|-------------|
| P1 | Syntax | `parseInt(\w+, 10)` 无 `Number.isFinite` 校验 | `parseInt` 返回 NaN/Infinity 时无声通过后续数值比较 | HIGH | `parseIntSafe()` 或 `!Number.isFinite()` guard |
| P2 | Semantic | `kill()` 后无退出确认 | 进程 kill 后未等待退出，端口/资源未释放 | HIGH | kill 后轮询 PID / 监听 close 事件 / wait() |
| P3 | Structural | `fs.writeFileSync` / `mkdirSync` 无 try-catch | 同步文件操作在不可写路径下抛未捕获异常 | MEDIUM | 包裹 try-catch + log.warn fallback |

### 代码库扫描命中

#### P1 — parseInt 无 NaN guard（环境变量 / 配置解析路径）

| File | Line | Risk | Note |
|------|------|------|------|
| src-ts/mcp/config.ts | 152 | LOW | 已有 `Number.isNaN` fallback |
| src-ts/mcp/config.ts | 229 | LOW | 已有 `Number.isNaN` fallback |
| src-ts/mcp/config.ts | 243-244 | LOW | 后续逻辑有 fallback |
| src-ts/mcp/config.ts | 279 | LOW | 已有 `Number.isNaN` fallback |
| src-ts/mcp/contract.ts | 242 | LOW | `safeInt()` 已有 NaN 检查 |
| src-ts/mcp/gateway-bootstrap.ts | 114 | FIXED | ✅ `Number.isFinite(parsed)` |
| src-ts/config/index.ts | 多处 | FIXED | ✅ `parseIntSafe()` |
| src-ts/knowledge/config.ts | 286-292 | LOW | 使用 `?? 'default'` 确保 parseInt 输入合法 |
| src-ts/services/reranker/factory.ts | 117 | LOW | 同上 |
| src-ts/workflow/project-tech.ts | 287 | LOW | 有 fallback 逻辑 |
| src-ts/graph/graph-manager.ts | 272, 298 | LOW | 解析已知格式输入，非环境变量 |
| src-ts/graph/graph-engine.ts | 809, 946 | LOW | 同上 |

**结论**: P1 在配置/环境变量路径已全部修复或已有 fallback；业务逻辑中的 parseInt 输入为已知格式（数字匹配），风险 LOW。

#### P2 — kill() 后无退出确认

| File | Line | Risk | Note |
|------|------|------|------|
| desktop/src-tauri/src/gateway_runtime.rs | 433 | FIXED | ✅ OpenProcess 轮询 |
| src-ts/services/nowledge-mem-adapter.ts | 67 | SAFE | 使用 `node:child_process` spawn，有 `on('close')` 处理 |

**结论**: P2 仅 2 处命中，1 处已修复，1 处安全。

#### P3 — writeFileSync / mkdirSync 无 try-catch

| File | Line | Risk | Note |
|------|------|------|------|
| src-ts/config/index.ts | createDefaultConfigFile | FIXED | ✅ try-catch + log.warn |
| src-ts/cli/commands.ts | 50, 56 | MEDIUM | CLI init 命令，失败时异常可接受（用户看到错误） |
| src-ts/cli/commands.ts | 61 | MEDIUM | 同上 |
| src-ts/cli/commands.ts | 261, 268 | LOW | /save /export 用户命令，失败抛异常可接受 |
| src-ts/cli/commands.ts | 362, 397 | LOW | 同上，导出命令 |

**结论**: P3 在 config 核心路径已修复；CLI 命令中文件操作失败可接受（用户得到明确错误信息）。

### 泛化统计

- Patterns extracted: 3
- Total hits: 21
- Cross-layer confirmed: 0 (P1/P2/P3 各自独立)
- Regression risks: 0
- Deepening triggered: no (no module ≥3 high-risk hits)

## 8. Discoveries & Decisions

（待分类）

## 9. Learnings

（待沉淀）
