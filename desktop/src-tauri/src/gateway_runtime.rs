use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use tauri::Manager;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;
use tokio::sync::Mutex as AsyncMutex;

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

    fn contract_note(self) -> &'static str {
        match self {
            GatewayRuntime::Python => {
                "Python is the packaged compatibility sidecar artifact that Tauri expects today."
            }
            GatewayRuntime::Node => {
                "Node is the authoritative local runtime, but the current launcher stays repo-local and packaged builds fall back to the pre-staged Python compatibility artifact."
            }
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

fn resolve_services_config_path(resource_dir: &Path) -> Option<PathBuf> {
    for ancestor in std::iter::once(resource_dir).chain(resource_dir.ancestors()) {
        let nested = ancestor.join("config").join("services.yaml");
        if nested.exists() {
            return Some(nested);
        }

        let direct = ancestor.join("services.yaml");
        if direct.exists() {
            return Some(direct);
        }
    }

    None
}

pub async fn is_gateway_healthy(base: &str) -> bool {
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

pub struct GatewayState {
    child: Mutex<Option<CommandChild>>,
    local_base: Mutex<Option<String>>,
    base_override: Mutex<Option<String>>,
    start_lock: AsyncMutex<()>,
}

impl GatewayState {
    pub fn new() -> Self {
        Self {
            child: Mutex::new(None),
            local_base: Mutex::new(None),
            base_override: Mutex::new(None),
            start_lock: AsyncMutex::new(()),
        }
    }

    pub async fn resolve_base(&self, app: &tauri::AppHandle) -> Result<String, String> {
        if let Some(env_base) = get_configured_gateway_base() {
            if is_gateway_healthy(&env_base).await {
                return Ok(env_base);
            }
        }

        let override_base = { self.base_override.lock().unwrap().clone() };
        if let Some(override_base) = override_base {
            if is_gateway_healthy(&override_base).await {
                return Ok(override_base);
            }
        }

        let local_base = { self.local_base.lock().unwrap().clone() };
        if let Some(local_base) = local_base {
            if is_gateway_healthy(&local_base).await {
                return Ok(local_base);
            }
            self.stop_child_best_effort();
        }

        self.start_local_sidecar(app).await
    }

    async fn start_local_sidecar(&self, app: &tauri::AppHandle) -> Result<String, String> {
        let _guard = self.start_lock.lock().await;

        let existing_local = { self.local_base.lock().unwrap().clone() };
        if let Some(local_base) = existing_local {
            if is_gateway_healthy(&local_base).await {
                return Ok(local_base);
            }
            self.stop_child_best_effort();
        }

        // ISS-20260430-001 follow-up: honor NIKO_GATEWAY_PORT when set so Layer 4
        // smoke (and any other external probe) can pin the port. Falls back to an
        // ephemeral OS-assigned port for the normal user-launch path so multiple
        // installs / dev instances don't collide.
        let port = match std::env::var("NIKO_GATEWAY_PORT")
            .ok()
            .and_then(|v| v.parse::<u16>().ok())
        {
            Some(p) if p > 0 => p,
            _ => std::net::TcpListener::bind("127.0.0.1:0")
                .map_err(|e| format!("Failed to bind ephemeral port: {e}"))?
                .local_addr()
                .map_err(|e| format!("Failed to read bound addr: {e}"))?
                .port(),
        };

        let base = format!("http://127.0.0.1:{port}");

        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("Failed to resolve resource_dir: {e}"))?;
        let skills_dir = resource_dir.join("skills");
        let services_config_path = resolve_services_config_path(&resource_dir);

        let app_data_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to resolve app_data_dir: {e}"))?;
        std::fs::create_dir_all(&app_data_dir)
            .map_err(|e| format!("Failed to create app_data_dir: {e}"))?;

        let requested_runtime = get_requested_gateway_runtime();
        let runtimes = if requested_runtime == GatewayRuntime::Node {
            vec![GatewayRuntime::Node, GatewayRuntime::Python]
        } else {
            vec![GatewayRuntime::Python]
        };

        const MAX_ATTEMPTS: usize = 3;
        let mut last_error: Option<String> = None;

        for runtime in runtimes {
            for attempt in 1..=MAX_ATTEMPTS {
                let mut cmd = match app.shell().sidecar(runtime.sidecar_name()) {
                    Ok(cmd) => cmd,
                    Err(e) => {
                        last_error = Some(format!(
                            "Failed to create {} sidecar command: {e}. {}",
                            runtime.as_env(),
                            runtime.contract_note()
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
                    .env(
                        "NIKO_CORS_DEV_ORIGINS",
                        "tauri://localhost,http://localhost:5173",
                    )
                    .env("NIKO_SKILLS_DIR", skills_dir.to_string_lossy().to_string());

                if let Some(config_path) = &services_config_path {
                    cmd = cmd.env(
                        "NIKO_CONFIG_PATH",
                        config_path.to_string_lossy().to_string(),
                    );
                }

                let (_rx, child) = match cmd.spawn() {
                    Ok(result) => result,
                    Err(e) => {
                        last_error = Some(format!(
                            "Failed to spawn {} sidecar (attempt {attempt}): {e}. {}",
                            runtime.as_env(),
                            runtime.contract_note()
                        ));
                        if attempt == MAX_ATTEMPTS {
                            break;
                        }
                        tokio::time::sleep(Duration::from_millis(200)).await;
                        continue;
                    }
                };

                *self.child.lock().unwrap() = Some(child);
                *self.local_base.lock().unwrap() = Some(base.clone());

                let health_timeout = if runtime == GatewayRuntime::Node {
                    Duration::from_secs(5)
                } else {
                    Duration::from_secs(20)
                };
                match self.wait_until_healthy(&base, health_timeout).await {
                    Ok(()) => return Ok(base),
                    Err(err) => {
                        self.stop_child_best_effort();
                        last_error = Some(format!(
                            "{} sidecar failed health check (attempt {attempt}): {err}. {}",
                            runtime.as_env(),
                            runtime.contract_note()
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

    pub fn stop_child_best_effort(&self) {
        let child_opt = self.child.lock().unwrap().take();
        if let Some(child) = child_opt {
            let _ = child.kill();
        }
        *self.local_base.lock().unwrap() = None;
    }

    pub fn set_base_override(&self, base: Option<String>) {
        *self.base_override.lock().unwrap() = base.map(|value| normalize_base_url(value.trim()));
    }
}

impl Drop for GatewayState {
    fn drop(&mut self) {
        self.stop_child_best_effort();
    }
}
