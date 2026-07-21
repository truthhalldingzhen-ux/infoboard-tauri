//! 后端日志 → 前端日志台 + 本地文件
//!
//! 打包后无 DevTools 时，通过 emit("app_log") 推到应用内日志台，
//! 并追加写入 %APPDATA%/infoboard-tauri/app.log。

use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppLogPayload {
    pub level: String,
    pub message: String,
    pub source: String,
}

static LOG_PATH: Mutex<Option<PathBuf>> = Mutex::new(None);

fn ensure_log_path(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(guard) = LOG_PATH.lock() {
        if let Some(p) = guard.as_ref() {
            return Some(p.clone());
        }
    }
    let dir = app.path().app_data_dir().ok()?;
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("app.log");
    if let Ok(mut guard) = LOG_PATH.lock() {
        *guard = Some(path.clone());
    }
    Some(path)
}

fn append_file(path: &PathBuf, line: &str) {
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(path) {
        let _ = writeln!(f, "{line}");
    }
}

/// 发往前端日志台，并写本地文件
pub fn emit(app: &AppHandle, level: &str, message: &str) {
    let source = "rust";
    let ts = chrono_like_now();
    let line = format!("[{ts}] [{level}] [{source}] {message}");
    if let Some(path) = ensure_log_path(app) {
        append_file(&path, &line);
    }
    let _ = app.emit(
        "app_log",
        AppLogPayload {
            level: level.to_string(),
            message: message.to_string(),
            source: source.to_string(),
        },
    );
    // 仍打印到 stdout（dev 可见）
    println!("{line}");
}

fn chrono_like_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    // 简单时间戳，避免引入 chrono 依赖
    format!("{secs}")
}

/// 返回日志文件路径
#[tauri::command]
pub fn log_get_path(app: AppHandle) -> Result<String, String> {
    ensure_log_path(&app)
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "无法获取日志路径".into())
}

/// 前端也可写入同一文件（方便统一导出）
#[tauri::command]
pub fn log_append_file(app: AppHandle, level: String, message: String) -> Result<(), String> {
    let path = ensure_log_path(&app).ok_or_else(|| "无法获取日志路径".to_string())?;
    let ts = chrono_like_now();
    append_file(&path, &format!("[{ts}] [{level}] [web] {message}"));
    Ok(())
}
