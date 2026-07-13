use std::time::Duration;
use serde_json::{json, Value};

#[tauri::command]
pub async fn geolocate_ip() -> Result<Value, String> {
    let mut builder = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .user_agent("InfoBoard/1.0");

    // 读取系统代理环境变量（HTTPS_PROXY / https_proxy / ALL_PROXY / all_proxy）
    let proxy_env = std::env::var("HTTPS_PROXY")
        .or_else(|_| std::env::var("https_proxy"))
        .or_else(|_| std::env::var("ALL_PROXY"))
        .or_else(|_| std::env::var("all_proxy"))
        .ok()
        .filter(|s| !s.is_empty());

    if let Some(proxy_url) = &proxy_env {
        match reqwest::Proxy::https(proxy_url) {
            Ok(proxy) => {
                builder = builder.proxy(proxy);
                eprintln!("[geolocate] 使用代理: {proxy_url}");
            }
            Err(e) => {
                eprintln!("[geolocate] 代理配置失败，跳过代理: {e}");
            }
        }
    } else {
        eprintln!("[geolocate] 未检测到代理环境变量");
    }

    let client = builder.build()
        .map_err(|e| format!("HTTP 客户端创建失败: {e}"))?;

    let url = "https://ip-api.com/json/?fields=status,message,country,regionName,city,lat,lon";
    let resp = client
        .get(url)
        .send()
        .await
        .map_err(|e| format!("IP 定位请求失败 (代理={}): {e}", proxy_env.as_deref().unwrap_or("无")))?;

    if !resp.status().is_success() {
        return Err(format!("IP 定位 HTTP {}", resp.status().as_u16()));
    }

    let raw: Value = resp.json::<Value>()
        .await
        .map_err(|e| format!("解析失败: {e}"))?;

    if raw.get("status").and_then(|s| s.as_str()) != Some("success") {
        let msg = raw.get("message").and_then(|m| m.as_str()).unwrap_or("未知错误");
        return Err(format!("IP 定位失败: {msg}"));
    }

    // 统一字段名（ip-api.com → 前端期望的格式）
    Ok(json!({
        "latitude": raw["lat"],
        "longitude": raw["lon"],
        "city": raw["city"],
        "region": raw["regionName"],
        "country_name": raw["country"],
    }))
}
