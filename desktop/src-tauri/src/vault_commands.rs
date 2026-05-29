use crate::vault_watcher::{discover_vaults, VaultChangeEvent, VaultInfo, VaultWatcher};
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::State;

pub struct VaultWatcherState(Mutex<Option<VaultWatcher>>);

#[tauri::command]
pub fn list_vaults() -> Vec<VaultInfo> {
    discover_vaults()
}

#[tauri::command]
pub fn select_vault(
    app: tauri::AppHandle,
    state: State<'_, VaultWatcherState>,
    vault_path: String,
) -> Result<VaultInfo, String> {
    let path = PathBuf::from(&vault_path);
    if !path.exists() {
        return Err("Vault directory does not exist".into());
    }
    let has_config = path.join(".obsidian").exists();
    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let watcher = VaultWatcher::new(app, path)
        .map_err(|e| format!("Failed to start vault watcher: {}", e))?;

    *state.0.lock().unwrap() = Some(watcher);

    Ok(VaultInfo {
        path: vault_path,
        name,
        has_obsidian_config,
    })
}

#[tauri::command]
pub fn stop_vault_watcher(state: State<'_, VaultWatcherState>) -> Result<(), String> {
    *state.0.lock().unwrap() = None;
    Ok(())
}

#[tauri::command]
pub fn get_vault_graph(vault_path: String) -> Result<serde_json::Value, String> {
    // Stub: returns empty graph structure for now
    // Full implementation will read vault and construct graph data
    Ok(serde_json::json!({
        "nodes": [],
        "edges": []
    }))
}