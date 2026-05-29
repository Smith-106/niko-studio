# F-007: Configuration Data Model

## Data Model Design

### Layered Configuration Schema

Configuration MUST follow a layered merge strategy (lower layers override higher):

```
Layer 1: Defaults (built-in, hardcoded)
Layer 2: System config (app-level, shipped with distribution)
Layer 3: User config (per-user preferences)
Layer 4: Project config (per-novel/workspace)
Layer 5: Session config (runtime overrides, ephemeral)
```

**ConfigSchema** — Unified configuration shape:
```typescript
interface AppConfig {
  $schema_version: string;
  $layer?: 'system' | 'user' | 'project' | 'session';
  
  // LLM settings
  llm: {
    provider?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
  };
  
  // Workflow settings
  workflow: {
    defaultLevel?: number;
    autoApproveThreshold?: number;
    checkpointInterval?: number;    // seconds
    maxRevisions?: number;
  };
  
  // Analysis settings
  analysis: {
    enabledDimensions?: string[];
    scoreThreshold?: number;
    parallelAnalyzers?: number;
  };
  
  // UI settings
  ui: {
    language?: 'zh' | 'en';
    theme?: 'light' | 'dark' | 'system';
    fontSize?: number;
    panelLayout?: Record<string, unknown>;
  };
  
  // Storage settings
  storage: {
    sessionRetentionDays?: number;
    maxCheckpoints?: number;
    autoArchive?: boolean;
  };
}
```

All fields MUST be optional at every layer (partial configs merge upward). Only Layer 1 (defaults) provides complete values.

### Validation Strategy

Each config field MUST define:
- Type constraint (via TypeScript + JSON Schema)
- Value range (min/max for numbers, enum for strings)
- Default value (in Layer 1)

```typescript
interface ConfigFieldMeta {
  key: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  default: unknown;
  validation?: {
    min?: number;
    max?: number;
    enum?: string[];
    pattern?: string;
  };
  layer_writable: ('system' | 'user' | 'project' | 'session')[];
  description: string;
}
```

Some fields MUST NOT be overridable at lower layers (e.g., security-critical settings). The `layer_writable` array controls this.

## Storage Strategy

| Layer | Location | Format |
|-------|----------|--------|
| Defaults | `src-ts/config/defaults.ts` | TypeScript const |
| System | `data/config/system.json` | JSON |
| User | `~/.niko-studio/config.json` | JSON |
| Project | `{project}/.niko/config.json` | JSON |
| Session | In-memory only | N/A |

Access pattern: On startup, merge all layers bottom-up. Cache merged result. Re-merge on file change (user/project layers).

## Migration Path

Current state: Configuration is scattered across multiple locations:
- `LevelConfig` in `workflow/types.ts` (workflow-specific)
- Settings store in desktop app (`useSettingsStore`)
- Various hardcoded constants

Migration:
1. **Audit**: Catalog all configurable values across codebase
2. **Schema**: Define unified `AppConfig` interface
3. **Defaults**: Extract hardcoded values into `config/defaults.ts`
4. **Loader**: Implement layered config loader with merge logic
5. **Bridge**: Existing `LevelConfig` and settings store read from unified config

### Merge Semantics

- Scalar values: lower layer wins (override)
- Arrays: lower layer replaces entirely (no merge)
- Objects: deep merge (field-by-field)
- `null` value at any layer: explicitly unset (revert to higher layer default)

## Data Flow Changes

Current: Each module reads its own config from various sources
Target: `ConfigService.get('workflow.defaultLevel')` → returns merged value from all layers

The `ConfigService` SHOULD expose:
- `get<T>(path: string): T` — read merged value
- `set(path: string, value: unknown, layer: Layer): void` — write to specific layer
- `onChange(path: string, callback): Disposable` — watch for changes

## Backward Compatibility

- Existing `LEVEL_CONFIGS` in `workflow/types.ts` remains as the default values source
- Existing `useSettingsStore` in desktop continues to work (reads from user layer)
- No existing config files are relocated or reformatted
- New config system is additive — modules can adopt it incrementally
- Modules that don't adopt the new system continue reading their own config sources
