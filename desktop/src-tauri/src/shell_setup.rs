use crate::gateway_runtime::GatewayState;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconEvent};
use tauri::Manager;

const TRAY_ICON: tauri::image::Image<'static> = tauri::include_image!("icons/icon.png");

fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn handle_window_event(window: &tauri::Window, event: &tauri::WindowEvent) {
    if let tauri::WindowEvent::CloseRequested { .. } = event {
        if window.label() == "main" {
            if let Some(state) = window.app_handle().try_state::<GatewayState>() {
                state.stop_child_best_effort();
            }
        }
    }
}

pub fn setup_shell(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let show = MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[&show, &separator, &quit])?;

    tauri::tray::TrayIconBuilder::new()
        .icon(TRAY_ICON.clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().0.as_str() {
            "show" => focus_main_window(app),
            "quit" => {
                if let Some(state) = app.try_state::<GatewayState>() {
                    state.stop_child_best_effort();
                }
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button,
                button_state,
                ..
            } = event
            {
                if button == MouseButton::Left && button_state == MouseButtonState::Up {
                    focus_main_window(tray.app_handle());
                }
            }
        })
        .build(app)?;

    Ok(())
}
