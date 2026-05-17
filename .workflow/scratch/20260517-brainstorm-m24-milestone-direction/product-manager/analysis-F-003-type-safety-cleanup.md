# F-003: Type Safety Cleanup — Product Analysis

## User Value Proposition

清理前端 4 个非测试文件中的 `as any` 类型断言，恢复 TypeScript 完整类型推导能力。用户将受益于更少的运行时错误和更稳定的应用行为。

**核心价值**: 运行时稳定性 + 开发信心 + 类型系统完整性

## Priority Justification

### Impact vs Effort Matrix

| 维度 | 评估 |
|------|------|
| 用户影响 | Low-Medium（减少运行时错误） |
| 开发影响 | Medium（IDE 提示更准确） |
| 安全影响 | Medium（类型安全是第一道防线） |
| 实施工作量 | Low（4 个文件，范围明确） |
| 风险 | Low（类型修复不改变运行时行为） |

**综合优先级**: P2 — 范围极小但价值确定，SHOULD 在 Batch 1 与 F-001 并行完成。

## Success Metrics

| 指标 | 目标值 | 测量方式 |
|------|--------|----------|
| as any 使用数（非测试前端） | 0 | TypeScript strict 编译 |
| 类型错误数 | 0 | tsc --noEmit |
| 运行时类型相关错误 | 0 | Error tracking |
| 测试通过率 | 100% | CI pipeline |

## User Stories

### US-001: 作为开发者，我希望 MathView 组件有完整的类型定义
**动机**: 当前 as any 导致 props 传递错误只能在运行时发现
**验收**: MathView 所有 props 和内部状态有明确类型，IDE 能正确提示

### US-002: 作为用户，我希望导出对话框不会因类型错误崩溃
**动机**: ExportDialog 中的 as any 可能掩盖数据格式不匹配
**验收**: 导出功能在各种数据状态下稳定运行，无 TypeError

### US-003: 作为开发者，我希望 revisionOrchestrator 的类型链完整
**动机**: 编排器是核心逻辑，类型断言可能掩盖状态机错误
**验收**: 编排器所有输入输出有明确类型，状态转换类型安全

## Acceptance Criteria

1. MathView.tsx MUST NOT 包含 `as any` 类型断言
2. ExportDialog.tsx MUST NOT 包含 `as any` 类型断言
3. WritingHelperPanel.tsx MUST NOT 包含 `as any` 类型断言
4. revisionOrchestrator.ts MUST NOT 包含 `as any` 类型断言
5. 替代方案 MUST 使用具体类型或泛型，MUST NOT 使用 `as unknown as T` 绕过
6. `tsc --noEmit --strict` MUST 通过（针对修改的文件）
7. 所有现有测试 MUST 通过

## Dependencies and Sequencing

### 前置依赖
- 无硬性依赖

### 后续影响
- 为后续所有功能开发建立"零 as any"规范
- revisionOrchestrator 类型加固直接服务于 F-008 修订工作流

### 建议排期
- **Batch 1, Week 1-2**
- 预估工时：1-2 天
- 可与 F-001 并行执行
