# F-005: Craft Catalog Externalize

## 1. Requirements Summary

The static craft-catalog data (1584 lines in `craft-catalog.ts`) MUST be externalized to JSON files with JSON Schema validation, build-time TypeScript type generation, and optional hot-reload capability. The externalization MUST preserve the existing `enum + interface + Record` pattern at the type level and MUST NOT break any consumer code.

## 2. Design Decisions [CORE]

### Architecture: JSON Data + JSON Schema + Build-Time Codegen

**Target structure**:
```
src-ts/data/
├── craft-catalog/
│   ├── v1/
│   │   ├── dimensions.json         (WritingCraftDimension data)
│   │   ├── patterns.json           (SatisfactionPattern data)
│   │   ├── techniques.json         (CommentaryTechnique data)
│   │   └── catalog.schema.json     (JSON Schema for validation)
│   └── index.ts                    (loader + type exports)
├── codegen/
│   └── generate-catalog-types.ts   (build script)
```

**Why JSON over YAML** (data-architect consensus):
- Zero-dependency parsing (native `JSON.parse`)
- Native TypeScript tooling support
- Better IDE support (JSON Schema IntelliSense)
- Smaller bundle when embedded as static import

### Data Model Preservation

The existing pattern `enum → interface → Record<enum, interface>` is preserved at the TypeScript level through build-time code generation:

```typescript
// Generated at build time from dimensions.json
export enum WritingCraftDimension {
  PACING = 'pacing',
  TENSION = 'tension',
  // ... generated from JSON keys
}

export interface DimensionDefinition {
  id: string;
  name: string;
  description: string;
  indicators: string[];
  // ... from JSON schema
}

export const DIMENSION_CATALOG: Record<WritingCraftDimension, DimensionDefinition> = {
  // ... generated from JSON data
};
```

### Validation Strategy (Three Layers)

| Layer | When | Tool | Failure Mode |
|-------|------|------|-------------|
| Build-time | `npm run build` | TypeScript compiler on generated types | Build fails |
| Load-time | App startup or first access | JSON Schema validation (Zod/AJV) | Fallback to bundled default |
| Runtime | Data access | TypeScript type system | Compile-time error |

### Hot-Reload Protocol (from data-architect EP-003)

1. File watcher detects JSON change (development mode only)
2. Validate against `catalog.schema.json`
3. If valid: regenerate types + atomic swap in-memory cache
4. If invalid: log warning via LogService, retain previous version
5. Emit `catalog:updated` event for dependent modules

**Production**: No hot-reload. Data is bundled at build time as static JSON import.

### Migration Path

1. Extract data from `craft-catalog.ts` → JSON files (automated script)
2. Write JSON Schema from existing TypeScript interfaces
3. Create codegen script (JSON → TypeScript types + constants)
4. Update build pipeline to run codegen before compilation
5. Update all imports to use generated module
6. Remove original `craft-catalog.ts` (or reduce to re-export)
7. Verify all consumers compile and tests pass

## 3. Interface Contract

```typescript
// Public API — MUST NOT change
export { WritingCraftDimension } from './generated/dimensions';
export { SatisfactionPattern } from './generated/patterns';
export { DIMENSION_CATALOG, PATTERN_CATALOG } from './generated/catalogs';

// New internal API
export interface CatalogLoader {
  getDimensions(): DimensionDefinition[];
  getPatterns(): SatisfactionPattern[];
  reload(): Promise<void>;  // dev-mode only
}
```

All existing export types from `craft-catalog.ts` MUST be preserved with identical signatures.

## 4. Constraints & Risks

- **Risk (Low-Medium)**: Codegen adds build complexity → mitigate with clear npm script and CI validation
- **Risk (Low)**: JSON doesn't support comments → use `_comment` fields or separate docs
- **Constraint**: Bundle size MUST NOT increase (JSON is typically smaller than TS source)
- **Constraint**: Existing `enum` values MUST NOT change (backward compatibility)
- **EP-001**: All JSON files include `$schema_version: "2026-05"`

## 5. Acceptance Criteria

- [ ] All catalog data lives in JSON files (not TypeScript source)
- [ ] JSON Schema validates all data files
- [ ] Build-time codegen produces correct TypeScript types
- [ ] All existing imports resolve without changes
- [ ] Hot-reload works in development mode
- [ ] Bundle size delta < +5%
- [ ] All narrative analysis tests pass

## 6. Detailed Analysis References

- @system-architect/analysis-F-005-craft-catalog-externalize.md — JSON + type guards, shared infrastructure
- @product-manager/analysis-F-005-craft-catalog-externalize.md — Future extensibility, community contribution path
- @data-architect/analysis-F-005-craft-catalog.md — JSON format decision, versioning, hot-reload protocol

## 7. Cross-Feature Dependencies

- **Depends on**: None (parallel with F-004)
- **Produces**: Externalized data pattern reusable for future knowledge bases
- **Enables**: F-008 (revision workflow needs catalog data access patterns)
- **EP-001 applied**: Schema version header
- **EP-002 applied**: ModuleLoader pattern (shared with F-004)
- **EP-003 applied**: Hot-reload protocol
- **EP-005 applied**: Migrate-on-access for version upgrades
