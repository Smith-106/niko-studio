# Code Signing Guide

## Overview

This document describes how to set up Windows code signing for Niko Studio desktop builds.

## Current State

The Tauri build configuration (`desktop/src-tauri/tauri.conf.json`) is set up for unsigned local builds:

- `certificateThumbprint`: `null`
- `timestampUrl`: `""`
- `digestAlgorithm`: `"sha256"`

Unsigned builds will trigger Windows SmartScreen warnings when users install them.

## Signing Options

### Option A: Self-Signed Certificate (Local Testing)

```powershell
# Create a self-signed certificate
New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Niko Studio" -CertStoreLocation "Cert:\CurrentUser\My"

# Copy the thumbprint from the output
```

Then update `tauri.conf.json`:

```json
{
  "windows": {
    "certificateThumbprint": "<YOUR_THUMBPRINT>",
    "digestAlgorithm": "sha256",
    "timestampUrl": "http://timestamp.digicert.com"
  }
}
```

Build:

```powershell
npm --prefix desktop run tauri:build
```

### Option B: EV/OV Code Signing Certificate (Production)

For production releases, obtain a code signing certificate from a trusted CA:

1. **Purchase** a code signing certificate from DigiCert, Sectigo, or GlobalSign
2. **Install** the certificate on the build machine
3. **Configure** `tauri.conf.json` with the certificate thumbprint and timestamp URL

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
# Unsigned build (development)
npm --prefix desktop run tauri:build

# Signed build (requires certificate installed)
npm --prefix desktop run tauri:build
# Tauri automatically detects and uses the configured certificate
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
