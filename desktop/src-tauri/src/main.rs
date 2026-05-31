#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gateway_commands;
mod gateway_runtime;
mod shell_setup;
mod vault_commands;
mod vault_watcher;

use gateway_commands::{
    call_api, check_backend_health, fetch_chunk, get_gateway_base, set_gateway_base_override, start_backend,
    restart_backend,
};
use gateway_runtime::GatewayState;
use vault_commands::{list_vaults, select_vault, stop_vault_watcher, get_vault_graph};
use vault_commands::VaultWatcherState;

fn main() {
    let _sentry_guard = option_env!("SENTRY_DSN").and_then(|dsn| {
        if dsn.is_empty() {
            None
        } else {
            match dsn.parse() {
                Ok(dsn_value) => {
                    let guard = sentry::init(sentry::ClientOptions {
                        dsn: Some(dsn_value),
                        release: Some(env!("CARGO_PKG_VERSION").into()),
                        ..Default::default()
                    });
                    if guard.is_enabled() {
                        Some(guard)
                    } else {
                        None
                    }
                }
                Err(e) => {
                    eprintln!("[sentry] Failed to parse SENTRY_DSN: {e}, disabling Sentry");
                    None
                }
            }
        }
    });

    tauri::Builder::default()
        .manage(GatewayState::new())
        .manage(VaultWatcherState::new())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .on_window_event(shell_setup::handle_window_event)
        .setup(shell_setup::setup_shell)
        .invoke_handler(tauri::generate_handler![
            get_gateway_base,
            set_gateway_base_override,
            start_backend,
            check_backend_health,
            call_api,
            fetch_chunk,
            restart_backend,
            list_vaults,
            select_vault,
            stop_vault_watcher,
            get_vault_graph
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
