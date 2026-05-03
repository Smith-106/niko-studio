# TASK-007 Summary: Wire CharacterManager depth system to endpoints + profile UI

## Status: COMPLETED

## What was done

1. **Created service layer** (`src-tauri/bin/sidecar/mcp/services/character.js`):
   - Singleton wrapper around `CharacterManager` with lazy `getManager()` init
   - 4 exported async functions: `characterAnalyzeDepth`, `characterGetProfile`, `characterGetRelationships`, `characterValidateConsistency`
   - Uses `charToDict()` for serialization in profile endpoint

2. **Created endpoint handlers** (`src-tauri/bin/sidecar/mcp/endpoints/character.js`):
   - `characterDepthEndpoint` — POST /character/depth, validates `id`, returns depth assessment
   - `characterProfileEndpoint` — POST /character/profile, validates `name`, returns full charToDict profile
   - `characterRelationshipsEndpoint` — POST /character/relationships, returns network graph
   - `characterConsistencyEndpoint` — POST /character/consistency, validates `id`, returns validation result

3. **Registered routes** in `routes/content.js` + barrel export in `endpoints/index.js`

4. **Added frontend API** (`src/api/knowledge.ts`):
   - `CharacterDepthAssessment`, `CharacterProfile`, `CharacterRelationshipNetwork` interfaces
   - 4 API functions: `analyzeCharacterDepth`, `getCharacterProfile`, `getCharacterRelationships`, `validateCharacterConsistency`

5. **Extended UI** (`src/components/knowledge/CharacterTab.tsx`):
   - Added profile lookup section with name input + load button below PersistedEntityTab
   - Profile summary card showing name, role, depth level, overall score
   - Depth analysis button with five-dimension score grid (dynamic/competence/eccentricity/contrast/duality)
   - Relationship network display with node/edge listing
   - Consistency validation endpoint wired (ready for future UI)

6. **Added i18n keys** (`src/i18n/translations.ts`):
   - 13 new keys for depth/profile/relationships/consistency UI labels (zh + en)

## Decisions

- **Service singleton pattern**: CharacterManager not in DI container, so module-level singleton with lazy init (same as ForeshadowingManager)
- **Name-based lookup**: Profile endpoint uses `getByName()` since the existing graph-based CRUD works with character names
- **Additive UI**: Profile panel added below PersistedEntityTab, keeping backward compatibility with existing character CRUD

## Verification

- TypeScript compiles cleanly for all modified files
- 860 tests pass, no regressions
