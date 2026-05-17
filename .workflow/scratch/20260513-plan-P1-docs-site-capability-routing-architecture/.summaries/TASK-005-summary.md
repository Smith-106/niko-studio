# TASK-005: Validate docs content consistency and homepage discoverability

## Status
completed

## Modified Files
- None. Build and convergence checks already passed, so no docs-site source changes were required.

## Verification
- `npm --prefix docs-site run build` exited 0.
- `docs-site/src/client/data/inventory.ts` contains `category: 'guides'` for guides doc pages.
- `docs-site/src/client/data/content.ts` imports and spreads `guidesContent`.
- `docs-site/src/client/pages/LandingPage.tsx` contains `/guides/learning-paths`.
- `docs-site/src/client/data/content-guides.ts` contains `能力状态矩阵`.

## Notes
- Docs lint checked 62 pages across 13 content files and passed.
- No content consistency fixes were needed.
