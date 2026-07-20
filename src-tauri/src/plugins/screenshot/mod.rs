//! 截图模块 — Tauri 后端
//!
//! 修复全屏白屏：
//! - 不在启动时预创建覆盖窗
//! - 点击截图后再创建（默认 hidden）
//! - xcap 原生截图
//! - 先推图再 show

use std::sync::Mutex;
use base64::{engine::general_purpose, Engine as _};
use tauri::webview::WebviewWindowBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl};

static CAPTURED: Mutex<Option<String>> = Mutex::new(None);
const OVERLAY_LABEL: &str = "screenshot-overlay";

/// 兼容旧调用：空实现，绝不在启动时建全屏窗
pub fn setup_screenshot(_app: &AppHandle) {}

fn capture_screen_native() -> Result<String, String> {
    let monitors = xcap::Monitor::all().map_err(|e| format!("枚举显示器失败: {}", e))?;
    let monitor = monitors
        .into_iter()
        .next()
        .ok_or_else(|| "未找到显示器".to_string())?;
    let image = monitor
        .capture_image()
        .map_err(|e| format!("截图失败: {}", e))?;

    let mut png_bytes = Vec::new();
    {
        let mut cursor = std::io::Cursor::new(&mut png_bytes);
        image
            .write_to(&mut cursor, image::ImageFormat::Png)
            .map_err(|e| format!("PNG 编码失败: {}", e))?;
    }
    Ok(format!(
        "data:image/png;base64,{}",
        general_purpose::STANDARD.encode(&png_bytes)
    ))
}

#[tauri::command]
pub async fn screenshot_start(app: AppHandle) -> Result<(), String> {
    // 先截图
    let data_url = tokio::task::spawn_blocking(capture_screen_native)
        .await
        .map_err(|e| format!("截图任务失败: {}", e))??;
    *CAPTURED.lock().unwrap() = Some(data_url.clone());

    // 关闭旧覆盖窗（若有）
    if let Some(old) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = old.close();
        tokio::time::sleep(std::time::Duration::from_millis(50)).await;
    }

    // 再创建覆盖窗（默认不可见）
    let overlay = WebviewWindowBuilder::new(
        &app,
        OVERLAY_LABEL,
        WebviewUrl::App("index.html#/screenshot".into()),
    )
    .title("截图")
    .fullscreen(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .resizable(false)
    .visible(false)
    .focused(false)
    .build()
    .map_err(|e| format!("创建覆盖窗口失败: {}", e))?;

    // 推送图片
    overlay
        .emit("screenshot:data", &data_url)
        .map_err(|e| format!("推送截图失败: {}", e))?;

    // 等前端加载/渲染
    tokio::time::sleep(std::time::Duration::from_millis(120)).await;

    overlay
        .show()
        .map_err(|e| format!("显示覆盖窗失败: {}", e))?;
    let _ = overlay.set_focus();
    Ok(())
}

#[tauri::command]
pub fn screenshot_get_image() -> Result<Option<String>, String> {
    Ok(CAPTURED.lock().unwrap().clone())
}

#[tauri::command]
pub async fn screenshot_confirm(app: AppHandle, data_url: String) -> Result<(), String> {
    let base64_str = data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效 data URL".to_string())?;
    let png = general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| format!("base64: {}", e))?;
    let img = image::load_from_memory(&png).map_err(|e| format!("解码: {}", e))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut cb = arboard::Clipboard::new().map_err(|e| format!("剪贴板: {}", e))?;
    cb.set_image(arboard::ImageData {
        width: w as usize,
        height: h as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    })
    .map_err(|e| format!("写入: {}", e))?;

    cleanup(&app);
    Ok(())
}

#[tauri::command]
pub async fn screenshot_cancel(app: AppHandle) -> Result<(), String> {
    cleanup(&app);
    Ok(())
}

fn cleanup(app: &AppHandle) {
    *CAPTURED.lock().unwrap() = None;
    if let Some(overlay) = app.get_webview_window(OVERLAY_LABEL) {
        let _ = overlay.close();
    }
}
