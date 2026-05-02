# Architecture — Niko-Studio Desktop

## Layer Overview

```
┌─────────────────────────────────────────────────────────┐
│  Frontend UI  (React + Vite, src/)                      │
│  Zustand stores · hooks · TipTap editor · SSE client    │
└───────────────────┬─────────────────────────────────────┘
                    │ Tauri IPC  (invoke / @tauri-apps/api)
┌───────────────────▼─────────────────────────────────────┐
│  Tauri Shell  (Rust, src-tauri/src/)                    │
│  GatewayState · sidecar launcher · HTTP proxy           │
└───────────────────┬─────────────────────────────────────┘
                    │ HTTP  (127.0.0.1:<ephemeral-port>)
┌───────────────────▼─────────────────────────────────────┐
│  Node.js Gateway  (sidecar, src-tauri/target/.../sidecar)│
│  MCP endpoints · agents · workflow engine · memory      │
└─────────────────────────────────────────────────────────┘
```

Runtime selection: default is the Node sidecar (`niko-gateway-node`/`niko-gateway-node.cmd`);
falls back to the Python compatibility artifact (`niko-gateway`) if Node fails.
Controlled by `NIKO_GATEWAY_RUNTIME` env var or `GatewayRuntime` enum in
`src-tauri/src/gateway_runtime.rs:27-63`.

---

## Frontend Architecture

### Entry Point

`src/main.tsx` → `src/App.tsx`

`App.tsx` is the shell. It calls `useAppViewModel()` to derive all props for top-level
components, calls `useAppStartup()` once on mount (theme + backend bootstrap), and reads
`useSettingsStore` for global font size.

### Component Tree (Top Level)

```
<App>
  <ErrorBoundary>                 src/components/ErrorBoundary.tsx
    <Sidebar>                     src/components/Sidebar.tsx       — workspace / conversation list
    <AppMainContent>              src/components/AppMainContent.tsx
        <AppHeader>               src/components/AppHeader.tsx     — toolbar, status
        <AppRestoreStatusBanner>  src/components/AppRestoreStatusBanner.tsx
        <DocumentEditor>          src/components/DocumentEditor.tsx — TipTap rich text
        <AppContextFooter>        src/components/AppContextFooter.tsx — token budget display
    <ChatSidebar>                 src/components/ChatSidebar.tsx   — AI conversation panel
    <AppRightPanels>              src/components/AppRightPanels.tsx — lazy right drawers
        <KnowledgeModal>          (lazy)
        <SettingsModal>           (lazy)
        <EvaluationPanel>         (lazy)
        <AutomationPanel>         (lazy)
        <McpStatusPanel>          (lazy)
        <WritingHelperPanel>      (lazy)
        <AiTextOptimizer>         (lazy)
    <ToastContainer>
```

All right panels are lazy-loaded via `React.lazy` + `Suspense` — `src/components/AppRightPanels.tsx:7-35`.

### Zustand Store Modules

Two independent Zustand stores:

**`useAppStore`** (`src/stores/appStore.ts`) — composed from five slices:

| Slice | File | Responsibility |
|-------|------|---------------|
| `BackendSlice` | `src/stores/app/backendSlice.ts` | `backendStatus: boolean`, `checkBackend()` — polls `/health` |
| `WorkspaceSlice` | `src/stores/app/workspaceSlice.ts` | `currentWorkspace: ProjectWorkspaceContext` — project/chapter/scene scope |
| `ConversationSlice` | `src/stores/app/conversationSlice.ts` | `conversationsById`, `allConversationIds`, `currentConversationId`; full CRUD for conversations and messages |
| `SkillsSlice` | `src/stores/app/skillsSlice.ts` | `availableSkills`, `selectedSkills`, `refreshAvailableSkills()` — fetches from `GET /skills` |
| `LoadingSlice` | `src/stores/app/loadingSlice.ts` | `loadingMap: Record<string, boolean>` — keyed async loading flags |

**`useSettingsStore`** (`src/stores/settingsStore.ts`) — persisted via `zustand/persist` under
localStorage key `niko-settings`. Manages LLM providers, API base URL, prompt templates, quality
goals, retrieval settings, and backend config (synced to/from gateway via `src/stores/settings/backendConfig.ts`).

### Key Hooks

| Hook | File | Role |
|------|------|------|
| `useAppViewModel` | `src/hooks/useAppViewModel.ts` | Root view-model — assembles all props for `<App>` layout |
| `useAppStartup` | `src/hooks/useAppStartup.ts` | Mount-time init: theme + backend bootstrap |
| `useAppBackendBootstrap` | `src/hooks/useAppBackendBootstrap.ts` | In Tauri: syncs override URL, starts sidecar, repairs stale base URL |
| `useChatStreaming` | `src/hooks/useChatStreaming.ts` | Manages SSE lifecycle for chat replies |
| `useChatRequestBuilder` | `src/hooks/useChatRequestBuilder.ts` | Builds `ChatRequest` from store state |
| `useAppRuntimeHealth` | `src/hooks/useAppRuntimeHealth.ts` | Polls gateway `/health`, surfaces `GatewayRuntimeView` |
| `useEditorAI` | `src/hooks/useEditorAI.ts` | Inline AI actions within TipTap editor |
| `useAppPanelOrchestration` | `src/hooks/useAppPanelOrchestration.ts` | Right panel open/close routing |
| `useAppUiPersistence` | `src/hooks/useAppUiPersistence.ts` | Persists UI state (active panel, writing helper draft) |

---

## Gateway Architecture

The Node.js gateway is the compiled sidecar binary at
`src-tauri/target/release/bin/sidecar/` (TypeScript source compiled to JS; `.d.ts` declarations
are the public surface visible from the desktop repo).

### HTTP Endpoints (from sidecar `.d.ts` declarations)

| Path | Module | Description |
|------|--------|-------------|
| `GET /health` | `mcp/endpoints/health.d.ts` | Health check; returns service statuses, MCP runtime state |
| `GET /metrics` | `mcp/endpoints/health.d.ts` | Prometheus-style metrics snapshot |
| `GET /tools` | `mcp/endpoints/health.d.ts` | Lists registered MCP tools |
| `GET /models` | `mcp/endpoints/health.d.ts` | Lists available LLM models |
| `POST /chat` | (inferred from `src/api/chat.ts`) | Single-turn chat |
| `POST /chat/stream` | `src/api/chat.ts:299` | SSE streaming chat; events: `start`, `routing`, `progress`, `content`, `evaluation`, `done`, `error` |
| `POST /workflow/route` | `mcp/endpoints/workflow.d.ts` | Route a task through the workflow engine |
| `POST /workflow/plan` | `mcp/endpoints/workflow.d.ts` | Generate an execution plan |
| `POST /workflow/execute` | `mcp/endpoints/workflow.d.ts` | Execute a plan step |
| `POST /workflow/lifecycle` | `mcp/endpoints/workflow.d.ts` | Lifecycle transitions (pause/resume/cancel) |
| `POST /workflow/scheduler/*` | `mcp/endpoints/workflow.d.ts` | Scheduler: register, list, pause, resume, run-now, import-lite-plan |
| `POST /ui-bridge/workflow/*` | `mcp/endpoints/workflow.d.ts` | Same as above via UI bridge mode |
| `POST /checkpoint/*` | `mcp/endpoints/workflow.d.ts` | Create / restore / list checkpoints |
| `POST /critic/evaluate` | `mcp/endpoints/critic.d.ts` | Narrative evaluation (score + feedback) |
| `POST /critic/suggestions` | `mcp/endpoints/critic.d.ts` | Improvement suggestions |
| `POST /critic/consistency` | `mcp/endpoints/critic.d.ts` | Cross-chapter consistency check (character / timeline / worldview) |
| `GET/POST /config/*` | `mcp/endpoints/config.d.ts` | Backend config read/write |
| `* /mcp-admin/*` | `mcp/endpoints/mcp-admin.d.ts` | MCP server admin |

### Gateway Internal Modules

```
sidecar/
  agents/          — base agent, writer, critic, plot, architect, commander, skill-router
  workflow/engine/ — plan-authority-store, lifecycle, flow-control, risk, observability
  workflow/session/— session-manager
  memory/          — unified-memory
  graph/           — graph-engine (knowledge graph)
  search/          — hybrid-search, vector-search, iterative-retriever, smart-search
  services/        — llm-service, embedding-service, knowledge-service, memory-service,
                     token-service, distill-service, reranker/*
  knowledge/       — models, providers (openai-llm, anthropic-llm, openai-embedding, local-embedding)
  project/         — workspace-model, wiki-store, wiki-query, wiki-projection, narrative-records
  narrative/       — evaluators (dream, suspense, character, premise, voice, critic-engine)
                     analyzers, cross-chapter-character-tracker, timeline-consistency-checker,
                     worldview-coherence-validator
  integrations/    — adapters (external service integrations)
  skills/          — skill-loader (loads skills from NIKO_SKILLS_DIR at runtime)
  config/          — config reader
  container/       — DI container: workflow-runtime-provider, types
```

---

## Data Flow

### User Chat Write Action (Editor → Agent → Editor)

```
1. User types message in <ChatSidebar>
   └─ useChatRequestBuilder builds ChatRequest
        { messages, workflowLevel, skills, workspace, qualityGoals, ... }

2. useChatStreaming calls chatStream() → src/api/chat.ts:294
   └─ In Tauri: transport.getRuntimeGatewayBase() → invoke("get_gateway_base")
        → GatewayState.resolve_base() checks env / override / local sidecar health
        → returns http://127.0.0.1:<port>
   └─ fetch POST /chat/stream  (SSE)

3. Gateway receives /chat/stream
   └─ skill-router routes to writer agent
   └─ writer agent calls LLM service (OpenAI / Anthropic via providers)
   └─ knowledge-service injects canon context (wiki pages, memory)
   └─ workflow engine applies L1–L5 quality levels
   └─ SSE events emitted: start → routing → progress → content (chunks) → evaluation → done

4. chatStream() SSE handler (src/api/chat.ts:423-470)
   └─ onContent chunks → useSmoothStream buffers → ChatSidebar renders incrementally
   └─ onDone: stores writer_metadata in ConversationSlice.addMessage()
              workspace context synced via WorkspaceSlice.syncConversationWorkspace()

5. User applies/copies content → DocumentEditor (TipTap)
   └─ streamToEditor (src/components/editor/streamToEditor.ts)
      directly inserts text into ProseMirror doc
```

### Backend Bootstrap (Tauri App Start)

```
useAppStartup → useAppBackendBootstrap (src/hooks/useAppBackendBootstrap.ts)
  └─ syncGatewayBaseOverride(configuredBase)  → invoke("set_gateway_base_override")
  └─ startTauriBackend()                      → invoke("start_backend")
       → GatewayState.resolve_base()
       → start_local_sidecar(): try Node sidecar → fallback Python sidecar
       → wait_until_healthy() polls GET /health every 150–1000 ms (timeout 5s Node / 20s Python)
  └─ getRuntimeGatewayBase()                  → invoke("get_gateway_base") (TTL-cached 5s)
  └─ stale base URL repair if configured base was legacy port 8000
```

---

## Key Boundaries & Contracts

### Tauri IPC Commands

Defined in `src/api/tauri-contract.ts` and implemented in `src-tauri/src/gateway_commands.rs`:

| Command | Direction | Signature |
|---------|-----------|-----------|
| `get_gateway_base` | TS → Rust → String | Resolves live gateway base URL; starts sidecar if needed |
| `set_gateway_base_override` | TS → Rust | Sets/clears override URL stored in GatewayState |
| `start_backend` | TS → Rust → String | Explicit sidecar start, returns `"Gateway ready: <url>"` |
| `check_backend_health` | TS → Rust → bool | Proxies GET /health to current base URL |
| `call_api` | TS → Rust → TauriGatewayApiResponse | Generic HTTP proxy: endpoint + method + body → {statusCode, body} |

In Tauri runtime, ALL non-streaming API calls (`callApi` in `src/api/core.ts`) route through
`call_api` IPC command. Streaming chat (`/chat/stream`) bypasses IPC and uses `fetch` directly
with the resolved gateway base URL.

### HTTP API Contract (Frontend ↔ Gateway)

Core types live in `src/api/chat.ts`, `src/api/workflow/`, `src/api/evaluation.ts`, etc.
The gateway base URL resolves to `http://127.0.0.1:<port>` (ephemeral in Tauri, default
`127.0.0.1:8000` in browser-shell dev mode).

Key request/response shapes:

- `ChatRequest` / `ChatResponse` — `src/api/chat.ts:27-187`
- `StreamCallbacks` / `StreamDonePayload` — `src/api/chat.ts:272-283`
- `WorkflowEndpointPath` variants — `src/api/workflow/endpoints.ts:7-18`
- `ApiResponse<T, E>` wrapper — `src/api/core.ts:16-21`
- `GatewayHealth` / `GatewayRuntimeView` — `src/api/gateway/runtime.ts` + `src/api/contracts.ts`

### Dual Transport

`src/api/core.ts:82-138` — runtime check `isTauriRuntime()` (presence of `window.__TAURI__`):
- **Tauri path**: `callTauriApi` → IPC `call_api` (Rust proxies HTTP to sidecar)
- **Browser path**: native `fetch` directly to `getResolvedApiBase()`

This means the gateway HTTP API is the single stable contract; Tauri IPC is a transparent wrapper
around it, not a separate protocol.
