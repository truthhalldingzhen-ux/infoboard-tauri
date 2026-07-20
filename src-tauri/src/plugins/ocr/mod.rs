//! OCR 文字识别 — Tauri 后端
//!
//! 复刻 Electron `electron/ocr.ts` 的协议：
//! 1. 启动 RapidOCR-json.exe（cwd = 引擎目录，加载 models）
//! 2. 等待 stdout 出现 "init completed"
//! 3. 写入一行 JSON: {"image_base64":"..."}
//! 4. 读取一行 JSON 响应 { code, data }
//!
//! 注意：必须等 init 完成后再写 stdin，否则引擎忽略请求或无响应。

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─── 类型 ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResponse {
    pub code: i32,
    pub data: Value,
}

pub struct OcrEngine {
    engine_path: Mutex<PathBuf>,
}

impl OcrEngine {
    pub fn new() -> Self {
        Self {
            engine_path: Mutex::new(get_engine_path()),
        }
    }

    fn path(&self) -> PathBuf {
        self.engine_path.lock().unwrap().clone()
    }
}

fn get_engine_path() -> PathBuf {
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("rapidocr")
        .join("RapidOCR-json.exe");
    if dev.exists() {
        return dev;
    }
    if let Ok(exe) = std::env::current_exe() {
        let bundle = exe
            .parent()
            .unwrap_or(&exe)
            .join("rapidocr")
            .join("RapidOCR-json.exe");
        if bundle.exists() {
            return bundle;
        }
    }
    dev
}

/// 同步执行一次 OCR（在 spawn_blocking 中调用）
fn recognize_once(engine_path: &PathBuf, image_base64: &str) -> Result<OcrResponse, String> {
    if !engine_path.exists() {
        return Err(format!(
            "OCR 引擎未找到: {}。请将 RapidOCR-json.exe 及 models 放到 src-tauri/binaries/rapidocr/",
            engine_path.display()
        ));
    }

    let engine_dir = engine_path
        .parent()
        .ok_or_else(|| "引擎路径无效".to_string())?;

    let mut child = Command::new(engine_path)
        .current_dir(engine_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("启动 OCR 引擎失败: {}", e))?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "无法获取子进程 stdout".to_string())?;
    let mut stdin = child
        .stdin
        .take()
        .ok_or_else(|| "无法获取子进程 stdin".to_string())?;

    let mut reader = BufReader::new(stdout);
    let mut line = String::new();

    // 1) 等待 init completed（模型加载，最长 30s）
    let init_deadline = Instant::now() + Duration::from_secs(30);
    let mut inited = false;
    while Instant::now() < init_deadline {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break, // EOF
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                log::info!("[OCR] stdout: {}", &trimmed[..trimmed.len().min(200)]);
                if trimmed.contains("init completed") {
                    inited = true;
                    break;
                }
                // 有的版本 init 后直接可收 JSON，若先收到 { 也继续
                if trimmed.starts_with('{') {
                    // 意外：未 init 就收到 JSON，仍尝试解析
                    if let Ok(resp) = serde_json::from_str::<OcrResponse>(trimmed) {
                        let _ = child.kill();
                        let _ = child.wait();
                        return Ok(resp);
                    }
                }
            }
            Err(e) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("读取 OCR stdout 失败: {}", e));
            }
        }
    }

    if !inited {
        let _ = child.kill();
        let _ = child.wait();
        return Err("OCR 引擎初始化超时（30s），请检查 models 目录是否完整".to_string());
    }

    // 2) 发送请求（JSON Lines，一行一个请求）
    let request = serde_json::json!({ "image_base64": image_base64 }).to_string();
    writeln!(stdin, "{}", request).map_err(|e| format!("写入 stdin 失败: {}", e))?;
    stdin
        .flush()
        .map_err(|e| format!("刷新 stdin 失败: {}", e))?;
    // 保持 stdin 打开直到读完响应；部分引擎在 stdin 关闭后立即退出
    // 读完后再 drop

    // 3) 读取 JSON 响应（最长 20s）
    let resp_deadline = Instant::now() + Duration::from_secs(20);
    while Instant::now() < resp_deadline {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    continue;
                }
                if trimmed.contains("init completed") {
                    continue;
                }
                if trimmed.starts_with('{') {
                    match serde_json::from_str::<OcrResponse>(trimmed) {
                        Ok(resp) => {
                            drop(stdin);
                            let _ = child.kill();
                            let _ = child.wait();
                            return Ok(resp);
                        }
                        Err(e) => {
                            log::warn!(
                                "[OCR] JSON 解析失败: {} raw={:.200}",
                                e,
                                trimmed
                            );
                        }
                    }
                } else {
                    log::info!("[OCR] 非 JSON 输出: {}", &trimmed[..trimmed.len().min(200)]);
                }
            }
            Err(e) => {
                drop(stdin);
                let _ = child.kill();
                let _ = child.wait();
                return Err(format!("读取 OCR 响应失败: {}", e));
            }
        }
    }

    drop(stdin);
    // 附带 stderr 便于诊断
    let mut stderr_msg = String::new();
    if let Some(mut err) = child.stderr.take() {
        use std::io::Read;
        let mut buf = String::new();
        let _ = err.read_to_string(&mut buf);
        stderr_msg = buf;
    }
    let _ = child.kill();
    let _ = child.wait();

    if stderr_msg.trim().is_empty() {
        Err("未收到有效的 OCR 响应（超时）".to_string())
    } else {
        Err(format!(
            "未收到有效的 OCR 响应。stderr: {}",
            stderr_msg.trim().chars().take(300).collect::<String>()
        ))
    }
}

// ─── Tauri Commands ───

/// OCR 识别
///
/// 前端传入纯 base64（不含 data: 前缀），参数名 imageBase64（Tauri 会映射到 image_base64）
#[tauri::command]
pub async fn ocr_recognize(
    state: tauri::State<'_, OcrEngine>,
    image_base64: String,
) -> Result<Value, String> {
    if image_base64.is_empty() {
        return Ok(serde_json::json!({
            "code": 299,
            "data": "图片数据为空"
        }));
    }

    // 兼容误传完整 data URL
    let image_base64 = image_base64
        .split(',')
        .last()
        .unwrap_or(&image_base64)
        .to_string();

    if image_base64.len() > 50 * 1024 * 1024 {
        return Ok(serde_json::json!({
            "code": 299,
            "data": "图片数据过大，请缩小选区"
        }));
    }

    let engine_path = state.path();
    log::info!(
        "[OCR] 开始识别 base64_len={} engine={}",
        image_base64.len(),
        engine_path.display()
    );

    let result = tokio::task::spawn_blocking(move || recognize_once(&engine_path, &image_base64))
        .await
        .map_err(|e| format!("OCR 任务失败: {}", e))?;

    match result {
        Ok(resp) => {
            log::info!("[OCR] 完成 code={}", resp.code);
            Ok(serde_json::to_value(resp).unwrap_or_else(|_| {
                serde_json::json!({ "code": 299, "data": "序列化失败" })
            }))
        }
        Err(e) => {
            log::error!("[OCR] 失败: {}", e);
            Ok(serde_json::json!({
                "code": 299,
                "data": e
            }))
        }
    }
}

#[tauri::command]
pub async fn ocr_is_ready(state: tauri::State<'_, OcrEngine>) -> Result<bool, String> {
    Ok(state.path().exists())
}

#[tauri::command]
pub async fn ocr_engine_status(state: tauri::State<'_, OcrEngine>) -> Result<Value, String> {
    let path = state.path();
    Ok(serde_json::json!({
        "ready": path.exists(),
        "engine_path": path.to_string_lossy(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ocr_response_parse_success() {
        let json = r#"{"code":100,"data":[{"text":"hello","box":[[0,0],[1,0],[1,1],[0,1]],"score":0.99}]}"#;
        let resp: OcrResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.code, 100);
        assert!(resp.data.is_array());
    }

    #[test]
    fn test_ocr_response_parse_error() {
        let json = r#"{"code":101,"data":"image decode failed"}"#;
        let resp: OcrResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.code, 101);
    }

    #[test]
    fn test_engine_path_points_to_exe() {
        let p = get_engine_path();
        assert!(p.to_string_lossy().contains("RapidOCR-json.exe"));
    }
}
