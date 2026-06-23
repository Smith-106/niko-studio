# 前后端接口状态矩阵 + 修复建议

- [[spec:project:coding-conventions-025]]
- [[spec:project:coding-conventions-026]]

## 安全回归状态

| 原始 Issue | 修复状态 | 验证结果 | 残留缺口 |
|-----------|---------|---------|---------|
| ISS-001 Cypher 注入 | **部分修复** | ✅ 核心安全工具 + 前端已防护 | ⚠️ SEC-002: graphAddEntity 无验证, SEC-003: raw Cypher 端点 |
| ISS-002 API Key 传输 | **部分修复** | ✅ writing.ts/gateway 已用 headers | ⚠️ SEC-001: writing-craft.ts 仍发 body |

## 接口端点状态矩阵

### 前端 → 后端: Writing API

| 端点 | 前端调用 | 后端处理 | 状态 | 备注 |
|------|---------|---------|------|------|
| POST /writing/helper | processWritingHelper → X-LLM-API-Key header | resolveProviderConfig (header priority) | ✅ 健康 | ISS-002 修复生效 |
| POST /writing/stream | streamWritingHelper → X-LLM-API-Key header | resolveProviderConfig (header priority) | ✅ 健康 | 同上 |
| POST /writing-craft/llm-analyze | analyzeWritingCraftLLM → ...llmConfig in body | resolveProviderConfig (header + body fallback) | ⚠️ **需修复** | SEC-001: 前端不发 header |
| POST /writing-craft/analyze | analyzeWritingCraft | N/A (无 LLM) | ✅ 健康 | — |

### 前端 → 后端: Graph API

| 端点 | 前端调用 | 后端处理 | 状态 | 备注 |
|------|---------|---------|------|------|
| POST /graph/query | queryGraph (safe builder) | graphQueryEndpoint → raw Cypher | ⚠️ **需防护** | SEC-003: 无 Cypher 安全校验 |
| POST /graph/add-entity | graphAddEntity | engine.createEntity (no validation) | ⚠️ **需修复** | SEC-002: 无 validateEntityType |
| POST /graph/character | getCharacter | graphGetCharacter | ✅ 健康 | — |
| POST /graph/foreshadows | getForeshadows | graphGetForeshadows | ✅ 健康 | — |
| POST /foreshadow/plant | plantForeshadow | foreshadowPlantEndpoint | ⚠️ 无 workspace | CORR-002: 未 scoped |
| GET /foreshadow/stats | getForeshadowStats | foreshadowStatsEndpoint | ⚠️ 无 workspace | 同上 |

### 前端 → 后端: Character/Foreshadow API

| 端点 | 前端调用 | Workspace 上下文 | 状态 | 备注 |
|------|---------|-----------------|------|------|
| POST /character/depth | analyzeCharacterDepth | ❌ 未传递 | ⚠️ **需修复** | ARCH-004 |
| POST /character/profile | getCharacterProfile | ❌ 未传递 | ⚠️ **需修复** | ARCH-004 |
| POST /character/relationships | getCharacterRelationships | ❌ 未传递 | ⚠️ **需修复** | ARCH-004 |

### 前端 → 后端: Story Bible API

| 端点 | 前端调用 | Workspace 上下文 | 状态 | 备注 |
|------|---------|-----------------|------|------|
| POST /story-bible/entities/list | sbGetEntities | ❌ _workspace 未接线 | ⚠️ **需修复** | ARCH-005 |
| GET /story-bible/entity/{id} | sbGetEntity | ❌ _workspace 未接线 | ⚠️ **需修复** | ARCH-005 |
| POST /story-bible/entities | sbCreateEntity | ❌ _workspace 未接线 | ⚠️ **需修复** | ARCH-005 |
| PUT /story-bible/entity/{id} | sbUpdateEntity | ❌ _workspace 未接线 | ⚠️ **需修复** | ARCH-005 |
| DELETE /story-bible/entity/{id} | sbDeleteEntity | ❌ _workspace 未接线 | ⚠️ **需修复** | ARCH-005 |
| POST /story-bible/extract | sbExtractFromManuscript | ❌ _workspace 未接线 | ⚠️ **需修复** | ARCH-005 |

### 前端 → 后端: Gateway (LLM Provider)

| 端点 | 前端调用 | API Key 传输 | 状态 | 备注 |
|------|---------|-------------|------|------|
| GET /v1beta/models | requestJson | X-Goog-Api-Key header | ✅ 健康 | ISS-002 修复生效 |
| POST /chat/completions | requestJson | Authorization: Bearer header | ✅ 健康 | — |

## 优先修复建议

### P0 — 安全（必须修复）

| # | ID | 问题 | 修复方案 | 文件 | 工作量 |
|---|-----|------|---------|------|--------|
| 1 | SEC-001 | writing-craft.ts API key 在 body 中传输 | 提取 api_key/base_url → X-LLM-API-Key/X-LLM-Base-Url headers（复用 callApi extraHeaders） | desktop/src/api/writing-craft.ts | S |
| 2 | SEC-002 | graphAddEntity 无 entityType 验证 | 在 graphAddEntity 开头调用 validateEntityType(entityType) | src-ts/mcp/services/graph.ts | S |
| 3 | SEC-003 | /graph/query 接受原始 Cypher 无防护 | 添加 Cypher 安全校验：阻止 DETACH DELETE / DROP / CREATE constraint | src-ts/mcp/endpoints/graph.ts | M |

### P1 — 架构一致性（推荐修复）

| # | ID | 问题 | 修复方案 | 文件 | 工作量 |
|---|-----|------|---------|------|--------|
| 4 | ARCH-004 | 5 个前端 API 不传 workspace 上下文 | 给 plantForeshadow, getForeshadowStats, analyzeCharacterDepth, getCharacterProfile, getCharacterRelationships 添加 workspace 参数 + appendWorkspacePayload | desktop/src/api/knowledge.ts | M |
| 5 | ARCH-005 | story-bible 6 个函数 _workspace 未接线 | 将 _workspace 通过 appendWorkspacePayload 接入 callApi | desktop/src/api/story-bible.ts | M |
| 6 | CORR-002 | foreshadowPlant 不传 workspace scope | 在 foreshadowPlantEndpoint 中 resolveGraphScope 并传入 graphAddEntity | src-ts/mcp/endpoints/graph.ts | S |

### P2 — 低优先级

| # | ID | 问题 | 修复方案 | 工作量 |
|---|-----|------|---------|--------|
| 7 | CORR-003 | story-bible entityId 未 URL 编码 | 使用 encodeURIComponent | S |
| 8 | CORR-004 | SSE 解析器不处理多行 data | 累积 data 行直到空行 | M |
| 9 | ARCH-001 | 旧 /writing-helper/process 路由重复 | 添加 deprecation 警告 | S |
| 10 | ARCH-002 | knowledge.ts 混合关注点 | 拆分为 memory.ts, graph.ts, foreshadow.ts, character-analysis.ts | L |

## 统计

- ✅ 健康: 9 端点
- ⚠️ 需修复: 12 端点/调用点
- 总计: 21 端点
- P0 安全: 3 项 (工作量 S+S+M)
- P1 架构: 3 项 (工作量 M+M+S)
- P2 低优先: 4 项 (工作量 S+M+S+L)
