# F-003: Type Safety Cleanup

## 1. Requirements Summary

All `as any` type assertions in non-test frontend files (4 files) MUST be replaced with proper TypeScript types. The cleanup MUST NOT change runtime behavior and SHOULD improve IDE autocompletion and error detection.

## 2. Design Decisions [CORE]

### Scope: 4 Non-Test Files

| File | Expected Approach |
|------|-------------------|
| `components/editor/extensions/MathView.tsx` | Tiptap extension typing — use `NodeViewProps` generic |
| `components/ExportDialog.tsx` | Event handler typing — use proper DOM event types |
| `components/WritingHelperPanel.tsx` | API response typing — define response interfaces |
| `services/revisionOrchestrator.ts` | Service method typing — use existing domain types |

### Strategy: Type Narrowing Over Type Assertion

For each `as any` occurrence:
1. Identify the actual runtime type (via debugger or type inference)
2. Define or import the correct interface
3. Replace `as any` with either:
   - Proper type annotation (preferred)
   - Type guard function (for dynamic data)
   - Generic type parameter (for library interop)
   - `as SpecificType` (last resort, only when library types are incomplete)

**Why not `@ts-expect-error`**: It hides the problem. The goal is to make the type system accurately reflect runtime reality.

### Branded Types (Where Applicable)

For IDs and domain-specific strings that are currently `string`:
```typescript
type ChapterId = string & { readonly __brand: 'ChapterId' };
type DimensionId = string & { readonly __brand: 'DimensionId' };
```

Only introduce branded types where `as any` was used to bypass ID type mismatches. Do not over-apply.

## 3. Interface Contract

No public interface changes. All fixes are internal type annotations.

## 4. Constraints & Risks

- **Risk (Low)**: Tiptap extension types may be incomplete upstream → use module augmentation if needed
- **Constraint**: MUST NOT add `@ts-ignore` or `@ts-expect-error` as replacements
- **Constraint**: MUST NOT change any runtime behavior (type-only changes)

## 5. Acceptance Criteria

- [ ] Zero `as any` in non-test frontend source files
- [ ] `tsc --noEmit` passes with strict mode
- [ ] All existing tests pass
- [ ] No new type assertions introduced (net reduction)

## 6. Detailed Analysis References

- @system-architect/analysis-F-003-type-safety-cleanup.md — Branded types, type guard patterns
- @product-manager/analysis-F-003-type-safety-cleanup.md — DX improvement metrics

## 7. Cross-Feature Dependencies

- **Depends on**: None (independent)
- **Produces**: Type-safe foundation for F-006 refactor (safer refactoring with full type coverage)
- **Parallel with**: F-001 (no conflicts)
