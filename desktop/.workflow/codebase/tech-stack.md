# Tech Stack — Niko-Studio Desktop

## Frontend

- **React** 18.3.1 — UI rendering (react-jsx transform)
- **TypeScript** 5.4.x — strict mode, ES2020 target, bundler module resolution
- **Vite** 7.3.1 — dev server (port 5173), production bundler with manual chunk splitting
- **Tailwind CSS** 3.4.1 — utility-first styling; dark-mode via `class` strategy; custom design tokens (CSS variables for surface/text/shadow); fonts: Inter, Merriweather, Fira Code
- **Zustand** 4.5.0 — global state management
- **TipTap** 3.22.x — rich-text editor (ProseMirror-based); extensions: starter-kit, heading, bullet-list, ordered-list, blockquote, code-block, horizontal-rule, placeholder, text-style, typography, underline; tooltip integration via tippy.js 6.3.7
- **React Router DOM** 6.22.0 — client-side routing
- **react-markdown** 9.0.1 — markdown rendering
- **@tanstack/react-virtual** 3.13.23 — virtualised list rendering
- **lucide-react** 0.344.0 — icon library
- **i18next** 26.0.6 + **react-i18next** 17.0.4 — internationalisation
- **@floating-ui/dom** 1.7.6 — floating element positioning
- **clsx** 2.1.0 + **tailwind-merge** 2.2.1 — conditional class utilities
- **PostCSS** 8.4.35 + **autoprefixer** 10.4.18 — CSS post-processing

## Desktop Host

- **Tauri** 2.x — desktop shell (Rust host + WebView frontend bridge)
  - Config: `src-tauri/tauri.conf.json`; window 1200x800 min 900x600; tray icon enabled
  - CSP enforced in production; `freezePrototype: true`
  - Bundle targets: Windows (WiX, zh-CN + en-US), macOS, Linux
- **Rust** (edition 2021) — `src-tauri/src/`; profile.release: LTO, codegen-units=1, opt-level="s", strip, panic=abort
- **Tauri plugins**: `tauri-plugin-shell`, `tauri-plugin-http`, `tauri-plugin-fs`, `tauri-plugin-dialog`, `tauri-plugin-notification`
- **tokio** 1.x (full features) — async Rust runtime
- **serde** 1.x + **serde_json** 1.x — serialisation
- **reqwest** 0.11 (json feature) — HTTP client in Rust
- **Gateway launcher binary** (`niko-gateway-launcher`) — minimal Rust binary (`src/bin/niko-gateway-launcher.rs`) that spawns the Node.js staged sidecar from `<install>/sidecar/`; no Tauri or reqwest deps, stdlib-only

## Gateway (Node.js Sidecar)

Location: `../../src-ts/` (sibling repo directory, not inside `desktop/`)

- **Node.js** >=20.0.0 — ESM-native runtime
- **TypeScript** 5.4.x — compiled via `tsc`; runtime execution via **ts-node** 10.9.2 (`--esm` loader)
- **better-sqlite3** 12.8.0 — synchronous SQLite bindings (local data persistence)
- **fastembed** 2.1.0 — local embedding generation
- **@xenova/transformers** 2.17.2 — Transformers.js for on-device ML inference
- **@aws-sdk/client-s3** 3.x — S3-compatible object storage
- **inversify** 6.0.2 + **inversify-binding-decorators** 4.0.0 + **reflect-metadata** 0.2.2 — IoC/DI container
- **mammoth** 1.12.0 — DOCX-to-text extraction
- **pdf-parse** 2.4.5 — PDF text extraction
- **async-lock** 1.4.1 — mutual-exclusion for async operations
- Entry point selection: `niko-gateway-node` script (`src-tauri/bin/`) probes for `src-ts/gateway-server.ts`; falls back to HTTP reverse-proxy mode pointing at `NIKO_GATEWAY_URL` (default `http://127.0.0.1:8000`)
- Runtime switch: `NIKO_GATEWAY_RUNTIME=node` (default) | `python` (legacy compatibility artifact)

## Build & Tooling

- **Vite** 7.3.1 — frontend build; manual chunks: `vendor-editor-pm`, `vendor-editor`, `vendor-markdown`, `vendor-virtual`, `vendor-lucide`
- **vitest** 3.2.4 — test runner; jsdom environment; coverage via `@vitest/coverage-v8`; thresholds: lines/statements 75%, branches/functions 70%
- **@testing-library/react** 16.3.0 + **@testing-library/user-event** 14.6.1 — component testing utilities
- **ESLint** 9.36.0 + **@typescript-eslint** 8.46.0 — linting (zero warnings enforced via `--max-warnings 0`); config at `../eslint.config.mjs`
- **Prettier** 3.6.2 — code formatting; config at `../prettier.config.mjs`
- **tauri-build** 2 — Rust build script (`build.rs`)
- **Sidecar build scripts** (`scripts/`): `build_node_sidecar.cjs`, `choose_sidecar.cjs`, `validate_sidecar_contract.cjs` — Node.js CJS scripts for sidecar staging and contract validation
- **Python scripts** (`../scripts/`): `build_gateway_sidecar.py`, `generate_signed_tauri_config.py`, `refresh_release_evidence.py` — Python utilities for release and signing workflows
- Node >=20, npm >=10 enforced in `engines`

## Key Dependencies Table

| Package | Version | Purpose |
|---|---|---|
| react | ^18.3.1 | UI framework |
| typescript | ^5.4.0 | Type system (frontend + gateway) |
| vite | ^7.3.1 | Frontend dev server and bundler |
| tailwindcss | ^3.4.1 | Utility-first CSS |
| zustand | ^4.5.0 | Frontend state management |
| @tiptap/starter-kit | ^3.22.0 | Rich-text editor core |
| react-router-dom | ^6.22.0 | Client-side routing |
| react-markdown | ^9.0.1 | Markdown rendering |
| @tanstack/react-virtual | ^3.13.23 | Virtual list scrolling |
| i18next | ^26.0.6 | Internationalisation |
| lucide-react | ^0.344.0 | Icon library |
| tauri (Rust) | 2.x | Desktop shell and native bridge |
| tokio (Rust) | 1.x | Async Rust runtime |
| reqwest (Rust) | 0.11 | HTTP client (Rust side) |
| better-sqlite3 | ^12.8.0 | Local SQLite storage (gateway) |
| fastembed | ^2.1.0 | Local text embeddings (gateway) |
| @xenova/transformers | ^2.17.2 | On-device ML inference (gateway) |
| @aws-sdk/client-s3 | ^3.x | S3 storage integration (gateway) |
| inversify | ^6.0.2 | Dependency injection (gateway) |
| mammoth | ^1.12.0 | DOCX parsing (gateway) |
| pdf-parse | ^2.4.5 | PDF parsing (gateway) |
| vitest | ^3.2.4 | Test runner (both packages) |
| eslint | ^9.36.0 | Linting (both packages) |
| prettier | ^3.6.2 | Formatting (both packages) |
