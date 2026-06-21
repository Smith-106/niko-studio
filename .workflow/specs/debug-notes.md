---
title: "Debug Notes"
readMode: optional
priority: medium
category: debug
keywords:
  - debug
  - issue
  - workaround
  - root-cause
  - gotcha
related:
  - "spec:project:architecture-constraints"
  - "spec:project:coding-conventions"
---

# Debug Notes

## Entries

<spec-entry category="debug" keywords="i18n,CJK,slug,normalizeAscii" date="2026-06-13" title="normalizeAscii 剥离 CJK 字符 — slug 生成断裂" description="wiki-schema.ts:92-101 的 normalizeAscii 剥离所有非 ASCII，中文标题 slug 变为 '-'">
### normalizeAscii 剥离 CJK 字符 — slug 生成断裂
wiki-schema.ts:92-101 的 normalizeAscii 剥离所有非 ASCII，中文标题 slug 变为 '-'。
</spec-entry>

<spec-entry category="debug" keywords="SSE,parser,cross-chunk,chat" date="2026-06-13" title="SSE parser 跨 chunk 事件丢失根因" description="currentEvent/currentData 在 while 循环内初始化，跨 chunk 事件被丢弃">
### SSE parser 跨 chunk 事件丢失根因
currentEvent/currentData 在 while 循环内初始化，跨 chunk 事件被丢弃。
</spec-entry>

<spec-entry category="debug" keywords="catalog-loader,lazy-loading-defeated,const-bindings" date="2026-06-13" title="craft-catalog 模块级 const 导出架空延迟缓存" description="18 个模块级 const 立即调用 getter，reloadCatalog 因 const 绑定不可重赋值而 broken">
### craft-catalog 模块级 const 导出架空延迟缓存
18 个模块级 const 立即调用 getter，reloadCatalog 因 const 绑定不可重赋值而 broken。
</spec-entry>

<spec-entry category="debug" keywords="tauri,commandchild,sidecar,kill,wait,port,进程退出" date="2026-06-21" title="Tauri CommandChild 无 wait() — kill 后须轮询 PID 确认退出" description="Tauri CommandChild 只有 kill() 和 pid()，无 wait()。Windows 上 kill 后需轮询 PID 确保进程退出释放端口">
### Tauri CommandChild 无 wait() — kill 后须轮询 PID 确认退出
使用 `tauri_plugin_shell::process::CommandChild` 管理 sidecar 进程，调用 `kill()` 后需要确认进程退出。但 `CommandChild` 无 `wait()` 方法。Windows 修复：kill 后用 `OpenProcess(SYNCHRONIZE)` 轮询 PID 确认进程退出（3s 超时），确保端口/资源释放。Node.js child_process 场景可用 `on('close')` 事件。
来源：odyssey-debug EG-08/P2, gateway_runtime.rs:433
</spec-entry>

<spec-entry category="debug" keywords="writefilesync,mkdirsync,try-catch,crash,uncaught-exception" date="2026-06-21" title="同步文件操作无 try-catch 保护 — 进程崩溃" description="fs.writeFileSync / mkdirSync 在不可写路径下抛未捕获异常导致整个进程崩溃">
### 同步文件操作无 try-catch 保护 — 进程崩溃
`fs.writeFileSync()` / `fs.mkdirSync()` 无 try-catch 时，在不可写路径下抛未捕获异常导致整个进程崩溃。修复模板：包裹 try-catch + `log.warn()` fallback。适用场景：配置文件创建、初始化等"尽力而为"操作。CLI 命令中失败可接受（用户看到明确错误信息），核心启动路径不可接受。
来源：odyssey-debug EG-15/P3, config/index.ts
</spec-entry>

<spec-entry category="debug" keywords="localhost,guard,security,配置-执行两步,授权绕过" date="2026-06-21" title="localhost-only guard 配置-执行两步必须同步" description="localhost-only guard 配置解析和请求执行是两步：实现 resolveLocalhostOnlyEnabled() 后必须在 request handler 中显式调用">
### localhost-only guard 配置-执行两步必须同步
安全相关配置必须有对应的运行时执行路径。漏洞类别：授权绕过 — 配置层实现但请求层未集成。修复：在请求处理器顶部添加 IP 检查中间件（403 拒绝非本地请求）。
来源：odyssey-improve C3, gateway-request-handler.ts:45-58
</spec-entry>

<spec-entry category="debug" keywords="recovery,risk,mitigation,test" date="2026-06-21" title="Recovery risk mitigations (lock scope / failure-path / flaky test)" description="R1: Lock domain limited to git-mutating critical sections to avoid throughput regression. R2: Failure-path semantics mus">
### Recovery risk mitigations (lock scope / failure-path / flaky test)
R1: Lock domain limited to git-mutating critical sections to avoid throughput regression. R2: Failure-path semantics must preserve existing UI response contracts with explicit failure reason assertions. R3: New concurrent tests must use deterministic temp workspaces and strict teardown to avoid flakiness.
</spec-entry>
