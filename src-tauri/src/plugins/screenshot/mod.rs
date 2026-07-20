//! 截图模块 — Tauri 后端
//!
//! 复刻自 Electron 版 `electron/screenshot.ts`
//! Electron 使用 desktopCapturer → 这里用 PowerShell CopyFromScreen 替代
//!
//! 流程：
//! 1. PowerShell 截全屏 → PNG base64 data URL
//! 2. 前端覆盖层框选 → Canvas 裁剪
//! 3. 确认后 data URL → PNG 字节 → arboard 写入剪贴板

use std::time::Duration;
use base64::{Engine as _, engine::general_purpose};
use tokio::process::Command;
use tokio::time::timeout;

/// 复刻自 Electron `screen.getPrimaryDisplay().bounds`
/// PowerShell 截屏脚本：捕获主显示器全屏，输出 PNG base64
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
$ms.Close()
$bitmap.Dispose()
$graphics.Dispose()
Write-Output $base64
"#;

/// 复刻自 Electron `startScreenshot()` 中的 `captureScreen()`
/// 返回 data:image/png;base64,... 格式的 data URL
#[tauri::command]
pub async fn screenshot_capture() -> Result<String, String> {
    log::info!("[截图] 开始捕获屏幕");

    let output = timeout(Duration::from_secs(12), Command::new("powershell")
        .args(["-NoProfile", "-NonInteractive", "-Command", CAPTURE_SCRIPT])
        .output())
        .await
        .map_err(|_| "截图超时（12秒）".to_string())?
        .map_err(|e| {
            log::error!("[截图] PowerShell 启动失败: {}", e);
            format!("截图失败: {}", e)
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        log::error!("[截图] PowerShell 失败: {}", stderr.trim());
        return Err(format!("PowerShell 截图失败: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let base64_str = stdout.trim();

    if base64_str.is_empty() {
        log::error!("[截图] 截图结果为空");
        return Err("截图结果为空".to_string());
    }

    log::info!("[截图] 捕获完成，base64 长度: {}", base64_str.len());
    Ok(format!("data:image/png;base64,{}", base64_str))
}

/// 复刻自 Electron `screenshot:confirm` handler
/// electron: `nativeImage.createFromDataURL(dataUrl)` → `clipboard.writeImage(image)`
/// tauri:  dataUrl → base64 解码 → image crate 解码 PNG → arboard 写入
#[tauri::command]
pub fn screenshot_confirm(data_url: String) -> Result<(), String> {
    log::info!("[截图] 确认截图，写入剪贴板");

    let base64_str = data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;

    let png_bytes = general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| format!("base64 解码失败: {}", e))?;

    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| format!("图片解码失败: {}", e))?;

    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let raw_pixels = rgba.into_raw();

    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("无法访问剪贴板: {}", e))?;

    clipboard
        .set_image(arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(raw_pixels),
        })
        .map_err(|e| format!("写入剪贴板失败: {}", e))?;

    log::info!("[截图] 已写入剪贴板 {}x{}", width, height);
    Ok(())
}

/// 复刻自 Electron `screenshot:cancel` — 关闭窗口，清理状态
#[tauri::command]
pub fn screenshot_cancel() -> Result<(), String> {
    log::info!("[截图] 取消");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_data_url_parsing() {
        // base64 解码简单的 "AAAA"（合法编码）
        let decoded = general_purpose::STANDARD.decode("AAAA").unwrap();
        assert_eq!(decoded, vec![0x00, 0x00, 0x00]);
    }
}
