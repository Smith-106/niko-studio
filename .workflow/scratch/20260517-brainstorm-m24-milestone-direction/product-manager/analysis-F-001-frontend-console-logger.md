# F-001: Frontend Console Logger — Product Analysis

## User Value Proposition

将前端 17 个文件的 `console.*` 直接调用收口到结构化 logger，消除生产环境信息泄露风险，为未来远程诊断能力奠定基础。用户虽无直接感知，但这是产品安全性和可运维性的基础保障。

**核心价值**: 安全合规 + 运维能力 + 开发规范统一

## Priority Justification

### Impact vs Effort Matrix

| 维度 | 评估 |
|------|------|
| 用户影响 | Low（用户无感） |
| 开发影响 | Medium（统一日志规范） |
| 安全影响 | High（消除信息泄露） |
| 实施工作量 | Low（机械替换 + lint 规则） |
| 风险 | Very Low（纯重构，无逻辑变更） |

**综合优先级**: P1 — 低风险快速交付，MUST 在 M24 第一批次完成。

## Success Metrics

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| console.* 直接调用数 | 0（前端非测试文件） | ESLint no-console 规则 |
| 生产构建日志泄露 | 0 条 | 构建产物静态扫描 |
| 结构化日志覆盖率 | 100%（前端） | Logger 调用统计 |
| 回归测试通过率 | 100% | CI pipeline |

## User Stories

### US-001: 作为开发者，我希望所有前端日志通过统一 logger 输出
**动机**: 当前 console.* 散落各处，无法统一控制日志级别和输出目标
**验收**: 所有前端文件使用 `logger.info/warn/error` 替代 `console.*`

### US-002: 作为运维人员，我希望生产环境不泄露调试信息
**动机**: console.log 在生产环境可被用户通过 DevTools 看到，可能暴露内部逻辑
**验收**: 生产构建中 logger 的 debug/info 级别自动静默

### US-003: 作为开发者，我希望有 lint 规则阻止新增 console.* 调用
**动机**: 防止清理后再次引入直接调用
**验收**: ESLint no-console 规则启用，CI 中强制检查

## Acceptance Criteria

1. 前端所有非测试 `.ts/.tsx` 文件中 MUST NOT 存在 `console.log/warn/error/debug` 直接调用
2. Logger MUST 支持至少 4 个级别：debug, info, warn, error
3. 生产构建 MUST 自动抑制 debug 和 info 级别输出
4. ESLint `no-console` 规则 MUST 在 CI 中启用并通过
5. 所有现有测试 MUST 通过，无回归
6. Logger API SHOULD 与后端已有 logger 保持一致的调用风格

## Dependencies and Sequencing

### 前置依赖
- 无（后端 logger 已完成，可直接参考其 API 设计）

### 后续影响
- 为所有后续功能开发建立日志规范
- MAY 为未来远程诊断/错误上报功能提供数据源

### 建议排期
- **Batch 1, Week 1**
- 预估工时：1-2 天
- 可与 F-003 并行执行
