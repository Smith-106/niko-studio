# Cross-Cutting Concerns — Niko-Studio Desktop

## State Management

Two Zustand stores cover all runtime state.

**`useAppStore`** (`src/stores/appStore.ts`) — ephemeral session state, composed from five slices:

| Slice | File | Owns |
|---|---|---|
| `BackendSlice` | `app/backendSlice.ts` | `backendStatus: boolean`, `checkBackend()` |
| `WorkspaceSlice` | `app/workspaceSlice.ts` | `currentWorkspace: ProjectWorkspaceContext`, per-conversation workspace sync |
| `ConversationSlice` | `app/conversationSlice.ts` | `conversationsById`, `allConversationIds`, `currentConversationId`, CRUD operations |
| `SkillsSlice` | `app/skillsSlice.ts` | `availableSkills`, `selectedSkills`, `refreshAvailableSkills()` |
| `LoadingSlice` | `app/loadingSlice.ts` | `loadingMap: Record<string, boolean>`, named loading gates |

Shared types (`Message`, `Conversation`, `MessageComparison`) are defined in `src/stores/app/shared.ts` and re-exported from `appStore.ts`.

**`useSettingsStore`** (`src/stores/settingsStore.ts`) — persisted user settings, wrapped with `zustand/middleware/persist` to `localStorage` key `niko-settings`. A `sanitizeSettingsForPersist` pass (`src/stores/settings/state.ts:376`) strips runtime-only fields (`backendConfig`, `sidebarCollapsed`) and sensitive secrets before writing. On rehydration, `normalizeSettings` applies schema migrations.

Selectors are centralised in `src/stores/selectors.ts` (tested in `src/stores/selectors.test.ts`).

## Error Handling

**React ErrorBoundary** (`src/components/ErrorBoundary.tsx`) — class component wrapping the full app tree. On uncaught render error it renders a recovery UI with two actions: soft reset (clear state, re-render) and hard reload (`window.location.reload()`). Uses the legacy `translations` object directly via `useSettingsStore.getState()` (not a hook, safe from class context). Pattern noted as adapted from Cherry Studio.

**Toast notifications** (`src/hooks/useToast.ts` + `src/components/ToastContainer.tsx`) — local `useState`-based queue, capped at 5 items (`prev.slice(-4)`) with auto-dismiss after a configurable duration (default 3 s). Types: `success | error | info`. The hook is instanced at the consumer level; there is no global toast singleton.

**Streaming error recovery** (`src/hooks/useChatStreaming.ts`, `src/hooks/useChatRecovery.ts`) — `StreamPhase` FSM: `idle → streaming → done | error | interrupted | recovered`. On interruption, `useChatRecovery` uses `createCheckpoint` / `restoreCheckpoint` API calls to offer roll-back. Connection state transitions (`connected | degraded | disconnected | reconnecting`) gate recovery actions. `useSmoothStream` uses `requestAnimationFrame` to drain the display queue; no error propagation from RAF.

## i18n / Localization

Dual-layer system:

1. **Legacy `translations` object** (`src/i18n/translations.ts`) — static flat records for `zh` and `en`, used by `useI18n()` hook and directly by `ErrorBoundary`. The hook exposes `t` (typed record) and `translate(key, params)` for `{placeholder}` interpolation. Key parity between `zh` and `en` is asserted at module load (`ensureTranslationShape()`; throws on mismatch).

2. **i18next** (`src/i18n/index.ts`) — loaded with `react-i18next`, resources from `src/i18n/locales/zh-CN.json` and `src/i18n/locales/en-US.json`. Language is synced from `settingsStore` via `syncI18nLanguage()` (called at startup and on language change). The legacy `useI18n` hook remains the primary API for the 36+ existing consumers; i18next is available for new code.

Language values stored in settings: `'zh' | 'en'` (legacy short codes), mapped to i18next locales `zh-CN` / `en-US`.

## Testing Conventions

- **Framework**: Vitest with jsdom environment, configured in `vite.config.ts:44-82`.
- **Setup file**: `src/test/setup.ts` — adds `@testing-library/jest-dom` matchers, stubs `scrollIntoView`, suppresses known Zustand `createWithEqualityFn` deprecation warning.
- **File naming**: `*.test.ts` / `*.test.tsx` co-located next to source files (e.g. `src/hooks/useChatStreaming.test.tsx`, `src/stores/appStore.test.ts`).
- **What is tested**: hooks (render-hook pattern), store slices (direct Zustand API calls), and UI components (accessibility semantics via `getByRole`). See `src/components/ChatAreaComposer.test.tsx` for the component test style: props exhaustively supplied, assertions via ARIA roles.
- **Coverage**: v8 provider, reporters `text|json|html`. Includes `src/**/*.{ts,tsx}`, excludes tests, types, i18n, styles. Non-regression thresholds: statements 75%, branches 70%, functions 70%, lines 75% (baseline ~79/74/73/79).
- **Excluded from discovery**: `src-tauri/bin/sidecar/**` and `src-tauri/target/**` (sidecar build artifacts that would otherwise pollute Vitest's file walk).

## Performance Patterns

**Virtual list** (`src/components/VirtualList.tsx`) — `@tanstack/react-virtual` (`useVirtualizer`) with `stickToBottom` support for the chat message list. Degrades gracefully to flat render in jsdom (test env detection via `navigator.userAgent`). Used in `src/components/ChatArea.tsx`.

**Smooth streaming** (`src/hooks/useSmoothStream.ts`) — `requestAnimationFrame` loop drains an in-memory chunk queue at `minDelay = 10 ms`. Batch size is `chars.length / 5` graphemes per tick using `Intl.Segmenter('zh', { granularity: 'grapheme' })` for correct CJK character handling, falling back to spread iterator if Segmenter is unavailable.

**Lazy panel loading** (`src/components/AppRightPanels.tsx`) — `React.lazy` + `Suspense` for heavy right-panel components: `SettingsModal`, `KnowledgeModal`, `EvaluationPanel`, `AutomationPanel`, `McpStatusPanel`. Build splits these via `vite.config.ts` `manualChunks`: `vendor-editor`, `vendor-editor-pm`, `vendor-markdown`, `vendor-virtual`, `vendor-lucide`.

**Health polling** (`src/hooks/useAppRuntimeHealth.ts`) — 30 s interval polls `getGatewayHealth()` and `checkBackend()`. Interval is paused while `document.hidden` (Page Visibility API) and resumed on return to focus — avoids unnecessary traffic in background tabs.

## Gateway Health & Sidecar Lifecycle

Boot sequence (Tauri desktop only):

1. **`useAppStartup`** (`src/hooks/useAppStartup.ts`) — called once from the app shell; calls `useTheme()` and `useAppBackendBootstrap()`.
2. **`useAppBackendBootstrap`** (`src/hooks/useAppBackendBootstrap.ts`) — runs `syncGatewayBaseOverride(configuredBase)` then `startTauriBackend()` via `src/api/transport`. Repairs a stale persisted gateway URL (`http://127.0.0.1:8000`) if the sidecar has started on a different port.
3. **Tauri commands** (`src-tauri/src/gateway_commands.rs`) — `start_backend`, `check_backend_health`, `get_gateway_base`, `set_gateway_base_override`, `call_api`.
4. **`GatewayState`** (`src-tauri/src/gateway_runtime.rs`) — selects sidecar runtime (`GatewayRuntime::Node` default; `GatewayRuntime::Python` fallback for packaged builds). Reads `NIKO_GATEWAY_URL` / `VITE_NIKO_GATEWAY_URL` env vars. Locates `services.yaml` by walking ancestor directories from the resource dir.
5. **Runtime health view** (`src/hooks/useAppRuntimeHealth.ts`) — merges Tauri `backendStatus` bool with gateway `/health` response into a `GatewayRuntimeView` displayed in the app header.

In browser (non-Tauri) mode, `isTauriRuntime()` short-circuits bootstrap; the app connects directly to a developer-specified `apiBaseUrl`.
