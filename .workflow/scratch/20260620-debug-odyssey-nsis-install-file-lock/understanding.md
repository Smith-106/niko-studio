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

### H1 [HIGH] — listen() 无 error 事件监听，端口占用时进程挂起
- 证据: gateway-bootstrap.ts:46-50 `listen()` 函数从不 reject，未监听 server 'error' 事件
- 测试: 模拟端口占用场景，验证 listen() 是否挂起

### H2 [HIGH] — gateway_runtime.rs kill() 未 wait()，Windows 端口释放延迟
- 证据: gateway_runtime.rs:384 `stop_child_best_effort` 调用 `kill()` 但未 `wait()`
- 测试: 检查 sidecar 进程在 kill 后是否真正退出

### H3 [HIGH] — NaN port 通过 validateConfig 校验
- 证据: config/index.ts:658 `parseInt(env.NIKO_GATEWAY_PORT)` 产生 NaN，validateConfig 中 `NaN < 1` 和 `NaN > 65535` 都是 false
- 测试: 设置 NIKO_GATEWAY_PORT=abc，验证是否通过校验

### H4 [MEDIUM] — createDefaultConfigFile 无 try-catch
- 证据: config/index.ts:570-571 `fs.writeFileSync` 直接调用
- 测试: 只读目录下验证

### H5 [MEDIUM] — CoreMemoryStore 构造函数 _initSchema 无 try-catch
- 证据: core-memory-store.ts:194 直接调用
- 测试: 验证不可写路径下的行为

## 5. Root Cause

启动链中存在 3 类根因导致"运行出错"：

1. **静默失败**（最难诊断）— listen() 挂起、kill() 未 wait、NaN 通过校验
2. **未捕获异常**（最易崩溃）— createDefaultConfigFile、_initSchema、bindWorkflowRuntimeProvider
3. **降级无通知**（用户体验差）— onError 可选、Mutex poison 无日志、global config 解析失败静默

## 6. Fix & Confirmation

（待修复验证）

## 7. Generalization

（待泛化扫描）

## 8. Discoveries & Decisions

（待分类）

## 9. Learnings

（待沉淀）
