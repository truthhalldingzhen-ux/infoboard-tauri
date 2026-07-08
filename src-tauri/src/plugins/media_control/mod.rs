// ─── SMTC 媒体控制 ───
//
// 通过 PowerShell 子进程调用 Windows SMTC API：
//   1. media_get_current_session() — 查询 SMTC 会话 + B站窗口标题
//   2. media_send_command() — 发送播放控制命令
//
// 缩略图缓存：避免每秒都读 SMTC 图片流浪费性能
//
// 超时保护：查询 12 秒超时，命令发送 5 秒超时

pub mod types;

use std::process::Command;
use std::sync::Mutex;
use std::time::Duration;
use tauri::State;
use types::{MediaSession, ThumbnailCache};

// ─── 常量 ───

/// 查询超时（秒）
const QUERY_TIMEOUT_SECS: u64 = 12;
/// 命令发送超时（秒）
const COMMAND_TIMEOUT_SECS: u64 = 5;
/// PowerShell 执行策略
const PS_EXE: &str = "powershell.exe";
const PS_ARGS: [&str; 4] = [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
];

// ─── PowerShell 脚本 ───

/// 查询会话 + B站窗口标题（合并单次 PS 调用）
const PS_QUERY_COMBINED: &str = r#"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
try {
    $task = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $manager = $task.GetAwaiter().GetResult()
    $session = $manager.GetCurrentSession()
    if ($session -ne $null) {
        $mediaProps = $session.TryGetMediaPropertiesAsync().GetAwaiter().GetResult()
        $playback = $session.GetPlaybackInfo()
        $status = $playback.PlaybackStatus.ToString()
        $thumbBase64 = ""
        if ($mediaProps.Thumbnail -ne $null) {
            try {
                $thumbStream = $mediaProps.Thumbnail.OpenReadAsync().GetAwaiter().GetResult()
                if ($thumbStream -ne $null -and $thumbStream.CanRead) {
                    $ms = New-Object System.IO.MemoryStream
                    $thumbStream.CopyTo($ms)
                    $thumbBytes = $ms.ToArray()
                    if ($thumbBytes.Length -gt 0) {
                        $thumbBase64 = [Convert]::ToBase64String($thumbBytes)
                    }
                    $ms.Dispose()
                    $thumbStream.Dispose()
                }
            } catch {}
        }
        $result = @{
            title = if ($mediaProps.Title) { $mediaProps.Title } else { "" }
            artist = if ($mediaProps.Artist) { $mediaProps.Artist } else { "" }
            thumbnail = if ($thumbBase64) { "data:image/jpeg;base64,$thumbBase64" } else { "" }
            playbackStatus = $status
            sourceAppId = if ($session.SourceAppUserModelId) { $session.SourceAppUserModelId } else { "" }
        }
        Write-Output (ConvertTo-Json $result -Compress)
        exit 0
    }
} catch {}
Write-Output "null"
"#;

/// 发送播放控制命令
const PS_SEND_COMMAND: &str = r#"
param($cmd)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
try {
    $task = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $manager = $task.GetAwaiter().GetResult()
    $session = $manager.GetCurrentSession()
    if ($session -eq $null) { Write-Output "false"; exit 0 }
    $success = $false
    switch ($cmd) {
        "play"    { $r = $session.TryPlayAsync().GetAwaiter().GetResult(); $success = $r }
        "pause"   { $r = $session.TryPauseAsync().GetAwaiter().GetResult(); $success = $r }
        "toggle"  { $r = $session.TryTogglePlayPauseAsync().GetAwaiter().GetResult(); $success = $r }
        "next"    { $r = $session.TrySkipNextAsync().GetAwaiter().GetResult(); $success = $r }
        "previous" { $r = $session.TrySkipPreviousAsync().GetAwaiter().GetResult(); $success = $r }
    }
    if ($success) { Write-Output "true" } else { Write-Output "false" }
} catch { Write-Output "false" }
"#;

// ─── 状态管理 ───

/// 应用状态（存放缩略图缓存）
pub struct AppState {
    pub thumbnail_cache: Mutex<Option<ThumbnailCache>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            thumbnail_cache: Mutex::new(None),
        }
    }
}

// ─── PowerShell 执行器 ───

/// 运行 PowerShell 脚本并返回标准输出
fn run_powershell(script: &str, args: &[&str], timeout_secs: u64) -> Result<String, String> {
    let mut cmd = Command::new(PS_EXE);
    cmd.args(&PS_ARGS);

    if !args.is_empty() {
        cmd.args(args);
    }

    cmd.arg("-Command")
        .arg(script)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| format!("启动 PowerShell 失败: {e}"))?;

    // 等待子进程完成（超时保护）
    let start = std::time::Instant::now();
    let timeout = Duration::from_secs(timeout_secs);

    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                if status.success() {
                    use std::io::Read;
                    let mut output = String::new();
                    child
                        .stdout
                        .take()
                        .ok_or("无法读取 PowerShell 输出")?
                        .read_to_string(&mut output)
                        .map_err(|e| format!("读取 PowerShell 输出失败: {e}"))?;
                    return Ok(output.trim().to_string());
                } else {
                    use std::io::Read;
                    let mut stderr = String::new();
                    child
                        .stderr
                        .take()
                        .ok_or("无法读取 PowerShell 错误")?
                        .read_to_string(&mut stderr)
                        .map_err(|e| format!("读取 PowerShell 错误失败: {e}"))?;
                    return Err(format!("PowerShell 错误: {stderr}"));
                }
            }
            Ok(None) => {
                // 子进程仍在运行
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    return Err(format!("PowerShell 超时（>{timeout_secs}s）"));
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => {
                return Err(format!("PowerShell 等待失败: {e}"));
            }
        }
    }
}

// ─── 解析 B站窗口标题 ───

/// 从 "视频标题 — UP主 — 哔哩哔哩" 格式提取视频标题和UP主
#[allow(dead_code)]
fn parse_bilibili_window_title(window_title: &str) -> Option<(String, String)> {
    // 格式: "视频标题 — UP主 — 哔哩哔哩"
    let parts: Vec<&str> = window_title.split("—").map(|s| s.trim()).collect();
    if parts.len() >= 3 && parts[2].contains("哔哩哔哩") {
        let video_title = parts[0].to_string();
        let up_name = parts[1].to_string();
        if !video_title.is_empty() && !up_name.is_empty() {
            return Some((video_title, up_name));
        }
    }
    None
}

// ─── Tauri Commands ───

/// 获取当前 SMTC 媒体会话
///
/// 返回当前正在播放的媒体会话信息，包括标题、艺术家、缩略图、播放状态和来源应用。
/// 缩略图使用 Rust 侧缓存：标题不变时复用上次读取的 base64。
/// 无活跃会话时返回 `None`。
#[tauri::command]
pub async fn media_get_current_session(
    state: State<'_, AppState>,
) -> Result<Option<MediaSession>, String> {
    // 使用 spawn_blocking 避免阻塞主线程
    let result = tokio::task::spawn_blocking(move || {
        run_powershell(PS_QUERY_COMBINED, &[], QUERY_TIMEOUT_SECS)
    })
    .await
    .map_err(|e| format!("spawn_blocking 失败: {e}"))?;

    let output = match result {
        Ok(o) => o,
        Err(e) => {
            eprintln!("[media_get_current_session] PS 查询失败: {e}");
            return Ok(None);
        }
    };

    // "null" 表示无会话
    if output == "null" || output.is_empty() {
        return Ok(None);
    }

    // 解析 JSON
    let mut session: MediaSession = match serde_json::from_str(&output) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("[media_get_current_session] JSON 解析失败: {e}");
            return Ok(None);
        }
    };

    // 缩略图缓存逻辑
    let mut cache = state.thumbnail_cache.lock().map_err(|e| format!("锁失败: {e}"))?;
    if let Some(ref cached) = *cache {
        if cached.title == session.title {
            // 标题不变，复用缓存
            session.thumbnail = format!("{}{}", cached.mime_prefix, cached.data);
        } else {
            // 标题变了，更新缓存
            let (mime_prefix, data) = split_thumbnail_data(&session.thumbnail);
            *cache = Some(ThumbnailCache {
                title: session.title.clone(),
                data,
                mime_prefix,
            });
        }
    } else {
        // 首次缓存
        let (mime_prefix, data) = split_thumbnail_data(&session.thumbnail);
        *cache = Some(ThumbnailCache {
            title: session.title.clone(),
            data,
            mime_prefix,
        });
    }

    Ok(Some(session))
}

/// 发送播放控制命令
///
/// 支持命令：`play`, `pause`, `toggle`, `next`, `previous`
/// 成功返回 `true`，失败返回 `false`（不抛错）
#[tauri::command]
pub async fn media_send_command(_command: String) -> Result<bool, String> {
    let result = tokio::task::spawn_blocking(move || {
        run_powershell(PS_SEND_COMMAND, &[], COMMAND_TIMEOUT_SECS)
    })
    .await
    .map_err(|e| format!("spawn_blocking 失败: {e}"))?;

    match result {
        Ok(output) => Ok(output.trim() == "true"),
        Err(e) => {
            eprintln!("[media_send_command] PS 执行失败: {e}");
            Ok(false)
        }
    }
}

// ─── 工具函数 ───

/// 将 "data:image/jpeg;base64,xxx" 拆分为前缀和数据部分
fn split_thumbnail_data(uri: &str) -> (String, String) {
    if let Some(pos) = uri.find("base64,") {
        let prefix = uri[..pos + 7].to_string(); // 包含 "base64,"
        let data = uri[pos + 7..].to_string();
        (prefix, data)
    } else {
        ("data:image/jpeg;base64,".to_string(), uri.to_string())
    }
}

// ─── 单元测试 ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_bilibili_window_title() {
        let result = parse_bilibili_window_title("【4K】赛博朋克2077 全剧情电影 — 影视飓风 — 哔哩哔哩");
        assert!(result.is_some());
        let (title, artist) = result.unwrap();
        assert_eq!(title, "【4K】赛博朋克2077 全剧情电影");
        assert_eq!(artist, "影视飓风");
    }

    #[test]
    fn test_parse_bilibili_window_title_no_match() {
        let result = parse_bilibili_window_title("Visual Studio Code");
        assert!(result.is_none());
    }

    #[test]
    fn test_parse_bilibili_window_title_too_few_parts() {
        let result = parse_bilibili_window_title("测试视频 — 哔哩哔哩");
        assert!(result.is_none());
    }

    #[test]
    fn test_split_thumbnail_data() {
        let uri = "data:image/png;base64,ABC123";
        let (prefix, data) = split_thumbnail_data(uri);
        assert_eq!(prefix, "data:image/png;base64,");
        assert_eq!(data, "ABC123");
    }

    #[test]
    fn test_split_thumbnail_data_no_prefix() {
        let uri = "ABC123";
        let (prefix, data) = split_thumbnail_data(uri);
        assert_eq!(prefix, "data:image/jpeg;base64,");
        assert_eq!(data, "ABC123");
    }
}
