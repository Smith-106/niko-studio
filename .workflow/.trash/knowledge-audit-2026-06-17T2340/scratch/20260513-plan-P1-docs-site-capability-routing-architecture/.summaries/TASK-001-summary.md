# TASK-001: Add docs guide category and capability routing page

## status
completed

## modified files
- `D:\工作目录\niko-studio\docs-site\src\client\data\inventory.ts`: Added the `guides` category and `capability-routing` doc page.
- `D:\工作目录\niko-studio\docs-site\src\client\data\content.ts`: Imported and spread `guidesContent` into the content map.
- `D:\工作目录\niko-studio\docs-site\src\client\data\content-guides.ts`: Added `guidesContent` with the capability routing guide, Mermaid flowchart, routing table, default path, and troubleshooting sections.

## verification
- `inventory.ts` contains `id: 'guides'`: verified with content search.
- `inventory.ts` contains `id: 'capability-routing'`: verified with content search.
- `content.ts` contains `guidesContent`: verified with content search.
- `content-guides.ts` contains `能力路由是什么`: verified with content search.
- `content-guides.ts` contains `flowchart TD`: verified with content search.
- `npm --prefix docs-site run build`: passed. Docs lint checked 60 pages across 13 content files and Vite build completed.

## notes
- No new dependencies were added.
- Git commit was intentionally not created per task execution requirement.
