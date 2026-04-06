// Niko-Studio Desktop - Tauri Main Process

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::Mutex;
use std::time::Duration;

use tokio::sync::Mutex as AsyncMutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

const TRAY_ICON: tauri::image::Image<'static> = tauri::include_image!("icons/icon.png");

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

#[derive(Clone, Copy, PartialEq, Eq)]
enum GatewayRuntime {
    Python,
    Node,
}

impl GatewayRuntime {
    fn sidecar_name(self) -> &'static str {
        match self {
            GatewayRuntime::Python => "niko-gateway",
            GatewayRuntime::Node => {
                if cfg!(target_os = "windows") {
                    "niko-gateway-node.cmd"
                } else {
                    "niko-gateway-node"
                }
            }
        }
    }

    fn as_env(self) -> &'static str {
        match self {
            GatewayRuntime::Python => "python",
            GatewayRuntime::Node => "node",
        }
    }
}

fn get_requested_gateway_runtime() -> GatewayRuntime {
    match std::env::var("NIKO_GATEWAY_RUNTIME") {
        Ok(value) if value.trim().eq_ignore_ascii_case("python") => GatewayRuntime::Python,
        Ok(value) if value.trim().eq_ignore_ascii_case("node") => GatewayRuntime::Node,
        _ => GatewayRuntime::Node,
    }
}

async fn is_gateway_healthy(base: &str) -> bool {
    let health_url = format!("{}/health", base);
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(2))
        .build()
        .ok();
    let client = match client {
        Some(c) => c,
        None => return false,
    };
    client
        .get(&health_url)
        .send()
        .await
        .ok()
        .map(|resp| resp.status().is_success())
        .unwrap_or(false)
}

struct GatewayState {
    child: Mutex<Option<CommandChild>>,
    local_base: Mutex<Option<String>>,
    base_override: Mutex<Option<String>>,
    start_lock: AsyncMutex<()>,
}

impl GatewayState {
    fn new() -> Self {
        Self {
            child: Mutex::new(None),
            local_base: Mutex::new(None),
            base_override: Mutex::new(None),
            start_lock: AsyncMutex::new(()),
        }
    }

    async fn resolve_base(&self, app: &tauri::AppHandle) -> Result<String, String> {
        // 1) Hard override via env (highest priority, for dev / advanced use)
        if let Some(env_base) = get_configured_gateway_base() {
            if is_gateway_healthy(&env_base).await {
                return Ok(env_base);
            }
        }

        // 2) UI override
        let override_base = { self.base_override.lock().unwrap().clone() };
        if let Some(override_base) = override_base {
            if is_gateway_healthy(&override_base).await {
                return Ok(override_base);
            }
        }

        // 3) Local base (already started)
        let local_base = { self.local_base.lock().unwrap().clone() };
        if let Some(local_base) = local_base {
            if is_gateway_healthy(&local_base).await {
                return Ok(local_base);
            }
            // Stale local base; clear state before respawning.
            self.stop_child_best_effort();
        }

        // 4) Start local sidecar
        self.start_local_sidecar(app).await
    }

    async fn start_local_sidecar(&self, app: &tauri::AppHandle) -> Result<String, String> {
        // Serialize sidecar start to avoid spawning duplicates under concurrent calls.
        let _guard = self.start_lock.lock().await;

        // If another call already started it while waiting for the lock, reuse.
        let existing_local = { self.local_base.lock().unwrap().clone() };
        if let Some(local_base) = existing_local {
            if is_gateway_healthy(&local_base).await {
                return Ok(local_base);
            }
            // Existing instance is unhealthy; clear stale state before respawning.
            self.stop_child_best_effort();
        }

        // Pick a free port.
        let port = std::net::TcpListener::bind("127.0.0.1:0")
            .map_err(|e| format!("Failed to bind ephemeral port: {e}"))?
            .local_addr()
            .map_err(|e| format!("Failed to read bound addr: {e}"))?
            .port();

        let base = format!("http://127.0.0.1:{port}");

        // Compute paths.
        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to resolve resource_dir: {e}"))?;
        let skills_dir = resource_dir.join("skills");

        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
        std::fs::create_dir_all(&app_data_dir).map_err(|e| format!("Failed to create app_data_dir: {e}"))?;

        let requested_runtime = get_requested_gateway_runtime();
        let runtimes = if requested_runtime == GatewayRuntime::Node {
            vec![GatewayRuntime::Node, GatewayRuntime::Python]
        } else {
            vec![GatewayRuntime::Python]
        };

        // Retry spawn + health check.
        const MAX_ATTEMPTS: usize = 3;
        let mut last_error: Option<String> = None;

        for runtime in runtimes {
            for attempt in 1..=MAX_ATTEMPTS {
                let mut cmd = match app.shell().sidecar(runtime.sidecar_name()) {
                    Ok(cmd) => cmd,
                    Err(e) => {
                        last_error = Some(format!(
                            "Failed to create {} sidecar command: {e}",
                            runtime.as_env()
                        ));
                        break;
                    }
                };

                cmd = cmd
                    .current_dir(&app_data_dir)
                    .env("NIKO_GATEWAY_HOST", "127.0.0.1")
                    .env("NIKO_GATEWAY_PORT", port.to_string())
                    .env("NIKO_GATEWAY_RELOAD", "0")
                    .env("NIKO_ENV", "development")
                    .env("NIKO_GATEWAY_RUNTIME", runtime.as_env())
                    .env("NIKO_CORS_DEV_ORIGINS", "tauri://localhost,http://localhost:5173")
                    .env("NIKO_SKILLS_DIR", skills_dir.to_string_lossy().to_string());

                let (_rx, child) = match cmd.spawn() {
                    Ok(result) => result,
                    Err(e) => {
                        last_error = Some(format!(
                            "Failed to spawn {} sidecar (attempt {attempt}): {e}",
                            runtime.as_env()
                        ));
                        if attempt == MAX_ATTEMPTS {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(200)).await;
                        continue;
                    }
                };

                // Save child handle and tentatively set local_base (port is bound).
                // If health check fails, we'll clear it.
                *self.child.lock().unwrap() = Some(child);
                *self.local_base.lock().unwrap() = Some(base.clone());

                // Wait until healthy.
                let health_timeout = if runtime == GatewayRuntime::Node {
                    Duration::from_secs(5)
                } else {
                    Duration::from_secs(20)
                };
                let wait_result = self.wait_until_healthy(&base, health_timeout).await;
                match wait_result {
                    Ok(()) => {
                        return Ok(base);
                    }
                    Err(err) => {
                        self.stop_child_best_effort();
                        last_error = Some(format!(
                            "{} sidecar failed health check (attempt {attempt}): {err}",
                            runtime.as_env()
                        ));
                        if attempt == MAX_ATTEMPTS {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(200)).await;
                    }
                }
            }
        }

        Err(last_error.unwrap_or_else(|| "Failed to start gateway sidecar".to_string()))
    }

    async fn wait_until_healthy(&self, base: &str, timeout: Duration) -> Result<(), String> {
        let start = std::time::Instant::now();
        let mut interval = Duration::from_millis(150);
        let max_interval = Duration::from_secs(1);

        loop {
            if is_gateway_healthy(base).await {
                return Ok(());
            }

            let _pid = { self.child.lock().unwrap().as_ref().map(|child| child.pid()) };

            if start.elapsed() >= timeout {
                return Err(format!("Gateway did not become healthy in {:?}", timeout));
            }

            tokio::time::sleep(interval).await;
            interval = std::cmp::min(max_interval, interval.saturating_mul(2));
        }
    }

    fn stop_child_best_effort(&self) {
        let child_opt = self.child.lock().unwrap().take();
        if let Some(child) = child_opt {
            // Best-effort kill; ignore errors.
            let _ = child.kill();
        }
        *self.local_base.lock().unwrap() = None;
    }

    fn set_base_override(&self, base: Option<String>) {
        *self.base_override.lock().unwrap() = base.map(|v| normalize_base_url(v.trim()));
    }
}

#[tauri::command]
async fn get_gateway_base(app: tauri::AppHandle, state: tauri::State<'_, GatewayState>) -> Result<String, String> {
    state.resolve_base(&app).await
}

#[tauri::command]
async fn set_gateway_base_override(base: Option<String>, state: tauri::State<'_, GatewayState>) -> Result<(), String> {
    state.set_base_override(base);
    Ok(())
}

#[tauri::command]
async fn start_backend(app: tauri::AppHandle, state: tauri::State<'_, GatewayState>) -> Result<String, String> {
    let base = state.resolve_base(&app).await?;
    Ok(format!("Gateway ready: {base}"))
}

#[tauri::command]
async fn check_backend_health(app: tauri::AppHandle, state: tauri::State<'_, GatewayState>) -> Result<bool, String> {
    let base_url = state.resolve_base(&app).await?;
    Ok(is_gateway_healthy(&base_url).await)
}

#[tauri::command]
async fn call_api(
    app: tauri::AppHandle,
    state: tauri::State<'_, GatewayState>,
    endpoint: String,
    method: String,
    body: Option<String>,
) -> Result<String, String> {
    let base_url = state.resolve_base(&app).await?;
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
        }
        "PUT" => {
            let mut req = client.put(&url);
            if let Some(b) = body {
                req = req.header("Content-Type", "application/json").body(b);
            }
            req.send().await
        }
        _ => return Err("Unsupported method".to_string()),
    };

    match response {
        Ok(resp) => resp.text().await.map_err(|e| e.to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn main() {
    tauri::Builder::default()
        .manage(GatewayState::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .on_window_event(|window, event| {
            // When main window is closed, clean up sidecar before app exits
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if window.label() == "main" {
                    if let Some(state) = window.app_handle().try_state::<GatewayState>() {
                        state.stop_child_best_effort();
                    }
                }
            }
        })
        .setup(|app| {
            // Tray menu
            let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let separator = PredefinedMenuItem::separator(app)?;
            let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

            tauri::tray::TrayIconBuilder::new()
                .icon(TRAY_ICON.clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().0.as_str() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        if let Some(state) = app.try_state::<GatewayState>() {
                            state.stop_child_best_effort();
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button, button_state, .. } = event {
                        if button == MouseButton::Left && button_state == MouseButtonState::Up {
                            if let Some(window) = tray.app_handle().get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_gateway_base,
            set_gateway_base_override,
            start_backend,
            check_backend_health,
            call_api
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

impl Drop for GatewayState {
    fn drop(&mut self) {
        // Fallback cleanup when GatewayState is dropped (e.g., on app exit).
        self.stop_child_best_effort();
    }
}
