# TASK-004: Expand API and desktop docs with examples and troubleshooting

## status
completed

## modified files
- `D:\工作目录\niko-studio\docs-site\src\client\data\content-api.ts`: Expanded Gateway request examples with the local base URL, clarified Gateway failure behavior, added related pages, and documented health/config/model/reload troubleshooting across health and config API pages.
- `D:\工作目录\niko-studio\docs-site\src\client\data\content-desktop.ts`: Confirmed desktop capability pages include troubleshooting and related-page sections for editor integration, LLM integration, and Wiki system.

## verification
- `content-api.ts` contains `请求示例`: verified with content search.
- `content-api.ts` contains `失败行为`: verified with content search.
- `content-api.ts` contains `http://localhost:8000`: verified with content search.
- `content-desktop.ts` contains `相关页面`: verified with content search.
- `content-desktop.ts` contains `故障排查`: verified with content search.
- `npm --prefix docs-site run build`: passed. Docs lint checked 62 pages across 13 content files; TypeScript and Vite production build completed.

## notes
- No endpoints outside `docs/API_REFERENCE.md` were added.
- No secrets or new dependencies were added.
- Git commit was intentionally not created per task execution requirement.
