//! 截图模块 — Tauri 后端
//!
//! 复刻 Electron `screenshot.ts`：
//! 1. PowerShell 截全屏
//! 2. 创建独立全屏 webview 窗口作为覆盖层
//! 3. 覆盖层框选确认 → 写入剪贴板 → 关闭覆盖窗口

use std::sync::Mutex;
use std::time::Duration;
use base64::{Engine as _, engine::general_purpose};
use tokio::process::Command;
use tokio::time::timeout;
use tauri::{AppHandle, Emitter, Manager};
use tauri::webview::WebviewWindowBuilder;
use tauri::WebviewUrl;

const CAPTURE_SCRIPT: &str = r#"
Add-Type -AssemblyName System.Drawing
Add-Type -AssemblyName System.Windows.Forms
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size)
$ms = New-Object System.IO.MemoryStream
$bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
$base64 = [Convert]::ToBase64String($ms.ToArray())
$ms.Close(); $bitmap.Dispose(); $graphics.Dispose()
Write-Output $base64
"#;

static CAPTURED: Mutex<Option<String>> = Mutex::new(None);

async fn capture_screen_raw() -> Result<String, String> {
    let output = timeout(Duration::from_secs(12), Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", CAPTURE_SCRIPT])
        .output()).await
        .map_err(|_| "截图超时（12秒）".to_string())?
        .map_err(|e| format!("截图失败: {}", e))?;
    if !output.status.success() {
        return Err(format!("PowerShell 失败: {}",
            String::from_utf8_lossy(&output.stderr).trim()));
    }
    let b64 = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if b64.is_empty() { return Err("截图结果为空".into()); }
    Ok(format!("data:image/png;base64,{}", b64))
}

#[tauri::command]
pub async fn screenshot_start(app: AppHandle) -> Result<(), String> {
    let data_url = capture_screen_raw().await?;
    *CAPTURED.lock().unwrap() = Some(data_url);

    WebviewWindowBuilder::new(
        &app, "screenshot-overlay",
        WebviewUrl::App("index.html#/screenshot".into()),
    )
    .fullscreen(true)
    .always_on_top(true)
    .skip_taskbar(true)
    .decorations(false)
    .resizable(false)
    .build()
    .map_err(|e| format!("创建覆盖窗口失败: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn screenshot_get_image() -> Result<Option<String>, String> {
    Ok(CAPTURED.lock().unwrap().clone())
}

#[tauri::command]
pub async fn screenshot_confirm(app: AppHandle, data_url: String) -> Result<(), String> {
    let base64_str = data_url.split(',').nth(1).ok_or("无效 data URL")?;
    let png = general_purpose::STANDARD.decode(base64_str).map_err(|e| format!("base64: {}", e))?;
    let img = image::load_from_memory(&png).map_err(|e| format!("解码: {}", e))?;
    let rgba = img.to_rgba8();
    let (w, h) = rgba.dimensions();
    let mut cb = arboard::Clipboard::new().map_err(|e| format!("剪贴板: {}", e))?;
    cb.set_image(arboard::ImageData {
        width: w as usize, height: h as usize,
        bytes: std::borrow::Cow::Owned(rgba.into_raw()),
    }).map_err(|e| format!("写入: {}", e))?;
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
    if let Some(overlay) = app.get_webview_window("screenshot-overlay") {
        overlay.close().ok();
    }
}
