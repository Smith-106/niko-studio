//! Niko Gateway Launcher (ISS-20260430-001 fix)
//!
//! Tiny Tauri-friendly executable that replaces the stale 128 MB Python
//! compat sidecar. Tauri's externalBin mechanism expects a single per-arch
//! .exe; this launcher is that .exe. At runtime it spawns the Node TS
//! gateway from the staged sidecar bundle next to itself.
//!
//! Resolution order for the Node runtime:
//!   1. <exe_dir>/sidecar/node.exe (bundled portable Node — preferred)
//!   2. System `node` from PATH (graceful degradation when Node 20+ is installed)
//!
//! If neither is available the launcher prints a clear error to stderr and
//! exits with code 127 so Tauri / smoke tests can surface a meaningful
//! failure mode instead of "0-byte sidecar / never bound port".
//!
//! All argv passed to the launcher is forwarded verbatim to the spawned
//! Node process (port, host, env overrides, etc.). stdout/stderr are
//! inherited so logs flow upstream.
//!
//! Compile via `cargo build --release --bin niko-gateway-launcher`.

use std::env;
use std::path::{Path, PathBuf};
use std::process::{exit, Command, Stdio};

const SIDECAR_DIRNAME: &str = "sidecar";
const SIDECAR_ENTRY: &str = "gateway-server.js";
const BUNDLED_NODE_REL_WIN: &str = "sidecar/node.exe";
const BUNDLED_NODE_REL_UNIX: &str = "sidecar/bin/node";
const EXIT_NODE_NOT_FOUND: i32 = 127;
const EXIT_SIDECAR_MISSING: i32 = 126;
const EXIT_SPAWN_FAILED: i32 = 125;

fn exe_dir() -> PathBuf {
    env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|p| p.to_path_buf()))
        .unwrap_or_else(|| PathBuf::from("."))
}

fn resolve_node(exe_dir: &Path) -> Option<PathBuf> {
    // Try bundled portable Node next to the staged sidecar dir, mirroring the
    // candidate layouts in resolve_sidecar(). Falls back to system PATH.
    let bundled_rel = if cfg!(target_os = "windows") {
        BUNDLED_NODE_REL_WIN
    } else {
        BUNDLED_NODE_REL_UNIX
    };
    let bundled_candidates: [PathBuf; 5] = [
        exe_dir.join(bundled_rel),
        // Tauri 2 NSIS preserves relative paths from `bundle.resources`, so
        // `"bin/sidecar"` from tauri.conf.json lands at <install>/bin/sidecar/.
        exe_dir.join("bin").join(bundled_rel),
        exe_dir.join("resources").join(bundled_rel),
        exe_dir
            .parent()
            .map(|p| p.join("resources").join(bundled_rel))
            .unwrap_or_else(|| exe_dir.join("resources").join(bundled_rel)),
        exe_dir.join("_up_").join("resources").join(bundled_rel),
    ];
    for candidate in &bundled_candidates {
        if candidate.is_file() {
            return Some(candidate.clone());
        }
    }
    // Fallback: system node from PATH (graceful degradation when host has Node 20+)
    let system_name = if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    };
    if let Some(path_var) = env::var_os("PATH") {
        for entry in env::split_paths(&path_var) {
            let candidate = entry.join(system_name);
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

fn resolve_sidecar(exe_dir: &Path) -> Option<PathBuf> {
    // Tauri NSIS install layouts vary across platforms; check the most common
    // candidate paths in order. The first match wins.
    //
    //   1. <exe_dir>/sidecar/                    — co-located (dev / Tauri externalBin staging)
    //   2. <exe_dir>/bin/sidecar/                — Tauri 2 NSIS install (resources path "bin/sidecar"
    //                                              from tauri.conf.json is preserved relative to install root)
    //   3. <exe_dir>/resources/sidecar/          — Tauri 2 default resource_dir on Windows
    //   4. <exe_dir>/../resources/sidecar/       — Tauri 2 install layout where launcher
    //                                              sits in a sibling bin/ folder
    //   5. <exe_dir>/_up_/resources/sidecar/     — Tauri's renamed parent-relative escape
    let candidates: [PathBuf; 5] = [
        exe_dir.join(SIDECAR_DIRNAME),
        exe_dir.join("bin").join(SIDECAR_DIRNAME),
        exe_dir.join("resources").join(SIDECAR_DIRNAME),
        exe_dir
            .parent()
            .map(|p| p.join("resources").join(SIDECAR_DIRNAME))
            .unwrap_or_else(|| exe_dir.join("resources").join(SIDECAR_DIRNAME)),
        exe_dir.join("_up_").join("resources").join(SIDECAR_DIRNAME),
    ];
    for candidate in &candidates {
        let entry = candidate.join(SIDECAR_ENTRY);
        if entry.is_file() {
            return Some(entry);
        }
    }
    None
}

fn main() {
    let dir = exe_dir();

    let sidecar = match resolve_sidecar(&dir) {
        Some(p) => p,
        None => {
            eprintln!(
                "[niko-gateway-launcher] FATAL: staged sidecar not found at {}/{}/{}",
                dir.display(),
                SIDECAR_DIRNAME,
                SIDECAR_ENTRY
            );
            eprintln!(
                "[niko-gateway-launcher] HINT: run `npm --prefix desktop run build:sidecar` to stage the Node sidecar bundle."
            );
            exit(EXIT_SIDECAR_MISSING);
        }
    };

    let node = match resolve_node(&dir) {
        Some(p) => p,
        None => {
            eprintln!(
                "[niko-gateway-launcher] FATAL: Node runtime not found. Tried bundled ({}/{}) and system PATH.",
                dir.display(),
                if cfg!(target_os = "windows") {
                    BUNDLED_NODE_REL_WIN
                } else {
                    BUNDLED_NODE_REL_UNIX
                }
            );
            eprintln!(
                "[niko-gateway-launcher] HINT: bundled portable Node should be staged by `npm --prefix desktop run build:sidecar`. ISS-20260430-001 specifies this is the supported path; system Node is only a fallback."
            );
            exit(EXIT_NODE_NOT_FOUND);
        }
    };

    let forwarded_args: Vec<String> = env::args().skip(1).collect();

    let status = Command::new(&node)
        .arg(&sidecar)
        .args(&forwarded_args)
        .stdin(Stdio::inherit())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .status();

    match status {
        Ok(s) => exit(s.code().unwrap_or(EXIT_SPAWN_FAILED)),
        Err(err) => {
            eprintln!(
                "[niko-gateway-launcher] FATAL: failed to spawn {} {}: {}",
                node.display(),
                sidecar.display(),
                err
            );
            exit(EXIT_SPAWN_FAILED);
        }
    }
}
