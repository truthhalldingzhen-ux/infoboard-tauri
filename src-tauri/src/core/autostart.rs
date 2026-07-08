//! 开机自启动命令
//!
//! 使用 tauri-plugin-autostart 控制应用是否随系统启动。
//! 提供 2 个 Tauri command：
//! - autostart_is_enabled
//! - autostart_set_enabled

use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

/// 查询开机自启动是否已启用
#[tauri::command]
pub fn autostart_is_enabled(app: AppHandle) -> Result<bool, String> {
    app.autolaunch().is_enabled().map_err(|e| e.to_string())
}

/// 设置开机自启动
#[tauri::command]
pub fn autostart_set_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}
