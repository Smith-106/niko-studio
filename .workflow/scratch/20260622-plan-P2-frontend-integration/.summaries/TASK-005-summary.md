# TASK-005 Summary: DocumentEditor.tsx import 重指向 + 4 测试 vi.mock/import 同步迁移

**Status**: ✅ Completed
**Convergence**: 5/5 criteria passed (含 [UI-observable])

## Files Changed

1. **Modified**: `desktop/src/components/DocumentEditor.tsx` L21-24 — `from '../../../src-ts/analysis/personalized-craft-profile'` → `from '../api/analysis'`
2. **Modified**: `desktop/src/components/DocumentEditor.additional.test.tsx` — vi.mock 路径 + import 路径同步改为 `'../api/analysis'`
3. **Modified**: `desktop/src/components/DocumentEditor.branch-gap.additional.test.tsx` — vi.mock 路径 + import 路径同步
4. **Modified**: `desktop/src/components/DocumentEditor.branches.additional.test.tsx` — vi.mock 路径同步
5. **Modified**: `desktop/src/components/DocumentEditor.branches.extra.test.tsx` — vi.mock 路径同步

## Convergence Evidence

- DocumentEditor.tsx `grep "from.*src-ts/analysis/personalized-craft-profile"` = 0 ✓
- DocumentEditor.tsx `grep "from '../api/analysis'"` = 1 ✓
- `grep "vi.mock.*src-ts/analysis/personalized-craft-profile" desktop/src/components/` = 空 ✓
- `grep "vi.mock.*'../api/analysis'" desktop/src/components/DocumentEditor.*.test.tsx` 命中 4 文件 ✓
- `[UI-observable]` vitest run 4 DocumentEditor 测试文件 = 25/25 passed ✓

## Deviations

**计划外修复**: 2 个测试文件（additional + branch-gap）的 `import { buildPersonalizedCraftProfile }` 路径也需同步从 `src-ts/...` 改为 `../api/analysis`，否则 `vi.mocked()` 获取真实函数而非 mock 函数，导致 `mockReturnValue is not a function` 错误。此偏离是 plan 未列出的 4 个 import 行（非 vi.mock 行），但逻辑上属于"vi.mock 路径须与生产 import 一致"（G-003 灰色地带）的自然延伸。
