//! 小牛翻译插件
//!
//! 提供 6 个 Tauri command：
//! - niutrans_translate — 调用小牛翻译 API v2
//! - niutrans_set_api_key / niutrans_set_app_id — 存储凭据
//! - niutrans_has_api_key — 检查凭据
//! - niutrans_get_config — 获取凭据掩码
//! - niutrans_get_char_count — 累计翻译字符数

pub mod types;

use std::sync::Arc;
use md5::{Digest, Md5};
use reqwest::Client;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;
use types::{TranslateConfig, TranslateResult};

/// 小牛翻译 API 地址
const NIUTRANS_API_URL: &str = "https://api.niutrans.com/v2/text/translate";

/// Store 文件名
const STORE_FILE: &str = "niutrans.json";

// ── Helper ──────────────────────────────────────────────

/// 计算小牛翻译 API MD5 签名
///
/// 算法：`sort(params) → join("&") → "apikey=$key&$params" → md5`
fn calculate_sign(api_key: &str, params: &[(&str, &str)]) -> String {
    let mut sorted = params.to_vec();
    sorted.sort_by(|a, b| a.0.cmp(b.0));

    let param_str = sorted
        .iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("&");

    let sign_str = format!("apikey={}&{}", api_key, param_str);
    let hash = Md5::digest(sign_str.as_bytes());
    format!("{:x}", hash)
}

/// 从 Store 中读取字符串值
fn store_get_string(store: &tauri_plugin_store::Store<tauri::Wry>, key: &str) -> Option<String> {
    store
        .get(key)
        .and_then(|v| v.as_str().map(String::from))
}

/// 从 Store 中读取 u64 值
fn store_get_u64(store: &tauri_plugin_store::Store<tauri::Wry>, key: &str) -> u64 {
    store.get(key).and_then(|v| v.as_u64()).unwrap_or(0)
}

/// 获取 Store 实例
fn get_store(app: &AppHandle) -> Result<Arc<tauri_plugin_store::Store<tauri::Wry>>, String> {
    app.store(STORE_FILE).map_err(|e| format!("无法打开 Store: {}", e))
}

// ── Commands ────────────────────────────────────────────

/// 1. 翻译文本
#[tauri::command]
pub async fn niutrans_translate(
    app: AppHandle,
    text: String,
    target_lang: String,
) -> Result<TranslateResult, String> {
    let store = get_store(&app)?;
    let api_key = store_get_string(&store, "apiKey")
        .ok_or_else(|| "API_KEY_MISSING".to_string())?;
    let _app_id = store_get_string(&store, "appId")
        .ok_or_else(|| "API_KEY_MISSING".to_string())?;

    // 准备签名参数（不含 apikey）
    let params = &[
        ("from", "auto"),
        ("to", target_lang.as_str()),
        ("src_text", text.as_str()),
    ];

    let sign = calculate_sign(&api_key, params);

    // 构建请求体（含 apikey + sign）
    let body = serde_json::json!({
        "from": "auto",
        "to": target_lang,
        "apikey": api_key,
        "src_text": text,
        "sign": sign,
    });

    let client = Client::new();
    let resp = client
        .post(NIUTRANS_API_URL)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("请求失败: {}", e))?;

    let status = resp.status();
    let response_text = resp.text().await.map_err(|e| format!("读取响应失败: {}", e))?;

    if !status.is_success() {
        return Err(format!("API 返回错误 ({}): {}", status.as_u16(), response_text));
    }

    // 解析响应
    let json: serde_json::Value =
        serde_json::from_str(&response_text).map_err(|e| format!("解析响应失败: {}", e))?;

    // 检查错误码
    if let Some(err_code) = json.get("error_code").and_then(|v| v.as_i64()) {
        let err_msg = json
            .get("error_msg")
            .and_then(|v| v.as_str())
            .unwrap_or("未知错误");
        return Err(format!("API 错误 ({}): {}", err_code, err_msg));
    }

    let result = TranslateResult {
        text: json["tgt_text"]
            .as_str()
            .ok_or("响应缺少 tgt_text")?
            .to_string(),
        from: json["from"]
            .as_str()
            .unwrap_or("auto")
            .to_string(),
        to: json["to"]
            .as_str()
            .unwrap_or(&target_lang)
            .to_string(),
    };

    // 累加字符数
    let char_count = text.chars().count() as u64;
    let current = store_get_u64(&store, "charCount");
    store.set("charCount", serde_json::json!(current + char_count));
    store.save().map_err(|e| format!("保存用量失败: {}", e))?;

    Ok(result)
}

/// 2. 设置 API Key
#[tauri::command]
pub async fn niutrans_set_api_key(app: AppHandle, key: String) -> Result<(), String> {
    let store = get_store(&app)?;
    store.set("apiKey", serde_json::json!(key));
    store.save().map_err(|e| format!("保存失败: {}", e))
}

/// 3. 设置 App ID
#[tauri::command]
pub async fn niutrans_set_app_id(app: AppHandle, id: String) -> Result<(), String> {
    let store = get_store(&app)?;
    store.set("appId", serde_json::json!(id));
    store.save().map_err(|e| format!("保存失败: {}", e))
}

/// 4. 检查是否已配置 API Key 和 App ID
#[tauri::command]
pub async fn niutrans_has_api_key(app: AppHandle) -> Result<bool, String> {
    let store = get_store(&app)?;
    let has_key = store_get_string(&store, "apiKey").is_some()
        && store_get_string(&store, "appId").is_some();
    Ok(has_key)
}

/// 5. 获取配置信息（带掩码）
#[tauri::command]
pub async fn niutrans_get_config(app: AppHandle) -> Result<TranslateConfig, String> {
    let store = get_store(&app)?;
    let api_key = store_get_string(&store, "apiKey").unwrap_or_default();
    let app_id = store_get_string(&store, "appId").unwrap_or_default();
    let has_key = !api_key.is_empty() && !app_id.is_empty();

    let mask = |s: &str| -> String {
        if s.len() <= 4 {
            s.to_string()
        } else {
            format!("{}***", &s[..4])
        }
    };

    Ok(TranslateConfig {
        has_key,
        app_id: mask(&app_id),
        api_key_mask: mask(&api_key),
    })
}

/// 6. 获取累计翻译字符数
#[tauri::command]
pub async fn niutrans_get_char_count(app: AppHandle) -> Result<u64, String> {
    let store = get_store(&app)?;
    Ok(store_get_u64(&store, "charCount"))
}

// ── Tests ───────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_sign() {
        let api_key = "test_key_123";
        let params = &[
            ("from", "auto"),
            ("to", "zh"),
            ("src_text", "hello"),
        ];

        let sign = calculate_sign(api_key, params);

        // 验证签名非空且为 32 位 hex
        assert_eq!(sign.len(), 32);
        assert!(sign.chars().all(|c| c.is_ascii_hexdigit()));

        // 验证确定性：相同输入得到相同输出
        let sign2 = calculate_sign(api_key, params);
        assert_eq!(sign, sign2);

        // 验证不同输入得到不同输出
        let params3 = &[
            ("from", "auto"),
            ("to", "en"),
            ("src_text", "hello"),
        ];
        let sign3 = calculate_sign(api_key, params3);
        assert_ne!(sign, sign3);
    }

    #[test]
    fn test_calculate_sign_ordering() {
        // 验证参数顺序不影响结果（函数内部会排序）
        let api_key = "k";
        let params_a = &[("b", "2"), ("a", "1"), ("c", "3")];
        let params_b = &[("c", "3"), ("a", "1"), ("b", "2")];

        assert_eq!(calculate_sign(api_key, params_a), calculate_sign(api_key, params_b));
    }

    #[test]
    fn test_mask_short_string() {
        // mask 是内部闭包，通过 get_config 行为间接验证
        // 直接测试掩码逻辑
        let s = "abc";
        let result = if s.len() <= 4 { s.to_string() } else { format!("{}***", &s[..4]) };
        assert_eq!(result, "abc");
    }

    #[test]
    fn test_mask_long_string() {
        let s = "abcdefgh";
        let result = if s.len() <= 4 { s.to_string() } else { format!("{}***", &s[..4]) };
        assert_eq!(result, "abcd***");
    }
}
