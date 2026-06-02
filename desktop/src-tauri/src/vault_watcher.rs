use notify::{Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::mpsc;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInfo {
    pub path: String,
    pub name: String,
    pub has_obsidian_config: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultChangeEvent {
    pub path: String,
    pub kind: String,
}

pub struct VaultWatcher {
    _watcher: RecommendedWatcher,
    vault_path: PathBuf,
}

impl VaultWatcher {
    pub fn new(app: AppHandle, vault_path: PathBuf) -> Result<Self, notify::Error> {
        let (tx, rx): (mpsc::Sender<notify::Event>, mpsc::Receiver<notify::Event>) =
            mpsc::channel();
        let vault_path_clone = vault_path.clone();

        let mut watcher = RecommendedWatcher::new(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    if matches!(
                        event.kind,
                        EventKind::Create(_) | EventKind::Modify(_) | EventKind::Remove(_)
                    ) {
                        for path in &event.paths {
                            let rel = path.strip_prefix(&vault_path_clone).unwrap_or(path);
                            if rel.starts_with(".obsidian") {
                                continue;
                            }
                            let _ = app.emit(
                                "vault:file-changed",
                                VaultChangeEvent {
                                    path: rel.to_string_lossy().to_string(),
                                    kind: format!("{:?}", event.kind),
                                },
                            );
                        }
                    }
                }
            },
            Config::default(),
        )?;

        watcher.watch(&vault_path, RecursiveMode::Recursive)?;
        // Block the receiver to keep the channel alive
        std::thread::spawn(move || {
            let _ = rx.recv();
        });

        Ok(Self {
            _watcher: watcher,
            vault_path,
        })
    }
}

pub fn discover_vaults() -> Vec<VaultInfo> {
    let mut vaults = Vec::new();

    // Read Obsidian's obsidian.json for registered vaults
    if let Some(obsidian_config) =
        dirs::config_dir().map(|p| p.join("obsidian").join("obsidian.json"))
    {
        if obsidian_config.exists() {
            if let Ok(content) = std::fs::read_to_string(&obsidian_config) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(obj) = val.get("vaults").and_then(|v| v.as_object()) {
                        for (_id, vault_val) in obj {
                            if let Some(path) = vault_val.get("path").and_then(|p| p.as_str()) {
                                let p = PathBuf::from(path);
                                let has_config = p.join(".obsidian").exists();
                                let name = p
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default();
                                vaults.push(VaultInfo {
                                    path: path.to_string(),
                                    name,
                                    has_obsidian_config: has_config,
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    vaults
}
