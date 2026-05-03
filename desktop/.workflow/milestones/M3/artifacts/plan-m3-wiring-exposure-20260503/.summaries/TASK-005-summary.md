# TASK-005 Summary: Wire ForeshadowingManager lifecycle to MCP endpoints + UI

## Status: COMPLETED

## What was done

1. **Created service layer** (`src-tauri/bin/sidecar/mcp/services/foreshadow.js`):
   - Singleton wrapper around `ForeshadowingManager` with lazy `getManager()` init
   - 4 exported async functions: `foreshadowPlant`, `foreshadowHint`, `foreshadowHarvest`, `foreshadowGetStats`
   - Uses `foreshadowToDict()` for serialization

2. **Created endpoint handlers** (`src-tauri/bin/sidecar/mcp/endpoints/foreshadow.js`):
   - `foreshadowPlantEndpoint` — POST, validates `description`, returns `{success, data}`
   - `foreshadowHintEndpoint` — POST, validates `id`, 404 if not found/harvested
   - `foreshadowHarvestEndpoint` — POST, validates `id`, 404 if not found
   - `foreshadowStatsEndpoint` — GET, returns `{success, data: stats}`

3. **Registered routes** in `routes/content.js` + barrel export in `endpoints/index.js`

4. **Added frontend API** (`src/api/knowledge.ts`):
   - `ForeshadowItem` and `ForeshadowStats` interfaces
   - 4 API functions: `plantForeshadow`, `hintForeshadow`, `harvestForeshadow`, `getForeshadowStats`
   - No `appendWorkspacePayload` — ForeshadowingManager is in-memory, not workspace-scoped

5. **Extended UI** (`src/components/knowledge/MemoryForm.tsx`):
   - Added plant input + button below existing foreshadow filter section
   - Added stats display row (planted/hinted/harvested counts)
   - Added stats button to load statistics
   - Original filter section preserved for backward compatibility

6. **Added i18n keys** (`src/i18n/translations.ts`):
   - 8 new keys for plant/hint/harvest actions and status labels (zh + en)

## Decisions

- **Service singleton pattern**: ForeshadowingManager not in DI container, so module-level singleton with lazy init
- **No workspace scope**: Foreshadow endpoints don't use `appendWorkspacePayload` since the manager is in-memory
- **Additive UI**: Extended existing foreshadow panel rather than replacing it, keeping backward compatibility

## Verification

- TypeScript compiles cleanly (only pre-existing errors in unrelated files)
- 860 tests pass
