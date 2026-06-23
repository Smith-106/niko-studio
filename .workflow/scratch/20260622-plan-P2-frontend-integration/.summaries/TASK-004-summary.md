# TASK-004 Summary: reader-endpoints.ts 拆分方案文档

**Status**: ✅ Completed
**Convergence**: 5/5 criteria passed

## Files Created

1. **Created**: `.workflow/milestones/M27/reader-endpoints-split-plan.md` — 完整拆分方案文档

## Document Content

- 概述：1146 行 / 13 函数 / 11 接口 / 本次仅文档化不拆分
- 4 功能组划分：A(analyze+overlay) / B(personas) / C(feedback) / D(compare+deai)
- 组间依赖关系：B/C 叶子组→A→D；clearReaderStores 跨组
- 推荐拆分顺序：B→C→A→D→主文件瘦身（最小化破坏面）
- 测试影响：server.ts 路由注册 + 2 测试文件 import 更新 + 向后兼容 re-export 锚策略
- 风险与回滚提示

## Convergence Evidence

- 文件存在 ✓
- 4 功能组标题均命中（16 matches 跨全文） ✓
- 「拆分顺序」命中 ✓
- 「测试影响」命中 ✓
- reader-endpoints.ts 未被修改 ✓

## Deviations

None. 文档标注「初步划分，M28+ 执行时复核」。
