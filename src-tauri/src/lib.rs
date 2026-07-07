mod core {
    pub mod toast;
    pub mod tray;
    pub mod window;
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好, {}! 欢迎使用 InfoBoard", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            core::tray::setup_tray(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            core::window::window_minimize,
            core::window::window_maximize,
            core::window::window_close,
            core::window::window_is_maximized,
            core::window::window_is_visible,
        ])
        .build(tauri::generate_context!())
        .expect("启动 InfoBoard 失败");

    app.run(core::tray::handle_run_event);
}
