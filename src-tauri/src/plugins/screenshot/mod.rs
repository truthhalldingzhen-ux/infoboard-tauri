//! 截图插件后端
//!
//! 1. PowerShell 截全屏 → base64 data URL
//! 2. 前端框选裁剪后，确认写入剪贴板
//! 3. 取消时后端清理

use std::time::Duration;
use base64::{Engine as _, engine::general_purpose};
use tokio::process::Command;
use tokio::time::timeout;

/// PowerShell 截全屏脚本
///
/// 使用 System.Drawing + System.Windows.Forms 捕获主显示器全屏，
/// 输出 PNG base64 字符串（不含 data URL 前缀）
const CAPTURE_SCRIPT: &str = r#"
Add-Type -AssemblyName System.Drawing;
Add-Type -AssemblyName System.Windows.Forms;
try {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds;
    $bitmap = New-Object System.Drawing.Bitmap $bounds.Width, $bounds.Height;
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap);
    $graphics.CopyFromScreen($bounds.X, $bounds.Y, 0, 0, $bounds.Size);
    $ms = New-Object System.IO.MemoryStream;
    $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
    $base64 = [Convert]::ToBase64String($ms.ToArray());
    $ms.Close();
    $bitmap.Dispose();
    $graphics.Dispose();
    Write-Output $base64;
} catch {
    Write-Error $_.Exception.Message;
    exit 1;
}
"#;

/// 截取全屏，返回 data:image/png;base64,... 格式的 data URL
#[tauri::command]
pub async fn screenshot_capture() -> Result<String, String> {
    let script = CAPTURE_SCRIPT;

    let output = timeout(Duration::from_secs(12), Command::new("powershell")
        .args(["-STA", "-NoProfile", "-NonInteractive", "-Command", script])
        .output())
        .await
        .map_err(|_| "截图超时（12秒）".to_string())?
        .map_err(|e| format!("截图失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // 首次加载 System.Drawing 会有 1-2 秒延迟，但不算错误
        return Err(format!("PowerShell 截图失败: {}", stderr.trim()));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let base64_str = stdout.trim();

    if base64_str.is_empty() {
        return Err("截图结果为空".to_string());
    }

    // 构造 data URL
    Ok(format!("data:image/png;base64,{}", base64_str))
}

/// 确认截图：将用户框选区域的 data URL 解码并写入系统剪贴板
///
/// 参数 data_url 应为裁剪后的 data:image/png;base64,... 格式
#[tauri::command]
pub fn screenshot_confirm(data_url: String) -> Result<(), String> {
    // 解析 data URL，提取 base64 部分
    let base64_str = data_url
        .split(',')
        .nth(1)
        .ok_or_else(|| "无效的 data URL 格式".to_string())?;

    // base64 解码
    let png_bytes = general_purpose::STANDARD
        .decode(base64_str)
        .map_err(|e| format!("base64 解码失败: {}", e))?;

    // 使用 image crate 将 PNG 字节解码为动态图片
    let img = image::load_from_memory(&png_bytes)
        .map_err(|e| format!("图片解码失败: {}", e))?;

    // 转换为 RGBA 原始像素数据
    let rgba = img.to_rgba8();
    let (width, height) = rgba.dimensions();
    let raw_pixels = rgba.into_raw();

    // 通过 arboard 写入剪贴板
    let mut clipboard = arboard::Clipboard::new()
        .map_err(|e| format!("无法访问剪贴板: {}", e))?;

    clipboard
        .set_image(arboard::ImageData {
            width: width as usize,
            height: height as usize,
            bytes: std::borrow::Cow::Owned(raw_pixels),
        })
        .map_err(|e| format!("写入剪贴板失败: {}", e))?;

    Ok(())
}

/// 取消截图：后端清理（当前为空操作，保留接口供后续扩展）
#[tauri::command]
pub fn screenshot_cancel() -> Result<(), String> {
    // 当前无需清理，仅作为占位 command 保留
    Ok(())
}

// ─── 单元测试 ───

#[cfg(test)]
mod tests {

    #[test]
    fn test_data_url_parsing() {
        let data_url = "data:image/png;base64,ABC123".to_string();
        let base64 = data_url.split(',').nth(1).unwrap();
        assert_eq!(base64, "ABC123");
    }

    #[test]
    fn test_empty_data_url() {
        let data_url = "data:image/png;base64,".to_string();
        let base64 = data_url.split(',').nth(1).unwrap();
        assert!(base64.is_empty());
    }

    #[test]
    fn test_data_url_without_prefix() {
        let data_url = "ABC123".to_string();
        let parts: Vec<&str> = data_url.split(',').collect();
        // 没有逗号时，整个字符串作为 base64 部分
        assert_eq!(parts.len(), 1);
        assert_eq!(parts[0], "ABC123");
    }
}
