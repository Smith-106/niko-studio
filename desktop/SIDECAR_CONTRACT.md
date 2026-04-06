# Sidecar Binary Contract

This document defines the naming and location conventions for sidecar binaries in Niko-Studio Desktop.

## Location Contract

All sidecar binaries MUST be placed in:
```
desktop/src-tauri/bin/
```

This is configured in `tauri.conf.json`:
```json
{
  "bundle": {
    "externalBin": ["bin/niko-gateway"]
  }
}
```

## Naming Contracts

### Python Sidecar (Fallback / Packaged Runtime)

Produced by PyInstaller via `scripts/build_gateway_sidecar.py`.

**Windows**:
- `niko-gateway.exe` - Primary executable (plain name)
- `niko-gateway-x86_64-pc-windows-msvc.exe` - Target-triple variant (Tauri convention)

**Unix (macOS/Linux)**:
- `niko-gateway` - Primary executable (plain name)

### Node.js Sidecar (Preferred Local Runtime)

Standalone proxy implemented in pure Node.js.

**Windows**:
- `niko-gateway-node` - Node.js script entry
- `niko-gateway-node.cmd` - Windows batch wrapper

**Unix**:
- `niko-gateway-node` - Node.js script entry (executable)

## Runtime Selection

Controlled by `NIKO_GATEWAY_RUNTIME` environment variable:

```rust
// desktop/src-tauri/src/main.rs
enum GatewayRuntime {
    Python,  // Explicit override / fallback: uses niko-gateway
    Node,    // Default local runtime: uses niko-gateway-node
}
```

**Usage**:
```bash
# Desktop runtime default (Node-first in the Rust host)
npm run tauri:dev

# Explicit Python fallback
NIKO_GATEWAY_RUNTIME=python npm run tauri:dev
```

**Build-time note**:

- `desktop/scripts/choose_sidecar.cjs` still defaults to building the Python sidecar when `NIKO_GATEWAY_RUNTIME` is unset.
- Runtime preference and packaged build default are intentionally separate until the final packaged/runtime cutover is complete.

## Validation

Run contract validation:
```bash
npm run validate:sidecar-contract
```

This checks:
- All required files exist for the current platform
- Bin directory exists
- Strict mode exits with error on violations

## Build Scripts

**Build Node sidecar**:
```bash
npm run build:sidecar:node
```
- Validates `niko-gateway-node` syntax
- No build required (pure Node.js script)

**Build Python sidecar**:
```bash
npm run build:sidecar:python
```
- Runs PyInstaller to create binaries
- Outputs to `desktop/src-tauri/bin/`

**Build all + validate**:
```bash
npm run build:sidecar
```
- Builds Node sidecar
- Validates contracts

## Platform Detection

Tauri's `externalBin` uses platform-specific naming:

**Pattern**: `binary-name{-target-triple}{.exe}`

**Examples**:
- `bin/niko-gateway` → Tauri looks for:
  - Windows: `niko-gateway-x86_64-pc-windows-msvc.exe` or `niko-gateway.exe`
  - macOS: `niko-gateway-aarch64-apple-darwin` or `niko-gateway`
  - Linux: `niko-gateway-x86_64-unknown-linux-gnu` or `niko-gateway`

## CI Integration

The contract validator should run in CI:

```yaml
- name: Validate sidecar contracts
  run: npm run validate:sidecar-contract
```

## Troubleshooting

**Issue**: `Sidecar binary not found`

**Check**:
1. Run `npm run validate:sidecar-contract`
2. Verify files exist in `desktop/src-tauri/bin/`
3. Check platform-specific naming matches Tauri expectations

**Issue**: `Permission denied` (Unix)

**Fix**:
```bash
chmod +x desktop/src-tauri/bin/niko-gateway
chmod +x desktop/src-tauri/bin/niko-gateway-node
```

## Future Work

- [ ] Add CI gate for sidecar contract validation
- [ ] Document Python sidecar build requirements (PyInstaller, etc.)
- [ ] Add integration tests for sidecar startup and health checks
