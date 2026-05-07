# M20 Code Signing — CI Integration Guide
#
# GitHub Actions workflow example for signed Tauri builds.

# .github/workflows/release.yml
#
# name: Release
# on:
#   push:
#     tags: ['v*']
#
# jobs:
#   build:
#     runs-on: windows-latest
#     steps:
#       - uses: actions/checkout@v4
#
#       - name: Setup Node
#         uses: actions/setup-node@v4
#         with:
#           node-version: 20
#
#       - name: Setup Rust
#         uses: dtolnay/rust-toolchain@stable
#
#       - name: Install frontend deps
#         working-directory: desktop
#         run: npm ci
#
#       - name: Install Tauri CLI
#         run: npm install -g @tauri-apps/cli
#
#       - name: Build Tauri (unsigned)
#         working-directory: desktop
#         env:
#           TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
#           TAURI_SIGNING_PUBLIC_KEY: ${{ secrets.TAURI_SIGNING_PUBLIC_KEY }}
#         run: npm run tauri build
#
#       - name: Sign Windows binary
#         shell: pwsh
#         env:
#           CODESIGN_CERT_THUMBPRINT: ${{ secrets.CODESIGN_CERT_THUMBPRINT }}
#         run: |
#           ./scripts/sign-windows.ps1 -BinaryPath "desktop/src-tauri/target/release/niko-studio-desktop.exe"
#           ./scripts/sign-windows.ps1 -BinaryPath "desktop/src-tauri/target/release/bundle/msi/*.msi"
#
#       - name: Upload artifacts
#         uses: actions/upload-artifact@v4
#         with:
#           name: niko-studio-windows
#           path: desktop/src-tauri/target/release/bundle/*
