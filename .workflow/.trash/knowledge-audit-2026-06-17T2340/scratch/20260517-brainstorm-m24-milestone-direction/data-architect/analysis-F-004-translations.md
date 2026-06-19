# F-004: Translation Externalization

## Data Model Design

### Module Boundary Definition

Translations MUST be split by functional module. The current monolithic `translations.ts` (2892 lines in desktop, 51 lines in src-ts) becomes a module-scoped system:

```
desktop/src/i18n/
  locales/
    zh-CN/
      common.json          → app-level strings (title, service status)
      chat.json            → chat panel strings
      knowledge.json       → knowledge modal strings
      workflow.json        → workflow-related strings
      analysis.json        → analysis panel strings
      settings.json        → settings page strings
      editor.json          → editor component strings
    en-US/
      common.json
      chat.json
      ...
```

### Key Namespace Strategy

Keys MUST follow a hierarchical namespace: `{module}.{component}.{element}`:

```json
{
  "chat.input.placeholder": "开始写作...",
  "chat.stream.canceled": "流已取消",
  "chat.starter.hint": "试试这些开始方式",
  "knowledge.modal.title": "知识库",
  "knowledge.tab.characters": "角色"
}
```

Rules:
- Module prefix MUST match the file name (keys in `chat.json` start with `chat.`)
- Maximum 3 levels of nesting in key names
- Leaf keys MUST be descriptive English (no abbreviations)
- Interpolation variables use `{{variable}}` syntax (i18next standard)

### Type Safety

A build-time script MUST generate TypeScript types from JSON files:

```typescript
// auto-generated: do not edit
interface TranslationKeys {
  'chat.input.placeholder': string;
  'chat.stream.canceled': string;
  // ...
}
```

This preserves the compile-time safety of the current `Translations` interface.

## Storage Strategy

- **Format**: JSON (native to i18next, no parser dependency)
- **Location**: `desktop/src/i18n/locales/{locale}/{module}.json`
- **Loading**: Lazy per-module via i18next `backend` plugin or dynamic import
- **Backend (src-ts)**: Retain minimal inline translations for server-side messages (< 50 keys)

The existing `zh-CN.json` and `en-US.json` files in `desktop/src/i18n/locales/` already use JSON format — this is an expansion of that pattern.

## Migration Path

1. **Extract**: Parse current `translations.ts` `Translations` interface, group keys by module prefix
2. **Generate**: Write per-module JSON files for each locale
3. **Bridge**: Keep `translations.ts` as a re-export facade that loads from JSON (backward compat)
4. **Update**: Migrate components from direct `translations` import to `useTranslation(namespace)` hook
5. **Remove**: Delete monolithic `translations.ts` once all consumers migrated

### Phasing

- Phase 1: Generate JSON files from existing data, keep `translations.ts` as source of truth
- Phase 2: Flip source of truth to JSON files, generate `translations.ts` from JSON
- Phase 3: Remove `translations.ts`, all consumers use i18next directly

## Data Flow Changes

Current: `translations.ts → import → component`
Target: `JSON files → i18next loader → useTranslation(ns) → component`

The `syncI18nLanguage()` function in `desktop/src/i18n/index.ts` continues to work — it already uses i18next. The change is in how resources are loaded (static import → dynamic namespace loading).

## Backward Compatibility

- The `Language` type (`'zh' | 'en'`) and `Translations` interface MUST remain exported during transition
- The `LANGUAGE_TO_LOCALE` mapping remains unchanged
- Components using `t()` from i18next are already compatible
- Components using the legacy `translations[lang]` pattern need migration but can use a compat wrapper:

```typescript
// Compat wrapper during migration
export function legacyT(lang: Language): Translations {
  return new Proxy({} as Translations, {
    get: (_, key: string) => i18n.t(key, { lng: LANGUAGE_TO_LOCALE[lang] })
  });
}
```

- The `src-ts/ui/translations.ts` (51 lines, LOCK system labels) is a separate concern — it SHOULD remain inline as it serves the backend analysis module, not the UI framework.
