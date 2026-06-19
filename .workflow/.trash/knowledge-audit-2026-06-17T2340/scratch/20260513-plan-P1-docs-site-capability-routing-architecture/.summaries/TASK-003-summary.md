# TASK-003: Add learning paths and capability status guide

## status
completed

## modified files
- `D:\工作目录\niko-studio\docs-site\src\client\data\inventory.ts`: Added `learning-paths` and `capability-status` pages under the existing `guides` category without changing the TASK-001 `capability-routing` entry.
- `D:\工作目录\niko-studio\docs-site\src\client\data\content-guides.ts`: Added `learning-paths` content with writer, developer, integrator, and maintainer paths; added `capability-status` content with status label definitions and docs-site coverage matrix.
- `D:\工作目录\niko-studio\docs-site\src\client\pages\LandingPage.tsx`: Updated the first quick link to point to `/guides/learning-paths`.

## verification
- `inventory.ts` contains `id: 'learning-paths'`: verified with content search.
- `inventory.ts` contains `id: 'capability-status'`: verified with content search.
- `content-guides.ts` contains `写作者路径`: verified with content search.
- `content-guides.ts` contains `supported`: verified with content search.
- `LandingPage.tsx` contains `/guides/learning-paths`: verified with content search.

## tests
- `npm --prefix docs-site run build`: passed. Docs lint checked 62 pages across 13 content files; TypeScript and Vite production build completed.

## notes
- No new dependencies were added.
- Git commit was intentionally not created per task execution requirement.
