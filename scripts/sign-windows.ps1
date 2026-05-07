# Code Signing Configuration
#
# Environment variables (set in CI or local shell):
#   TAURI_SIGNING_PRIVATE_KEY_PATH  - Path to code signing private key (.pfx/.p12)
#   TAURI_SIGNING_PRIVATE_KEY       - Base64-encoded private key (alternative to path)
#   TAURI_SIGNING_PUBLIC_KEY        - Base64-encoded public key for update verification
#   CODESIGN_CERT_THUMBPRINT        - Windows certificate thumbprint (from cert store)
#
# To procure a production CA certificate:
#   1. Purchase from DigiCert / Sectigo / GlobalSign (OV or EV code signing)
#   2. Install cert in Windows cert store (Local Machine → Personal)
#   3. Set CODESIGN_CERT_THUMBPRINT to the cert thumbprint
#   4. Update tauri.conf.json → bundle.windows.certificateThumbprint
#
# For Tauri updater signing:
#   1. Generate keypair: npx tauri signer generate -w ~/.tauri/myapp.key
#   2. Set TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PUBLIC_KEY in CI

# Windows code signing via signtool.exe (requires Windows SDK)
param(
    [string]$CertificateThumbprint = $env:CODESIGN_CERT_THUMBPRINT,
    [string]$BinaryPath,
    [string]$TimestampUrl = "http://timestamp.digicert.com"
)

if (-not $CertificateThumbprint) {
    Write-Host "WARN: No certificate thumbprint set. Skipping code signing."
    Write-Host "Set CODESIGN_CERT_THUMBPRINT env var or pass -CertificateThumbprint."
    exit 0
}

if (-not $BinaryPath) {
    Write-Host "ERROR: -BinaryPath is required"
    exit 1
}

$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe" |
    Sort-Object { [version]($_.FullName -split '\\')[6] } -Descending |
    Select-Object -First 1

if (-not $signtool) {
    Write-Host "ERROR: signtool.exe not found. Install Windows SDK."
    exit 1
}

Write-Host "Signing: $BinaryPath"
Write-Host "Using cert thumbprint: $CertificateThumbprint"

& $signtool.FullName sign /sha1 $CertificateThumbprint /tr $TimestampUrl /td sha256 /fd sha256 $BinaryPath

if ($LASTEXITCODE -eq 0) {
    Write-Host "Code signing succeeded."
} else {
    Write-Host "ERROR: Code signing failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
