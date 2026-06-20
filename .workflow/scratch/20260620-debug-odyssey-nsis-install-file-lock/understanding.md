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

（待泛化扫描）

## 8. Discoveries & Decisions

（待分类）

## 9. Learnings

（待沉淀）
