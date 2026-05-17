# TASK-003: 非测试文件 as-any 类型加固

## Status: COMPLETED

## Changes
- Modified: `desktop/src/components/editor/extensions/MathView.tsx` — removed unnecessary `as any` cast (node already typed as PMNode)
- Modified: `desktop/src/components/ExportDialog.tsx` — removed `as any` after adding `'docx'` to format union
- Modified: `desktop/src/components/WritingHelperPanel.tsx` — `as any` → `as object` (guarded by typeof check)
- Modified: `desktop/src/services/revisionOrchestrator.ts` — `as any[]` → `as unknown[]` + runtime type narrowing
- Modified: `desktop/src/hooks/useExportHistory.ts` — added `'docx'` to ExportEntry format union type

## Key Decisions
1. MathView: node from NodeViewProps is already properly typed — cast was unnecessary
2. ExportDialog: root cause was missing 'docx' in format union, fixed at source rather than suppressing
3. WritingHelperPanel: used `as object` since typeof guard already validates
4. revisionOrchestrator: used `unknown[]` + Record<string, unknown> + typeof narrowing for runtime safety

## Verification
- grep 'as any' returns 0 matches in all 4 target files
- npx tsc --noEmit exits 0
- 116 tests passed, 0 failed
