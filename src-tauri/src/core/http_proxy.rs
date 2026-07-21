//! 前端 HTTP 代理（绕过 WebView CSP / 混合内容限制）
//!
//! 仅允许白名单域名，避免成为开放代理。

use std::time::Duration;
use tauri::AppHandle;

const ALLOWED_HOST_SUFFIXES: &[&str] = &[
    "qweather.com",
    "heweather.net",
    "api.bilibili.com",
    "search.bilibili.com",
    "hdslb.com",
    "niutrans.com",
    "open-meteo.com",
    "minimaxi.com",
    "opencode.ai",
];

fn host_allowed(host: &str) -> bool {
    let h = host.to_ascii_lowercase();
    ALLOWED_HOST_SUFFIXES.iter().any(|suf| h == *suf || h.ends_with(&format!(".{suf}")))
}

/// GET 请求并返回响应文本（JSON/HTML 均可）
#[tauri::command]
pub async fn http_proxy_get(app: AppHandle, url: String) -> Result<String, String> {
    let parsed = url::Url::parse(&url).map_err(|e| format!("URL 无效: {e}"))?;
    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("仅支持 http/https".into());
    }
    let host = parsed.host_str().ok_or_else(|| "缺少 host".to_string())?;
    if !host_allowed(host) {
        crate::core::app_log::emit(
            &app,
            "warn",
            &format!("[http_proxy] 拒绝非白名单域名: {host}"),
        );
        return Err(format!("域名不在白名单: {host}"));
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("InfoBoard/0.1")
        .build()
        .map_err(|e| format!("HTTP 客户端失败: {e}"))?;

    let resp = client
        .get(url.clone())
        .send()
        .await
        .map_err(|e| format!("请求失败: {e}"))?;

    let status = resp.status();
    let text = resp
        .text()
        .await
        .map_err(|e| format!("读取 body 失败: {e}"))?;

    if !status.is_success() {
        crate::core::app_log::emit(
            &app,
            "warn",
            &format!("[http_proxy] HTTP {} url={} body={}", status.as_u16(), url, &text[..text.len().min(200)]),
        );
        return Err(format!("HTTP {} {}", status.as_u16(), text.chars().take(120).collect::<String>()));
    }

    Ok(text)
}
