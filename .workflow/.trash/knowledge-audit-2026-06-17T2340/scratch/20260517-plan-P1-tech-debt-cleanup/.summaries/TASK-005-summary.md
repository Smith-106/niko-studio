# TASK-005: craft-catalog 外置为 JSON + 热加载 loader

## Status: COMPLETED

## Changes
- Created: `src-ts/narrative/writing-craft/catalog-loader.ts` — JSON loading with lazy caching + reloadCatalog()
- Created: `src-ts/narrative/writing-craft/catalog-data/satisfaction-patterns.json`
- Created: `src-ts/narrative/writing-craft/catalog-data/narrative-techniques.json`
- Created: `src-ts/narrative/writing-craft/catalog-data/genre-structures.json`
- Created: `src-ts/narrative/writing-craft/catalog-data/web-novel-data.json`
- Created: `src-ts/narrative/writing-craft/catalog-data/writing-quality.json`
- Created: `src-ts/narrative/writing-craft/catalog-data/extended-catalogs.json`
- Modified: `src-ts/narrative/writing-craft/craft-catalog.ts` (1585 → 361 lines)

## Summary
Extracted pure data from craft-catalog.ts into 6 JSON files. TypeScript file retains all 16 enums + interfaces. Loader provides lazy caching with reloadCatalog() for hot reload. All existing exports preserved.

## Key Decisions
1. 6 JSON files grouped by theme (satisfaction, techniques, genre, web-novel, quality, extended)
2. Lazy caching in loader — data loaded on first access, reloadCatalog() invalidates cache
3. All 16 enums stay in TypeScript (runtime values)
4. Re-export pattern maintains backward compatibility

## Verification
- catalog-data/ has 6 JSON files
- catalog-loader.ts exports reloadCatalog
- craft-catalog.ts is 361 lines (≤ 400)
- 16 export enum declarations preserved
- npx tsc --noEmit exits 0
- 115 tests passed, 0 failed
