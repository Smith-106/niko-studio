// Niko-Studio Desktop - Tauri Main Process

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::{Manager, SystemTray, SystemTrayEvent, SystemTrayMenu, CustomMenuItem};
use std::process::{Command, Child};
use std::sync::Mutex;

const DEFAULT_GATEWAY_BASE: &str = "http://127.0.0.1:8000";

fn normalize_base_url(value: &str) -> String {
    value.trim_end_matches('/').to_string()
}

fn get_configured_gateway_base() -> Option<String> {
    for key in ["NIKO_GATEWAY_URL", "VITE_NIKO_GATEWAY_URL"] {
        if let Ok(env_value) = std::env::var(key) {
            let trimmed = env_value.trim();
            if !trimmed.is_empty() {
                return Some(normalize_base_url(trimmed));
            }
        }
    }
    None
}

async fn is_gateway_healthy(base: &str) -> bool {
    let health_url = format!("{}/health", base);
    let client = reqwest::Client::new();
    client
        .get(&health_url)
        .send()
        .await
        .ok()
        .map(|resp| resp.status().is_success())
        .unwrap_or(false)
}

async fn resolve_gateway_base_with_fallback() -> String {
    if let Some(remote_base) = get_configured_gateway_base() {
        if is_gateway_healthy(&remote_base).await {
            return remote_base;
        }
    }
    DEFAULT_GATEWAY_BASE.to_string()
}

struct PythonBackend(Mutex<Option<Child>>);

#[tauri::command]
async fn start_backend() -> Result<String, String> {
    if let Some(remote_base) = get_configured_gateway_base() {
        if is_gateway_healthy(&remote_base).await {
            return Ok("Remote Gateway is healthy, skip local backend start".to_string());
        }
    }

    // Start Python backend (local fallback)
    let child = Command::new("python")
        .args(["-m", "uvicorn", "src.mcp.gateway:app", "--host", "127.0.0.1", "--port", "8000"])
        .current_dir("..")
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;

    Ok(format!("Backend started with PID: {}", child.id()))
}

#[tauri::command]
async fn check_backend_health() -> Result<bool, String> {
    let base_url = resolve_gateway_base_with_fallback().await;
    Ok(is_gateway_healthy(&base_url).await)
}

#[tauri::command]
async fn call_api(endpoint: String, method: String, body: Option<String>) -> Result<String, String> {
    let base_url = resolve_gateway_base_with_fallback().await;
    let url = format!("{}{}", base_url, endpoint);
    let client = reqwest::Client::new();

    let response = match method.as_str() {
        "GET" => client.get(&url).send().await,
        "POST" => {
            let mut req = client.post(&url);
            if let Some(b) = body {
                req = req.header("Content-Type", "application/json").body(b);
            }
            req.send().await
        },
        "PUT" => {
            let mut req = client.put(&url);
            if let Some(b) = body {
                req = req.header("Content-Type", "application/json").body(b);
            }
            req.send().await
        },
        _ => return Err("Unsupported method".to_string()),
    };

    match response {
        Ok(resp) => resp.text().await.map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    // System tray menu
    let quit = CustomMenuItem::new("quit".to_string(), "Quit");
    let show = CustomMenuItem::new("show".to_string(), "Show Window");
    let tray_menu = SystemTrayMenu::new()
        .add_item(show)
        .add_native_item(tauri::SystemTrayMenuItem::Separator)
        .add_item(quit);

    let system_tray = SystemTray::new().with_menu(tray_menu);

    tauri::Builder::default()
        .manage(PythonBackend(Mutex::new(None)))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .system_tray(system_tray)
        .on_system_tray_event(|app, event| match event {
            SystemTrayEvent::LeftClick { .. } => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
                window.set_focus().unwrap();
            }
            SystemTrayEvent::MenuItemClick { id, .. } => {
                match id.as_str() {
                    "quit" => {
                        std::process::exit(0);
                    }
                    "show" => {
                        let window = app.get_window("main").unwrap();
                        window.show().unwrap();
                        window.set_focus().unwrap();
                    }
                    _ => {}
                }
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            start_backend,
            check_backend_health,
            call_api
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
