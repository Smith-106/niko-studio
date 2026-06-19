# TASK-002: Deepen architecture principles and data authority docs

## Status
completed

## Modified Files
- `D:\工作目录\niko-studio\docs-site\src\client\data\content-architecture.ts`: added architecture principle sections for runtime boundaries, request lifecycle, data authority order, and historical architecture boundaries; added Mermaid runtime layer and request lifecycle diagrams.

## Verification
- [x] `content-architecture.ts` contains `运行时边界`: verified with content search.
- [x] `content-architecture.ts` contains `请求生命周期`: verified with content search.
- [x] `content-architecture.ts` contains `数据权威顺序`: verified with content search.
- [x] `content-architecture.ts` contains `历史架构边界`: verified with content search.
- [x] `content-architecture.ts` contains `sequenceDiagram`: verified with content search.
- [x] `npm --prefix docs-site run build`: passed; docs lint checked 62 pages across 13 content files, TypeScript and Vite build completed.

## Notes
- No git commit was created per task instruction.
- Historical/browser-first/Python references are labeled as compatibility, advisory, deprecated, or design reference rather than current shipped runtime.
