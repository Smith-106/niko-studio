# Code Signing Guide

## Overview

This document describes how to set up Windows code signing for Niko Studio desktop builds.

## Current State

The Tauri build configuration (`desktop/src-tauri/tauri.conf.json`) is set up for unsigned local builds:

- `certificateThumbprint`: `null`
- `timestampUrl`: `""`
- `digestAlgorithm`: `"sha256"`

Unsigned builds will trigger Windows SmartScreen warnings when users install them.

## Repository Policy

- The checked-in `desktop/src-tauri/tauri.conf.json` must remain unsigned-by-default.
- Signed external releases must inject release-private signing inputs outside git.
- Do not edit `tauri.conf.json` in-place on release hosts.
- Instead, generate a temporary signed config with `python scripts/generate_signed_tauri_config.py` and point Tauri at it via `TAURI_CONFIG`.
- The authoritative signed-build entrypoint is `npm --prefix desktop run tauri:build:signed`, which delegates to `python scripts/generate_signed_tauri_config.py --run-build`.

## Signing Options

### Option A: Self-Signed Certificate (Local Testing)

```powershell
# Create a self-signed certificate
New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Niko Studio" -CertStoreLocation "Cert:\CurrentUser\My"
```

Export the release-host environment variables instead of editing repo config:

```powershell
$env:NIKO_WINDOWS_CERT_THUMBPRINT = "<YOUR_THUMBPRINT>"
$env:NIKO_WINDOWS_TIMESTAMP_URL = "http://timestamp.digicert.com"
python scripts/generate_signed_tauri_config.py
$env:TAURI_CONFIG = "desktop/src-tauri/tauri.signed.local.generated.json"
npm --prefix desktop run tauri:build
```

Or use the single signed-build entrypoint:

```powershell
$env:NIKO_WINDOWS_CERT_THUMBPRINT = "<YOUR_THUMBPRINT>"
$env:NIKO_WINDOWS_TIMESTAMP_URL = "http://timestamp.digicert.com"
npm --prefix desktop run tauri:build:signed
```

### Option B: EV/OV Code Signing Certificate (Production)

For production releases, obtain a code signing certificate from a trusted CA:

1. **Purchase** a code signing certificate from DigiCert, Sectigo, or GlobalSign
2. **Install** the certificate on the build machine
3. **Export** signing inputs as release-host environment variables (`NIKO_WINDOWS_CERT_THUMBPRINT`, `NIKO_WINDOWS_TIMESTAMP_URL`)
4. **Generate** the temporary signed Tauri config outside git before running `npm --prefix desktop run tauri:build:signed`

Recommended CAs and their timestamp URLs:

| CA | Timestamp URL |
|----|---------------|
| DigiCert | `http://timestamp.digicert.com` |
| Sectigo | `http://timestamp.sectigo.com` |
| GlobalSign | `http://timestamp.globalsign.com` |

### Option C: Azure SignTool (CI/CD)

For CI/CD pipelines, use Azure SignTool with Azure Key Vault:

```powershell
# Install Azure SignTool
dotnet tool install --global AzureSignTool

# Sign the built executable
azuresigntool sign `
  --azure-key-vault-url "https://<vault>.vault.azure.net" `
  --azure-key-vault-certificate "<cert-name>" `
  --azure-key-vault-client-id "<client-id>" `
  --azure-key-vault-client-secret "<secret>" `
  --timestamp-rfc3161 "http://timestamp.digicert.com" `
  --timestamp-digest sha256 `
  "<path-to-exe>"
```

## Build Commands

```bash
# Unsigned build (development / local proof)
npm --prefix desktop run tauri:build

# Generate temporary signed config from release-host environment variables
python scripts/generate_signed_tauri_config.py

# Signed build (release host only)
npm --prefix desktop run tauri:build:signed
```

Required release-host environment variables:

```powershell
$env:NIKO_WINDOWS_CERT_THUMBPRINT = "<thumbprint>"
$env:NIKO_WINDOWS_TIMESTAMP_URL = "http://timestamp.digicert.com"
```

## Verification

After building, verify the signature:

```powershell
Get-AuthenticodeSignature desktop/src-tauri/target/release/bundle/nsis/*.exe | Format-List
```

## Security Notes

- Never commit certificate private keys to the repository
- Store certificate thumbprints in CI/CD secrets, not in config files
- The `tauri.conf.json` in the repo should keep `certificateThumbprint: null` for unsigned builds
- Override the value via environment variable or CI/CD config for signed releases
