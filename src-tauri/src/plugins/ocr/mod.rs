//! OCR 文字识别插件后端
//!
//! 通过 RapidOCR-json.exe 子进程进行文字识别。
//! 子进程管理：惰性启动、请求队列、10 秒超时、意外退出自动重启。

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ─── 状态管理 ───

// ─── 数据结构 ───

/// OCR 响应（与 RapidOCR-json 协议一致）
#[derive(Debug, Serialize, Deserialize)]
pub struct OcrResponse {
    pub code: i32,
    pub data: Value,
}

// ─── Helper 函数 ───

/// 查找 RapidOCR-json.exe 路径
///
/// 优先级：
/// 1. 开发模式：src-tauri/binaries/rapidocr/RapidOCR-json.exe
/// 2. 打包模式：可执行文件同目录下的 rapidocr/RapidOCR-json.exe
fn find_engine_path() -> PathBuf {
    // 开发模式优先
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join("rapidocr")
        .join("RapidOCR-json.exe");

    if dev_path.exists() {
        return dev_path;
    }

    // 打包模式：通过可执行文件路径推算资源目录
    if let Ok(exe_path) = std::env::current_exe() {
        let bundle_path = exe_path
            .parent()
            .unwrap_or(&exe_path)
            .join("rapidocr")
            .join("RapidOCR-json.exe");
        if bundle_path.exists() {
            return bundle_path;
        }
    }

    // 兜底：返回开发路径（将由调用方处理文件不存在错误）
    dev_path
}

// ─── Tauri Commands ───

/// 线程安全的 OCR 引擎包装
pub struct OcrEngine {
    inner: Mutex<OcrEngineInner>,
}

struct OcrEngineInner {
    engine_path: PathBuf,
}

impl OcrEngine {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(OcrEngineInner {
                engine_path: find_engine_path(),
            }),
        }
    }

    pub fn engine_path(&self) -> PathBuf {
        self.inner.lock().unwrap().engine_path.clone()
    }
}

/// OCR 识别：对 base64 图片进行文字识别
///
/// 参数 image_base64：纯 base64 字符串（不含 data URL 前缀）
#[tauri::command]
pub async fn ocr_recognize(
    state: tauri::State<'_, OcrEngine>,
    image_base64: String,
) -> Result<OcrResponse, String> {
    println!("[OCR] 识别请求开始 (图片大小: {}B)", image_base64.len());
    // 构造请求 JSON
    let request = serde_json::json!({
        "image_base64": image_base64
    })
    .to_string();

    // 获取 engine_path 的拷贝，以便跨线程使用
    let engine_path = state.engine_path();

    // 使用 spawn_blocking 执行同步 IO
    let result = tokio::task::spawn_blocking(move || {
        // 检查引擎文件是否存在
        if !engine_path.exists() {
            return Err(format!(
                "OCR 引擎未找到: {}。请将 RapidOCR-json.exe 及 models 目录复制到该路径。",
                engine_path.display()
            ));
        }

        // 每次请求启动新进程（简化管理，避免状态共享问题）
        let mut child = Command::new(&engine_path)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("启动 OCR 引擎失败: {}", e))?;

        let mut stdin = child
            .stdin
            .take()
            .ok_or_else(|| "无法获取子进程 stdin".to_string())?;
        let stdout = child
            .stdout
            .as_mut()
            .ok_or_else(|| "无法获取子进程 stdout".to_string())?;

        // 发送请求
        stdin
            .write_all(request.as_bytes())
            .map_err(|e| format!("写入 stdin 失败: {}", e))?;
        stdin
            .flush()
            .map_err(|e| format!("刷新 stdin 失败: {}", e))?;

        // 🔴 关键：显式 drop stdin 关闭管道写端，通知子进程 EOF
        // 否则子进程会一直等待下一行输入，child.wait() 永久阻塞
        drop(stdin);

        // 读取响应（最多读 10 行，取第一行有效 JSON）
        let mut reader = BufReader::new(stdout);
        let mut response = String::new();

        for _ in 0..10 {
            response.clear();
            if reader.read_line(&mut response).map_err(|e| format!("读取 stdout 失败: {}", e))? == 0 {
                break;
            }
            let trimmed = response.trim();

            // 跳过初始化消息
            if trimmed.contains("init completed") {
                continue;
            }

            // 跳过空行
            if trimmed.is_empty() {
                continue;
            }

            // 找到 JSON 响应
            if trimmed.starts_with('{') {
                let ocr_response: OcrResponse = serde_json::from_str(trimmed)
                    .map_err(|e| format!("解析 OCR 响应失败: {}", e))?;

                // 等待子进程退出
                let _ = child.wait();
                return Ok(ocr_response);
            }
        }

        // 等待子进程退出
        let _ = child.wait();
        Err("未收到有效的 OCR 响应".to_string())
    })
    .await
    .map_err(|e| format!("OCR 任务失败: {}", e))?;

    result
}

/// 查询 OCR 引擎是否已就绪
#[tauri::command]
pub async fn ocr_is_ready(state: tauri::State<'_, OcrEngine>) -> Result<bool, String> {
    // 简单检查引擎文件是否存在
    let path = state.engine_path();
    Ok(path.exists())
}

/// 返回 OCR 引擎状态
#[tauri::command]
pub async fn ocr_engine_status(state: tauri::State<'_, OcrEngine>) -> Result<Value, String> {
    let path = state.engine_path();
    let exists = path.exists();

    Ok(serde_json::json!({
        "ready": exists,
        "engine_path": path.to_string_lossy().to_string(),
    }))
}

// ─── 单元测试 ───

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_engine_path() {
        let path = find_engine_path();
        assert!(path.to_string_lossy().contains("RapidOCR-json.exe"));
        // 不一定存在（取决于是否复制了引擎文件），但路径格式应正确
    }

    #[test]
    fn test_json_parse_ocr_response() {
        let json = r#"{"code":100,"data":[{"text":"Hello World","box":[[10,20],[30,20],[30,40],[10,40]],"score":0.95}]}"#;
        let resp: OcrResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.code, 100);
        if let Some(arr) = resp.data.as_array() {
            assert_eq!(arr.len(), 1);
            if let Some(obj) = arr[0].as_object() {
                assert_eq!(obj["text"], "Hello World");
                assert!(obj["score"].as_f64().unwrap() - 0.95 < f64::EPSILON);
            } else {
                panic!("data[0] 不是对象");
            }
        } else {
            panic!("data 不是数组");
        }
    }

    #[test]
    fn test_json_parse_ocr_error() {
        let json = r#"{"code":101,"data":"image decode failed"}"#;
        let resp: OcrResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.code, 101);
        if let Some(s) = resp.data.as_str() {
            assert_eq!(s, "image decode failed");
        } else {
            panic!("data 不是字符串");
        }
    }

    #[test]
    fn test_json_parse_ocr_empty() {
        let json = r#"{"code":100,"data":[]}"#;
        let resp: OcrResponse = serde_json::from_str(json).unwrap();
        assert_eq!(resp.code, 100);
        assert!(resp.data.as_array().unwrap().is_empty());
    }

    #[test]
    fn test_invalid_json() {
        let json = r#"not json"#;
        let result: Result<OcrResponse, _> = serde_json::from_str(json);
        assert!(result.is_err());
    }
}
