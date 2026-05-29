# F-004: Translations Modularize

## 1. Requirements Summary

The monolithic `translations.ts` (2892 lines) MUST be split into per-module JSON files with namespace-scoped keys. The split MUST preserve all existing translation keys, maintain the `useI18n()` hook interface, and support lazy loading of translation modules.

## 2. Design Decisions [CORE]

### Architecture: Namespace-Scoped JSON Modules

**Directory structure**:
```
desktop/src/i18n/
├── index.ts              (loader + useI18n hook, ~100 lines)
├── types.ts              (generated type definitions)
├── locales/
│   ├── zh/
│   │   ├── common.json       (shared UI strings)
│   │   ├── editor.json       (editor-related)
│   │   ├── evaluation.json   (evaluation panel)
│   │   ├── storyBible.json   (story bible panel)
│   │   ├── workflow.json     (workflow/automation)
│   │   ├── knowledge.json    (knowledge system)
│   │   ├── settings.json     (settings/preferences)
│   │   └── export.json       (export/import)
│   └── en/
│       └── ... (same structure)
```

**Key namespace convention**: `module.component.key` (e.g., `evaluation.dimensions.pacing`). Existing flat keys map to `common.*` namespace.

**Why JSON over TypeScript**: 
- Enables hot-reload without recompilation
- Standard format for i18n tooling (Crowdin, Lokalise)
- Tree-shakeable with dynamic imports
- Aligns with data-architect's externalization strategy

### Loading Strategy: Eager Common + Lazy Modules

```typescript
// Common module loaded at startup (small, ~200 keys)
// Feature modules loaded on first panel/route access
const translations = await loadModule('evaluation'); // lazy
```

**ModuleLoader pattern** (shared with F-005, from system-architect EP-002):
```typescript
interface I18nModuleLoader {
  load(module: string, locale: string): Promise<Record<string, string>>;
  preload(modules: string[]): Promise<void>;
  invalidate(module: string): void;
}
```

### Migration Path

1. Parse existing `translations.ts` → extract key-value pairs
2. Categorize keys by module (automated via key prefix analysis)
3. Generate JSON files per module
4. Generate TypeScript types from JSON (build-time)
5. Update `useI18n()` internals to use loader (interface unchanged)
6. Verify all keys resolve correctly

### Backward Compatibility

The `useI18n()` hook return type `Translations` MUST NOT change. Internally, the implementation switches from static import to dynamic loading, but consumers see the same `t('key.path')` API.

## 3. Interface Contract

```typescript
// Public API — MUST NOT change
export function useI18n(): {
  t: (key: string, params?: Record<string, string>) => string;
  locale: string;
  setLocale: (locale: string) => void;
};

// Internal (new)
interface TranslationModule {
  $schema_version: string;  // EP-001
  keys: Record<string, string>;
}
```

## 4. Constraints & Risks

- **Risk (Low)**: Key categorization may be ambiguous for some strings → manual review for edge cases
- **Risk (Low)**: Lazy loading adds async complexity → preload critical modules at app init
- **Constraint**: All existing key paths MUST resolve identically (zero broken translations)
- **Constraint**: Fallback to key string if module load fails (graceful degradation)

## 5. Acceptance Criteria

- [ ] `translations.ts` removed or reduced to re-export shim
- [ ] Per-module JSON files created with correct key mapping
- [ ] `useI18n()` hook interface unchanged
- [ ] All UI strings render correctly (manual spot-check)
- [ ] Build-time type generation produces correct `Translations` type
- [ ] Module lazy loading verified (network tab shows deferred loads)

## 6. Detailed Analysis References

- @system-architect/analysis-F-004-translations-modularize.md — ModuleLoader pattern, build-time types
- @product-manager/analysis-F-004-translations-modularize.md — DX improvement, future multi-language
- @data-architect/analysis-F-004-translations.md — Namespace strategy, hot-reload protocol

## 7. Cross-Feature Dependencies

- **Depends on**: None (independent, parallel with F-005)
- **Produces**: ModuleLoader pattern reused by F-005
- **EP-001 applied**: `$schema_version` in translation JSON files
- **EP-002 applied**: Shared ModuleLoader interface
