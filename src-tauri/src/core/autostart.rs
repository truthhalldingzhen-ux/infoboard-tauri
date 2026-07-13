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
    let enabled = app.autolaunch().is_enabled().map_err(|e| e.to_string())?;
    println!("[自启动] 查询状态: {}", if enabled { "已启用" } else { "未启用" });
    Ok(enabled)
}

/// 设置开机自启动
#[tauri::command]
pub fn autostart_set_enabled(app: AppHandle, enabled: bool) -> Result<(), String> {
    println!("[自启动] 设置: {}", if enabled { "启用" } else { "禁用" });
    if enabled {
        app.autolaunch().enable().map_err(|e| e.to_string())
    } else {
        app.autolaunch().disable().map_err(|e| e.to_string())
    }
}
