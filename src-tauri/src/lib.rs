use tauri::{Emitter, Manager};
use tauri_plugin_window_state::{WindowExt, StateFlags};

mod core {
    pub mod autostart;
    pub mod geolocate;
    pub mod toast;
    pub mod tray;
    pub mod window;
}

mod plugins {
    pub mod bilibili_info;
    pub mod media_control;
    pub mod niutrans;
    pub mod opencode;
    pub mod screenshot;
    pub mod ocr;
    pub mod mail;
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好, {}! 欢迎使用 InfoBoard", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None::<Vec<&'static str>>,
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                        println!("[快捷键] Ctrl+Shift+I 触发");
                        // 切换主窗口显隐
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                println!("[快捷键] 隐藏窗口");
                                let _ = window.hide();
                            } else {
                                println!("[快捷键] 显示窗口");
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        // 通知前端
                        let _ = app.emit("window_toggle_visibility", ());
                    }
                })
                .build(),
        )
        .manage(plugins::media_control::AppState::new())
        .setup(|app| {
            println!("[系统] InfoBoard 启动");
            core::tray::setup_tray(app.handle())?;
            // 恢复上次关闭时的窗口大小和位置
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.restore_state(StateFlags::all());
            }
            // 注册全局快捷键 Ctrl+Shift+I
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let _ = app.global_shortcut().register("Ctrl+Shift+I");
            }
            // 注册插件状态
            app.manage(plugins::ocr::OcrEngine::new());
            app.manage(plugins::mail::MailManager::new());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            core::autostart::autostart_is_enabled,
            core::autostart::autostart_set_enabled,
            core::window::window_minimize,
            core::window::window_maximize,
            core::window::window_close,
            core::window::window_is_maximized,
            core::window::window_is_visible,
            core::geolocate::geolocate_ip,
            plugins::opencode::opencode_get_usage,
            plugins::opencode::opencode_get_sessions,
            plugins::opencode::opencode_get_minimax,
            plugins::opencode::opencode_refresh_cookie,
            plugins::opencode::opencode_get_cookie_mtime,
            plugins::bilibili_info::bilibili_enrich_media,
            plugins::media_control::media_get_current_session,
            plugins::media_control::media_send_command,
            plugins::niutrans::niutrans_translate,
            plugins::niutrans::niutrans_set_api_key,
            plugins::niutrans::niutrans_set_app_id,
            plugins::niutrans::niutrans_has_api_key,
            plugins::niutrans::niutrans_get_config,
            plugins::niutrans::niutrans_get_char_count,
            // Issue 14: 截图
            plugins::screenshot::screenshot_capture,
            plugins::screenshot::screenshot_confirm,
            plugins::screenshot::screenshot_cancel,
            // Issue 15: OCR
            plugins::ocr::ocr_recognize,
            plugins::ocr::ocr_is_ready,
            plugins::ocr::ocr_engine_status,
            // Issue 16: IMAP 邮件
            plugins::mail::mail_get_config,
            plugins::mail::mail_set_config,
            plugins::mail::mail_add_account,
            plugins::mail::mail_remove_account,
            plugins::mail::mail_connect_saved,
            plugins::mail::mail_fetch_recent,
            plugins::mail::mail_check_new,
            plugins::mail::mail_fetch_content,
            plugins::mail::mail_mark_read,
            plugins::mail::mail_disconnect_all,
            plugins::mail::mail_connection_info,
        ])
        .build(tauri::generate_context!())
        .expect("启动 InfoBoard 失败");

    app.run(core::tray::handle_run_event);
}
