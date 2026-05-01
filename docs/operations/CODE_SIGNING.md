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

Optional override for hosts where Tauri's built-in `signtool.exe` detection fails:

```powershell
$env:NIKO_WINDOWS_SIGNTOOL_PATH = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64\signtool.exe"
```

Set this when `npm --prefix desktop run tauri:build:signed` errors with `failed to bundle project SignTool not found` even though `signtool.exe` exists on the host. This happens when the Windows SDK was installed via Visual Studio installer to the `C:\Program Files (x86)\` tree but `HKLM\SOFTWARE\Microsoft\Windows Kits\Installed Roots\KitsRoot10` still points at the empty `C:\Program Files\Windows Kits\10\` stub. The override injects `bundle.windows.signCommand` into the generated config with the absolute signtool path, bypassing Tauri's KitsRoot10 lookup entirely.

Verify the path before exporting:

```powershell
Get-ChildItem -Path "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter signtool.exe | Where-Object { $_.FullName -like "*x64*" } | Select-Object -First 1 -ExpandProperty FullName
```

## Self-Signed Pipeline Dry-Run

Use this when you want to prove the full signing pipeline works **before procuring a real CA-issued certificate** (e.g. before paying for DigiCert/Sectigo, or as a quarterly regression check). A self-signed dry-run exercises every step the real release host will run, but produces a binary that Windows SmartScreen will still flag — **do not ship a self-signed build to users**.

### 1. Mint a self-signed cert and capture the thumbprint

```powershell
$cert = New-SelfSignedCertificate `
  -Type CodeSigningCert `
  -Subject "CN=Niko Studio Dry-Run" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -KeyUsage DigitalSignature `
  -KeyAlgorithm RSA `
  -KeyLength 2048
$thumbprint = $cert.Thumbprint
$thumbprint  # 40-char hex; copy this
```

### 2. Run the same pipeline the real release host will run

```powershell
$env:NIKO_WINDOWS_CERT_THUMBPRINT = $thumbprint
$env:NIKO_WINDOWS_TIMESTAMP_URL   = "http://timestamp.digicert.com"
npm --prefix desktop run tauri:build:signed
```

### 3. Verify with Authenticode

```powershell
$exe = "desktop/src-tauri/target/release/bundle/nsis/Niko-Studio_*_x64-setup.exe"
Get-AuthenticodeSignature (Resolve-Path $exe) | Format-List Status, StatusMessage, SignerCertificate, TimeStamperCertificate
```

Expected dry-run output:

| Field | Real CA cert | Self-signed dry-run |
|---|---|---|
| `Status` | `Valid` | `UnknownError` or `NotTrusted` |
| `SignatureType` | `Authenticode` | `Authenticode` (still valid) |
| `TimeStamperCertificate` | populated | populated |

The self-signed `NotTrusted` status is **expected** — it means the pipeline produced a real Authenticode signature with a valid timestamp, but the chain doesn't terminate at a trusted root. This proves the toolchain works; replacing the cert with a CA-issued one is the only delta to ship.

### 4. Capture attestation evidence

Even for a dry-run, write a `.workflow/evidence/release/signed-bundle-attestation.json` matching the schema in `docs/release/SIGN_OFF.md` (section 8). Mark `release_state: "self_signed_dry_run"` so it is never confused with a shippable signed build.

### 5. Cleanup

```powershell
Remove-Item desktop/src-tauri/tauri.signed.local.generated.json
Get-ChildItem Cert:\CurrentUser\My\$thumbprint | Remove-Item   # optional
```

The repo `tauri.conf.json` is never touched by this flow — it stays `null/""`.

## Verification (real signed bundle)

After a release-cert build, verify the signature:

```powershell
Get-AuthenticodeSignature desktop/src-tauri/target/release/bundle/nsis/*.exe | Format-List
```

Then capture the result into `.workflow/evidence/release/signed-bundle-attestation.json` per the schema in `docs/release/SIGN_OFF.md` section 8. The attestation is the formal handoff proof that converts `unsigned_local_proof` → `signed_external_release`.

## Security Notes

- Never commit certificate private keys to the repository
- Store certificate thumbprints in CI/CD secrets, not in config files
- The `tauri.conf.json` in the repo should keep `certificateThumbprint: null` for unsigned builds
- Override the value via environment variable or CI/CD config for signed releases
