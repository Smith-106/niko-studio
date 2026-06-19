# F-005: Craft Catalog Externalization

## Data Model Design

### Format Decision: JSON

**JSON** is the recommended format over YAML or custom formats:

| Criterion | JSON | YAML | Custom |
|-----------|------|------|--------|
| TypeScript ecosystem fit | Native (JSON.parse) | Requires `js-yaml` dep | Custom parser needed |
| Type generation | Direct schema → types | Extra transform step | Full custom tooling |
| IDE support | Excellent (JSON Schema) | Good | None |
| Hot-reload complexity | Low (parse + validate) | Medium (parse + validate + dep) | High |
| Human readability | Good (with formatting) | Better | Variable |
| Existing pattern | Matches `locales/*.json` | New pattern | New pattern |

YAML's readability advantage is marginal for structured catalog data. JSON's zero-dependency parsing and native TypeScript tooling make it the pragmatic choice.

### Schema Design

Each catalog dimension becomes a separate JSON file:

```
data/craft-catalog/
  v1/
    satisfaction-patterns.json
    commentary-techniques.json
    oral-narrative-skills.json
    catalog.schema.json          → shared JSON Schema
    manifest.json                → index of all dimension files
```

**manifest.json**:
```json
{
  "$schema_version": "2026-03",
  "dimensions": [
    { "id": "satisfaction-patterns", "file": "satisfaction-patterns.json", "entry_count": 10 },
    { "id": "commentary-techniques", "file": "commentary-techniques.json", "entry_count": 8 },
    { "id": "oral-narrative-skills", "file": "oral-narrative-skills.json", "entry_count": 6 }
  ]
}
```

**satisfaction-patterns.json** (example):
```json
{
  "$schema_version": "2026-03",
  "dimension": "satisfaction-patterns",
  "entries": {
    "power_display": {
      "label": "装逼打脸",
      "structure": ["对方轻视/挑衅", "主角展示碾压实力", "旁观者震惊+对方后悔"],
      "proportion": [0.3, 0.4, 0.3],
      "keywords": {
        "setup": ["不屑", "冷笑", "不过如此"],
        "payoff": ["一击", "秒杀", "碾压"],
        "twist": ["原来", "竟然还", "只是热身"]
      },
      "informationGap": "reader_ahead"
    }
  }
}
```

### Versioning Strategy

- Catalog data is versioned via `$schema_version` in each file
- The `v1/` directory allows future major restructuring (`v2/`) without breaking existing installations
- Minor additions (new entries within a dimension) do NOT require version bump
- Structural changes (new fields on entries, renamed keys) require version bump

## Hot-Reload Strategy

```typescript
interface CatalogLoader {
  load(dimensionId: string): Promise<CatalogDimension>;
  reload(dimensionId?: string): Promise<void>;  // reload specific or all
  onChange(callback: (dimensionId: string) => void): Disposable;
}
```

Implementation:
1. On startup: load all dimension files, validate against schema, build in-memory `Record<enum, Def>` maps
2. File watcher on `data/craft-catalog/v1/` directory
3. On file change: re-validate changed file → if valid, atomic swap of in-memory map → emit change event
4. Consumers (analyzers, detectors) receive change event and refresh their references

Hot-reload SHOULD be opt-in (disabled in production builds for stability, enabled in development).

### Build-Time Type Generation

A build script MUST generate TypeScript types from the JSON catalog:

```typescript
// auto-generated from data/craft-catalog/v1/satisfaction-patterns.json
export type SatisfactionPatternKey = 'power_display' | 'hidden_power' | 'underdog_win' | ...;
export const SATISFACTION_PATTERN_KEYS: readonly SatisfactionPatternKey[] = [...];
```

This preserves the enum-like type safety of the current `SatisfactionPattern` enum while allowing data to live in JSON.

## Storage Strategy

- **Location**: `data/craft-catalog/v1/` at project root (not inside `src-ts/`)
- **Build output**: Generated types written to `src-ts/narrative/writing-craft/generated/`
- **Runtime access**: Loaded via a `CatalogService` singleton that reads from the data directory
- **Bundling**: For desktop distribution, catalog JSON files are copied to the sidecar bundle

## Migration Path

1. **Export**: Script reads current `craft-catalog.ts`, extracts all enum values and Record entries, writes JSON files
2. **Generate**: Build script produces TypeScript types + runtime loader from JSON
3. **Bridge**: `craft-catalog.ts` becomes a thin re-export of generated types + loaded data
4. **Validate**: Run existing `craft-catalog-m15.test.ts` against new loader to verify equivalence
5. **Cleanup**: Remove static data from `craft-catalog.ts`, retain only the re-export facade

### Data Integrity Check

The migration script MUST verify:
- Entry count matches (10 satisfaction patterns, etc.)
- All enum values preserved
- All keyword arrays preserved exactly
- All numeric values (proportions) preserved

## Backward Compatibility

- `SatisfactionPattern` enum type remains importable from same path
- `SATISFACTION_PATTERNS` Record remains importable from same path
- Runtime behavior identical — same data, different source
- Existing tests pass without modification (they import the same symbols)
- The `enum+interface+Record` pattern is preserved at the TypeScript level via codegen
