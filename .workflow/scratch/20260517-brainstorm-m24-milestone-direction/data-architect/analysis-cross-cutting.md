# Cross-Cutting Data Architecture Concerns

## 1. Shared Data Patterns

### Schema Version Header

All persisted JSON artifacts MUST include a `$schema_version` field at the document root. Format: `YYYY-MM` (matching existing `ANALYSIS_SCHEMA_VERSION = '2026-02'` pattern in `workflow/types.ts`).

```typescript
interface VersionedDocument {
  $schema_version: string;  // e.g. "2026-03"
  [key: string]: unknown;
}
```

Readers MUST implement version-aware deserialization: if `$schema_version` is newer than known, apply best-effort parsing with `additionalProperties: true` semantics. Readers MUST NOT reject unknown fields.

### Enum + Interface + Record Pattern

The codebase consistently uses `enum → interface → Record<enum, interface>` for catalog data (SatisfactionPattern, CommentaryTechnique, OralNarrativeSkill). Externalized data MUST preserve this pattern at the TypeScript type level even when storage moves to JSON files. Build-time codegen bridges the gap.

### Optional Fields Convention

Per architecture specs, schema evolution uses optional fields. All new fields added to existing interfaces MUST be optional (`field?: Type`). Removal of fields MUST NOT occur within a major version — deprecated fields SHOULD be marked with JSDoc `@deprecated` and retained for 2 milestone cycles.

## 2. Schema Evolution Strategy

### Versioning Rules

- **Additive changes** (new optional fields): bump minor version (`2026-02` → `2026-03`). No migration needed.
- **Structural changes** (field rename, type change): bump major version (`2026-02` → `2027-01`). Migration script required.
- **Removal**: MUST NOT remove fields. Mark deprecated, stop writing after 2 milestones.

### Migration Infrastructure

A `migrations/` directory SHOULD be introduced at `src-ts/migrations/` containing versioned transform functions:

```typescript
interface Migration {
  from: string;       // source schema version
  to: string;         // target schema version
  transform: (data: unknown) => unknown;
}
```

Migrations MUST be idempotent and reversible where possible. The system SHOULD apply migrations lazily on read (migrate-on-access) rather than batch migration at startup.

### Legacy Contract Compatibility

The existing `LEGACY_CONTRACT_FIELD_MAP` and `LEGACY_DECISION_MAP` in `workflow/types.ts` demonstrate the project's approach to backward compatibility. This pattern SHOULD be generalized into a `compat-layer` utility that other modules can reuse.

## 3. Data Validation Approach

### Validation Layers

| Layer | Responsibility | Tool |
|-------|---------------|------|
| Build-time | Type correctness of static data | TypeScript compiler + codegen |
| Load-time | Schema conformance of external JSON | JSON Schema or Zod validation |
| Runtime | Business rule validation | Domain-specific validators |

External data files (craft-catalog, translations) MUST be validated at load-time against their JSON Schema. Validation failures MUST produce structured error objects (not thrown exceptions) to allow graceful degradation.

### Validation Schema Location

JSON Schema files SHOULD live alongside their data files:
```
data/
  craft-catalog/
    v1/
      catalog.json
      catalog.schema.json
```

## 4. Caching Considerations

### Cache Hierarchy

| Data Type | Cache Strategy | Invalidation |
|-----------|---------------|--------------|
| Craft catalog | In-memory singleton, reload on file change | File watcher (fs.watch) |
| Translations | Per-locale in-memory map | Language switch event |
| Workflow state | No cache (always read from session store) | N/A |
| Analysis scores | LRU cache (per chapter hash) | Content change |
| Config | Layered merge cache | Config file change |

### Hot-Reload Protocol

For externalized data (F-004, F-005), the system SHOULD implement:
1. File watcher detects change
2. Validate new data against schema
3. If valid: atomic swap of in-memory reference
4. If invalid: log warning, retain previous version
5. Emit event for dependent modules to refresh

Cache invalidation MUST be event-driven, not polling-based.

## 5. Data Lifecycle Management

### Retention Policy

| Data Category | Retention | Storage |
|---------------|-----------|---------|
| Session state (active) | Until archived | File system (JSON) |
| Session state (archived) | 90 days default | File system, compressible |
| Workflow audit events | Indefinite | JSONL append-only |
| Analysis results | Per-chapter, latest 5 versions | File system |
| User config | Indefinite | JSON file |

### Cleanup Strategy

The system SHOULD implement a background cleanup task that:
- Archives sessions older than configurable threshold
- Compacts audit logs (merge daily entries)
- Removes orphaned analysis results (no matching chapter)

Cleanup MUST NOT run during active writing sessions. Cleanup MAY be triggered on app startup after a configurable idle period.

## 6. Data Integrity

### Atomicity

File writes MUST use write-to-temp-then-rename pattern to prevent corruption on crash. The existing `SessionManager` path-routing pattern provides a good foundation.

### Consistency

Cross-file references (e.g., session referencing a plan) MUST use stable IDs. The existing `SESSION_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/` SHOULD be adopted as the universal ID format.

### Backup

Before any migration transforms, the system MUST create a backup of the original data. Backups SHOULD be stored in a `.backup/` sibling directory with timestamp suffix.
